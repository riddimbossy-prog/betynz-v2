import assert from 'node:assert/strict';
import { fetchOddsApiFixtures } from './odds-api.js';

process.env.ODDS_API_KEY = 'smoke-test-key';
process.env.ODDS_API_SPORT_KEYS = 'soccer_test';
process.env.ODDS_API_REGIONS = 'eu';
process.env.ODDS_API_MARKETS = 'h2h,totals';

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  assert.match(url, /\/sports\/soccer_test\/odds\//);
  return new Response(JSON.stringify([{
    id: 'evt1',
    sport_key: 'soccer_test',
    sport_title: 'Test League',
    commence_time: '2026-07-25T18:00:00Z',
    home_team: 'Alpha',
    away_team: 'Beta',
    bookmakers: [{
      key: 'book',
      markets: [
        { key: 'h2h', outcomes: [{ name: 'Alpha', price: 1.8 }, { name: 'Draw', price: 3.4 }, { name: 'Beta', price: 4.2 }] },
        { key: 'totals', outcomes: [{ name: 'Over', point: 2.5, price: 1.9 }, { name: 'Under', point: 2.5, price: 1.95 }] }
      ]
    }]
  }]), { status: 200, headers: { 'x-requests-remaining': '999', 'x-requests-used': '1' } });
};

try {
  const result = await fetchOddsApiFixtures('2026-07-25', '2026-07-25');
  assert.equal(result.fixtures.length, 1);
  assert.equal(result.fixtures[0].odds.home, 1.8);
  assert.equal(result.fixtures[0].odds.draw, 3.4);
  assert.equal(result.fixtures[0].odds.away, 4.2);
  assert.equal(result.fixtures[0].odds.over25, 1.9);
  console.log(JSON.stringify({ ok: true, tests: 5, provider: 'odds-api' }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
