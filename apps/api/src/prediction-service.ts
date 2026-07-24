import { fetchMultiLeagueUpcomingFixtures, fetchRescueUpcomingFixtures, mergeProviderFixtures, type ProviderSyncReport } from './fixture-provider.js';
import { analyzeFixtureBattle, ENGINE_VERSION } from './engine.js';
import {
  allMatches,
  clearPredictionsForWindow,
  listPredictions,
  listStreakSnapshots,
  listUpcomingFixtures,
  sourceName,
  upsertConfrontationRecords,
  upsertPredictions,
  upsertStreakSnapshots,
  replaceRejectedBattles,
  upsertUpcomingFixtures
} from './store.js';
import type { PredictionDashboard } from './forecast-types.js';

export type PredictionSyncStatus = {
  at: string;
  ok: boolean;
  source: 'fresh-provider' | 'provider-rescue' | 'retained-database' | 'none';
  window: { from: string; to: string };
  fixtures: number;
  pricedFixtures: number;
  message: string;
  providerReport?: ProviderSyncReport;
};

let lazyRebuildPromise: Promise<void> | null = null;
let lastLazyRebuildAttempt = 0;
let lastSyncStatus: PredictionSyncStatus | null = null;
const LAZY_REBUILD_COOLDOWN_MS = 10 * 60 * 1000;

function dateInTimeZone(timeZone = process.env.PREDICTION_TIMEZONE || 'Africa/Accra') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function pricedFixtures<T extends { odds: { home?: number; draw?: number; away?: number } }>(fixtures: T[]) {
  return fixtures.filter((fixture) => Boolean(fixture.odds.home && fixture.odds.draw && fixture.odds.away)).length;
}

export function predictionWindow(days = Number(process.env.PREDICTION_DAYS || 6)) {
  const count = Math.max(1, Math.min(10, days));
  const from = dateInTimeZone();
  const dates = Array.from({ length: count }, (_, index) => addDays(from, index));
  return { from, to: dates[dates.length - 1], days: dates };
}

export function predictionSyncStatus() {
  return lastSyncStatus;
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

  const battles = fixtures.map((fixture) => analyzeFixtureBattle(fixture, historicalMatches, externalStreakSnapshots));
  const predictions = battles.flatMap((battle) => battle.prediction ? [battle.prediction] : []);
  const rejections = battles.flatMap((battle) => battle.rejection ? [battle.rejection] : []);
  const snapshots = battles.flatMap((battle) => battle.snapshots);
  const confrontations = battles.flatMap((battle) => battle.confrontation ? [battle.confrontation] : []);

  await clearPredictionsForWindow(start, end, ENGINE_VERSION);
  await Promise.all([
    upsertPredictions(predictions),
    replaceRejectedBattles(start, end, ENGINE_VERSION, rejections),
    upsertStreakSnapshots(snapshots),
    upsertConfrontationRecords(confrontations)
  ]);

  return {
    window: { from: start, to: end },
    fixtures: fixtures.length,
    fixturesWith1X2: pricedFixtures(fixtures),
    fixtureLeagues: new Set(fixtures.map((fixture) => `${fixture.country}|${fixture.leagueName}`)).size,
    predictions: predictions.length,
    fullPicks: predictions.filter((prediction) => prediction.tier === 'full').length,
    provisionalPicks: predictions.filter((prediction) => prediction.tier === 'provisional').length,
    bankers: predictions.filter((prediction) => prediction.banker).length,
    lowOddsUpgrades: predictions.filter((prediction) => prediction.upgraded).length,
    rejectedBattles: rejections.length,
    streakSnapshots: snapshots.length,
    confrontationRecords: confrontations.length,
    externalStreakSnapshots: externalStreakSnapshots.length
  };
}

