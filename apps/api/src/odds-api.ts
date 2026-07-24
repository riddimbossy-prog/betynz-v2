import { createHash } from 'node:crypto';
import type { UpcomingFixture, UpcomingOdds } from './forecast-types.js';
import type { NormalizedMatch } from './types.js';

const BASE_URL = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

type OddsApiOutcome = { name?: string; price?: number; point?: number };
type OddsApiMarket = { key?: string; outcomes?: OddsApiOutcome[] };
type OddsApiBookmaker = { key?: string; title?: string; last_update?: string; markets?: OddsApiMarket[] };
type OddsApiEvent = {
  id?: string;
  sport_key?: string;
  sport_title?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: OddsApiBookmaker[];
};

type OddsApiReport = {
  enabled: boolean;
  usedAsFallback: boolean;
  sportsRequested: number;
  requests: number;
  fixtures: number;
  fixturesWith1X2: number;
  remaining?: number;
  used?: number;
  warnings: string[];
};

let lastReport: OddsApiReport | null = null;
let sportsCache: { at: number; keys: string[] } | null = null;

function key() {
  return process.env.ODDS_API_KEY?.trim() || '';
}

function numberHeader(response: Response, name: string) {
  const value = response.headers.get(name);
  const parsed = value == null ? undefined : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function apiGet<T>(path: string, params: Record<string, string>) {
  const apiKey = key();
  if (!apiKey) throw new Error('ODDS_API_KEY is not configured.');
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('apiKey', apiKey);
  for (const [name, value] of Object.entries(params)) if (value) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { 'User-Agent': 'Betynz-Odds-Fallback/2.9' } });
  const remaining = numberHeader(response, 'x-requests-remaining');
  const used = numberHeader(response, 'x-requests-used');
  if (!response.ok) throw new Error(`Odds API request failed (${response.status}) for ${path}.`);
  return { data: await response.json() as T, remaining, used };
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function outcomePrices(event: OddsApiEvent, marketKey: string, outcomeName: string, point?: number) {
  const prices: number[] = [];
  for (const bookmaker of event.bookmakers || []) {
    for (const market of bookmaker.markets || []) {
      if (market.key !== marketKey) continue;
      for (const outcome of market.outcomes || []) {
        const pointMatches = point == null || Number(outcome.point) === point;
        if (pointMatches && String(outcome.name || '').toLowerCase() === outcomeName.toLowerCase() && Number(outcome.price) > 1) prices.push(Number(outcome.price));
      }
    }
  }
  return median(prices);
}

function parseOdds(event: OddsApiEvent): UpcomingOdds {
  const home = event.home_team || '';
  const away = event.away_team || '';
  const odds: UpcomingOdds = {};
  const assign = (name: keyof UpcomingOdds, value: number | undefined) => { if (value && Number.isFinite(value)) odds[name] = Number(value.toFixed(3)); };
  assign('home', outcomePrices(event, 'h2h', home));
  assign('draw', outcomePrices(event, 'h2h', 'Draw'));
  assign('away', outcomePrices(event, 'h2h', away));
  assign('over15', outcomePrices(event, 'totals', 'Over', 1.5));
  assign('under15', outcomePrices(event, 'totals', 'Under', 1.5));
  assign('over25', outcomePrices(event, 'totals', 'Over', 2.5));
  assign('under25', outcomePrices(event, 'totals', 'Under', 2.5));
  assign('over35', outcomePrices(event, 'totals', 'Over', 3.5));
  assign('under35', outcomePrices(event, 'totals', 'Under', 3.5));
  return odds;
}

function numericId(value: string) {
  return Number.parseInt(createHash('sha1').update(value).digest('hex').slice(0, 8), 16);
}

function eventToFixture(event: OddsApiEvent): UpcomingFixture | null {
  if (!event.id || !event.commence_time || !event.home_team || !event.away_team) return null;
  const kickoff = new Date(event.commence_time).toISOString();
  const odds = parseOdds(event);
  const sportKey = event.sport_key || 'soccer_unknown';
  return {
    provider: 'odds-api',
    providerUrl: undefined,
    oddsSource: 'odds-api-premium',
    dataQuality: odds.home && odds.draw && odds.away ? 88 : Object.keys(odds).length ? 72 : 50,
    id: `oddsapi-${event.id}`,
    providerFixtureId: numericId(event.id),
    leagueId: numericId(sportKey),
    leagueCode: sportKey,
    leagueName: event.sport_title || sportKey.replace(/^soccer_/, '').replaceAll('_', ' '),
    country: String(event.sport_title || '').split(' ')[0] || 'International',
    season: String(new Date(kickoff).getUTCFullYear()),
    kickoff,
    date: kickoff.slice(0, 10),
    status: 'NS',
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    odds,
    rawOdds: { provider: 'the-odds-api', bookmakerCount: event.bookmakers?.length || 0, event },
    updatedAt: new Date().toISOString()
  };
}

async function soccerSportKeys() {
  const configured = (process.env.ODDS_API_SPORT_KEYS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.length) return configured;
  if (sportsCache && Date.now() - sportsCache.at < 6 * 60 * 60 * 1000) return sportsCache.keys;
  const { data } = await apiGet<Array<{ key?: string; active?: boolean }>>('/sports/', {});
  const max = Math.max(1, Number(process.env.ODDS_API_MAX_SPORTS || 45));
  const keys = data.filter((sport) => sport.active !== false && String(sport.key || '').startsWith('soccer_')).map((sport) => String(sport.key)).slice(0, max);
  sportsCache = { at: Date.now(), keys };
  return keys;
}

