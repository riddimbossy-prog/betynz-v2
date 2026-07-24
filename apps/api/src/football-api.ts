import { createHash } from 'node:crypto';
import type { UpcomingFixture, UpcomingOdds } from './forecast-types.js';
import type { NormalizedMatch } from './types.js';

const API_BASE = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

function apiKey() {
  const key = process.env.API_FOOTBALL_KEY?.trim();
  if (!key) throw new Error('API_FOOTBALL_KEY is not configured on Render.');
  return key;
}

async function apiGet(path: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'x-apisports-key': apiKey(),
      'user-agent': 'Betynz-Forecast-Engine/2.0'
    }
  });
  if (!response.ok) throw new Error(`API-Football request failed with ${response.status}`);
  const payload = await response.json() as any;
  if (payload.errors && Object.keys(payload.errors).length) {
    throw new Error(`API-Football error: ${JSON.stringify(payload.errors)}`);
  }
  return payload;
}

const clean = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9.+-]/g, '');
const toOdd = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : undefined;
};

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(3));
}

function push(map: Map<keyof UpcomingOdds, number[]>, key: keyof UpcomingOdds, value: unknown) {
  const odd = toOdd(value);
  if (!odd) return;
  const list = map.get(key) ?? [];
  list.push(odd);
  map.set(key, list);
}

function parseBet(map: Map<keyof UpcomingOdds, number[]>, betName: string, values: any[]) {
  const name = clean(betName);
  for (const item of values ?? []) {
    const valueRaw = String(item?.value ?? '');
    const value = clean(valueRaw);
    const odd = item?.odd;

    if (name === 'matchwinner' || name === '1x2' || name === 'winner') {
      if (['home', '1'].includes(value)) push(map, 'home', odd);
      if (['draw', 'x'].includes(value)) push(map, 'draw', odd);
      if (['away', '2'].includes(value)) push(map, 'away', odd);
    }

    if (name.includes('doublechance')) {
      if (['homedraw', '1x'].includes(value)) push(map, 'dc1x', odd);
      if (['homeaway', '12'].includes(value)) push(map, 'dc12', odd);
      if (['drawaway', 'x2'].includes(value)) push(map, 'dcx2', odd);
    }

    if (name.includes('drawnobet')) {
      if (['home', '1'].includes(value)) push(map, 'homeDnb', odd);
      if (['away', '2'].includes(value)) push(map, 'awayDnb', odd);
    }

    const isGoals = name.includes('goalsoverunder') || name.includes('totalgoals') || name === 'goals';
    if (isGoals && !name.includes('home') && !name.includes('away') && !name.includes('team')) {
      if (value.includes('over1.5') || value === 'over15') push(map, 'over15', odd);
      if (value.includes('under1.5') || value === 'under15') push(map, 'under15', odd);
      if (value.includes('over2.5') || value === 'over25') push(map, 'over25', odd);
      if (value.includes('under2.5') || value === 'under25') push(map, 'under25', odd);
      if (value.includes('over3.5') || value === 'over35') push(map, 'over35', odd);
      if (value.includes('under3.5') || value === 'under35') push(map, 'under35', odd);
    }

    const homeTotal = (name.includes('home') && (name.includes('total') || name.includes('goals') || name.includes('overunder')) && !name.includes('away')) || name.includes('totalhome');
    if (homeTotal) {
      if (value.includes('over0.5') || value === 'over05') push(map, 'homeOver05', odd);
      if (value.includes('under0.5') || value === 'under05') push(map, 'homeUnder05', odd);
      if (value.includes('over1.5') || value === 'over15') push(map, 'homeOver15', odd);
      if (value.includes('under1.5') || value === 'under15') push(map, 'homeUnder15', odd);
    }

    const awayTotal = (name.includes('away') && (name.includes('total') || name.includes('goals') || name.includes('overunder')) && !name.includes('home')) || name.includes('totalaway');
    if (awayTotal) {
      if (value.includes('over0.5') || value === 'over05') push(map, 'awayOver05', odd);
      if (value.includes('under0.5') || value === 'under05') push(map, 'awayUnder05', odd);
      if (value.includes('over1.5') || value === 'over15') push(map, 'awayOver15', odd);
      if (value.includes('under1.5') || value === 'under15') push(map, 'awayUnder15', odd);
    }
  }
}

