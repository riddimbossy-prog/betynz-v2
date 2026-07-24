import type { UpcomingFixture, UpcomingOdds } from './forecast-types.js';

const BASE_URL = process.env.ODDS_API_BASE_URL?.trim() || 'https://api.the-odds-api.com/v4';

type OddsApiSport = {
  key?: string;
  group?: string;
  title?: string;
  active?: boolean;
};

type OddsApiOutcome = {
  name?: string;
  price?: number;
};

type OddsApiMarket = {
  key?: string;
  outcomes?: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key?: string;
  title?: string;
  markets?: OddsApiMarket[];
};

type OddsApiEvent = {
  id?: string;
  sport_key?: string;
  sport_title?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: OddsApiBookmaker[];
};

export type OddsApiEnrichmentReport = {
  enabled: boolean;
  requestedSports: number;
  events: number;
  matchedFixtures: number;
  fixturesNeeding1X2: number;
  fixturesWith1X2Before: number;
  fixturesWith1X2After: number;
  quotaRemaining?: number;
  warnings: string[];
};

function configuredKey() {
  return process.env.ODDS_API_KEY?.trim()
    || process.env.THE_ODDS_API_KEY?.trim()
    || process.env.THE_ODDS_API_API_KEY?.trim()
    || '';
}

function enabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.ODDS_API_ENABLED ?? 'true').toLowerCase())
    && Boolean(configuredKey());
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|afc|club|calcio|fk|sk|the|women|wfc|u\d{2}|reserves?)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function diceSimilarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b || a.length < 2 || b.length < 2) return 0;
  const pairs = (value: string) => {
    const map = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const pair = value.slice(index, index + 2);
      map.set(pair, (map.get(pair) || 0) + 1);
    }
    return map;
  };
  const left = pairs(a);
  const right = pairs(b);
  let overlap = 0;
  for (const [pair, count] of left) overlap += Math.min(count, right.get(pair) || 0);
  const total = [...left.values()].reduce((sum, value) => sum + value, 0)
    + [...right.values()].reduce((sum, value) => sum + value, 0);
  return total ? (2 * overlap) / total : 0;
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Number(value.toFixed(3));
}

function validOdd(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 1.001 && number < 1000 ? number : undefined;
}

function eventOdds(event: OddsApiEvent): UpcomingOdds {
  const homePrices: number[] = [];
  const drawPrices: number[] = [];
  const awayPrices: number[] = [];
  const homeKey = normalizeName(event.home_team || '');
  const awayKey = normalizeName(event.away_team || '');

  for (const bookmaker of event.bookmakers || []) {
    const market = (bookmaker.markets || []).find((entry) => entry.key === 'h2h');
    for (const outcome of market?.outcomes || []) {
      const odd = validOdd(outcome.price);
      if (!odd) continue;
      const name = normalizeName(outcome.name || '');
      if (name === homeKey || diceSimilarity(name, homeKey) >= 0.82) homePrices.push(odd);
      else if (name === awayKey || diceSimilarity(name, awayKey) >= 0.82) awayPrices.push(odd);
      else if (/^(draw|tie|x)$/i.test(String(outcome.name || '').trim())) drawPrices.push(odd);
    }
  }

  return {
    home: median(homePrices),
    draw: median(drawPrices),
    away: median(awayPrices)
  };
}

