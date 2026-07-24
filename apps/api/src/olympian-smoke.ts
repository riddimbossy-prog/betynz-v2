import assert from 'node:assert/strict';
import { buildZeusAutoPicks, ZEUS_MAX_ODDS_EXCLUSIVE } from './god-picks.js';
import type { GodPublicPick, UpcomingFixture } from './forecast-types.js';

function pick(overrides: Partial<GodPublicPick> = {}): GodPublicPick {
  return {
    fixtureId: 'fixture-1',
    engineVersion: 'test',
    god: 'chronos',
    date: '2026-07-24',
    kickoff: '2026-07-24T18:00:00Z',
    leagueCode: 'TEST',
    leagueName: 'Test League',
    country: 'Test',
    homeTeam: 'Home FC',
    awayTeam: 'Away FC',
    selection: 'Home FC draw no bet',
    marketKey: 'HOME_DNB',
    score: 82,
    banker: true,
    odds: 1.55,
    statsLine: 'Test',
    sourceGods: ['chronos'],
    settledStatus: 'pending',
    ...overrides
  };
}

const fixture: UpcomingFixture = {
  id: 'fixture-2',
  providerFixtureId: 2,
  leagueId: 1,
  leagueCode: 'TEST',
  leagueName: 'Test League',
  country: 'Test',
  season: '2026',
  kickoff: '2026-07-24T19:00:00Z',
  date: '2026-07-24',
  status: 'NS',
  homeTeam: 'Athena Home',
  awayTeam: 'Athena Away',
  odds: { homeDnb: 1.45, dc1x: 1.25 }
};

const consensus = buildZeusAutoPicks([
  pick(),
  pick({ god: 'athena', score: 88, odds: 1.48, sourceGods: ['athena'] }),
  pick({ god: 'ares', score: 90, odds: 1.62, sourceGods: ['ares'] })
]);
assert.equal(consensus.length, 1);
assert(consensus[0].odds! < ZEUS_MAX_ODDS_EXCLUSIVE);
assert.equal(consensus[0].sourceGods?.length, 2);

const exactGate = buildZeusAutoPicks([pick({ odds: 1.60 })]);
assert.equal(exactGate.length, 0, 'Odds exactly 1.60 must be rejected.');

const conflict = buildZeusAutoPicks([
  pick({ marketKey: 'HOME_WIN', selection: 'Home FC to win', odds: 1.50 }),
  pick({ god: 'ares', marketKey: 'AWAY_WIN', selection: 'Away FC to win', odds: 1.55, sourceGods: ['ares'] })
]);
assert.equal(conflict.length, 0, 'Opposing directions must be rejected.');

const translated = buildZeusAutoPicks([
  pick({
    fixtureId: 'fixture-2',
    god: 'athena',
    homeTeam: 'Athena Home',
    awayTeam: 'Athena Away',
    marketKey: 'HOME_WIN_EITHER_HALF',
    selection: 'Athena Home to win either half',
    odds: undefined,
    sourceGods: ['athena']
  })
], [fixture]);
assert.equal(translated.length, 1);
assert.equal(translated[0].marketKey, 'HOME_DNB');
assert.equal(translated[0].odds, 1.45);

console.log(JSON.stringify({ ok: true, tests: 4, consensus: consensus[0], translated: translated[0] }, null, 2));
