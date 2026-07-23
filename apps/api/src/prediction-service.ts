import { fetchMultiLeagueUpcomingFixtures } from './fixture-provider.js';
import { analyzeFixture, ENGINE_VERSION } from './engine.js';
import {
  allMatches,
  clearPredictionsForWindow,
  listPredictions,
  listUpcomingFixtures,
  sourceName,
  upsertPredictions,
  upsertUpcomingFixtures
} from './store.js';
import type { PredictionDashboard } from './forecast-types.js';

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
  const [fixtures, historicalMatches] = await Promise.all([
    listUpcomingFixtures(start, end),
    allMatches()
  ]);

  const predictions = fixtures
    .map((fixture) => analyzeFixture(fixture, historicalMatches))
    .filter((prediction) => prediction !== null);

  await clearPredictionsForWindow(start, end, ENGINE_VERSION);
  await upsertPredictions(predictions);

  return {
    window: { from: start, to: end },
    fixtures: fixtures.length,
    fixturesWith1X2: fixtures.filter((fixture) => Boolean(fixture.odds.home && fixture.odds.draw && fixture.odds.away)).length,
    fixtureLeagues: new Set(fixtures.map((fixture) => `${fixture.country}|${fixture.leagueName}`)).size,
    predictions: predictions.length,
    fullPicks: predictions.filter((prediction) => prediction.tier === 'full').length,
    provisionalPicks: predictions.filter((prediction) => prediction.tier === 'provisional').length,
    bankers: predictions.filter((prediction) => prediction.banker).length,
    lowOddsUpgrades: predictions.filter((prediction) => prediction.upgraded).length
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
  const [allPredictions, fixtures] = await Promise.all([
    listPredictions(start, end),
    listUpcomingFixtures(start, end)
  ]);
  const radarFixtures = fixtures
    .filter((fixture) => Boolean(fixture.odds.home && fixture.odds.draw && fixture.odds.away))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const sorted = allPredictions
    .filter((prediction) => prediction.engineVersion === ENGINE_VERSION)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const bankers = [...sorted]
    .filter((prediction) => prediction.banker && prediction.tier === 'full')
    .sort((a, b) => b.confidence - a.confidence || b.edge - a.edge);
  return {
    source: sourceName(),
    generatedAt: new Date().toISOString(),
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
      pricedFixtures: radarFixtures.length
    },
    bankers,
    predictions: sorted,
    radarFixtures
  };
}
