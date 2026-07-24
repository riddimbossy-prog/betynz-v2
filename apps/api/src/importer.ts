import { parse } from 'csv-parse/sync';
import { readFile } from 'node:fs/promises';
import { normalizeFootballDataRow } from './normalize.js';
import { upsertMatches } from './store.js';
import { settlePredictionsFromMatches } from './settlement.js';
import { settleAthenaShadowRunsFromMatches } from './athena-settlement.js';

export async function importCsvText(csvText: string, season: string, leagueName?: string) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true }) as Record<string, string>[];
  const matches = rows.filter((row) => row.Div && row.Date && row.HomeTeam && row.AwayTeam && row.FTR).map((row) => normalizeFootballDataRow(row, season, leagueName));
  const imported = await upsertMatches(matches);
  const [settled, athenaSettled] = await Promise.all([
    settlePredictionsFromMatches(matches),
    settleAthenaShadowRunsFromMatches(matches)
  ]);
  return { imported, matches, settled, athenaSettled };
}

export async function importFootballDataUrl(url: string, season: string, leagueName?: string) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Betynz-Internal-Importer/1.0' } });
  if (!response.ok) throw new Error(`Download failed with ${response.status}`);
  return importCsvText(await response.text(), season, leagueName);
}

export async function parseLocalCsv(path: string, season: string, leagueName?: string) {
  const csvText = await readFile(path, 'utf8');
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true }) as Record<string, string>[];
  return rows.filter((row) => row.Div && row.Date && row.HomeTeam && row.AwayTeam && row.FTR).map((row) => normalizeFootballDataRow(row, season, leagueName));
}
