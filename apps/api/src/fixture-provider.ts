import { fetchUpcomingFixtures as fetchApiFootballFixtures } from './football-api.js';
import { betExplorerConfiguration, fetchBetExplorerFixtures, type BetExplorerSyncReport } from './betexplorer.js';
import { enrichFixturesWithOddsApi, oddsApiConfiguration, type OddsApiEnrichmentReport } from './odds-api.js';
import type { UpcomingFixture, UpcomingOdds } from './forecast-types.js';

export type FixtureProviderMode = 'api-football' | 'betexplorer' | 'hybrid';
export type ProviderSource = 'betexplorer' | 'api-football' | 'hybrid' | 'api-football-rescue';

export type ProviderSyncReport = {
  mode: FixtureProviderMode;
  selectedSource: ProviderSource;
  fixtures: number;
  pricedFixtures: number;
  apiFootball: { enabled: boolean; fixtures: number; error?: string };
  oddsApi: OddsApiEnrichmentReport;
  betExplorer: BetExplorerSyncReport;
  rescue: {
    enabled: boolean;
    triggered: boolean;
    reason?: string;
    fixtures: number;
    pricedFixtures: number;
  };
  matchedAcrossProviders: number;
  unmatchedBetExplorer: number;
  unmatchedApiFootball: number;
  warnings: string[];
};


function oddsApiConfigured() {
  return Boolean(process.env.ODDS_API_KEY?.trim()
    || process.env.THE_ODDS_API_KEY?.trim()
    || process.env.THE_ODDS_API_API_KEY?.trim());
}

const emptyOddsReport = (): OddsApiEnrichmentReport => ({
  enabled: oddsApiConfigured(),
  requestedSports: 0,
  events: 0,
  matchedFixtures: 0,
  fixturesNeeding1X2: 0,
  fixturesWith1X2Before: 0,
  fixturesWith1X2After: 0,
  warnings: []
});

const emptyBetExplorerReport = (enabled = false): BetExplorerSyncReport => ({
  provider: 'betexplorer',
  enabled,
  requestedPages: 0,
  parsedFixtures: 0,
  fixturesWith1X2: 0,
  pages: [],
  warnings: []
});

let lastReport: ProviderSyncReport | null = null;
let lastRescueReport: ProviderSyncReport | null = null;

function mode(): FixtureProviderMode {
  const value = String(process.env.FIXTURE_PROVIDER || 'betexplorer').toLowerCase();
  return value === 'betexplorer' || value === 'api-football' ? value : 'hybrid';
}

function rescueEnabled() {
  return !['0', 'false', 'no', 'off'].includes(String(process.env.AUTO_PROVIDER_RESCUE ?? 'true').toLowerCase());
}

function aliases() {
  try {
    const raw = JSON.parse(process.env.TEAM_ALIASES_JSON || '{}') as Record<string, string>;
    return new Map(Object.entries(raw).map(([key, value]) => [normalizeName(key), normalizeName(value)]));
  } catch {
    return new Map<string, string>();
  }
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|afc|club|calcio|fk|sk|the)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function canonicalName(value: string, map: Map<string, string>) {
  const normalized = normalizeName(value);
  return map.get(normalized) || normalized;
}

function diceSimilarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const bigrams = (value: string) => {
    const output = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const pair = value.slice(index, index + 2);
      output.set(pair, (output.get(pair) || 0) + 1);
    }
    return output;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  let overlap = 0;
  for (const [pair, count] of left) overlap += Math.min(count, right.get(pair) || 0);
  const total = [...left.values()].reduce((sum, count) => sum + count, 0) + [...right.values()].reduce((sum, count) => sum + count, 0);
  return total ? (2 * overlap) / total : 0;
}