function parseOddsResponse(payload: any) {
  const byFixture = new Map<number, UpcomingOdds>();
  for (const responseItem of payload?.response ?? []) {
    const fixtureId = Number(responseItem?.fixture?.id);
    if (!fixtureId) continue;
    const buckets = new Map<keyof UpcomingOdds, number[]>();
    for (const bookmaker of responseItem?.bookmakers ?? []) {
      for (const bet of bookmaker?.bets ?? []) parseBet(buckets, String(bet?.name ?? ''), bet?.values ?? []);
    }
    const odds: UpcomingOdds = {};
    for (const [key, values] of buckets) {
      const value = median(values);
      if (value) odds[key] = value;
    }
    byFixture.set(fixtureId, odds);
  }
  return byFixture;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  const end = new Date(`${to}T12:00:00Z`);
  for (const cursor = new Date(`${from}T12:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(isoDate(cursor));
  }
  return dates;
}

function buildId(providerFixtureId: number) {
  return createHash('sha1').update(`api-football|${providerFixtureId}`).digest('hex').slice(0, 20);
}

function seasonLabel(season: unknown) {
  const value = String(season ?? '');
  if (/^\d{4}$/.test(value)) return value;
  return value || 'unknown';
}

async function fetchOddsForDate(date: string) {
  const combined = new Map<number, UpcomingOdds>();
  let page = 1;
  let totalPages = 1;
  const maxPages = Math.max(1, Math.min(100, Number(process.env.API_FOOTBALL_MAX_ODDS_PAGES || 50)));
  do {
    const payload = await apiGet(`/odds?date=${encodeURIComponent(date)}&page=${page}`);
    for (const [fixtureId, odds] of parseOddsResponse(payload)) combined.set(fixtureId, odds);
    totalPages = Number(payload?.paging?.total ?? 1);
    page += 1;
  } while (page <= Math.min(totalPages, maxPages));
  return combined;
}

export async function fetchUpcomingFixtures(from: string, to: string): Promise<UpcomingFixture[]> {
  const configuredLeagueIds = (process.env.API_FOOTBALL_LEAGUE_IDS || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean);

  const fixtureResponses: any[] = [];
  if (configuredLeagueIds.length) {
    for (const leagueId of configuredLeagueIds) {
      const season = process.env.API_FOOTBALL_SEASON?.trim();
      const seasonPart = season ? `&season=${encodeURIComponent(season)}` : '';
      const payload = await apiGet(`/fixtures?league=${encodeURIComponent(leagueId)}${seasonPart}&from=${from}&to=${to}&timezone=UTC`);
      fixtureResponses.push(...(payload?.response ?? []));
    }
  } else {
    // API-Football's reliable all-league discovery path is one calendar date at a time.
    // A bare from/to query can be rejected or return no data when no league is supplied.
    const timezone = process.env.API_FOOTBALL_TIMEZONE?.trim() || process.env.PREDICTION_TIMEZONE?.trim() || 'Africa/Accra';
    for (const date of datesBetween(from, to)) {
      const payload = await apiGet(`/fixtures?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`);
      fixtureResponses.push(...(payload?.response ?? []));
    }
  }

  const dates: string[] = [];
  for (let cursor = new Date(`${from}T00:00:00Z`); cursor <= new Date(`${to}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(isoDate(cursor));
  }

  const oddsByFixture = new Map<number, UpcomingOdds>();
  for (const date of dates) {
    try {
      for (const [id, odds] of await fetchOddsForDate(date)) oddsByFixture.set(id, odds);
    } catch (error) {
      console.warn(`Odds fetch failed for ${date}:`, error);
    }
  }

  const allowedStatuses = new Set(['NS', 'TBD', 'PST']);
  return fixtureResponses
    .filter((item) => allowedStatuses.has(String(item?.fixture?.status?.short ?? 'NS')))
    .map((item) => {
      const providerFixtureId = Number(item.fixture.id);
      const kickoff = new Date(item.fixture.date).toISOString();
      return {
        id: buildId(providerFixtureId),
        provider: 'api-football',
        oddsSource: 'api-football',
        dataQuality: Object.keys(oddsByFixture.get(providerFixtureId) ?? {}).length >= 5 ? 85 : 65,
        providerFixtureId,
        leagueId: Number(item.league.id ?? 0),
        leagueCode: String(item.league.id ?? item.league.name ?? 'unknown'),
        leagueName: String(item.league.name ?? 'Unknown league'),
        country: String(item.league.country ?? ''),
        season: seasonLabel(item.league.season),
        kickoff,
        date: kickoff.slice(0, 10),
        status: String(item.fixture.status?.short ?? 'NS'),
        venue: item.fixture.venue?.name || undefined,
        homeTeamId: Number(item.teams.home?.id) || undefined,
        awayTeamId: Number(item.teams.away?.id) || undefined,
        homeTeam: String(item.teams.home?.name ?? 'Home'),
        awayTeam: String(item.teams.away?.name ?? 'Away'),
        odds: oddsByFixture.get(providerFixtureId) ?? {},
        rawOdds: null,
        updatedAt: new Date().toISOString()
      } satisfies UpcomingFixture;
    });
}


export type HistoricalBootstrapReport = {
  enabled: boolean;
  consideredLeagues: number;
  requestedLeagues: number;
  skippedLeagues: number;
  matchesFetched: number;
  warnings: string[];
  leagues: Array<{
    leagueId: number;
    leagueName: string;
    season: string;
    upcomingFixtures: number;
    existingMatches: number;
    fetchedMatches: number;
    currentSeasonFetched?: number;
    previousSeasonFetched?: number;
    seasonsRequested?: string[];
    error?: string;
  }>;
};

function booleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  return value == null ? fallback : String(value).toLowerCase() !== 'false';
}

