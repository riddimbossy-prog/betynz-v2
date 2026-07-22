import { createHash } from 'node:crypto';
import type { NormalizedMatch } from './types.js';

type CsvRow = Record<string, string>;

const num = (value?: string) => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function isoDate(value: string) {
  const [d, m, y] = value.split('/').map(Number);
  if (!d || !m || !y) throw new Error(`Unsupported date: ${value}`);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function normalizeFootballDataRow(row: CsvRow, season: string, leagueName = 'English Premier League'): NormalizedMatch {
  const date = isoDate(row.Date);
  const id = createHash('sha1').update(`${row.Div}|${season}|${date}|${row.HomeTeam}|${row.AwayTeam}`).digest('hex').slice(0, 20);
  return {
    id,
    leagueCode: row.Div,
    leagueName,
    season,
    date,
    time: row.Time || undefined,
    homeTeam: row.HomeTeam,
    awayTeam: row.AwayTeam,
    homeGoals: num(row.FTHG) ?? 0,
    awayGoals: num(row.FTAG) ?? 0,
    halfTimeHomeGoals: num(row.HTHG),
    halfTimeAwayGoals: num(row.HTAG),
    result: row.FTR as 'H' | 'D' | 'A',
    stats: {
      homeShots: num(row.HS) ?? null,
      awayShots: num(row.AS) ?? null,
      homeShotsOnTarget: num(row.HST) ?? null,
      awayShotsOnTarget: num(row.AST) ?? null,
      homeCorners: num(row.HC) ?? null,
      awayCorners: num(row.AC) ?? null
    },
    odds: {
      openingHome: num(row.AvgH) ?? num(row.B365H),
      openingDraw: num(row.AvgD) ?? num(row.B365D),
      openingAway: num(row.AvgA) ?? num(row.B365A),
      closingHome: num(row.AvgCH) ?? num(row.B365CH),
      closingDraw: num(row.AvgCD) ?? num(row.B365CD),
      closingAway: num(row.AvgCA) ?? num(row.B365CA),
      openingOver25: num(row['Avg>2.5']) ?? num(row['B365>2.5']),
      openingUnder25: num(row['Avg<2.5']) ?? num(row['B365<2.5']),
      closingOver25: num(row['AvgC>2.5']) ?? num(row['B365C>2.5']),
      closingUnder25: num(row['AvgC<2.5']) ?? num(row['B365C<2.5']),
      asianLine: num(row.AHh),
      closingAsianLine: num(row.AHCh)
    }
  };
}