export async function fetchOddsApiFixtures(from: string, to: string, usedAsFallback = true) {
  const warnings: string[] = [];
  if (!key()) {
    lastReport = { enabled: false, usedAsFallback, sportsRequested: 0, requests: 0, fixtures: 0, fixturesWith1X2: 0, warnings: ['ODDS_API_KEY is not configured.'] };
    return { fixtures: [] as UpcomingFixture[], report: lastReport };
  }
  const sports = await soccerSportKeys();
  const regions = process.env.ODDS_API_REGIONS || 'eu,uk';
  const markets = process.env.ODDS_API_MARKETS || 'h2h,totals';
  const fixtures: UpcomingFixture[] = [];
  let requests = 0;
  let remaining: number | undefined;
  let used: number | undefined;
  const concurrency = Math.max(1, Math.min(6, Number(process.env.ODDS_API_CONCURRENCY || 3)));
  let index = 0;
  async function worker() {
    while (index < sports.length) {
      const sport = sports[index++];
      try {
        const response = await apiGet<OddsApiEvent[]>(`/sports/${encodeURIComponent(sport)}/odds/`, { regions, markets, oddsFormat: 'decimal', dateFormat: 'iso', commenceTimeFrom: `${from}T00:00:00Z`, commenceTimeTo: `${to}T23:59:59Z` });
        requests += 1;
        remaining = response.remaining ?? remaining;
        used = response.used ?? used;
        for (const event of response.data) {
          const fixture = eventToFixture(event);
          if (fixture && fixture.date >= from && fixture.date <= to) fixtures.push(fixture);
        }
      } catch (error) {
        warnings.push(`${sport}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const deduped = [...new Map(fixtures.map((fixture) => [fixture.id, fixture])).values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  lastReport = {
    enabled: true,
    usedAsFallback,
    sportsRequested: sports.length,
    requests,
    fixtures: deduped.length,
    fixturesWith1X2: deduped.filter((fixture) => fixture.odds.home && fixture.odds.draw && fixture.odds.away).length,
    remaining,
    used,
    warnings
  };
  return { fixtures: deduped, report: lastReport };
}

function normalizeName(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|sc|afc|club|fk|sk|the)\b/g, '').replace(/[^a-z0-9]/g, '');
}

function sameHistoricalMatch(match: NormalizedMatch, fixture: UpcomingFixture) {
  return match.date === fixture.date
    && normalizeName(match.homeTeam) === normalizeName(fixture.homeTeam)
    && normalizeName(match.awayTeam) === normalizeName(fixture.awayTeam);
}

export async function enrichHistoricalMatchesWithOddsApi(matches: NormalizedMatch[], from: string, to: string) {
  const maxDays = Math.max(1, Math.min(14, Number(process.env.ODDS_API_HISTORY_MAX_DAYS || 7)));
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days < 1 || days > maxDays) throw new Error(`Historical Odds API backfill supports 1-${maxDays} days per request.`);
  const sports = await soccerSportKeys();
  const regions = process.env.ODDS_API_REGIONS || 'eu,uk';
  const markets = process.env.ODDS_API_MARKETS || 'h2h,totals';
  const snapshots: UpcomingFixture[] = [];
  let requests = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const matchDate = new Date(start.getTime() + offset * 86400000);
    const snapshot = new Date(matchDate.getTime() - 6 * 60 * 60 * 1000).toISOString();
    for (const sport of sports) {
      const response = await apiGet<{ data?: OddsApiEvent[] } | OddsApiEvent[]>(`/historical/sports/${encodeURIComponent(sport)}/odds/`, {
        regions, markets, oddsFormat: 'decimal', dateFormat: 'iso', date: snapshot
      });
      requests += 1;
      const events = Array.isArray(response.data) ? response.data : response.data.data || [];
      for (const event of events) {
        const fixture = eventToFixture(event);
        if (fixture && fixture.date >= from && fixture.date <= to) snapshots.push(fixture);
      }
    }
  }
  let enriched = 0;
  const updated = matches.map((match) => {
    const fixture = snapshots.find((candidate) => sameHistoricalMatch(match, candidate));
    if (!fixture) return match;
    const next = { ...match, odds: { ...match.odds } };
    if (!next.odds.openingHome && fixture.odds.home) next.odds.openingHome = fixture.odds.home;
    if (!next.odds.openingDraw && fixture.odds.draw) next.odds.openingDraw = fixture.odds.draw;
    if (!next.odds.openingAway && fixture.odds.away) next.odds.openingAway = fixture.odds.away;
    if (!next.odds.openingOver25 && fixture.odds.over25) next.odds.openingOver25 = fixture.odds.over25;
    if (!next.odds.openingUnder25 && fixture.odds.under25) next.odds.openingUnder25 = fixture.odds.under25;
    if (JSON.stringify(next.odds) !== JSON.stringify(match.odds)) enriched += 1;
    return next;
  });
  return { updated, enriched, snapshots: snapshots.length, requests };
}

export function oddsApiConfiguration() {
  return {
    enabled: Boolean(key()),
    baseUrl: BASE_URL,
    fallbackMinFixtures: Number(process.env.ODDS_API_FALLBACK_MIN_FIXTURES || 80),
    fallbackMinExtendedFixtures: Number(process.env.ODDS_API_FALLBACK_MIN_EXTENDED_FIXTURES || 30),
    sportsConfigured: (process.env.ODDS_API_SPORT_KEYS || '').split(',').filter(Boolean).length,
    lastReport
  };
}
