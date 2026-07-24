import assert from 'node:assert/strict';
import demoMatches from '../data/demo-matches.json' with { type: 'json' };
import { buildChronosPick } from './chronos-service.js';
import type { UpcomingFixture } from './forecast-types.js';
import type { NormalizedMatch } from './types.js';

const matches = (demoMatches as NormalizedMatch[]).map((match) => ({ ...match, odds: {} }));
const sourceRows = [...(demoMatches as NormalizedMatch[])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 180);
let produced = 0;
for (let index = 0; index < sourceRows.length; index += 1) {
  const row = sourceRows[index];
  const fixture: UpcomingFixture = {
    id: `chronos-fallback-${index}`,
    provider: 'api-football',
    providerFixtureId: index + 1,
    leagueId: 1,
    leagueCode: row.leagueCode,
    leagueName: row.leagueName,
    country: '',
    season: '2026',
    kickoff: '2026-07-25T15:00:00Z',
    date: '2026-07-25',
    status: 'NS',
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    odds: {
      home: row.odds.openingHome,
      draw: row.odds.openingDraw,
      away: row.odds.openingAway,
      over25: row.odds.openingOver25,
      under25: row.odds.openingUnder25
    }
  };
  const pick = buildChronosPick(fixture, matches);
  if (pick) {
    produced += 1;
    assert.match(pick.statsLine, /^Results /);
  }
}
assert.ok(produced > 0, 'Chronos should publish qualified result-pattern picks when historical odds are absent.');
console.log(`Chronos results-form fallback smoke test passed with ${produced} qualified picks.`);
