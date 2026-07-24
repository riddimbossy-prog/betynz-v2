import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseFixture, CLASSIFICATIONS, MARKETS } from '../src/index.js';

const make = (home, away, odds = undefined) => ({ id: 'test', home, away, odds });

const team = (name, htft, over25, under25, avg, gf = 20, ga = 20) => ({
  name,
  matchesPlayed: Object.values(htft).reduce((a, b) => a + b, 0),
  htft,
  goals: { over25, under25, averageTotalGoals: avg, goalsFor: gf, goalsAgainst: ga }
});

test('detects stable leader and team win either half', () => {
  const home = team('Bodo/Glimt', { ww: 10, wd: 0, wl: 0, dw: 0, dd: 1, dl: 0, lw: 0, ld: 1, ll: 2 }, 9, 5, 3.2, 34, 11);
  const away = team('HamKam', { ww: 4, wd: 0, wl: 0, dw: 1, dd: 2, dl: 0, lw: 0, ld: 1, ll: 5 }, 10, 3, 3.5, 20, 25);
  const result = analyseFixture(make(home, away, { home: 1.10, draw: 10, away: 18 }));
  assert.equal(result.classification.side, 'HOME');
  assert.equal(result.banker.market, MARKETS.HOME_WIN_EITHER_HALF);
});

test('detects draw lock', () => {
  const home = team('A', { ww: 3, wd: 2, wl: 0, dw: 3, dd: 6, dl: 2, lw: 0, ld: 1, ll: 2 }, 7, 12, 2.2);
  const away = team('B', { ww: 2, wd: 1, wl: 0, dw: 3, dd: 6, dl: 3, lw: 0, ld: 1, ll: 3 }, 7, 12, 2.1);
  const result = analyseFixture(make(home, away));
  assert.equal(result.classification.type, CLASSIFICATIONS.DRAW_LOCK);
});

test('detects high-event matchup and prefers goals when direction conflicts', () => {
  const home = team('Home', { ww: 5, wd: 1, wl: 0, dw: 2, dd: 0, dl: 1, lw: 1, ld: 0, ll: 4 }, 10, 4, 4.7, 29, 37);
  const away = team('Away', { ww: 3, wd: 0, wl: 0, dw: 4, dd: 0, dl: 1, lw: 1, ld: 1, ll: 4 }, 9, 5, 4.3, 34, 26);
  const result = analyseFixture(make(home, away, { home: 2.2, draw: 3.9, away: 2.6 }));
  assert.equal(result.classification.type, CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION);
  assert.ok([MARKETS.OVER_1_5, MARKETS.OVER_2_5, MARKETS.HOME_WIN_EITHER_HALF].includes(result.banker.market));
});

test('returns no pick when no market clears frozen threshold', () => {
  const home = team('Home', { ww: 1, wd: 2, wl: 1, dw: 2, dd: 2, dl: 2, lw: 1, ld: 2, ll: 1 }, 6, 8, 2.5);
  const away = team('Away', { ww: 1, wd: 2, wl: 1, dw: 2, dd: 2, dl: 2, lw: 1, ld: 2, ll: 1 }, 6, 8, 2.5);
  const result = analyseFixture(make(home, away), { minBankerScore: 95 });
  assert.equal(result.banker.market, MARKETS.NO_PICK);
});
