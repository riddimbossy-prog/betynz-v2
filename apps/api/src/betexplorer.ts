import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { UpcomingFixture, UpcomingOdds } from './forecast-types.js';

const BASE_URL = process.env.BETEXPLORER_BASE_URL?.trim() || 'https://www.betexplorer.com';
const DEFAULT_TEMPLATE = `${BASE_URL}/next/soccer/?year={YYYY}&month={MM}&day={DD}`;

export type BetExplorerSyncReport = {
  provider: 'betexplorer';
  enabled: boolean;
  requestedPages: number;
  parsedFixtures: number;
  pages: Array<{ date: string; url: string; status: number; fixtures: number; error?: string }>;
  warnings: string[];
};

const cleanText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const teamKey = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|cf|sc|afc|club|the)\b/g, '').replace(/[^a-z0-9]/g, '');
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function configuredEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.BETEXPLORER_ENABLED ?? '').toLowerCase());
}

function dayParts(date: string) {
  const [year, month, day] = date.split('-');
  return { year, month, day };
}

function renderTemplate(template: string, date: string) {
  const { year, month, day } = dayParts(date);
  return template
    .replaceAll('{DATE}', date)
    .replaceAll('{YYYY}', year)
    .replaceAll('{MM}', month)
    .replaceAll('{DD}', day);
}

function fixtureTemplates() {
  const primary = process.env.BETEXPLORER_FIXTURE_URL_TEMPLATE?.trim() || DEFAULT_TEMPLATE;
  const fallback = (process.env.BETEXPLORER_FALLBACK_URL_TEMPLATES || '')
    .split(';')
    .map((value: string) => value.trim())
    .filter(Boolean);
  return [primary, ...fallback];
}

function assertAllowedUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('BetExplorer collector only allows HTTPS.');
  if (!(url.hostname === 'betexplorer.com' || url.hostname.endsWith('.betexplorer.com'))) {
    throw new Error(`BetExplorer collector refused unexpected host: ${url.hostname}`);
  }
  return url.toString();
}

async function fetchHtml(rawUrl: string) {
  const url = assertAllowedUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.BETEXPLORER_TIMEOUT_MS || 20000));
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-GB,en;q=0.9',
        'cache-control': 'no-cache',
        'user-agent': process.env.BETEXPLORER_USER_AGENT || 'Betynz-Internal-Analytics/2.2 (+https://betynz.com)'
      }
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!body || body.length < 500) throw new Error('Response did not contain a usable HTML page.');
    return { status: response.status, body, url: response.url || url };
  } finally {
    clearTimeout(timeout);
  }
}

