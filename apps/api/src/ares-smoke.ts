import assert from 'node:assert/strict';
import { analyzeAresFixture, analyzeFixture, ARES_ENGINE_VERSION, ENGINE_VERSION } from './engine.js';
import type { UpcomingFixture } from './forecast-types.js';
import type { NormalizedMatch } from './types.js';

const openingOdds = {
  openingHome: 1.55,
  openingDraw: 4,
  openingAway: 6,
  openingOver25: 1.8,
  openingUnder25: 2
};

const matches: NormalizedMatch[] = [];

for (let index = 0; index < 130; index += 1) {
  const draw = index % 10 === 0;
  matches.push({
    id: `ares-history-${index}`,
    leagueCode: 'ARES',
    leagueName: 'Ares Test League',
    season: '2026',
    date: `2026-${String(1 + Math.floor(index / 28)).padStart(2, '0')}-${String(1 + (index % 28)).padStart(2, '0')}`,
    homeTeam: `History Home ${index}`,
    awayTeam: `History Away ${index}`,
    homeGoals: draw ? 1 : 2,
    awayGoals: draw ? 1 : 0,
    halfTimeHomeGoals: draw ? 0 : 1,
    halfTimeAwayGoals: 0,
    result: draw ? 'D' : 'H',
    odds: openingOdds
  });
}

for (let index = 0; index < 10; index += 1) {
  matches.push({
    id: `ares-favourite-${index}`,
    leagueCode: 'ARES',
    leagueName: 'Ares Test League',
    season: '2026',
    date: `2026-06-${String(1 + index).padStart(2, '0')}`,
    homeTeam: 'Ares FC',
    awayTeam: `Visitor ${index}`,
    homeGoals: 2,
    awayGoals: 0,
    halfTimeHomeGoals: 1,
    halfTimeAwayGoals: 0,
    result: 'H',
    odds: openingOdds
  });
}

for (let index = 0; index < 10; index += 1) {
  matches.push({
    id: `ares-opponent-${index}`,
    leagueCode: 'ARES',
    leagueName: 'Ares Test League',
    season: '2026',
    date: `2026-06-${String(11 + index).padStart(2, '0')}`,
    homeTeam: `Host ${index}`,
    awayTeam: 'Drift FC',
    homeGoals: 2,
    awayGoals: 0,
    halfTimeHomeGoals: 1,
    halfTimeAwayGoals: 0,
    result: 'H',
    odds: openingOdds
  });
}

const fixture: UpcomingFixture = {
  id: 'ares-smoke-fixture',
  providerFixtureId: 1,
  leagueId: 1,
  leagueCode: 'ARES',
  leagueName: 'Ares Test League',
  country: 'Testland',
  season: '2026',
  kickoff: '2026-07-24T18:00:00Z',
  date: '2026-07-24',
  status: 'NS',
  homeTeam: 'Ares FC',
  awayTeam: 'Drift FC',
  dataQuality: 95,
  odds: { home: 1.55, draw: 4, away: 6 }
};

const prediction = analyzeFixture(fixture, matches);
if (!prediction) throw new Error('Expected Ares to identify the favorite.');
assert.equal(prediction.engineVersion, ENGINE_VERSION);
assert.equal(prediction.qualification, 'ARES_STREAK_FAVOURITE');
assert.equal(prediction.marketKey, 'HOME_WIN');
assert(prediction.odds >= 1.19 && prediction.odds < 1.60);
assert(Number(prediction.evidence.aresScore) >= 68);



