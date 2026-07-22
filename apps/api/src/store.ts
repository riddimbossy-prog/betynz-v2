import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import demoMatches from '../data/demo-matches.json' with { type: 'json' };
import type { NormalizedMatch } from './types.js';

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
  const { data, error } = await supabase.from('matches_api').select('*').limit(10000);
  if (error) throw error;
  return (data ?? []).map(dbToApi);
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
