import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import type { HtFtProfile, StreakScope, StreakValues, TeamStreakSnapshot } from './streak-intelligence.js';

const cleanText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalize = (value: string) => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const number = (value: unknown) => {
  const match = cleanText(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

function titleCaseSlug(value: string) {
  return value.split('-').filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function pageCompetition(pageUrl: string) {
  try {
    const parts = new URL(pageUrl).pathname.split('/').filter(Boolean);
    if (parts[0] === 'football' && parts.length >= 3) {
      return {
        country: titleCaseSlug(parts[1]),
        leagueName: titleCaseSlug(parts[2]),
        leagueCode: `be-${createHash('sha1').update(`${parts[1]}|${parts[2]}`).digest('hex').slice(0, 10)}`
      };
    }
  } catch {
    // Fall through to unknown competition.
  }
  return { country: '', leagueName: 'Unknown league', leagueCode: 'be-unknown' };
}

function seasonFor(snapshotDate: string) {
  const [year, month] = snapshotDate.split('-').map(Number);
  return month >= 7 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

function emptyStreaks(): StreakValues {
  return { wins: 0, draws: 0, losses: 0, noWin: 0, noDraw: 0, unbeaten: 0, over25: 0, under25: 0 };
}

function emptyHtFt(): HtFtProfile {
  return {
    sample: 0,
    firstHalfLeadRate: 0,
    firstHalfDrawRate: 0,
    firstHalfTrailRate: 0,
    leadToWinRate: 0,
    drawToWinRate: 0,
    trailToAvoidLossRate: 0,
    combinations: {}
  };
}


function roundRate(value: number) {
  return Number(value.toFixed(1));
}

function finalizeHtFt(profile: HtFtProfile) {
  const count = (key: string) => Number(profile.combinations[key] || 0);
  const lead = count('W_W') + count('W_D') + count('W_L');
  const draw = count('D_W') + count('D_D') + count('D_L');
  const trail = count('L_W') + count('L_D') + count('L_L');
  const combinationSample = lead + draw + trail;
  profile.sample = Math.max(profile.sample, combinationSample);
  if (profile.sample > 0) {
    profile.firstHalfLeadRate = roundRate(lead / profile.sample * 100);
    profile.firstHalfDrawRate = roundRate(draw / profile.sample * 100);
    profile.firstHalfTrailRate = roundRate(trail / profile.sample * 100);
  }
  if (!profile.leadToWinRate && lead > 0) profile.leadToWinRate = roundRate(count('W_W') / lead * 100);
  if (!profile.drawToWinRate && draw > 0) profile.drawToWinRate = roundRate(count('D_W') / draw * 100);
  if (!profile.trailToAvoidLossRate && trail > 0) profile.trailToAvoidLossRate = roundRate((count('L_W') + count('L_D')) / trail * 100);
  return profile;
}

function scopeFromText(value: string): StreakScope {
  const normalized = normalize(value);
  if (/\bhome\b/.test(normalized)) return 'home';
  if (/\baway\b/.test(normalized)) return 'away';
  return 'overall';
}

function canonicalColumn(header: string) {
  const value = normalize(header);
  if (/^(team|club|participant)$/.test(value)) return 'team';
  if (/^(w|wins?|winning streak)$/.test(value)) return 'wins';
  if (/^(d|draws?|drawing streak)$/.test(value)) return 'draws';
  if (/^(l|losses?|losing streak)$/.test(value)) return 'losses';
  if (/no win|winless/.test(value)) return 'noWin';
  if (/no draw|drawless/.test(value)) return 'noDraw';
  if (/unbeaten|no loss/.test(value)) return 'unbeaten';
  if (/over 2 5|o2 5|2 5 over/.test(value)) return 'over25';
  if (/under 2 5|u2 5|2 5 under/.test(value)) return 'under25';
  if (/sample|played|matches/.test(value)) return 'sample';
  if (/^(w w|h h|1 1)$/.test(value)) return 'W_W';
  if (/^(w d|h d|1 x)$/.test(value)) return 'W_D';
  if (/^(w l|h a|1 2)$/.test(value)) return 'W_L';
  if (/^(d w|d h|x 1)$/.test(value)) return 'D_W';
  if (/^(d d|x x)$/.test(value)) return 'D_D';
  if (/^(d l|d a|x 2)$/.test(value)) return 'D_L';
  if (/^(l w|a h|2 1)$/.test(value)) return 'L_W';
  if (/^(l d|a d|2 x)$/.test(value)) return 'L_D';
  if (/^(l l|a a|2 2)$/.test(value)) return 'L_L';
  if (/lead.*win|ht lead.*ft win/.test(value)) return 'leadToWinRate';
  if (/draw.*win|ht draw.*ft win/.test(value)) return 'drawToWinRate';
  if (/trail.*avoid|recovery/.test(value)) return 'trailToAvoidLossRate';
  return '';
}

function rowTeam($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>, teamIndex: number) {
  const explicit = cleanText(
    row.attr('data-team')
    || row.find('[data-team]').first().attr('data-team')
    || row.find('.participant, .team, .table-main__participant, [class*="participant"], [class*="team-name"]').first().text()
  );
  if (explicit) return explicit;
  const cells = row.find('td, [role="cell"]').toArray();
  return cleanText(cells[teamIndex] ? $(cells[teamIndex]).text() : '');
}

function mapFromDataAttributes(row: cheerio.Cheerio<any>) {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(row.attr() || {})) {
    const canonical = canonicalColumn(key.replace(/^data-/, '').replaceAll('-', ' '));
    if (canonical) result[canonical] = number(value);
  }
  return result;
}

export type ParsedStreakPage = {
  snapshots: TeamStreakSnapshot[];
  tables: number;
  rows: number;
  warnings: string[];
};

export function parseBetExplorerStreakHtml(html: string, pageUrl: string, snapshotDate: string): ParsedStreakPage {
  const $ = cheerio.load(html);
  const competition = pageCompetition(pageUrl);
  const snapshots: TeamStreakSnapshot[] = [];
  const warnings: string[] = [];
  let parsedRows = 0;

  const tables = $('table, [role="table"]').toArray();
  for (const tableNode of tables) {
    const table = $(tableNode);
    const heading = cleanText(
      table.prevAll('h1, h2, h3, h4, .table-main__heading, [class*="heading"]').first().text()
      || table.find('caption').first().text()
      || table.attr('data-scope')
    );
    const scope = scopeFromText(`${heading} ${pageUrl}`);
    const headerCells = table.find('thead th, thead [role="columnheader"], tr').first().find('th, [role="columnheader"]').toArray();
    const columns = headerCells.map((cell: any) => canonicalColumn($(cell).text()));
    const teamIndex = Math.max(0, columns.indexOf('team'));
    const usefulColumns = columns.filter(Boolean);
    if (!usefulColumns.length && !table.find('[data-team]').length) continue;

    const rows = table.find('tbody tr, tr').toArray();
    for (const rowNode of rows) {
      const row = $(rowNode);
      if (row.find('th').length && !row.find('td').length) continue;
      const team = rowTeam($, row, teamIndex);
      if (!team || /^team|club$/i.test(team)) continue;
      const values = mapFromDataAttributes(row);
      const cells = row.find('td, [role="cell"]').toArray();
      columns.forEach((column: string, index: number) => {
        if (!column || column === 'team' || !cells[index]) return;
        values[column] = number($(cells[index]).text());
      });

      const streaks = emptyStreaks();
      for (const key of Object.keys(streaks) as Array<keyof StreakValues>) {
        if (Number.isFinite(values[key])) streaks[key] = Math.max(0, values[key] || 0);
      }
      const htft = emptyHtFt();
      const comboKeys = ['W_W', 'W_D', 'W_L', 'D_W', 'D_D', 'D_L', 'L_W', 'L_D', 'L_L'];
      for (const key of comboKeys) if (Number.isFinite(values[key])) htft.combinations[key] = values[key];
      htft.sample = Math.max(0, values.sample || Object.values(htft.combinations).reduce((a, b) => a + b, 0));
      htft.leadToWinRate = Math.max(0, values.leadToWinRate || 0);
      htft.drawToWinRate = Math.max(0, values.drawToWinRate || 0);
      htft.trailToAvoidLossRate = Math.max(0, values.trailToAvoidLossRate || 0);
      finalizeHtFt(htft);

      const hasStreak = Object.values(streaks).some((value) => value > 0);
      const hasHtFt = htft.sample > 0 || Object.keys(htft.combinations).length > 0;
      if (!hasStreak && !hasHtFt) continue;

      snapshots.push({
        snapshotDate,
        source: 'betexplorer',
        providerUrl: pageUrl,
        leagueCode: competition.leagueCode,
        leagueName: competition.leagueName,
        country: competition.country,
        season: seasonFor(snapshotDate),
        team,
        scope,
        sample: Math.max(values.sample || 0, Math.max(...Object.values(streaks), 0)),
        streaks,
        adjusted: { ...streaks, opponentStrength: 1.25 },
        htft
      });
      parsedRows += 1;
    }
  }

  // Some rendered pages expose streak values as cards instead of tables.
  $('[data-team]').each((_index: number, node: any) => {
    const card = $(node);
    const team = cleanText(card.attr('data-team'));
    if (!team || snapshots.some((snapshot) => snapshot.team === team && snapshot.providerUrl === pageUrl)) return;
    const values = mapFromDataAttributes(card);
    const streaks = emptyStreaks();
    for (const key of Object.keys(streaks) as Array<keyof StreakValues>) streaks[key] = Math.max(0, values[key] || 0);
    if (!Object.values(streaks).some((value) => value > 0)) return;
    snapshots.push({
      snapshotDate,
      source: 'betexplorer',
      providerUrl: pageUrl,
      leagueCode: competition.leagueCode,
      leagueName: competition.leagueName,
      country: competition.country,
      season: seasonFor(snapshotDate),
      team,
      scope: scopeFromText(`${card.attr('data-scope') || ''} ${pageUrl}`),
      sample: Math.max(values.sample || 0, Math.max(...Object.values(streaks), 0)),
      streaks,
      adjusted: { ...streaks, opponentStrength: 1.25 },
      htft: emptyHtFt()
    });
    parsedRows += 1;
  });

  if (!snapshots.length) warnings.push('No streak or HT/FT rows were recognized. Inspect the rendered DOM and update the header aliases if BetExplorer changed its table labels.');
  return { snapshots, tables: tables.length, rows: parsedRows, warnings };
}