function parseOdd(value: unknown) {
  const normalized = cleanText(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 1.001 && parsed < 1000 ? Number(parsed.toFixed(3)) : undefined;
}

function stableNegativeId(value: string) {
  const hex = createHash('sha1').update(value).digest('hex').slice(0, 12);
  const numeric = Number.parseInt(hex, 16) % 8_000_000_000_000;
  return -(numeric || 1);
}

function stableFixtureId(value: string) {
  return createHash('sha1').update(`betexplorer|${value}`).digest('hex').slice(0, 20);
}

function leagueCode(country: string, league: string) {
  return `be-${createHash('sha1').update(`${country}|${league}`).digest('hex').slice(0, 10)}`;
}

function seasonFor(date: string) {
  const forced = process.env.BETEXPLORER_SEASON?.trim();
  if (forced) return forced;
  const [year, month] = date.split('-').map(Number);
  if (month >= 7) return `${year}-${String(year + 1).slice(-2)}`;
  return `${year - 1}-${String(year).slice(-2)}`;
}

function kickoffIso(date: string, time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  const hours = match ? Number(match[1]) : 12;
  const minutes = match ? Number(match[2]) : 0;
  const offsetMinutes = Number(process.env.BETEXPLORER_UTC_OFFSET_MINUTES || 0);
  const utc = new Date(`${date}T00:00:00.000Z`);
  utc.setUTCMinutes(hours * 60 + minutes - offsetMinutes);
  return utc.toISOString();
}

function splitLeagueTitle(raw: string) {
  const title = cleanText(raw).replace(/\s+odds.*$/i, '').replace(/\s+fixtures.*$/i, '');
  const split = title.split(/\s*[:|]\s*/, 2);
  if (split.length === 2) return { country: split[0], league: split[1] };
  return { country: '', league: title || 'Unknown league' };
}

function findSectionTitle($: cheerio.CheerioAPI, row: any) {
  const directLeague = cleanText(row.attr('data-league') || row.attr('data-competition'));
  const directCountry = cleanText(row.attr('data-country'));
  if (directLeague && directCountry) return `${directCountry}: ${directLeague}`;
  if (directLeague) return directLeague;
  if (directCountry) return directCountry;

  const section = row.closest('.wrap-section, .league, .competition, section');
  const sectionHeading = cleanText(section.find('.wrap-section__header__title, .league-name, .competition-name, h2, h3').first().text());
  if (sectionHeading) return sectionHeading;

  const table = row.closest('table');
  const beforeTable = cleanText(table.prevAll('.wrap-section__header, .league-name, .competition-name, h2, h3').first().text());
  if (beforeTable) return beforeTable;

  const previousHeading = cleanText(row.prevAll('.league-name, .competition-name, .table-main__heading, h2, h3').first().text());
  return previousHeading || 'Unknown league';
}

function parseTeams($: cheerio.CheerioAPI, row: any) {
  const combinedSelectors = ['.in-match', '.table-main__participant', '.match-link', '[data-testid="match-participants"]'];
  for (const selector of combinedSelectors) {
    const text = cleanText(row.find(selector).first().text());
    if (!text) continue;
    const parts = text.split(/\s+(?:-|–|—|vs\.?|v)\s+/i).map(cleanText).filter(Boolean);
    if (parts.length >= 2) return { homeTeam: parts[0], awayTeam: parts[1] };
  }

  const participantSelectors = [
    '.participant-home', '.participant-away', '.team-home', '.team-away',
    '.table-main__participant a', '.in-match a', 'a[href*="/soccer/"]'
  ];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const selector of participantSelectors) {
    row.find(selector).each((_index: number, node: any) => {
      const value = cleanText($(node).text());
      const key = teamKey(value);
      if (!value || value.length < 2 || !key || seen.has(key)) return;
      if (/^(odds|preview|details|stats|h2h|1|x|2)$/i.test(value)) return;
      seen.add(key);
      candidates.push(value);
    });
    if (candidates.length >= 2) break;
  }
  return candidates.length >= 2 ? { homeTeam: candidates[0], awayTeam: candidates[1] } : null;
}

function parseTime($: cheerio.CheerioAPI, row: any) {
  const attributes = [row.attr('data-time'), row.attr('data-dt'), row.attr('data-date')].filter(Boolean).map(cleanText);
  for (const value of attributes) {
    const match = value.match(/(?:T|\s)(\d{1,2}:\d{2})/);
    if (match) return match[1];
    if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  }
  const text = cleanText(row.find('.table-main__time, .time, td.h-text-right, [class*="time"]').first().text());
  const match = text.match(/\b(\d{1,2}:\d{2})\b/);
  return match?.[1] || '12:00';
}

