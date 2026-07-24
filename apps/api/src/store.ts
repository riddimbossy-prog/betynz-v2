import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import demoMatches from '../data/demo-matches.json' with { type: 'json' };
import type { NormalizedMatch } from './types.js';
import type { PredictionRecord, RejectedBattle, UpcomingFixture } from './forecast-types.js';
import type { ConfrontationRecord, TeamStreakSnapshot } from './streak-intelligence.js';
import { teamKey } from './identity.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
const demoRejectedBattles: RejectedBattle[] = [];
const demoStreakSnapshots: TeamStreakSnapshot[] = [];

function isMissingOptionalIntelligenceTable(error: unknown) {
  const value = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const text = `${value?.code ?? ''} ${value?.message ?? ''} ${value?.details ?? ''} ${value?.hint ?? ''}`.toLowerCase();
  return value?.code === '42P01'
    || value?.code === 'PGRST205'
    || ((text.includes('streak_snapshots') || text.includes('confrontation_records') || text.includes('rejected_battles'))
      && (text.includes('does not exist') || text.includes('schema cache') || text.includes('could not find')));
}

function warnOptionalIntelligenceFallback(table: string, error: unknown) {
  const value = error as { message?: string } | null;
  console.warn(`[Betynz] Optional ${table} table is unavailable. Predictions will continue with computed-history intelligence. ${value?.message ?? ''}`.trim());
}

export function sourceName() {
  return supabase ? 'supabase' as const : 'demo' as const;
}

export async function listMatches(limit = 50, offset = 0, leagueCode?: string, season?: string): Promise<NormalizedMatch[]> {
  if (!supabase) {
    return (demoMatches as NormalizedMatch[])
      .filter((m) => (!leagueCode || m.leagueCode === leagueCode) && (!season || m.season === season))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(offset, offset + limit);
  }

  let query = supabase.from('matches_api').select('*').order('date', { ascending: false }).range(offset, offset + limit - 1);
  if (leagueCode) query = query.eq('league_code', leagueCode);
  if (season) query = query.eq('season', season);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(dbToApi);
}

export async function allMatches(): Promise<NormalizedMatch[]> {
  if (!supabase) return demoMatches as NormalizedMatch[];
  const rows: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await supabase.from('matches_api').select('*').range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(dbToApi);
}

export async function upsertMatches(matches: NormalizedMatch[]) {
  if (!supabase) throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const rows = matches.map((m) => ({
    external_id: m.id,
    league_code: m.leagueCode,
    league_name: m.leagueName,
    season: m.season,
    date: m.date,
    kickoff_time: m.time ?? null,
    home_team: m.homeTeam,
    away_team: m.awayTeam,
    home_goals: m.homeGoals,
    away_goals: m.awayGoals,
    ht_home_goals: m.halfTimeHomeGoals ?? null,
    ht_away_goals: m.halfTimeAwayGoals ?? null,
    result: m.result,
    stats: m.stats ?? {},
    odds: m.odds,
    source: 'football-data.co.uk'
  }));
  const chunk = 300;
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from('matches').upsert(rows.slice(i, i + chunk), { onConflict: 'external_id' });
    if (error) throw error;
  }
  return rows.length;
}

export async function upsertUpcomingFixtures(fixtures: UpcomingFixture[]) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const rows = fixtures.map((fixture) => ({
    external_id: fixture.id,
    provider_fixture_id: fixture.providerFixtureId,
    provider: fixture.provider ?? 'api-football',
    provider_url: fixture.providerUrl ?? null,
    odds_source: fixture.oddsSource ?? fixture.provider ?? 'unknown',
    data_quality: fixture.dataQuality ?? 60,
    league_id: fixture.leagueId,
    league_code: fixture.leagueCode,
    league_name: fixture.leagueName,
    country: fixture.country,
    season: fixture.season,
    kickoff: fixture.kickoff,
    match_date: fixture.date,
    status: fixture.status,
    venue: fixture.venue ?? null,
    home_team_id: fixture.homeTeamId ?? null,
    away_team_id: fixture.awayTeamId ?? null,
    home_team: fixture.homeTeam,
    away_team: fixture.awayTeam,
    odds: fixture.odds,
    raw_odds: fixture.rawOdds ?? null,
    updated_at: new Date().toISOString()
  }));
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await supabase.from('upcoming_fixtures').upsert(rows.slice(i, i + 250), { onConflict: 'external_id' });
    if (error) throw error;
  }
  return rows.length;
}