function sameFixture(a: UpcomingFixture, b: UpcomingFixture, map: Map<string, string>) {
  if (a.date !== b.date) return false;
  const home = diceSimilarity(canonicalName(a.homeTeam, map), canonicalName(b.homeTeam, map));
  const away = diceSimilarity(canonicalName(a.awayTeam, map), canonicalName(b.awayTeam, map));
  if (home < 0.72 || away < 0.72) return false;
  const timeDifference = Math.abs(new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  return timeDifference <= 4 * 60 * 60 * 1000;
}

function mergeOdds(apiOdds: UpcomingOdds, betExplorerOdds: UpcomingOdds) {
  // BetExplorer remains authoritative for its rendered 1X2 values.
  // API-Football and The Odds API fill markets missing from the BetExplorer row.
  return { ...apiOdds, ...betExplorerOdds };
}

export function mergeProviderFixtures(apiFixtures: UpcomingFixture[], betFixtures: UpcomingFixture[]) {
  const aliasMap = aliases();
  const usedApi = new Set<number>();
  const output: UpcomingFixture[] = [];
  let matched = 0;

  for (const betFixture of betFixtures) {
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < apiFixtures.length; index += 1) {
      if (usedApi.has(index)) continue;
      const apiFixture = apiFixtures[index];
      if (!sameFixture(betFixture, apiFixture, aliasMap)) continue;
      const score = diceSimilarity(canonicalName(betFixture.homeTeam, aliasMap), canonicalName(apiFixture.homeTeam, aliasMap))
        + diceSimilarity(canonicalName(betFixture.awayTeam, aliasMap), canonicalName(apiFixture.awayTeam, aliasMap));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      const apiFixture = apiFixtures[bestIndex];
      usedApi.add(bestIndex);
      matched += 1;
      output.push({
        ...apiFixture,
        // Preserve the BetExplorer identity when that row is already stored. This lets
        // rescue odds update the existing fixture instead of creating a duplicate match.
        id: betFixture.id,
        providerFixtureId: betFixture.providerFixtureId,
        leagueId: betFixture.leagueId,
        leagueCode: betFixture.leagueCode,
        leagueName: betFixture.leagueName,
        country: betFixture.country || apiFixture.country,
        season: betFixture.season || apiFixture.season,
        kickoff: betFixture.kickoff,
        date: betFixture.date,
        venue: betFixture.venue || apiFixture.venue,
        homeTeam: betFixture.homeTeam,
        awayTeam: betFixture.awayTeam,
        provider: 'hybrid',
        providerUrl: betFixture.providerUrl,
        oddsSource: `${betFixture.oddsSource || 'betexplorer'}+${apiFixture.oddsSource || 'api-football'}`,
        dataQuality: Math.min(100, Math.max(apiFixture.dataQuality || 70, betFixture.dataQuality || 60) + 8),
        odds: mergeOdds(apiFixture.odds, betFixture.odds),
        rawOdds: {
          apiFootball: apiFixture.rawOdds ?? null,
          betExplorer: betFixture.rawOdds ?? null
        },
        updatedAt: new Date().toISOString()
      });
    } else {
      output.push(betFixture);
    }
  }

  for (let index = 0; index < apiFixtures.length; index += 1) {
    if (!usedApi.has(index)) output.push(apiFixtures[index]);
  }

  return {
    fixtures: output,
    matched,
    unmatchedBetExplorer: betFixtures.length - matched,
    unmatchedApiFootball: apiFixtures.length - matched
  };
}

function filterFixtures(fixtures: UpcomingFixture[]) {
  const excludedCountries = new Set((process.env.EXCLUDED_COUNTRIES || '').split(',').map((value: string) => normalizeName(value)).filter(Boolean));
  const excludedLeagues = new Set((process.env.EXCLUDED_LEAGUE_IDS || '').split(',').map((value: string) => value.trim()).filter(Boolean));
  const includeCountries = new Set((process.env.INCLUDED_COUNTRIES || '').split(',').map((value: string) => normalizeName(value)).filter(Boolean));
  return fixtures.filter((fixture) => {
    if (excludedCountries.has(normalizeName(fixture.country))) return false;
    if (excludedLeagues.has(String(fixture.leagueId)) || excludedLeagues.has(fixture.leagueCode)) return false;
    if (includeCountries.size && !includeCountries.has(normalizeName(fixture.country))) return false;
    return true;
  });
}

