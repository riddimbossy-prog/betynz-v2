import { fetchMultiLeagueUpcomingFixtures } from './fixture-provider.js';
import { fetchHistoricalMatchesForUpcoming, type HistoricalBootstrapReport } from './football-api.js';
import { buildAthenaShadowRun } from './athena-service.js';
import { ATHENA_ENGINE_VERSION, ATHENA_MARKETS } from './athena-transition.js';
import { buildAresPick } from './ares-service.js';
import { buildChronosPick } from './chronos-service.js';
import { analyzeFixtureBattle, ENGINE_VERSION } from './engine.js';
import {
  OLYMPIAN_ENGINE_VERSION,
  buildAthenaPicks,
  buildChronosPicks,
  buildZeusAutoPicks
} from './god-picks.js';
import {
  allMatches,
  clearPredictionsForWindow,
  listAthenaShadowRuns,
  listGodPicks,
  listPredictions,
  listStreakSnapshots,
  listUpcomingFixtures,
  replaceAthenaShadowRuns,
  replaceGodPicks,
  replaceRejectedBattles,
  sourceName,
  upsertConfrontationRecords,
  upsertMatches,
  upsertPredictions,
  upsertStreakSnapshots,
  upsertUpcomingFixtures
} from './store.js';
import type { GodKey, GodPublicPick, PredictionDashboard } from './forecast-types.js';
import { isPipelineRunning } from './pipeline-state.js';

function dateInTimeZone(timeZone = process.env.PREDICTION_TIMEZONE || 'Africa/Accra') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function enabled(name: string, fallback = true) {
  const value = process.env[name];
  if (value == null) return fallback;
  return String(value).toLowerCase() !== 'false';
}