const thinLeagueMatches: NormalizedMatch[] = [];
for (let index = 0; index < 130; index += 1) {
  thinLeagueMatches.push({
    id: `global-pool-${index}`,
    leagueCode: 'GLOBAL',
    leagueName: 'Global Odds Pool',
    season: '2026',
    date: `2026-${String(1 + Math.floor(index / 28)).padStart(2, '0')}-${String(1 + (index % 28)).padStart(2, '0')}`,
    homeTeam: `Pool Home ${index}`,
    awayTeam: `Pool Away ${index}`,
    homeGoals: 2,
    awayGoals: 0,
    halfTimeHomeGoals: 1,
    halfTimeAwayGoals: 0,
    result: 'H',
    odds: openingOdds
  });
}
for (let index = 0; index < 6; index += 1) {
  thinLeagueMatches.push({
    id: `thin-favourite-${index}`,
    leagueCode: 'THIN',
    leagueName: 'Thin Ares League',
    season: '2026',
    date: `2026-06-${String(1 + index).padStart(2, '0')}`,
    homeTeam: 'Thin Ares FC',
    awayTeam: `Thin Visitor ${index}`,
    homeGoals: 2,
    awayGoals: 0,
    halfTimeHomeGoals: 1,
    halfTimeAwayGoals: 0,
    result: 'H',
    odds: openingOdds
  });
  thinLeagueMatches.push({
    id: `thin-opponent-${index}`,
    leagueCode: 'THIN',
    leagueName: 'Thin Ares League',
    season: '2026',
    date: `2026-06-${String(11 + index).padStart(2, '0')}`,
    homeTeam: `Thin Host ${index}`,
    awayTeam: 'Thin Drift FC',
    homeGoals: 2,
    awayGoals: 0,
    halfTimeHomeGoals: 1,
    halfTimeAwayGoals: 0,
    result: 'H',
    odds: openingOdds
  });
}
const thinFixture: UpcomingFixture = {
  ...fixture,
  id: 'ares-thin-history',
  leagueCode: 'THIN',
  leagueName: 'Thin Ares League',
  homeTeam: 'Thin Ares FC',
  awayTeam: 'Thin Drift FC'
};
const provisionalAres = analyzeFixture(thinFixture, thinLeagueMatches);
if (!provisionalAres) throw new Error('Expected provisional Ares to identify the favorite with external/global price history.');
assert.equal(provisionalAres.qualification, 'ARES_STREAK_FAVOURITE');
assert.equal(provisionalAres.tier, 'provisional');
assert.equal(provisionalAres.banker, false);


const refinedAres = analyzeAresFixture(fixture, matches);
if (!refinedAres) throw new Error('Expected independent Ares assessment for the sub-1.60 favorite.');
assert.equal(refinedAres.engineVersion, ARES_ENGINE_VERSION);
assert.equal(refinedAres.qualification, 'ARES_STREAK_FAVOURITE');
assert(['ELITE', 'STRONG'].includes(String(refinedAres.evidence.aresGrade)));

const watchlistFixture: UpcomingFixture = {
  ...fixture,
  id: 'ares-watchlist-fixture',
  leagueCode: 'NEW',
  leagueName: 'New Ares League',
  homeTeam: 'New Favorite FC',
  awayTeam: 'New Opponent FC',
  dataQuality: 60,
  odds: { home: 1.48, draw: 4.2, away: 6.4 }
};
const watchlist = analyzeAresFixture(watchlistFixture, matches);
if (!watchlist) throw new Error('Expected every complete sub-1.60 favorite to enter the Ares candidate feed.');
assert.equal(watchlist.qualification, 'ARES_WATCHLIST');
assert.equal(watchlist.banker, false);

const refinedBoundary = analyzeAresFixture({ ...fixture, id: 'ares-refined-160-boundary', odds: { home: 1.60, draw: 4, away: 6 } }, matches);
assert.equal(refinedBoundary, null, 'Exactly 1.60 must not enter the refined Ares candidate feed.');

const boundary = analyzeFixture({ ...fixture, id: 'ares-160-boundary', odds: { home: 1.60, draw: 4, away: 6 } }, matches);
assert.notEqual(boundary?.qualification, 'ARES_STREAK_FAVOURITE', 'Exactly 1.60 must not enter the Ares feed.');

console.log(JSON.stringify({
  ok: true,
  engineVersion: ENGINE_VERSION,
  selection: prediction.selection,
  odds: prediction.odds,
  qualification: prediction.qualification,
  aresScore: prediction.evidence.aresScore,
  boundary160Excluded: true,
  provisionalFallback: provisionalAres.selection,
  refinedEngineVersion: ARES_ENGINE_VERSION,
  refinedGrade: refinedAres.evidence.aresGrade,
  watchlistVisible: watchlist.qualification
}, null, 2));