export async function listUpcomingFixtures(from: string, to: string): Promise<UpcomingFixture[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('upcoming_fixtures')
    .select('*')
    .gte('match_date', from)
    .lte('match_date', to)
    .order('kickoff', { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map(dbToUpcoming);
}

export async function upsertPredictions(predictions: PredictionRecord[]) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const rows = predictions.map((prediction) => ({
    fixture_id: prediction.fixtureId,
    engine_version: prediction.engineVersion,
    run_at: prediction.runAt,
    match_date: prediction.date,
    kickoff: prediction.kickoff,
    league_code: prediction.leagueCode,
    league_name: prediction.leagueName,
    country: prediction.country,
    home_team: prediction.homeTeam,
    away_team: prediction.awayTeam,
    market_key: prediction.marketKey,
    market_label: prediction.marketLabel,
    selection: prediction.selection,
    odds: prediction.odds,
    original_market_key: prediction.originalMarketKey ?? null,
    original_market_label: prediction.originalMarketLabel ?? null,
    original_odds: prediction.originalOdds ?? null,
    upgraded: prediction.upgraded,
    probability: prediction.probability,
    confidence: prediction.confidence,
    edge: prediction.edge,
    sample: prediction.sample,
    banker: prediction.banker,
    tier: prediction.tier,
    qualification: prediction.qualification,
    risk: prediction.risk,
    explanation: prediction.explanation,
    summary: prediction.summary,
    evidence: prediction.evidence,
    engines: prediction.engines,
    settled_status: prediction.settledStatus ?? 'pending',
    settled_at: prediction.settledAt ?? null
  }));
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await supabase.from('predictions').upsert(rows.slice(i, i + 250), { onConflict: 'fixture_id,engine_version' });
    if (error) throw error;
  }
  return rows.length;
}


export async function clearPredictionsForWindow(from: string, to: string, engineVersion: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('predictions')
    .delete()
    .eq('engine_version', engineVersion)
    .gte('match_date', from)
    .lte('match_date', to);
  if (error) throw error;
}

export async function listPredictions(from: string, to: string, bankerOnly = false): Promise<PredictionRecord[]> {
  if (!supabase) return [];
  let query = supabase
    .from('predictions')
    .select('*')
    .gte('match_date', from)
    .lte('match_date', to)
    .order('kickoff', { ascending: true })
    .limit(5000);
  if (bankerOnly) query = query.eq('banker', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(dbToPrediction);
}


export async function listPendingPredictions(from: string, to: string): Promise<PredictionRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('settled_status', 'pending')
    .neq('qualification', 'ARES_WATCHLIST')
    .gte('match_date', from)
    .lte('match_date', to)
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map(dbToPrediction);
}

