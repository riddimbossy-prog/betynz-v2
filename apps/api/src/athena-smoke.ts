import {
  analyseAthenaFixture,
  ATHENA_CLASSIFICATIONS,
  ATHENA_MARKETS,
  type AthenaFixtureInput,
  type AthenaHtFtCounts
} from './athena-transition.js';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function team(name: string, htft: AthenaHtFtCounts, over25: number, under25: number, averageTotalGoals: number, goalsFor = 20, goalsAgainst = 20) {
  const matchesPlayed = Object.values(htft).reduce((sum, value) => sum + value, 0);
  return {
    name,
    matchesPlayed,
    htft,
    goals: { sample: matchesPlayed, over25, under25, averageTotalGoals, goalsFor, goalsAgainst }
  };
}

function fixture(home: ReturnType<typeof team>, away: ReturnType<typeof team>, odds?: AthenaFixtureInput['odds']): AthenaFixtureInput {
  return { id: 'athena-smoke', league: 'Smoke League', home, away, odds };
}

const stable = analyseAthenaFixture(fixture(
  team('Bodo/Glimt', { ww: 10, wd: 0, wl: 0, dw: 0, dd: 1, dl: 0, lw: 0, ld: 1, ll: 2 }, 9, 5, 3.2, 34, 11),
  team('HamKam', { ww: 4, wd: 0, wl: 0, dw: 1, dd: 2, dl: 0, lw: 0, ld: 1, ll: 5 }, 10, 3, 3.5, 20, 25),
  { home: 1.10, draw: 10, away: 18 }
));
check(stable.classification.side === 'HOME', 'Stable leader side should be HOME.');
check(stable.banker.market === ATHENA_MARKETS.HOME_WIN_EITHER_HALF, `Expected home win either half, got ${stable.banker.market}.`);

const drawLock = analyseAthenaFixture(fixture(
  team('A', { ww: 3, wd: 2, wl: 0, dw: 3, dd: 6, dl: 2, lw: 0, ld: 1, ll: 2 }, 7, 12, 2.2),
  team('B', { ww: 2, wd: 1, wl: 0, dw: 3, dd: 6, dl: 3, lw: 0, ld: 1, ll: 3 }, 7, 12, 2.1)
));
check(drawLock.classification.type === ATHENA_CLASSIFICATIONS.DRAW_LOCK, `Expected draw lock, got ${drawLock.classification.type}.`);

const highEvent = analyseAthenaFixture(fixture(
  team('Home', { ww: 5, wd: 1, wl: 0, dw: 2, dd: 0, dl: 1, lw: 1, ld: 0, ll: 4 }, 10, 4, 4.7, 29, 37),
  team('Away', { ww: 3, wd: 0, wl: 0, dw: 4, dd: 0, dl: 1, lw: 1, ld: 1, ll: 4 }, 9, 5, 4.3, 34, 26),
  { home: 2.2, draw: 3.9, away: 2.6 }
));
check(highEvent.classification.type === ATHENA_CLASSIFICATIONS.HIGH_EVENT_EARLY_SEPARATION, `Expected high event, got ${highEvent.classification.type}.`);
check((([ATHENA_MARKETS.OVER_1_5, ATHENA_MARKETS.OVER_2_5, ATHENA_MARKETS.HOME_WIN_EITHER_HALF] as string[]).includes(highEvent.banker.market)), `Unexpected high-event banker ${highEvent.banker.market}.`);

const noPick = analyseAthenaFixture(fixture(
  team('Home', { ww: 1, wd: 2, wl: 1, dw: 2, dd: 2, dl: 2, lw: 1, ld: 2, ll: 1 }, 6, 8, 2.5),
  team('Away', { ww: 1, wd: 2, wl: 1, dw: 2, dd: 2, dl: 2, lw: 1, ld: 2, ll: 1 }, 6, 8, 2.5)
), { minBankerScore: 95 });
check(noPick.banker.market === ATHENA_MARKETS.NO_PICK, `Expected no pick, got ${noPick.banker.market}.`);

console.log(JSON.stringify({
  ok: true,
  tests: 4,
  engine: stable.engine,
  stableLeaderBanker: stable.banker.market,
  drawLock: drawLock.classification.type,
  highEventBanker: highEvent.banker.market,
  noPick: noPick.banker.market
}, null, 2));
