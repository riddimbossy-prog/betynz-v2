import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const fixtureProvider = read('apps/api/src/fixture-provider.ts');
const footballApi = read('apps/api/src/football-api.ts');
const store = read('apps/api/src/store.ts');
const predictionService = read('apps/api/src/prediction-service.ts');
const runtime = read('apps/api/src/pipeline-runtime.ts');
const server = read('apps/api/src/server.ts');
const zeus = read('apps/api/src/god-picks.ts');
const version = read('apps/api/src/olympian-version.ts');
const web = read('apps/web/src/App.tsx');
const sw = read('apps/web/public/sw.js');
const render = read('deploy/render.yaml');

const checks = [
  ['engine version 3.0.4', version.includes("olympian-roles-3.0.4")],
  ['web label 3.0.4', web.includes('OLYMPIAN PICKS 3.0.4')],
  ['PWA cache 3.0.4', sw.includes('betynz-shell-v3-0-4')],
  ['Odds matching diagnostics', fixtureProvider.includes('matchedToPrimary') && fixtureProvider.includes('addedUnmatched')],
  ['Unmatched fallback disabled by default', fixtureProvider.includes("ODDS_API_INCLUDE_UNMATCHED_FIXTURES ?? 'false'")],
  ['Global fallback assignment', fixtureProvider.includes('candidates.sort') && fixtureProvider.includes('usedExisting')],
  ['Variant protection', fixtureProvider.includes('variantSignature')],
  ['Canonical active window replace', store.includes('replaceUpcomingFixturesForWindow') && predictionService.includes('replaceUpcomingFixturesForWindow')],
  ['Priced history priority', footballApi.includes('pricedFixtures') && footballApi.includes('zeusEligibleFixtures')],
  ['History default 36 leagues', footballApi.includes("API_FOOTBALL_HISTORY_MAX_LEAGUES', 36")],
  ['Public pipeline status', runtime.includes('publicPipelineStatus') && server.includes("'/api/v1/pipeline/status'" )],
  ['Rejection diagnostics', predictionService.includes('topRejectionReasons') && predictionService.includes('rejectionsByStage')],
  ['Fixture history diagnostics', predictionService.includes('fixtureHistoryCoverage')],
  ['Strict Zeus odds gate retained', zeus.includes('pick.odds < ZEUS_MAX_ODDS_EXCLUSIVE')],
  ['Render unmatched fallback false', render.includes('ODDS_API_INCLUDE_UNMATCHED_FIXTURES') && render.includes('API_FOOTBALL_HISTORY_MAX_LEAGUES')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed: failed.map(([name]) => name) }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks: checks.length, version: '3.0.4' }, null, 2));