export async function updatePredictionSettlement(
  fixtureId: string,
  status: 'won' | 'lost' | 'void',
  engineVersion?: string
) {
  if (!supabase) return;
  let query = supabase
    .from('predictions')
    .update({ settled_status: status, settled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('fixture_id', fixtureId);
  if (engineVersion) query = query.eq('engine_version', engineVersion);
  const { error } = await query;
  if (error) throw error;
}



function mergeStreakSnapshots(existing: TeamStreakSnapshot, incoming: TeamStreakSnapshot): TeamStreakSnapshot {
  const incomingHasStreaks = Object.values(incoming.streaks).some((value) => Number(value) > 0);
  const incomingHasHtFt = incoming.htft.sample > 0 || Object.keys(incoming.htft.combinations ?? {}).length > 0;
  return {
    ...existing,
    ...incoming,
    providerUrl: incoming.providerUrl || existing.providerUrl,
    sample: Math.max(existing.sample, incoming.sample),
    streaks: incomingHasStreaks ? incoming.streaks : existing.streaks,
    adjusted: incomingHasStreaks ? incoming.adjusted : existing.adjusted,
    htft: incomingHasHtFt ? incoming.htft : existing.htft
  };
}

function streakSnapshotKey(snapshot: TeamStreakSnapshot) {
  return `${snapshot.snapshotDate}|${snapshot.leagueCode}|${snapshot.season}|${teamKey(snapshot.team)}|${snapshot.scope}|${snapshot.source}`;
}

export async function upsertStreakSnapshots(snapshots: TeamStreakSnapshot[]) {
  const unique = new Map<string, TeamStreakSnapshot>();
  for (const snapshot of snapshots) {
    const key = streakSnapshotKey(snapshot);
    const current = unique.get(key);
    unique.set(key, current ? mergeStreakSnapshots(current, snapshot) : snapshot);
  }
  let values = [...unique.values()];
  if (!supabase) {
    for (const snapshot of values) {
      const index = demoStreakSnapshots.findIndex((item) => streakSnapshotKey(item) === streakSnapshotKey(snapshot));
      if (index >= 0) demoStreakSnapshots[index] = mergeStreakSnapshots(demoStreakSnapshots[index], snapshot);
      else demoStreakSnapshots.push(snapshot);
    }
    return values.length;
  }

  // A league can expose streaks and HT/FT on separate tabs. Merge with the
  // previously saved row so one page cannot erase intelligence from another.
  const merged = new Map<string, TeamStreakSnapshot>();
  const groups = new Map<string, TeamStreakSnapshot[]>();
  for (const snapshot of values) {
    const key = `${snapshot.snapshotDate}|${snapshot.leagueCode}|${snapshot.season}|${snapshot.source}`;
    const group = groups.get(key) ?? [];
    group.push(snapshot);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const example = group[0];
    const { data, error } = await supabase
      .from('streak_snapshots')
      .select('*')
      .eq('snapshot_date', example.snapshotDate)
      .eq('league_code', example.leagueCode)
      .eq('season', example.season)
      .eq('source', example.source);
    if (error) {
      if (isMissingOptionalIntelligenceTable(error)) {
        warnOptionalIntelligenceFallback('streak_snapshots', error);
        return 0;
      }
      throw error;
    }
    for (const row of data ?? []) {
      const snapshot = dbToStreakSnapshot(row);
      merged.set(streakSnapshotKey(snapshot), snapshot);
    }
    for (const snapshot of group) {
      const key = streakSnapshotKey(snapshot);
      const current = merged.get(key);
      merged.set(key, current ? mergeStreakSnapshots(current, snapshot) : snapshot);
    }
  }
  values = [...merged.values()];

  const rows = values.map((snapshot) => ({
    snapshot_date: snapshot.snapshotDate,
    source: snapshot.source,
    provider_url: snapshot.providerUrl ?? null,
    league_code: snapshot.leagueCode,
    league_name: snapshot.leagueName,
    country: snapshot.country,
    season: snapshot.season,
    team: snapshot.team,
    team_key: teamKey(snapshot.team),
    scope: snapshot.scope,
    matches_sample: snapshot.sample,
    streaks: snapshot.streaks,
    opponent_adjusted: snapshot.adjusted,
    htft: snapshot.htft,
    updated_at: new Date().toISOString()
  }));
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await supabase.from('streak_snapshots').upsert(rows.slice(i, i + 250), {
      onConflict: 'snapshot_date,league_code,season,team_key,scope,source'
    });
    if (error) {
      if (isMissingOptionalIntelligenceTable(error)) {
        warnOptionalIntelligenceFallback('streak_snapshots', error);
        return 0;
      }
      throw error;
    }
  }
  return rows.length;
}


export async function listStreakSnapshots(from: string, to: string): Promise<TeamStreakSnapshot[]> {
  if (!supabase) {
    return demoStreakSnapshots
      .filter((snapshot) => snapshot.snapshotDate >= from && snapshot.snapshotDate <= to)
      .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate));
  }
  const rows: any[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const { data, error } = await supabase
      .from('streak_snapshots')
      .select('*')
      .gte('snapshot_date', from)
      .lte('snapshot_date', to)
      .order('snapshot_date', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (isMissingOptionalIntelligenceTable(error)) {
        warnOptionalIntelligenceFallback('streak_snapshots', error);
        return [];
      }
      throw error;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(dbToStreakSnapshot);
}

export async function upsertConfrontationRecords(records: ConfrontationRecord[]) {
  if (!records.length) return 0;
  if (!supabase) return records.length;
  const rows = records.map((record) => ({
    fixture_id: record.fixtureId,
    engine_version: record.engineVersion,
    generated_at: record.generatedAt,
    match_date: record.matchDate,
    league_code: record.leagueCode,
    league_name: record.leagueName,
    country: record.country,
    home_team: record.homeTeam,
    away_team: record.awayTeam,
    strongest_signal: record.strongestSignal,
    score: record.score,
    compatible: record.compatible,
    signals: record.signals,
    home_snapshot: record.homeSnapshot,
    away_snapshot: record.awaySnapshot,
    updated_at: new Date().toISOString()
  }));
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await supabase.from('confrontation_records').upsert(rows.slice(i, i + 250), {
      onConflict: 'fixture_id,engine_version'
    });
    if (error) {
      if (isMissingOptionalIntelligenceTable(error)) {
        warnOptionalIntelligenceFallback('confrontation_records', error);
        return 0;
      }
      throw error;
    }
  }
  return rows.length;
}

