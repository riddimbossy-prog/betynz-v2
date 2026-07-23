import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import demoMatches from '../data/demo-matches.json' with { type: 'json' };
import type { NormalizedMatch } from './types.js';
import type { PredictionRecord, UpcomingFixture } from './forecast-types.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

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
    .gte('match_date', from)
    .lte('match_date', to)
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map(dbToPrediction);
}

export async function updatePredictionSettlement(fixtureId: string, status: 'won' | 'lost' | 'void') {
  if (!supabase) return;
  const { error } = await supabase
    .from('predictions')
    .update({ settled_status: status, settled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('fixture_id', fixtureId);
  if (error) throw error;
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
    risk: row.risk,
    explanation: Array.isArray(row.explanation) ? row.explanation : [],
    summary: row.summary,
    evidence: row.evidence ?? {},
    engines: Array.isArray(row.engines) ? row.engines : [],
    settledStatus: row.settled_status ?? 'pending',
    settledAt: row.settled_at ?? undefined
  };
}