function byGod(rows: GodPublicPick[], god: GodKey) {
  return rows.filter((pick) => pick.god === god).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export function predictionWindow(days = Number(process.env.PREDICTION_DAYS || 6)) {
  const count = Math.max(1, Math.min(10, days));
  const from = dateInTimeZone();
  const dates = Array.from({ length: count }, (_, index) => addDays(from, index));
  return { from, to: dates[dates.length - 1], days: dates };
}

export async function rebuildPredictions(from?: string, to?: string) {
  const defaults = predictionWindow();
  const start = from || defaults.from;
  const end = to || defaults.to;
  const snapshotFrom = addDays(start, -7);
  const [fixtures, historicalMatches, externalStreakSnapshots] = await Promise.all([
    listUpcomingFixtures(start, end),
    allMatches(),
    listStreakSnapshots(snapshotFrom, end)
  ]);

  const historicalMatchesWithHtFt = historicalMatches.filter((match) =>
    typeof match.halfTimeHomeGoals === 'number' && typeof match.halfTimeAwayGoals === 'number'
  ).length;
  const historicalMatchesWith1X2Odds = historicalMatches.filter((match) => Boolean(
    (match.odds.openingHome ?? match.odds.closingHome)
    && (match.odds.openingDraw ?? match.odds.closingDraw)
    && (match.odds.openingAway ?? match.odds.closingAway)
  )).length;
  const historicalMatchesWithTotalsOdds = historicalMatches.filter((match) => Boolean(
    (match.odds.openingOver25 ?? match.odds.closingOver25)
    && (match.odds.openingUnder25 ?? match.odds.closingUnder25)
  )).length;

  const battles = fixtures.map((fixture) => analyzeFixtureBattle(fixture, historicalMatches, externalStreakSnapshots));
  const predictions = battles.flatMap((battle) => battle.prediction ? [battle.prediction] : []);
  const rejections = battles.flatMap((battle) => battle.rejection ? [battle.rejection] : []);
  const snapshots = battles.flatMap((battle) => battle.snapshots);
  const confrontations = battles.flatMap((battle) => battle.confrontation ? [battle.confrontation] : []);

  const athenaRuns = enabled('ATHENA_ENGINE_ENABLED', true)
    ? fixtures.map((fixture, index) => buildAthenaShadowRun(fixture, historicalMatches, battles[index]?.snapshots ?? []))
    : [];

  const chronosPicks = enabled('CHRONOS_ENGINE_ENABLED', true)
    ? fixtures
        .map((fixture) => buildChronosPick(fixture, historicalMatches))
        .filter((pick): pick is GodPublicPick => Boolean(pick))
    : [];
  const athenaPicks = enabled('ATHENA_ENGINE_ENABLED', true) ? buildAthenaPicks(athenaRuns, fixtures) : [];
  const aresPicks = enabled('ARES_ENGINE_ENABLED', true)
    ? fixtures
        .map((fixture) => buildAresPick(fixture, historicalMatches, externalStreakSnapshots))
        .filter((pick): pick is GodPublicPick => Boolean(pick))
    : [];
  const zeusAutoPicks = enabled('ZEUS_ENGINE_ENABLED', true)
    ? buildZeusAutoPicks([...chronosPicks, ...athenaPicks, ...aresPicks], fixtures)
    : [];
  const godPicks = [...chronosPicks, ...athenaPicks, ...aresPicks, ...zeusAutoPicks];

  await clearPredictionsForWindow(start, end, ENGINE_VERSION);
  const [, , , , , godPicksPublished] = await Promise.all([
    upsertPredictions(predictions),
    replaceRejectedBattles(start, end, ENGINE_VERSION, rejections),
    upsertStreakSnapshots(snapshots),
    upsertConfrontationRecords(confrontations),
    replaceAthenaShadowRuns(start, end, ATHENA_ENGINE_VERSION, athenaRuns),
    replaceGodPicks(start, end, OLYMPIAN_ENGINE_VERSION, godPicks)
  ]);

  return {
    window: { from: start, to: end },
    fixtures: fixtures.length,
    fixturesWith1X2: fixtures.filter((fixture) => Boolean(fixture.odds.home && fixture.odds.draw && fixture.odds.away)).length,
    fixtureLeagues: new Set(fixtures.map((fixture) => `${fixture.country}|${fixture.leagueName}`)).size,
    predictions: predictions.length,
    fullPicks: predictions.filter((prediction) => prediction.tier === 'full').length,
    provisionalPicks: predictions.filter((prediction) => prediction.tier === 'provisional').length,
    bankers: predictions.filter((prediction) => prediction.banker).length,
    lowOddsUpgrades: predictions.filter((prediction) => prediction.upgraded).length,
    rejectedBattles: rejections.length,
    streakSnapshots: snapshots.length,
    confrontationRecords: confrontations.length,
    externalStreakSnapshots: externalStreakSnapshots.length,
    historyCoverage: {
      matches: historicalMatches.length,
      withHtFt: historicalMatchesWithHtFt,
      with1X2Odds: historicalMatchesWith1X2Odds,
      withTotalsOdds: historicalMatchesWithTotalsOdds
    },
    chronosPicks: chronosPicks.length,
    athenaRuns: athenaRuns.length,
    athenaPicks: athenaPicks.length,
    athenaShadowRuns: athenaRuns.length,
    athenaShadowPicks: athenaPicks.length,
    athenaShadowBankers: athenaRuns.filter((run) => run.banker).length,
    aresPicks: aresPicks.length,
    zeusAutoPicks: zeusAutoPicks.length,
    godPicksPublished
  };
}

export async function syncUpcomingPredictions() {
  const window = predictionWindow();
  const providerResult = await fetchMultiLeagueUpcomingFixtures(window.from, window.to);
  await upsertUpcomingFixtures(providerResult.fixtures);

  let historyBootstrap: HistoricalBootstrapReport = {
    enabled: String(process.env.API_FOOTBALL_HISTORY_ENABLED ?? 'true').toLowerCase() !== 'false',
    consideredLeagues: 0,
    requestedLeagues: 0,
    skippedLeagues: 0,
    matchesFetched: 0,
    warnings: [],
    leagues: []
  };
  let historicalMatchesImported = 0;
  try {
    const existingMatches = await allMatches();
    const hydrated = await fetchHistoricalMatchesForUpcoming(providerResult.fixtures, existingMatches);
    historyBootstrap = hydrated.report;
    if (hydrated.matches.length) historicalMatchesImported = await upsertMatches(hydrated.matches, 'api-football');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    historyBootstrap = { ...historyBootstrap, warnings: [...historyBootstrap.warnings, message] };
    console.warn('[Betynz history bootstrap] Continuing without additional history:', error);
  }

  const rebuilt = await rebuildPredictions(window.from, window.to);
  return {
    ...rebuilt,
    window,
    providers: providerResult.report,
    historyBootstrap,
    historicalMatchesImported
  };
}

export async function getPredictionDashboard(from?: string, to?: string): Promise<PredictionDashboard> {
  const defaults = predictionWindow();
  const start = from || defaults.from;
  const end = to || defaults.to;
  const days: string[] = [];
  for (let cursor = start; cursor <= end && days.length < 10; cursor = addDays(cursor, 1)) days.push(cursor);

  const [allPredictions, fixtures, athenaShadowRuns, storedGodPicks] = await Promise.all([
    listPredictions(start, end),
    listUpcomingFixtures(start, end),
    listAthenaShadowRuns(start, end, 5000),
    listGodPicks(start, end, OLYMPIAN_ENGINE_VERSION)
  ]);

  const hasCurrentEngineRows = allPredictions.some((prediction) => prediction.engineVersion === ENGINE_VERSION);
  const hasCurrentGodRows = storedGodPicks.length > 0;

  const currentEnginePredictions = allPredictions.filter((prediction) => prediction.engineVersion === ENGINE_VERSION);
  const fallbackEngineVersion = currentEnginePredictions.length === 0
    ? [...allPredictions].sort((a, b) => b.runAt.localeCompare(a.runAt))[0]?.engineVersion
    : undefined;
  const activeEngineVersion = fallbackEngineVersion || ENGINE_VERSION;
  const activePredictions = currentEnginePredictions.length > 0
    ? currentEnginePredictions
    : allPredictions.filter((prediction) => prediction.engineVersion === activeEngineVersion);
  const sorted = [...activePredictions].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const bankers = sorted
    .filter((prediction) => prediction.banker && prediction.tier === 'full')
    .sort((a, b) => b.confidence - a.confidence || b.edge - a.edge);

  let godPicks = storedGodPicks;
  if (!godPicks.length && sourceName() === 'demo') {
    const chronos = buildChronosPicks(sorted);
    const athena = buildAthenaPicks(athenaShadowRuns, fixtures);
    godPicks = [...chronos, ...athena, ...buildZeusAutoPicks([...chronos, ...athena], fixtures)];
  }

  const chronosPicks = enabled('CHRONOS_PUBLIC_ENABLED', true) ? byGod(godPicks, 'chronos') : [];
  const athenaPicks = enabled('ATHENA_PUBLIC_ENABLED', true) ? byGod(godPicks, 'athena') : [];
  const aresPicks = enabled('ARES_PUBLIC_ENABLED', true) ? byGod(godPicks, 'ares') : [];
  const zeusAutoPicks = enabled('ZEUS_PUBLIC_ENABLED', true) ? byGod(godPicks, 'zeus') : [];
  const publicPicks = [...chronosPicks, ...athenaPicks, ...aresPicks, ...zeusAutoPicks];
  const radarFixtures = fixtures
    .filter((fixture) => Boolean(fixture.odds.home && fixture.odds.draw && fixture.odds.away))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  return {
    source: sourceName(),
    generatedAt: new Date().toISOString(),
    engineVersion: OLYMPIAN_ENGINE_VERSION,
    currentEngineReady: hasCurrentEngineRows && hasCurrentGodRows,
    rebuilding: isPipelineRunning(),
    window: { from: start, to: end, days },
    metrics: {
      fixtures: fixtures.length,
      picks: publicPicks.length,
      fullPicks: sorted.filter((prediction) => prediction.tier === 'full').length,
      provisionalPicks: sorted.filter((prediction) => prediction.tier === 'provisional').length,
      bankers: publicPicks.filter((pick) => pick.banker).length,
      leagues: new Set(fixtures.map((fixture) => `${fixture.country}|${fixture.leagueName}`)).size,
      pickLeagues: new Set(publicPicks.map((pick) => `${pick.country}|${pick.leagueName}`)).size,
      lowOddsUpgrades: sorted.filter((prediction) => prediction.upgraded).length,
      pricedFixtures: radarFixtures.length,
      zeusAutoPicks: zeusAutoPicks.length,
      chronosPublicPicks: chronosPicks.length,
      aresPublicPicks: aresPicks.length,
      athenaShadowRuns: athenaShadowRuns.length,
      athenaShadowPicks: athenaShadowRuns.filter((run) => run.marketKey !== ATHENA_MARKETS.NO_PICK).length,
      athenaShadowBankers: athenaShadowRuns.filter((run) => run.banker).length,
      athenaPublicPicks: athenaPicks.length
    },
    bankers,
    predictions: sorted,
    zeusAutoPicks,
    chronosPicks,
    athenaPicks,
    aresPicks,
    radarFixtures
  };
}
