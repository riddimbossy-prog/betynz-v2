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
  'apps/web/src/App.tsx',
  'supabase/migrations/007_olympian_roles.sql'
];
for (const file of required) await access(new URL(file, root), constants.R_OK);

const godPicks = await readFile(new URL('apps/api/src/god-picks.ts', root), 'utf8');
const olympianVersion = await readFile(new URL('apps/api/src/olympian-version.ts', root), 'utf8');
const predictionService = await readFile(new URL('apps/api/src/prediction-service.ts', root), 'utf8');
const app = await readFile(new URL('apps/web/src/App.tsx', root), 'utf8');
const migration = await readFile(new URL('supabase/migrations/007_olympian_roles.sql', root), 'utf8');
const checks = [
  ['Zeus odds gate is strictly below 1.60', olympianVersion.includes('ZEUS_MAX_ODDS_EXCLUSIVE = 1.60') && godPicks.includes('pick.odds < ZEUS_MAX_ODDS_EXCLUSIVE')],
  ['Zeus aggregates banker picks only', godPicks.includes('.filter((pick) => pick.banker)')],
  ['Chronos, Athena and Ares feed Zeus', predictionService.includes('...chronosPicks, ...athenaPicks, ...aresPicks')],
  ['All four public god tabs are supported', ['zeus', 'chronos', 'athena', 'ares'].every((god) => app.includes(`${god}:`))],
  ['Empty gods stay hidden', app.includes('GOD_ORDER.filter((god) => picksByGod[god].length > 0)')],
  ['Public empty state is minimal', app.includes('No picks for today.')],
  ['God picks migration exists', migration.includes('create table if not exists public.god_picks')],
  ['No duplicate activePicks return', (app.match(/return activePicks/g) || []).length === 1]
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed: failed.map(([name]) => name) }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checks: checks.length, version: '3.0.0' }, null, 2));