export async function replaceRejectedBattles(from: string, to: string, engineVersion: string, records: RejectedBattle[]) {
  if (!supabase) {
    for (let i = demoRejectedBattles.length - 1; i >= 0; i -= 1) {
      const row = demoRejectedBattles[i];
      if (row.engineVersion === engineVersion && row.date >= from && row.date <= to) demoRejectedBattles.splice(i, 1);
    }
    demoRejectedBattles.push(...records);
    return records.length;
  }
  const { error: deleteError } = await supabase
    .from('rejected_battles')
    .delete()
    .eq('engine_version', engineVersion)
    .gte('match_date', from)
    .lte('match_date', to);
  if (deleteError) {
    if (isMissingOptionalIntelligenceTable(deleteError)) {
      warnOptionalIntelligenceFallback('rejected_battles', deleteError);
      return 0;
    }
    throw deleteError;
  }
  const rows = records.map((record) => ({
    fixture_id: record.fixtureId,
    engine_version: record.engineVersion,
    run_at: record.runAt,
    match_date: record.date,
    kickoff: record.kickoff,
    league_code: record.leagueCode,
    league_name: record.leagueName,
    country: record.country,
    home_team: record.homeTeam,
    away_team: record.awayTeam,
    rejection_stage: record.rejectionStage,
    top_market: record.topMarket,
    top_odds: record.topOdds,
    reasons: record.reasons,
    candidates: record.candidates,
    evidence: record.evidence
  }));
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await supabase.from('rejected_battles').upsert(rows.slice(i, i + 250), {
      onConflict: 'fixture_id,engine_version'
    });
    if (error) {
      if (isMissingOptionalIntelligenceTable(error)) {
        warnOptionalIntelligenceFallback('rejected_battles', error);
        return 0;
      }
      throw error;
    }
  }
  return rows.length;
}

export async function listRejectedBattles(from: string, to: string, limit = 500, engineVersion?: string): Promise<RejectedBattle[]> {
  if (!supabase) {
    return demoRejectedBattles
      .filter((row) => row.date >= from && row.date <= to && (!engineVersion || row.engineVersion === engineVersion))
      .sort((a, b) => b.runAt.localeCompare(a.runAt))
      .slice(0, limit);
  }
  let query = supabase
    .from('rejected_battles')
    .select('*')
    .gte('match_date', from)
    .lte('match_date', to)
    .order('run_at', { ascending: false })
    .limit(limit);
  if (engineVersion) query = query.eq('engine_version', engineVersion);
  const { data, error } = await query;
  if (error) {
    if (isMissingOptionalIntelligenceTable(error)) {
      warnOptionalIntelligenceFallback('rejected_battles', error);
      return [];
    }
    throw error;
  }
  return (data ?? []).map((row: any) => ({
    fixtureId: row.fixture_id,
    engineVersion: row.engine_version,
    runAt: row.run_at,
    date: row.match_date,
    kickoff: row.kickoff,
    leagueCode: row.league_code,
    leagueName: row.league_name,
    country: row.country ?? '',
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    rejectionStage: row.rejection_stage,
    topMarket: row.top_market ?? null,
    topOdds: row.top_odds == null ? null : Number(row.top_odds),
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    candidates: Array.isArray(row.candidates) ? row.candidates : [],
    evidence: row.evidence ?? {}
  }));
}


