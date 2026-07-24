import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const app = await readFile(new URL('apps/web/src/App.tsx', root), 'utf8');
const service = await readFile(new URL('apps/api/src/prediction-service.ts', root), 'utf8');
const provider = await readFile(new URL('apps/api/src/fixture-provider.ts', root), 'utf8');
const oddsApi = await readFile(new URL('apps/api/src/odds-api.ts', root), 'utf8');

assert.match(app, /athenaPicks/);
assert.match(app, /availableGods/);
assert.match(app, /No picks for today\./);
assert.doesNotMatch(app, /1\.19/);
assert.doesNotMatch(app, /Why this pick|Why\?/);
assert.match(service, /athenaPicks/);
assert.match(provider, /ODDS_API_FALLBACK_MIN_FIXTURES/);
assert.match(oddsApi, /fetchOddsApiFixtures/);
assert.match(oddsApi, /enrichHistoricalMatchesWithOddsApi/);

console.log(JSON.stringify({ ok: true, checks: 9, version: '2.9.0' }, null, 2));
