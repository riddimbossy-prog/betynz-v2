import fs from 'node:fs';
import { analyseFixture } from '../src/index.js';

const input = JSON.parse(fs.readFileSync(new URL('./okmk-vs-kokand.json', import.meta.url), 'utf8'));
const result = analyseFixture(input);
console.log(JSON.stringify(result, null, 2));
