import assert from 'node:assert/strict';
import type { UpcomingFixture } from './forecast-types.js';
import type { NormalizedMatch } from './types.js';

process.env.API_FOOTBALL_KEY = 'smoke-test-key';
process.env.API_FOOTBALL_HISTORY_ENABLED = 'true';
process.env.API_FOOTBALL_HISTORY_PREVIOUS_SEASON_ENABLED = 'true';
process.env.API_FOOTBALL_HISTORY_MAX_LEAGUES = '3';
process.env.API_FOOTBALL_HISTORY_MIN_TEAM_MATCHES = '6';
process.env.API_FOOTBALL_HISTORY_MIN_LEAGUE_MATCHES = '40';

let calls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  calls += 1;
  const url = String(input);
  const previousSeason = url.includes('season=2025');
  const response = previousSeason
    ? [
        {
          fixture: { id: 6001, date: '2025-10-01T18:00:00Z', status: { short: 'FT' } },
          league: { id: 99, name: 'Smoke League', season: 2025 },
          teams: { home: { name: 'Beta' }, away: { name: 'Alpha FC' } },
          goals: { home: 0, away: 1 },
          score: { halftime: { home: 0, away: 1 } }
        }
      ]
    : [
        {
          fixture: { id: 7001, date: '2026-07-01T18:00:00Z', status: { short: 'FT' } },
          league: { id: 99, name: 'Smoke League', season: 2026 },
          teams: { home: { name: 'Alpha FC' }, away: { name: 'Beta' } },
          goals: { home: 2, away: 1 },
          score: { halftime: { home: 1, away: 0 } }
        },
        {
          fixture: { id: 7002, date: '2026-07-05T18:00:00Z', status: { short: 'NS' } },
          league: { id: 99, name: 'Smoke League', season: 2026 },
          teams: { home: { name: 'Alpha FC' }, away: { name: 'Gamma' } },
          goals: { home: null, away: null },
          score: { halftime: { home: null, away: null } }
        }
      ];
  return new Response(JSON.stringify({ response }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

try {
  const { fetchHistoricalMatchesForUpcoming } = await import('./football-api.js');
  const fixtures: UpcomingFixture[] = [{
    id: 'future-1',
    provider: 'api-football',
    providerFixtureId: 8001,
    leagueId: 99,
    leagueCode: '99',
    leagueName: 'Smoke League',
    country: 'Test',
    season: '2026',
    kickoff: '2026-07-25T18:00:00Z',
    date: '2026-07-25',
    status: 'NS',
    homeTeam: 'Alpha FC',
    awayTeam: 'Beta',
    odds: {},
    updatedAt: new Date().toISOString()
  }];

  const first = await fetchHistoricalMatchesForUpcoming(fixtures, []);
  assert.equal(first.report.requestedLeagues, 1);
  assert.equal(first.matches.length, 2);
  assert.equal(first.report.leagues[0].currentSeasonFetched, 1);
  assert.equal(first.report.leagues[0].previousSeasonFetched, 1);
  assert.deepEqual(first.report.leagues[0].seasonsRequested, ['2026', '2025']);
  assert.equal(first.matches[0].halfTimeHomeGoals, 1);
  assert.equal(calls, 2);

  const sufficientHistory: NormalizedMatch[] = Array.from({ length: 40 }, (_, index) => ({
    id: `history-${index}`,
    leagueCode: '99',
    leagueName: 'Smoke League',
    season: index < 20 ? '2026' : '2025',
    date: '2026-06-01',
    homeTeam: index % 2 ? 'Alpha FC' : 'Beta',
    awayTeam: index % 2 ? 'Beta' : 'Alpha FC',
    homeGoals: 1,
    awayGoals: 0,
    result: 'H',
    odds: {}
  }));
  const second = await fetchHistoricalMatchesForUpcoming(fixtures, sufficientHistory);
  assert.equal(second.report.requestedLeagues, 0);
  assert.equal(second.matches.length, 0);
  assert.equal(calls, 2);

  console.log('History bootstrap previous-season smoke test passed.');
} finally {
  globalThis.fetch = originalFetch;
}
