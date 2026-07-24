import { fetchMultiLeagueUpcomingFixtures } from './fixture-provider.js';
import { buildAthenaShadowRun } from './athena-service.js';
import { ATHENA_ENGINE_VERSION, ATHENA_MARKETS } from './athena-transition.js';
import { analyzeFixtureBattle, ENGINE_VERSION } from './engine.js';
import {
  allMatches,
  clearPredictionsForWindow,
  listPredictions,
  listStreakSnapshots,
  listUpcomingFixtures,
  listAthenaShadowRuns,
  sourceName,
  upsertConfrontationRecords,
  upsertPredictions,
  upsertStreakSnapshots,
  replaceRejectedBattles,
  replaceAthenaShadowRuns,
  upsertUpcomingFixtures
} from './store.js';
import type { AthenaPublicPick, PredictionDashboard, UpcomingFixture } from './forecast-types.js';
import type { AthenaShadowRun } from './athena-types.js';

let lazyRebuildPromise: Promise<void> | null = null;
let lastLazyRebuildAttempt = 0;
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

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100)}%` : null;
}

function athenaStatsLine(run: AthenaShadowRun) {
  const home = run.metrics?.home;
  const away = run.metrics?.away;
  const parts: string[] = [];
  const homeUnder = percent(home?.under25Rate);
  const awayUnder = percent(away?.under25Rate);
  const homeHtDraw = percent(home?.htDrawRate);
  const awayHtDraw = percent(away?.htDrawRate);
  if (homeUnder && awayUnder) parts.push(`U2.5 ${homeUnder} / ${awayUnder}`);
  if (homeHtDraw && awayHtDraw) parts.push(`HT draw ${homeHtDraw} / ${awayHtDraw}`);
  if (parts.length < 2 && Number.isFinite(Number(home?.averageTotalGoals)) && Number.isFinite(Number(away?.averageTotalGoals))) {
    parts.push(`Avg goals ${Number(home.averageTotalGoals).toFixed(1)} / ${Number(away.averageTotalGoals).toFixed(1)}`);
  }
  return parts.slice(0, 2).join(' · ') || `Athena score ${Math.round(run.score)}%`;
}

function athenaMarketOdd(run: AthenaShadowRun, fixture?: UpcomingFixture) {
  if (!fixture) return undefined;
  const odds = fixture.odds;
  const map: Record<string, number | undefined> = {
    HOME_DNB: odds.homeDnb, AWAY_DNB: odds.awayDnb, HOME_OR_DRAW: odds.dc1x, AWAY_OR_DRAW: odds.dcx2,
    HOME_TEAM_OVER_0_5: odds.homeOver05, AWAY_TEAM_OVER_0_5: odds.awayOver05, OVER_1_5: odds.over15,
    OVER_2_5: odds.over25, UNDER_2_5: odds.under25, UNDER_3_5: odds.under35, FULL_TIME_DRAW: odds.draw
  };
  const value = map[run.marketKey];
  return value && Number.isFinite(value) ? value : undefined;
}

function toAthenaPublicPick(run: AthenaShadowRun, fixture?: UpcomingFixture): AthenaPublicPick {
  return {
    fixtureId: run.fixtureId, engineVersion: run.engineVersion, date: run.date, kickoff: run.kickoff,
    leagueCode: run.leagueCode, leagueName: run.leagueName, country: run.country, homeTeam: run.homeTeam, awayTeam: run.awayTeam,
    selection: run.marketLabel, marketKey: run.marketKey, score: run.score, banker: run.banker, odds: athenaMarketOdd(run, fixture),
    statsLine: athenaStatsLine(run), settledStatus: run.settledStatus
  };
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

  const battles = fixtures.map((fixture) => analyzeFixtureBattle(fixture, historicalMatches, externalStreakSnapshots));
  const predictions = battles.flatMap((battle) => battle.prediction ? [battle.prediction] : []);
  const rejections = battles.flatMap((battle) => battle.rejection ? [battle.rejection] : []);
  const snapshots = battles.flatMap((battle) => battle.snapshots);
  const confrontations = battles.flatMap((battle) => battle.confrontation ? [battle.confrontation] : []);
  const athenaEnabled = String(process.env.ATHENA_SHADOW_ENABLED ?? 'true').toLowerCase() !== 'false';
  const athenaRuns = athenaEnabled
    ? fixtures.map((fixture, index) => buildAthenaShadowRun(fixture, historicalMatches, battles[index]?.snapshots ?? []))
    : [];

  await clearPredictionsForWindow(start, end, ENGINE_VERSION);
  await Promise.all([
    upsertPredictions(predictions),
    replaceRejectedBattles(start, end, ENGINE_VERSION, rejections),
    upsertStreakSnapshots(snapshots),
    upsertConfrontationRecords(confrontations),
    replaceAthenaShadowRuns(start, end, ATHENA_ENGINE_VERSION, athenaRuns)
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
    athenaShadowRuns: athenaRuns.length,
    athenaShadowPicks: athenaRuns.filter((run) => run.marketKey !== ATHENA_MARKETS.NO_PICK).length,
    athenaShadowBankers: athenaRuns.filter((run) => run.banker).length
  };
}

export async function syncUpcomingPredictions() {
  const window = predictionWindow();
  const providerResult = await fetchMultiLeagueUpcomingFixtures(window.from, window.to);
  await upsertUpcomingFixtures(providerResult.fixtures);
  const rebuilt = await rebuildPredictions(window.from, window.to);
  return {
    ...rebuilt,
    window,
    providers: providerResult.report
  };
}

export async function getPredictionDashboard(from?: string, to?: string): Promise<PredictionDashboard> {
  const defaultWindow = predictionWindow();
  const start = from || defaultWindow.from;
  const end = to || defaultWindow.to;
  const days: string[] = [];
  for (let cursor = start; cursor <= end && days.length < 10; cursor = addDays(cursor, 1)) days.push(cursor);
  const [allPredictions, fixtures, athenaShadowRuns] = await Promise.all([
    listPredictions(start, end),
    listUpcomingFixtures(start, end),
    listAthenaShadowRuns(start, end, 5000)
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
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const athenaPublicEnabled = String(process.env.ATHENA_PUBLIC_ENABLED ?? 'true').toLowerCase() !== 'false';
  const athenaPicks = athenaPublicEnabled
    ? athenaShadowRuns
        .filter((run) => run.marketKey !== ATHENA_MARKETS.NO_PICK)
        .map((run) => toAthenaPublicPick(run, fixtureById.get(run.fixtureId)))
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    : [];
  const currentEnginePredictions = allPredictions.filter((prediction) => prediction.engineVersion === ENGINE_VERSION);
  const fallbackEngineVersion = currentEnginePredictions.length === 0
    ? [...allPredictions].sort((a, b) => b.runAt.localeCompare(a.runAt))[0]?.engineVersion
    : undefined;
  const activeEngineVersion = fallbackEngineVersion || ENGINE_VERSION;
  const activePredictions = currentEnginePredictions.length > 0
    ? currentEnginePredictions
    : allPredictions.filter((prediction) => prediction.engineVersion === activeEngineVersion);
  const sorted = activePredictions
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
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
  return {
    source: sourceName(),
    generatedAt: new Date().toISOString(),
    engineVersion: activeEngineVersion,
    currentEngineReady: currentEnginePredictions.length > 0,
    rebuilding: Boolean(lazyRebuildPromise),
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
      athenaShadowRuns: athenaShadowRuns.length,
      athenaShadowPicks: athenaShadowRuns.filter((run) => run.marketKey !== ATHENA_MARKETS.NO_PICK).length,
      athenaShadowBankers: athenaShadowRuns.filter((run) => run.banker).length,
      athenaPublicPicks: athenaPicks.length
    },
    bankers,
    predictions: sorted,
    zeusAutoPicks,
    athenaPicks,
    radarFixtures
  };
}