function boundedInteger(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function compactTeam(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|afc|club|calcio|fk|sk|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function numberOrUndefined(value: unknown) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function completedMatch(item: any): NormalizedMatch | null {
  const status = String(item?.fixture?.status?.short ?? '');
  if (!new Set(['FT', 'AET', 'PEN']).has(status)) return null;
  const homeGoals = numberOrUndefined(item?.goals?.home);
  const awayGoals = numberOrUndefined(item?.goals?.away);
  if (homeGoals == null || awayGoals == null) return null;
  const providerFixtureId = Number(item?.fixture?.id);
  if (!providerFixtureId) return null;
  const kickoff = new Date(item?.fixture?.date);
  if (Number.isNaN(kickoff.getTime())) return null;
  const halfTimeHomeGoals = numberOrUndefined(item?.score?.halftime?.home);
  const halfTimeAwayGoals = numberOrUndefined(item?.score?.halftime?.away);
  return {
    id: createHash('sha1').update(`api-football-history|${providerFixtureId}`).digest('hex').slice(0, 24),
    leagueCode: String(item?.league?.id ?? item?.league?.name ?? 'unknown'),
    leagueName: String(item?.league?.name ?? 'Unknown league'),
    season: seasonLabel(item?.league?.season),
    date: kickoff.toISOString().slice(0, 10),
    time: kickoff.toISOString(),
    homeTeam: String(item?.teams?.home?.name ?? 'Home'),
    awayTeam: String(item?.teams?.away?.name ?? 'Away'),
    homeGoals,
    awayGoals,
    halfTimeHomeGoals,
    halfTimeAwayGoals,
    result: homeGoals > awayGoals ? 'H' : homeGoals < awayGoals ? 'A' : 'D',
    stats: {},
    odds: {}
  };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      output[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return output;
}

/**
 * Hydrates the historical result/HT-FT layer required by Athena and Ares.
 * It is deliberately league-based to keep API-Football usage bounded and
 * skips leagues already carrying enough team history in Supabase.
 */
export async function fetchHistoricalMatchesForUpcoming(
  fixtures: UpcomingFixture[],
  existingMatches: NormalizedMatch[]
): Promise<{ matches: NormalizedMatch[]; report: HistoricalBootstrapReport }> {
  const enabled = booleanEnv('API_FOOTBALL_HISTORY_ENABLED', true);
  const emptyReport: HistoricalBootstrapReport = {
    enabled,
    consideredLeagues: 0,
    requestedLeagues: 0,
    skippedLeagues: 0,
    matchesFetched: 0,
    warnings: [],
    leagues: []
  };
  if (!enabled || !fixtures.length) return { matches: [], report: emptyReport };

  const grouped = new Map<string, {
    leagueId: number;
    leagueName: string;
    season: string;
    fixtures: UpcomingFixture[];
    teams: Set<string>;
  }>();
  for (const fixture of fixtures) {
    const leagueId = Number(fixture.leagueId);
    const season = String(fixture.season || '');
    // Synthetic Odds API league ids cannot be sent to API-Football. They are
    // still hydrated when the fixture was matched to an API-Football row.
    if (!leagueId || !/^\d{4}$/.test(season) || fixture.provider === 'odds-api') continue;
    const key = `${leagueId}|${season}`;
    const group = grouped.get(key) ?? {
      leagueId,
      leagueName: fixture.leagueName,
      season,
      fixtures: [],
      teams: new Set<string>()
    };
    group.fixtures.push(fixture);
    group.teams.add(compactTeam(fixture.homeTeam));
    group.teams.add(compactTeam(fixture.awayTeam));
    grouped.set(key, group);
  }

  const minTeamMatches = boundedInteger('API_FOOTBALL_HISTORY_MIN_TEAM_MATCHES', 6, 3, 20);
  const minLeagueMatches = boundedInteger('API_FOOTBALL_HISTORY_MIN_LEAGUE_MATCHES', 40, 12, 500);
  const maxLeagues = boundedInteger('API_FOOTBALL_HISTORY_MAX_LEAGUES', 18, 1, 80);
  const historyDays = boundedInteger('API_FOOTBALL_HISTORY_DAYS', 540, 90, 900);
  const concurrency = boundedInteger('API_FOOTBALL_HISTORY_CONCURRENCY', 3, 1, 8);
  const previousSeasonEnabled = booleanEnv('API_FOOTBALL_HISTORY_PREVIOUS_SEASON_ENABLED', true);

  const candidates = [...grouped.values()].map((group) => {
    const sameLeagueRows = existingMatches.filter((match) => {
      const sameCode = String(match.leagueCode) === String(group.leagueId);
      const sameName = compactTeam(match.leagueName) === compactTeam(group.leagueName);
      // Do not discard previous-season history here. Athena and Ares need it
      // at the start of a new season, and Chronos uses it as its base pattern.
      return sameCode || sameName;
    });
    const teamCounts = new Map<string, number>();
    for (const match of sameLeagueRows) {
      const home = compactTeam(match.homeTeam);
      const away = compactTeam(match.awayTeam);
      teamCounts.set(home, (teamCounts.get(home) || 0) + 1);
      teamCounts.set(away, (teamCounts.get(away) || 0) + 1);
    }
    const teamSamples = [...group.teams].map((team) => teamCounts.get(team) || 0);
    const weakestTeamSample = teamSamples.length ? Math.min(...teamSamples) : 0;
    const needsHistory = sameLeagueRows.length < minLeagueMatches || weakestTeamSample < minTeamMatches;
    return { ...group, existingMatches: sameLeagueRows.length, weakestTeamSample, needsHistory };
  });

  const selected = candidates
    .filter((group) => group.needsHistory)
    .sort((a, b) => b.fixtures.length - a.fixtures.length || a.existingMatches - b.existingMatches)
    .slice(0, maxLeagues);

  const nowDate = new Date().toISOString().slice(0, 10);
  const to = subtractDays(nowDate, 1);
  const from = subtractDays(to, historyDays);

  async function fetchLeagueSeason(leagueId: number, season: string) {
    const payload = await apiGet(
      `/fixtures?league=${encodeURIComponent(leagueId)}&season=${encodeURIComponent(season)}`
      + `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&timezone=UTC`
    );
    return (payload?.response ?? [])
      .map(completedMatch)
      .filter((match: NormalizedMatch | null): match is NormalizedMatch => Boolean(match));
  }

  const results = await mapWithConcurrency(selected, concurrency, async (group) => {
    const seasonsRequested = [group.season];
    try {
      const currentMatches = await fetchLeagueSeason(group.leagueId, group.season);
      let previousMatches: NormalizedMatch[] = [];
      const previousSeason = String(Number(group.season) - 1);

      // API-Football seasons are start years. In July/August a newly created
      // season can contain fixtures but zero completed games, so querying only
      // that season leaves every engine starved. Pull the preceding season
      // whenever the current one is below the safe history floor.
      if (previousSeasonEnabled && /^\d{4}$/.test(previousSeason) && currentMatches.length < minLeagueMatches) {
        seasonsRequested.push(previousSeason);
        try {
          previousMatches = await fetchLeagueSeason(group.leagueId, previousSeason);
        } catch (error) {
          console.warn(`[Betynz history bootstrap] Previous season ${previousSeason} failed for ${group.leagueName}:`, error);
        }
      }

      const unique = new Map<string, NormalizedMatch>();
      for (const match of [...currentMatches, ...previousMatches]) unique.set(match.id, match);
      return {
        group,
        matches: [...unique.values()],
        currentSeasonFetched: currentMatches.length,
        previousSeasonFetched: previousMatches.length,
        seasonsRequested
      };
    } catch (error) {
      return {
        group,
        matches: [] as NormalizedMatch[],
        currentSeasonFetched: 0,
        previousSeasonFetched: 0,
        seasonsRequested,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  const matches = new Map<string, NormalizedMatch>();
  const warnings: string[] = [];
  const leagueReports: HistoricalBootstrapReport['leagues'] = [];
  for (const result of results) {
    for (const match of result.matches) matches.set(match.id, match);
    if ('error' in result && result.error) warnings.push(`${result.group.leagueName}: ${result.error}`);
    leagueReports.push({
      leagueId: result.group.leagueId,
      leagueName: result.group.leagueName,
      season: result.group.season,
      upcomingFixtures: result.group.fixtures.length,
      existingMatches: result.group.existingMatches,
      fetchedMatches: result.matches.length,
      currentSeasonFetched: result.currentSeasonFetched,
      previousSeasonFetched: result.previousSeasonFetched,
      seasonsRequested: result.seasonsRequested,
      error: 'error' in result ? result.error : undefined
    });
  }

  return {
    matches: [...matches.values()],
    report: {
      enabled,
      consideredLeagues: candidates.length,
      requestedLeagues: selected.length,
      skippedLeagues: candidates.length - selected.length,
      matchesFetched: matches.size,
      warnings,
      leagues: leagueReports
    }
  };
}