async function rebuildFromRetainedFixtures(from: string, to: string, failure: unknown, providerReport?: ProviderSyncReport) {
  const [retained, existingPredictions] = await Promise.all([
    listUpcomingFixtures(from, to),
    listPredictions(from, to)
  ]);
  if (!retained.length) {
    const message = failure instanceof Error ? failure.message : String(failure);
    lastSyncStatus = {
      at: new Date().toISOString(),
      ok: false,
      source: 'none',
      window: { from, to },
      fixtures: 0,
      pricedFixtures: 0,
      message: `Fresh providers failed and there are no retained fixtures: ${message}`,
      providerReport
    };
    throw new Error(lastSyncStatus.message);
  }

  const currentPredictions = existingPredictions.filter((prediction) => prediction.engineVersion === ENGINE_VERSION);
  const rebuilt = currentPredictions.length
    ? {
        window: { from, to },
        fixtures: retained.length,
        fixturesWith1X2: pricedFixtures(retained),
        fixtureLeagues: new Set(retained.map((fixture) => `${fixture.country}|${fixture.leagueName}`)).size,
        predictions: currentPredictions.length,
        fullPicks: currentPredictions.filter((prediction) => prediction.tier === 'full').length,
        provisionalPicks: currentPredictions.filter((prediction) => prediction.tier === 'provisional').length,
        bankers: currentPredictions.filter((prediction) => prediction.banker && prediction.tier === 'full').length,
        lowOddsUpgrades: currentPredictions.filter((prediction) => prediction.upgraded).length,
        rejectedBattles: 0,
        streakSnapshots: 0,
        confrontationRecords: 0,
        externalStreakSnapshots: 0
      }
    : await rebuildPredictions(from, to);
  const message = failure instanceof Error ? failure.message : String(failure);
  lastSyncStatus = {
    at: new Date().toISOString(),
    ok: true,
    source: 'retained-database',
    window: { from, to },
    fixtures: retained.length,
    pricedFixtures: pricedFixtures(retained),
    message: currentPredictions.length
      ? `Fresh collection failed, so Betynz kept ${retained.length} existing fixtures and ${currentPredictions.length} current-engine picks. ${message}`
      : `Fresh collection failed, so Betynz kept and rebuilt from ${retained.length} existing database fixtures. ${message}`,
    providerReport
  };
  return {
    ...rebuilt,
    window: { from, to, days: [] as string[] },
    retained: true,
    syncStatus: lastSyncStatus,
    providers: providerReport
  };
}

export async function syncUpcomingPredictions() {
  const window = predictionWindow();
  try {
    const providerResult = await fetchMultiLeagueUpcomingFixtures(window.from, window.to);
    await upsertUpcomingFixtures(providerResult.fixtures);
    const rebuilt = await rebuildPredictions(window.from, window.to);
    const rescued = providerResult.report.rescue.triggered || providerResult.report.selectedSource === 'api-football-rescue';
    lastSyncStatus = {
      at: new Date().toISOString(),
      ok: true,
      source: rescued ? 'provider-rescue' : 'fresh-provider',
      window: { from: window.from, to: window.to },
      fixtures: providerResult.fixtures.length,
      pricedFixtures: pricedFixtures(providerResult.fixtures),
      message: rescued
        ? `BetExplorer needed rescue. Betynz continued with ${providerResult.report.selectedSource} and preserved the existing board.`
        : `Fresh fixtures loaded from ${providerResult.report.selectedSource}.`,
      providerReport: providerResult.report
    };
    return {
      ...rebuilt,
      window,
      retained: false,
      syncStatus: lastSyncStatus,
      providers: providerResult.report
    };
  } catch (error) {
    return rebuildFromRetainedFixtures(window.from, window.to, error);
  }
}

export async function rescueUpcomingPredictions(from?: string, to?: string) {
  const defaults = predictionWindow();
  const start = from || defaults.from;
  const end = to || defaults.to;
  try {
    const providerResult = await fetchRescueUpcomingFixtures(start, end);
    if (!providerResult.fixtures.length) {
      throw new Error(providerResult.report.warnings.join(' ') || 'Provider rescue returned zero fixtures.');
    }
    const existingFixtures = await listUpcomingFixtures(start, end);
    const existingBetExplorer = existingFixtures.filter((fixture) => fixture.provider === 'betexplorer' || fixture.provider === 'hybrid');
    const rescuedBoard = existingBetExplorer.length
      ? mergeProviderFixtures(providerResult.fixtures, existingBetExplorer).fixtures
      : providerResult.fixtures;
    await upsertUpcomingFixtures(rescuedBoard);
    const rebuilt = await rebuildPredictions(start, end);
    lastSyncStatus = {
      at: new Date().toISOString(),
      ok: true,
      source: 'provider-rescue',
      window: { from: start, to: end },
      fixtures: rescuedBoard.length,
      pricedFixtures: pricedFixtures(rescuedBoard),
      message: `Provider rescue loaded ${rescuedBoard.length} fixtures from API-Football${providerResult.report.oddsApi.matchedFixtures ? ' with The Odds API enrichment' : ''}.`,
      providerReport: providerResult.report
    };
    return {
      ...rebuilt,
      retained: false,
      syncStatus: lastSyncStatus,
      providers: providerResult.report
    };
  } catch (error) {
    return rebuildFromRetainedFixtures(start, end, error);
  }
}