function parseMatchUrl($: cheerio.CheerioAPI, row: any) {
  const href = row.find('.in-match a, .table-main__participant a, a[href*="/match/"] , a[href*="/soccer/"]').first().attr('href');
  if (!href) return undefined;
  try {
    return new URL(href, BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function parseOdds($: cheerio.CheerioAPI, row: any) {
  const values: number[] = [];
  const seen = new Set<number>();
  row.find('[data-odd], .table-main__odds, td[class*="odds"], .odds').each((_index: number, node: any) => {
    const element = $(node);
    const odd = parseOdd(element.attr('data-odd') || element.attr('data-value') || element.text());
    if (!odd || seen.has(odd)) return;
    seen.add(odd);
    values.push(odd);
  });
  if (values.length < 3) {
    const numbers = cleanText(row.text()).match(/\b\d{1,3}[.,]\d{1,3}\b/g) ?? [];
    for (const value of numbers) {
      const odd = parseOdd(value);
      if (!odd || seen.has(odd)) continue;
      seen.add(odd);
      values.push(odd);
    }
  }
  const odds: UpcomingOdds = {};
  if (values[0]) odds.home = values[0];
  if (values[1]) odds.draw = values[1];
  if (values[2]) odds.away = values[2];
  return odds;
}

export function parseBetExplorerHtml(html: string, date: string, pageUrl = BASE_URL): UpcomingFixture[] {
  const $ = cheerio.load(html);
  const rowSelectors = [
    'tr.table-main__row',
    'tr[data-def]',
    'tr[data-event-id]',
    '.table-main__row[data-def]',
    '[data-testid="match-row"]'
  ];
  const nodes = $(rowSelectors.join(',')).toArray();
  const fixtures: UpcomingFixture[] = [];
  const duplicateGuard = new Set<string>();

  for (const node of nodes) {
    const row = $(node);
    if (row.hasClass('table-main__row--head') || row.find('th').length) continue;
    const teams = parseTeams($, row);
    if (!teams) continue;
    const time = parseTime($, row);
    const title = findSectionTitle($, row);
    const { country, league } = splitLeagueTitle(title);
    const matchUrl = parseMatchUrl($, row);
    const sourceIdentity = cleanText(row.attr('data-def') || row.attr('data-event-id') || matchUrl || `${date}|${league}|${teams.homeTeam}|${teams.awayTeam}`);
    const dedupeKey = `${date}|${teamKey(teams.homeTeam)}|${teamKey(teams.awayTeam)}`;
    if (duplicateGuard.has(dedupeKey)) continue;
    duplicateGuard.add(dedupeKey);

    const kickoff = kickoffIso(date, time);
    const odds = parseOdds($, row);
    fixtures.push({
      id: stableFixtureId(sourceIdentity),
      providerFixtureId: stableNegativeId(sourceIdentity),
      provider: 'betexplorer',
      providerUrl: matchUrl || pageUrl,
      oddsSource: 'betexplorer',
      dataQuality: Object.keys(odds).length >= 3 ? 78 : 55,
      leagueId: Math.abs(stableNegativeId(`league|${country}|${league}`)) % 2_000_000_000,
      leagueCode: leagueCode(country, league),
      leagueName: league,
      country,
      season: seasonFor(date),
      kickoff,
      date,
      status: 'NS',
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      odds,
      rawOdds: {
        provider: 'betexplorer',
        pageUrl,
        matchUrl,
        listingOddsOnly: true
      },
      updatedAt: new Date().toISOString()
    });
  }

  return fixtures;
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export async function fetchBetExplorerFixtures(from: string, to: string) {
  const report: BetExplorerSyncReport = {
    provider: 'betexplorer',
    enabled: configuredEnabled(),
    requestedPages: 0,
    parsedFixtures: 0,
    pages: [],
    warnings: []
  };
  if (!report.enabled) return { fixtures: [] as UpcomingFixture[], report };

  const rateMs = Math.max(750, Number(process.env.BETEXPLORER_RATE_MS || 1800));
  const maxPages = Math.max(1, Math.min(50, Number(process.env.BETEXPLORER_MAX_PAGES || 18)));
  const fixtures: UpcomingFixture[] = [];

  for (const date of datesBetween(from, to)) {
    let foundForDate = false;
    for (const template of fixtureTemplates()) {
      if (report.requestedPages >= maxPages || foundForDate) break;
      const url = renderTemplate(template, date);
      report.requestedPages += 1;
      try {
        const response = await fetchHtml(url);
        const parsed = parseBetExplorerHtml(response.body, date, response.url);
        report.pages.push({ date, url: response.url, status: response.status, fixtures: parsed.length });
        if (parsed.length) {
          fixtures.push(...parsed);
          foundForDate = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        report.pages.push({ date, url, status: 0, fixtures: 0, error: message });
        if (/HTTP (403|429)/.test(message)) {
          report.warnings.push('BetExplorer refused automated access. The collector stopped without attempting to bypass the block.');
          report.parsedFixtures = fixtures.length;
          return { fixtures, report };
        }
      }
      await sleep(rateMs);
    }
  }

  report.parsedFixtures = fixtures.length;
  if (!fixtures.length) {
    report.warnings.push('No fixtures were parsed. BetExplorer may have changed its URL or HTML. Update BETEXPLORER_FIXTURE_URL_TEMPLATE or selectors before relying on this source.');
  }
  return { fixtures, report };
}

export function betExplorerConfiguration() {
  return {
    enabled: configuredEnabled(),
    baseUrl: BASE_URL,
    fixtureUrlTemplate: process.env.BETEXPLORER_FIXTURE_URL_TEMPLATE?.trim() || DEFAULT_TEMPLATE,
    rateMs: Math.max(750, Number(process.env.BETEXPLORER_RATE_MS || 1800)),
    mode: 'public-html-only',
    bypassesAccessControls: false
  };
}
