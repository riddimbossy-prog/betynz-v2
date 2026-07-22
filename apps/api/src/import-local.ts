import 'dotenv/config';
import { parseArgs } from 'node:util';
import { parseLocalCsv } from './importer.js';
import { upsertMatches } from './store.js';

const { values } = parseArgs({ options: { file: { type: 'string' }, season: { type: 'string' }, leagueName: { type: 'string' } } });
if (!values.file || !values.season) {
  console.error('Usage: npm run import:local -- --file=/path/E0.csv --season=2025-26 --leagueName="English Premier League"');
  process.exit(1);
}
const matches = await parseLocalCsv(values.file, values.season, values.leagueName);
const imported = await upsertMatches(matches);
console.log(JSON.stringify({ imported, first: matches[0]?.id, last: matches.at(-1)?.id }, null, 2));