async function apiGet<T>(path: string) {
  const key = configuredKey();
  if (!key) throw new Error('ODDS_API_KEY is not configured.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(5_000, Number(process.env.ODDS_API_TIMEOUT_MS || 20_000)));
  try {
    const separator = path.includes('?') ? '&' : '?';
    const response = await fetch(`${BASE_URL}${path}${separator}apiKey=${encodeURIComponent(key)}`, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'Betynz-Odds-Rescue/2.8.1'
      }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`The Odds API request failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
    return {
      body: JSON.parse(text) as T,
      quotaRemaining: Number(response.headers.get('x-requests-remaining') || '') || undefined
    };
  } finally {
    clearTimeout(timeout);
  }
}

function datesOverlap(event: OddsApiEvent, fixture: UpcomingFixture) {
  const eventTime = new Date(String(event.commence_time || '')).getTime();
  const fixtureTime = new Date(fixture.kickoff).getTime();
  if (!Number.isFinite(eventTime) || !Number.isFinite(fixtureTime)) return false;
  return Math.abs(eventTime - fixtureTime) <= 8 * 60 * 60 * 1000;
}

function eventMatchScore(event: OddsApiEvent, fixture: UpcomingFixture) {
  if (!datesOverlap(event, fixture)) return 0;
  const home = diceSimilarity(normalizeName(event.home_team || ''), normalizeName(fixture.homeTeam));
  const away = diceSimilarity(normalizeName(event.away_team || ''), normalizeName(fixture.awayTeam));
  if (home < 0.68 || away < 0.68) return 0;
  return home + away;
}

function requestedSportKeys(sports: OddsApiSport[]) {
  const configured = String(process.env.ODDS_API_SPORT_KEYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.length) return configured;
  const maxSports = Math.max(1, Math.min(80, Number(process.env.ODDS_API_MAX_SPORTS || 45)));
  return sports
    .filter((sport) => sport.active !== false)
    .filter((sport) => String(sport.key || '').startsWith('soccer_') || /soccer|football/i.test(`${sport.group || ''} ${sport.title || ''}`))
    .map((sport) => String(sport.key || ''))
    .filter(Boolean)
    .slice(0, maxSports);
}

function isComplete1X2(odds: UpcomingOdds) {
  return Boolean(odds.home && odds.draw && odds.away);
}

export async function enrichFixturesWithOddsApi(fixtures: UpcomingFixture[], from: string, to: string) {
  const report: OddsApiEnrichmentReport = {
    enabled: enabled(),
    requestedSports: 0,
    events: 0,
    matchedFixtures: 0,
    fixturesNeeding1X2: fixtures.filter((fixture) => !isComplete1X2(fixture.odds)).length,
    fixturesWith1X2Before: fixtures.filter((fixture) => isComplete1X2(fixture.odds)).length,
    fixturesWith1X2After: fixtures.filter((fixture) => isComplete1X2(fixture.odds)).length,
    warnings: []
  };

  if (!report.enabled || report.fixturesNeeding1X2 === 0) return { fixtures, report };

  try {
    const sportsResponse = await apiGet<OddsApiSport[]>('/sports/');
    report.quotaRemaining = sportsResponse.quotaRemaining;
    const sportKeys = requestedSportKeys(Array.isArray(sportsResponse.body) ? sportsResponse.body : []);
    if (!sportKeys.length) {
      report.warnings.push('The Odds API returned no active soccer sport keys.');
      return { fixtures, report };
    }

    const events: OddsApiEvent[] = [];
    const regions = process.env.ODDS_API_REGIONS?.trim() || 'eu,uk';
    const bookmakers = process.env.ODDS_API_BOOKMAKERS?.trim();
    const dateFrom = `${from}T00:00:00Z`;
    const dateTo = `${to}T23:59:59Z`;

    for (const sportKey of sportKeys) {
      try {
        const bookmakerPart = bookmakers ? `&bookmakers=${encodeURIComponent(bookmakers)}` : '';
        const path = `/sports/${encodeURIComponent(sportKey)}/odds/?regions=${encodeURIComponent(regions)}&markets=h2h&oddsFormat=decimal&dateFormat=iso&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}${bookmakerPart}`;
        const response = await apiGet<OddsApiEvent[]>(path);
        report.requestedSports += 1;
        if (response.quotaRemaining != null) report.quotaRemaining = response.quotaRemaining;
        if (Array.isArray(response.body)) events.push(...response.body);
      } catch (error) {
        report.warnings.push(`${sportKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    report.events = events.length;
    const usedEvents = new Set<string>();
    const enriched = fixtures.map((fixture) => {
      if (isComplete1X2(fixture.odds)) return fixture;
      let best: OddsApiEvent | undefined;
      let bestScore = 0;
      for (const event of events) {
        if (event.id && usedEvents.has(event.id)) continue;
        const score = eventMatchScore(event, fixture);
        if (score > bestScore) {
          bestScore = score;
          best = event;
        }
      }
      if (!best) return fixture;
      const h2h = eventOdds(best);
      if (!isComplete1X2(h2h)) return fixture;
      if (best.id) usedEvents.add(best.id);
      report.matchedFixtures += 1;
      return {
        ...fixture,
        odds: { ...fixture.odds, ...h2h },
        oddsSource: fixture.oddsSource?.includes('the-odds-api')
          ? fixture.oddsSource
          : `${fixture.oddsSource || fixture.provider || 'fixture-provider'}+the-odds-api`,
        dataQuality: Math.min(100, (fixture.dataQuality || 60) + 10),
        rawOdds: {
          previous: fixture.rawOdds ?? null,
          oddsApi: {
            eventId: best.id,
            sportKey: best.sport_key,
            commenceTime: best.commence_time,
            homeTeam: best.home_team,
            awayTeam: best.away_team
          }
        },
        updatedAt: new Date().toISOString()
      } satisfies UpcomingFixture;
    });

    report.fixturesWith1X2After = enriched.filter((fixture) => isComplete1X2(fixture.odds)).length;
    if (!report.matchedFixtures) report.warnings.push('The Odds API returned events, but no missing fixture could be matched safely by teams and kickoff time.');
    return { fixtures: enriched, report };
  } catch (error) {
    report.warnings.push(error instanceof Error ? error.message : String(error));
    return { fixtures, report };
  }
}

export function oddsApiConfiguration() {
  return {
    enabled: enabled(),
    configured: Boolean(configuredKey()),
    baseUrl: BASE_URL,
    regions: process.env.ODDS_API_REGIONS?.trim() || 'eu,uk',
    selectedSportKeys: String(process.env.ODDS_API_SPORT_KEYS || '').split(',').map((value) => value.trim()).filter(Boolean),
    maxSports: Math.max(1, Math.min(80, Number(process.env.ODDS_API_MAX_SPORTS || 45)))
  };
}