function dbToStreakSnapshot(row: any): TeamStreakSnapshot {
  return {
    snapshotDate: row.snapshot_date,
    source: row.source === 'betexplorer' ? 'betexplorer' : 'computed-history',
    providerUrl: row.provider_url ?? undefined,
    leagueCode: row.league_code,
    leagueName: row.league_name,
    country: row.country ?? '',
    season: row.season,
    team: row.team,
    scope: row.scope,
    sample: Number(row.matches_sample ?? 0),
    streaks: row.streaks ?? {},
    adjusted: row.opponent_adjusted ?? { ...(row.streaks ?? {}), opponentStrength: 1.25 },
    htft: row.htft ?? {
      sample: 0,
      firstHalfLeadRate: 0,
      firstHalfDrawRate: 0,
      firstHalfTrailRate: 0,
      leadToWinRate: 0,
      drawToWinRate: 0,
      trailToAvoidLossRate: 0,
      combinations: {}
    }
  };
}

function dbToApi(row: any): NormalizedMatch {
  return {
    id: row.external_id,
    leagueCode: row.league_code,
    leagueName: row.league_name,
    season: row.season,
    date: row.date,
    time: row.kickoff_time ?? undefined,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    halfTimeHomeGoals: row.ht_home_goals ?? undefined,
    halfTimeAwayGoals: row.ht_away_goals ?? undefined,
    result: row.result,
    stats: row.stats ?? {},
    odds: row.odds ?? {}
  };
}

function dbToUpcoming(row: any): UpcomingFixture {
  return {
    id: row.external_id,
    providerFixtureId: Number(row.provider_fixture_id),
    provider: row.provider ?? 'api-football',
    providerUrl: row.provider_url ?? undefined,
    oddsSource: row.odds_source ?? undefined,
    dataQuality: row.data_quality == null ? undefined : Number(row.data_quality),
    leagueId: Number(row.league_id ?? 0),
    leagueCode: row.league_code,
    leagueName: row.league_name,
    country: row.country ?? '',
    season: row.season,
    kickoff: row.kickoff,
    date: row.match_date,
    status: row.status,
    venue: row.venue ?? undefined,
    homeTeamId: row.home_team_id ?? undefined,
    awayTeamId: row.away_team_id ?? undefined,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    odds: row.odds ?? {},
    rawOdds: row.raw_odds ?? undefined,
    updatedAt: row.updated_at
  };
}

function dbToPrediction(row: any): PredictionRecord {
  return {
    fixtureId: row.fixture_id,
    engineVersion: row.engine_version,
    runAt: row.run_at,
    date: row.match_date,
    kickoff: row.kickoff,
    leagueCode: row.league_code,
    leagueName: row.league_name,
    country: row.country ?? '',
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    marketKey: row.market_key,
    marketLabel: row.market_label,
    selection: row.selection,
    odds: Number(row.odds),
    originalMarketKey: row.original_market_key ?? undefined,
    originalMarketLabel: row.original_market_label ?? undefined,
    originalOdds: row.original_odds == null ? undefined : Number(row.original_odds),
    upgraded: Boolean(row.upgraded),
    probability: Number(row.probability),
    confidence: Number(row.confidence),
    edge: Number(row.edge),
    sample: Number(row.sample),
    banker: Boolean(row.banker),
    tier: row.tier === 'provisional' ? 'provisional' : 'full',
    qualification: row.qualification ?? (row.tier === 'provisional' ? 'PROVISIONAL_GLOBAL_ODDS' : 'FULL_CHRONOS'),
    risk: row.risk,
    explanation: Array.isArray(row.explanation) ? row.explanation : [],
    summary: row.summary,
    evidence: row.evidence ?? {},
    engines: Array.isArray(row.engines) ? row.engines : [],
    settledStatus: row.settled_status ?? 'pending',
    settledAt: row.settled_at ?? undefined
  };
}