export async function getPredictionDashboard(from?: string, to?: string): Promise<PredictionDashboard> {
  const defaultWindow = predictionWindow();
  const start = from || defaultWindow.from;
  const end = to || defaultWindow.to;
  const days: string[] = [];
  for (let cursor = start; cursor <= end && days.length < 10; cursor = addDays(cursor, 1)) days.push(cursor);
  const [allPredictions, fixtures] = await Promise.all([
    listPredictions(start, end),
    listUpcomingFixtures(start, end)
  ]);

  const hasCurrentEngineRows = allPredictions.some((prediction) => prediction.engineVersion === ENGINE_VERSION);
  const needsCurrentEngineRows = sourceName() === 'supabase' && fixtures.length > 0 && !hasCurrentEngineRows;

  if (needsCurrentEngineRows) {
    if (!lazyRebuildPromise && Date.now() - lastLazyRebuildAttempt >= LAZY_REBUILD_COOLDOWN_MS) {
      lastLazyRebuildAttempt = Date.now();
      lazyRebuildPromise = rebuildPredictions(start, end)
        .then(() => undefined)
        .catch((error) => {
          console.error('[Betynz] Automatic prediction rebuild failed:', error);
        })
        .finally(() => {
          lazyRebuildPromise = null;
        });
    }
  }
  const radarFixtures = fixtures
    .filter((fixture) => Boolean(fixture.odds.home && fixture.odds.draw && fixture.odds.away))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const currentEnginePredictions = allPredictions.filter((prediction) => prediction.engineVersion === ENGINE_VERSION);
  const fallbackEngineVersion = currentEnginePredictions.length === 0
    ? [...allPredictions].sort((a, b) => b.runAt.localeCompare(a.runAt))[0]?.engineVersion
    : undefined;
  const activeEngineVersion = fallbackEngineVersion || ENGINE_VERSION;
  const activePredictions = currentEnginePredictions.length > 0
    ? currentEnginePredictions
    : allPredictions.filter((prediction) => prediction.engineVersion === activeEngineVersion);
  const sorted = activePredictions.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const bankers = [...sorted]
    .filter((prediction) => prediction.banker && prediction.tier === 'full')
    .sort((a, b) => b.confidence - a.confidence || b.edge - a.edge);
  const zeusAutoPicks = [...sorted]
    .sort((a, b) => {
      const tierDifference = Number(b.tier === 'full') - Number(a.tier === 'full');
      if (tierDifference) return tierDifference;
      const bankerDifference = Number(b.banker) - Number(a.banker);
      if (bankerDifference) return bankerDifference;
      return b.confidence + b.edge * 0.6 - (a.confidence + a.edge * 0.6) || a.kickoff.localeCompare(b.kickoff);
    });
  const streakFavorites = [...sorted]
    .filter((prediction) => prediction.qualification === 'ARES_STREAK_FAVOURITE')
    .sort((a, b) => Number(b.evidence.aresScore ?? 0) - Number(a.evidence.aresScore ?? 0)
      || b.confidence - a.confidence
      || a.kickoff.localeCompare(b.kickoff));
  return {
    source: sourceName(),
    generatedAt: new Date().toISOString(),
    engineVersion: activeEngineVersion,
    currentEngineReady: currentEnginePredictions.length > 0,
    rebuilding: Boolean(lazyRebuildPromise),
    dataStatus: lastSyncStatus,
    window: { from: start, to: end, days },
    metrics: {
      fixtures: fixtures.length,
      picks: sorted.length,
      fullPicks: sorted.filter((prediction) => prediction.tier === 'full').length,
      provisionalPicks: sorted.filter((prediction) => prediction.tier === 'provisional').length,
      bankers: bankers.length,
      leagues: new Set(fixtures.map((fixture) => `${fixture.country}|${fixture.leagueName}`)).size,
      pickLeagues: new Set(sorted.map((prediction) => `${prediction.country}|${prediction.leagueName}`)).size,
      lowOddsUpgrades: sorted.filter((prediction) => prediction.upgraded).length,
      pricedFixtures: radarFixtures.length,
      zeusAutoPicks: zeusAutoPicks.length,
      streakFavorites: streakFavorites.length
    },
    bankers,
    predictions: sorted,
    zeusAutoPicks,
    streakFavorites,
    radarFixtures
  };
}
