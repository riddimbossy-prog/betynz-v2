import assert from 'node:assert/strict';
import { enrichFixturesWithOddsApi } from './odds-api.js';
import type { UpcomingFixture } from './forecast-types.js';

process.env.ODDS_API_ENABLED = 'true';
process.env.ODDS_API_KEY = 'smoke-test-key';
process.env.ODDS_API_SPORT_KEYS = 'soccer_test_league';

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.includes('/sports/?')) {
    return new Response(JSON.stringify([{ key: 'soccer_test_league', group: 'Soccer', title: 'Test League', active: true }]), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-requests-remaining': '99' }
    });
  }
  if (url.includes('/sports/soccer_test_league/odds/')) {
    return new Response(JSON.stringify([{
      id: 'event-1',
      sport_key: 'soccer_test_league',
      commence_time: '2026-07-24T18:00:00Z',
      home_team: 'Alpha FC',
      away_team: 'Beta United',
      bookmakers: [{
        key: 'book-a',
        markets: [{
          key: 'h2h',
          outcomes: [
            { name: 'Alpha FC', price: 1.55 },
            { name: 'Draw', price: 3.9 },
            { name: 'Beta United', price: 5.8 }
          ]
        }]
      }]
    }]), { status: 200, headers: { 'content-type': 'application/json', 'x-requests-remaining': '98' } });
  }
  return new Response('not found', { status: 404 });
}) as typeof fetch;

const fixture: UpcomingFixture = {
  id: 'fixture-1',
  provider: 'api-football',
  providerFixtureId: 101,
  leagueId: 1,
  leagueCode: 'test',
  leagueName: 'Test League',
  country: 'Testland',
  season: '2026',
  kickoff: '2026-07-24T18:00:00Z',
  date: '2026-07-24',
  status: 'NS',
  homeTeam: 'Alpha',
  awayTeam: 'Beta United',
  odds: {},
  oddsSource: 'api-football',
  dataQuality: 58
};

try {
  const result = await enrichFixturesWithOddsApi([fixture], '2026-07-24', '2026-07-24');
  assert.equal(result.fixtures.length, 1);
  assert.equal(result.report.matchedFixtures, 1);
  assert.equal(result.fixtures[0].odds.home, 1.55);
  assert.equal(result.fixtures[0].odds.draw, 3.9);
  assert.equal(result.fixtures[0].odds.away, 5.8);
  assert.match(result.fixtures[0].oddsSource || '', /the-odds-api/);
  console.log('Odds API rescue smoke test passed.');
} finally {
  globalThis.fetch = originalFetch;
}
