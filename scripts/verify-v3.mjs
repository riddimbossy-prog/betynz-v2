import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);
const required = [
  'apps/api/src/chronos-service.ts',
  'apps/api/src/athena-transition.ts',
  'apps/api/src/ares-service.ts',
  'apps/api/src/god-picks.ts',
  'apps/api/src/olympian-version.ts',
  'apps/api/src/prediction-service.ts',
  'apps/api/src/pipeline-runtime.ts',
  'apps/api/src/pipeline-state.ts',
  'apps/api/src/server.ts',
  'apps/web/src/App.tsx',
  'apps/web/src/api.ts',
  'apps/web/public/sw.js',
  'apps/api/src/fixture-provider.ts',
  'apps/api/src/football-api.ts',
  'apps/api/src/store.ts',
  'supabase/migrations/007_olympian_roles.sql',
  'supabase/migrations/008_pipeline_hotfix.sql'
];
for (const file of required) await access(new URL(file, root), constants.R_OK);

const files = Object.fromEntries(await Promise.all(required.map(async (file) => [file, await readFile(new URL(file, root), 'utf8')])));
const godPicks = files['apps/api/src/god-picks.ts'];
const olympianVersion = files['apps/api/src/olympian-version.ts'];
const predictionService = files['apps/api/src/prediction-service.ts'];
const pipeline = files['apps/api/src/pipeline-runtime.ts'];
const server = files['apps/api/src/server.ts'];
const provider = files['apps/api/src/fixture-provider.ts'];
const footballApi = files['apps/api/src/football-api.ts'];
const store = files['apps/api/src/store.ts'];
const sw = files['apps/web/public/sw.js'];
const app = files['apps/web/src/App.tsx'];
const api = files['apps/web/src/api.ts'];
const migration7 = files['supabase/migrations/007_olympian_roles.sql'];
const migration8 = files['supabase/migrations/008_pipeline_hotfix.sql'];

const checks = [
  ['Hotfix engine version is 3.0.2', olympianVersion.includes("olympian-roles-3.0.2")],
  ['Zeus odds gate is strictly below 1.60', olympianVersion.includes('ZEUS_MAX_ODDS_EXCLUSIVE = 1.60') && godPicks.includes('pick.odds < ZEUS_MAX_ODDS_EXCLUSIVE')],
  ['Zeus aggregates banker picks only', godPicks.includes('.filter((pick) => pick.banker)')],
  ['Chronos, Athena and Ares feed Zeus', predictionService.includes('...chronosPicks, ...athenaPicks, ...aresPicks')],
  ['All god picks publish through god_picks', predictionService.includes('replaceGodPicks(start, end, OLYMPIAN_ENGINE_VERSION, godPicks)')],
  ['Startup rebuild is enabled', pipeline.includes("requestPipelineRebuild('startup')")],
  ['Daily rebuild is enabled', pipeline.includes("requestPipelineRebuild('daily')")],
  ['API-Football is the default provider', provider.includes("process.env.FIXTURE_PROVIDER || 'api-football'")],
  ['Odds API fallback is coverage-aware', provider.includes('ODDS_API_FALLBACK_MIN_1X2_COVERAGE') && provider.includes('triggerReasons.length > 0')],
  ['Legacy lazy rebuild cannot race the pipeline', !predictionService.includes('lazyRebuildPromise') && predictionService.includes('isPipelineRunning()')],
  ['Public Refresh runs the pipeline', server.includes("/api/v1/predictions/refresh") && api.includes("method: 'POST'")],
  ['Failed Refresh is not silently accepted', server.includes("rebuild.run.status === 'failed' ? 502")],
  ['API-Football historical bootstrap exists', footballApi.includes('fetchHistoricalMatchesForUpcoming') && footballApi.includes('API_FOOTBALL_HISTORY_MAX_LEAGUES')],
  ['Historical bootstrap feeds Supabase before rebuild', predictionService.includes('fetchHistoricalMatchesForUpcoming') && predictionService.includes("upsertMatches(hydrated.matches, 'api-football')")],
  ['Historical source is recorded', store.includes("upsertMatches(matches: NormalizedMatch[], source")],
  ['Pipeline diagnostics are private', server.includes("/api/v1/admin/pipeline-diagnostics") && server.includes('authorizeAdmin(req, res)')],
  ['Empty gods are hidden for the selected day', app.includes('picksByGod[god].some((pick) => pick.date === selectedDate)')],
  ['Zeus UI repeats the strict price gate', app.includes("typeof pick.odds === 'number' && pick.odds > 1 && pick.odds < 1.60")],
  ['God picks migration exists', migration7.includes('create table if not exists public.god_picks')],
  ['Odds API fallback fixtures are allowed', migration8.includes("'odds-api'")],
  ['Public empty state is minimal', app.includes('No picks for today.')]
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed: failed.map(([name]) => name) }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks: checks.length, version: '3.0.2' }, null, 2));