function pricedCount(fixtures: UpcomingFixture[]) {
  return fixtures.filter((fixture) => Boolean(fixture.odds.home && fixture.odds.draw && fixture.odds.away)).length;
}

async function loadApiFixtures(from: string, to: string) {
  let fixtures: UpcomingFixture[] = [];
  let error: string | undefined;
  let oddsApi = emptyOddsReport();
  if (!process.env.API_FOOTBALL_KEY?.trim()) {
    return { fixtures, error: 'API_FOOTBALL_KEY is not configured.', oddsApi };
  }
  try {
    fixtures = (await fetchApiFootballFixtures(from, to)).map((fixture) => ({
      ...fixture,
      provider: 'api-football',
      oddsSource: 'api-football',
      dataQuality: Object.keys(fixture.odds).length >= 5 ? 85 : Object.keys(fixture.odds).length >= 3 ? 72 : 58
    }));
    const enriched = await enrichFixturesWithOddsApi(fixtures, from, to);
    fixtures = enriched.fixtures;
    oddsApi = enriched.report;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return { fixtures, error, oddsApi };
}

export async function fetchRescueUpcomingFixtures(from: string, to: string) {
  const api = await loadApiFixtures(from, to);
  const fixtures = filterFixtures(api.fixtures).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const warnings = [...api.oddsApi.warnings];
  if (api.error) warnings.push(api.error);
  if (!fixtures.length) warnings.push('Provider rescue found no API-Football fixtures. Existing database fixtures should be retained.');
  if (fixtures.length && !pricedCount(fixtures)) warnings.push('Provider rescue found fixtures, but none have complete Home/Draw/Away odds.');

  const report: ProviderSyncReport = {
    mode: mode(),
    selectedSource: 'api-football-rescue',
    fixtures: fixtures.length,
    pricedFixtures: pricedCount(fixtures),
    apiFootball: { enabled: Boolean(process.env.API_FOOTBALL_KEY?.trim()), fixtures: fixtures.length, error: api.error },
    oddsApi: api.oddsApi,
    betExplorer: emptyBetExplorerReport(false),
    rescue: {
      enabled: rescueEnabled(),
      triggered: true,
      reason: 'Forced provider rescue requested.',
      fixtures: fixtures.length,
      pricedFixtures: pricedCount(fixtures)
    },
    matchedAcrossProviders: 0,
    unmatchedBetExplorer: 0,
    unmatchedApiFootball: fixtures.length,
    warnings
  };
  lastRescueReport = report;
  lastReport = report;
  return { fixtures, report };
}

export async function fetchMultiLeagueUpcomingFixtures(from: string, to: string) {
  const selectedMode = mode();
  const shouldUseBetExplorer = selectedMode === 'betexplorer' || selectedMode === 'hybrid';
  const betExplorerResult = shouldUseBetExplorer
    ? await fetchBetExplorerFixtures(from, to)
    : { fixtures: [] as UpcomingFixture[], report: emptyBetExplorerReport(false) };

  let api = selectedMode === 'api-football' || selectedMode === 'hybrid'
    ? await loadApiFixtures(from, to)
    : { fixtures: [] as UpcomingFixture[], error: undefined as string | undefined, oddsApi: emptyOddsReport() };

  let rescueTriggered = false;
  let rescueReason: string | undefined;
  const betPriced = pricedCount(betExplorerResult.fixtures);
  if (selectedMode === 'betexplorer' && rescueEnabled() && (!betExplorerResult.fixtures.length || betPriced === 0)) {
    rescueTriggered = true;
    rescueReason = !betExplorerResult.fixtures.length
      ? 'BetExplorer returned zero fixtures.'
      : 'BetExplorer returned fixtures without complete 1X2 odds.';
    api = await loadApiFixtures(from, to);
  }

  let merged: ReturnType<typeof mergeProviderFixtures>;
  let selectedSource: ProviderSource;
  if (selectedMode === 'api-football') {
    merged = { fixtures: api.fixtures, matched: 0, unmatchedBetExplorer: 0, unmatchedApiFootball: api.fixtures.length };
    selectedSource = 'api-football';
  } else if (selectedMode === 'hybrid') {
    merged = mergeProviderFixtures(api.fixtures, betExplorerResult.fixtures);
    selectedSource = betExplorerResult.fixtures.length && api.fixtures.length ? 'hybrid' : betExplorerResult.fixtures.length ? 'betexplorer' : 'api-football-rescue';
  } else if (rescueTriggered) {
    merged = mergeProviderFixtures(api.fixtures, betExplorerResult.fixtures);
    selectedSource = betExplorerResult.fixtures.length ? 'hybrid' : 'api-football-rescue';
  } else {
    merged = { fixtures: betExplorerResult.fixtures, matched: 0, unmatchedBetExplorer: betExplorerResult.fixtures.length, unmatchedApiFootball: 0 };
    selectedSource = 'betexplorer';
  }

  const fixtures = filterFixtures(merged.fixtures).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const warnings = [...betExplorerResult.report.warnings, ...api.oddsApi.warnings];
  if (api.error) warnings.push(api.error);
  if (rescueReason) warnings.push(`Automatic rescue activated: ${rescueReason}`);
  if (selectedMode === 'hybrid' && !betExplorerResult.fixtures.length) warnings.push('Hybrid mode continued with API-Football because BetExplorer returned no usable fixtures.');
  if (selectedMode === 'hybrid' && !api.fixtures.length) warnings.push('Hybrid mode continued with BetExplorer-only fixtures because API-Football returned no usable fixtures.');

  lastReport = {
    mode: selectedMode,
    selectedSource,
    fixtures: fixtures.length,
    pricedFixtures: pricedCount(fixtures),
    apiFootball: { enabled: Boolean(process.env.API_FOOTBALL_KEY?.trim()) && (selectedMode !== 'betexplorer' || rescueTriggered), fixtures: api.fixtures.length, error: api.error },
    oddsApi: api.oddsApi,
    betExplorer: betExplorerResult.report,
    rescue: {
      enabled: rescueEnabled(),
      triggered: rescueTriggered,
      reason: rescueReason,
      fixtures: rescueTriggered ? api.fixtures.length : 0,
      pricedFixtures: rescueTriggered ? pricedCount(api.fixtures) : 0
    },
    matchedAcrossProviders: merged.matched,
    unmatchedBetExplorer: merged.unmatchedBetExplorer,
    unmatchedApiFootball: merged.unmatchedApiFootball,
    warnings
  };

  if (!fixtures.length) {
    throw new Error(`No fresh upcoming fixtures were returned. API-Football: ${api.error || '0 fixtures'}. BetExplorer: ${betExplorerResult.report.parsedFixtures} parsed. Existing database fixtures were not deleted.`);
  }

  return { fixtures, report: lastReport };
}

export function providerConfiguration() {
  return {
    mode: mode(),
    automaticRescue: rescueEnabled(),
    leagueMode: process.env.API_FOOTBALL_LEAGUE_IDS?.trim() ? 'selected' : 'all',
    apiFootball: {
      configured: Boolean(process.env.API_FOOTBALL_KEY?.trim()),
      enabled: Boolean(process.env.API_FOOTBALL_KEY?.trim()),
      selectedLeagueIds: (process.env.API_FOOTBALL_LEAGUE_IDS || '').split(',').map((value: string) => value.trim()).filter(Boolean)
    },
    oddsApi: oddsApiConfiguration(),
    betExplorer: betExplorerConfiguration(),
    lastReport,
    lastRescueReport
  };
}
