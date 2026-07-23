import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const API_URL = String(process.env.API_URL || '').replace(/\/$/, '');
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '');
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const TIMEZONE = process.env.PREDICTION_TIMEZONE || 'Africa/Accra';
const DAYS = Math.max(1, Math.min(10, Number(process.env.PREDICTION_DAYS || 6)));
const FROM_DATE = process.env.FROM_DATE || dateInTimeZone(TIMEZONE);
const TO_DATE = process.env.TO_DATE || addDays(FROM_DATE, DAYS - 1);
const BASE_URL = 'https://www.betexplorer.com';
const DIAGNOSTIC_DIR = 'betexplorer-browser-diagnostics';
const LEAGUE_PAGE_LIMIT = DRY_RUN
  ? Math.max(0, Math.min(4, Number(process.env.BETEXPLORER_TEST_LEAGUE_PAGES || 2)))
  : Math.max(20, Math.min(180, Number(process.env.BETEXPLORER_LEAGUE_PAGE_LIMIT || 120)));
const REQUEST_DELAY_MS = Math.max(1400, Number(process.env.BETEXPLORER_BROWSER_RATE_MS || 2200));
const NO_NEW_FIXTURE_STOP = Math.max(12, Number(process.env.BETEXPLORER_NO_NEW_STOP || 30));
const MIN_LEAGUE_PAGES = DRY_RUN ? 1 : Math.max(20, Math.min(150, Number(process.env.BETEXPLORER_MIN_LEAGUE_PAGES || 60)));
const REQUEST_JITTER_MS = Math.max(0, Number(process.env.BETEXPLORER_BROWSER_JITTER_MS || 700));

if (!API_URL || !ADMIN_TOKEN) {
  console.error('API_URL and ADMIN_TOKEN are required.');
  process.exit(2);
}

function dateInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function allowedBetExplorerUrl(raw) {
  try {
    const url = new URL(raw, BASE_URL);
    if (url.protocol !== 'https:') return null;
    if (!(url.hostname === 'betexplorer.com' || url.hostname.endsWith('.betexplorer.com'))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function apiPost(path, payload) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': ADMIN_TOKEN
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { error: text.slice(0, 800) }; }
  return { status: response.status, ok: response.ok, body };
}

async function postRenderedPage(pageUrl, html) {
  const endpoint = DRY_RUN ? '/api/v1/admin/parse-betexplorer-html' : '/api/v1/admin/ingest-betexplorer-html';
  return apiPost(endpoint, DRY_RUN
    ? { date: FROM_DATE, pageUrl, html }
    : { from: FROM_DATE, to: TO_DATE, pageUrl, html });
}

async function openPage(context, requestedUrl) {
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const type = route.request().resourceType();
    if (['image', 'font', 'media'].includes(type)) await route.abort();
    else await route.continue();
  });

  let status = 0;
  let finalUrl = requestedUrl;
  let title = '';
  let bodyText = '';
  let html = '';
  let error = '';
  try {
    const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    status = response?.status() || 0;
    await page.waitForTimeout(3_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1_000);
    finalUrl = page.url();
    title = await page.title();
    bodyText = (await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '')).slice(0, 4_000);
    html = await page.content();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const lower = `${title} ${bodyText}`.toLowerCase();
  const blocked = status === 429 || /captcha|verify you are human|access denied|temporarily blocked|cloudflare/.test(lower);
  return { page, status, finalUrl, title, bodyText, html, error, blocked };
}

async function discoverLeagueLinks(page) {
  return page.evaluate(() => {
    const result = [];
    const byUrl = new Map();
    const anchors = [...document.querySelectorAll('a[href*="/football/"]')];
    for (const anchor of anchors) {
      try {
        const url = new URL(anchor.getAttribute('href') || '', location.href);
        if (url.hostname !== 'www.betexplorer.com' && url.hostname !== 'betexplorer.com') continue;
        if (!/^\/football\/[^/]+\/[^/]+\/$/.test(url.pathname)) continue;
        const key = url.origin + url.pathname;
        const header = anchor.closest('tr.js-tournament');
        let upcomingRows = 0;
        let pricedRows = 0;
        if (header) {
          let cursor = header.nextElementSibling;
          while (cursor && !cursor.matches('tr.js-tournament')) {
            if (cursor.matches('tr[data-dt]') && !cursor.querySelector('.table-main__result')) {
              upcomingRows += 1;
              if (cursor.querySelectorAll('td.table-main__odds').length >= 3) pricedRows += 1;
            }
            cursor = cursor.nextElementSibling;
          }
        }
        const text = String(anchor.textContent || anchor.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        const inMainTable = Boolean(header);
        const priority = (inMainTable ? 10_000 : 0) + pricedRows * 100 + upcomingRows * 10;
        const current = byUrl.get(key);
        if (!current || priority > current.priority) {
          byUrl.set(key, { url: key, title: text, priority, inMainTable });
        }
      } catch {
        // Ignore malformed links.
      }
    }
    for (const entry of byUrl.values()) result.push(entry);
    return result;
  });
}

async function discoverFixtureTab(page) {
  return page.evaluate(() => {
    const anchors = [...document.querySelectorAll('a[href]')];
    for (const anchor of anchors) {
      const text = String(anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const href = anchor.getAttribute('href') || '';
      if (!/(fixture|schedule|next matches)/.test(text) && !/fixtures|schedule/.test(href)) continue;
      try {
        const url = new URL(href, location.href);
        if (!(url.hostname === 'betexplorer.com' || url.hostname.endsWith('.betexplorer.com'))) continue;
        return url.toString();
      } catch {
        // Ignore malformed links.
      }
    }
    return null;
  });
}

async function captureDiagnostics(page, index, label, apiResult) {
  await mkdir(DIAGNOSTIC_DIR, { recursive: true });
  const safe = label.replace(/[^a-z0-9-]+/gi, '-').slice(0, 80);
  const prefix = `${String(index).padStart(2, '0')}-${safe}`;
  const html = await page.content().catch(() => '');
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  const dom = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    tournamentRows: document.querySelectorAll('tr.js-tournament').length,
    datedRows: document.querySelectorAll('tr[data-dt]').length,
    oddsRows: document.querySelectorAll('tr[data-dt] td.table-main__odds').length,
    leagueLinks: document.querySelectorAll('tr.js-tournament a[href*="/football/"]').length
  })).catch(() => ({}));
  await Promise.all([
    writeFile(`${DIAGNOSTIC_DIR}/${prefix}.html`, html),
    writeFile(`${DIAGNOSTIC_DIR}/${prefix}-body.txt`, bodyText.slice(0, 120_000)),
    writeFile(`${DIAGNOSTIC_DIR}/${prefix}-dom.json`, JSON.stringify({ ...dom, apiResult }, null, 2)),
    page.screenshot({ path: `${DIAGNOSTIC_DIR}/${prefix}.png`, fullPage: true }).catch(() => undefined)
  ]);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({
  locale: 'en-GB',
  timezoneId: TIMEZONE,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1440, height: 1100 }
});

const report = {
  mode: DRY_RUN ? 'test' : 'sync',
  from: FROM_DATE,
  to: TO_DATE,
  pagesVisited: 0,
  discoveredLeagues: 0,
  selectedLeaguePages: 0,
  leaguePageLimit: LEAGUE_PAGE_LIMIT,
  minimumLeaguePages: MIN_LEAGUE_PAGES,
  partial: false,
  blocked: false,
  pages: [],
  totals: {
    fixtures: 0,
    fixtureLeagues: 0,
    fixturesWith1X2: 0,
    predictions: 0,
    fullPicks: 0,
    provisionalPicks: 0,
    bankers: 0
  }
};
const fixtureIds = new Set();
const pricedFixtureIds = new Set();
let diagnosticIndex = 0;
let noNewStreak = 0;

async function processUrl(rawUrl, label) {
  const requestedUrl = allowedBetExplorerUrl(rawUrl);
  if (!requestedUrl) return { newFixtures: 0, links: [] };
  const opened = await openPage(context, requestedUrl);
  report.pagesVisited += 1;
  diagnosticIndex += 1;
  let apiResult = { status: 0, ok: false, body: { error: opened.error || 'No HTML captured.' } };
  if (opened.html.length >= 500 && !opened.blocked) apiResult = await postRenderedPage(opened.finalUrl, opened.html);
  if (DRY_RUN && opened.html.length >= 500) await captureDiagnostics(opened.page, diagnosticIndex, label, apiResult);

  const ids = Array.isArray(apiResult.body?.fixtureIds)
    ? apiResult.body.fixtureIds
    : Array.isArray(apiResult.body?.sample)
      ? apiResult.body.sample.map((fixture) => fixture?.id).filter(Boolean)
      : [];
  const pricedIds = Array.isArray(apiResult.body?.fixturesWith1X2Ids)
    ? apiResult.body.fixturesWith1X2Ids
    : [];
  let newFixtures = 0;
  for (const id of ids) {
    if (!fixtureIds.has(id)) {
      fixtureIds.add(id);
      newFixtures += 1;
    }
  }
  for (const id of pricedIds) pricedFixtureIds.add(id);

  report.pages.push({
    label,
    requestedUrl,
    finalUrl: opened.finalUrl,
    status: opened.status,
    blocked: opened.blocked,
    htmlBytes: Buffer.byteLength(opened.html || '', 'utf8'),
    apiStatus: apiResult.status,
    fixtures: Number(apiResult.body?.fixtures || 0),
    fixturesWith1X2: Number(apiResult.body?.fixturesWith1X2 || 0),
    leagues: Number(apiResult.body?.leagues || 0),
    newFixtures,
    error: apiResult.body?.error || opened.error || undefined
  });

  if (opened.blocked) {
    report.blocked = true;
    report.partial = fixtureIds.size > 0;
    console.error(`BetExplorer returned an access page for ${requestedUrl}. No bypass was attempted.`);
  }

  const links = await discoverLeagueLinks(opened.page).catch(() => []);
  const fixtureTab = label.startsWith('league:') ? await discoverFixtureTab(opened.page).catch(() => null) : null;
  await opened.page.close();
  return { newFixtures, links, fixtureTab, blocked: opened.blocked };
}

try {
  const landing = await processUrl(`${BASE_URL}/football/`, 'football-landing');
  const leagueMap = new Map();
  for (const entry of landing.links || []) leagueMap.set(entry.url, entry);
  report.discoveredLeagues = leagueMap.size;

  if (!landing.blocked) {
    const leagueLinks = [...leagueMap.values()]
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || a.title.localeCompare(b.title))
      .slice(0, LEAGUE_PAGE_LIMIT);
    for (let index = 0; index < leagueLinks.length; index += 1) {
      const entry = leagueLinks[index];
      await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * (REQUEST_JITTER_MS + 1)));
      const result = await processUrl(entry.url, `league:${entry.title || index + 1}`);
      report.selectedLeaguePages += 1;
      if (result.blocked) break;

      if (result.newFixtures === 0 && result.fixtureTab && result.fixtureTab !== entry.url && !DRY_RUN) {
        await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * (REQUEST_JITTER_MS + 1)));
        const tabResult = await processUrl(result.fixtureTab, `fixtures:${entry.title || index + 1}`);
        if (tabResult.blocked) break;
        result.newFixtures += tabResult.newFixtures;
      }

      noNewStreak = result.newFixtures > 0 ? 0 : noNewStreak + 1;
      if (!DRY_RUN && report.selectedLeaguePages >= MIN_LEAGUE_PAGES && noNewStreak >= NO_NEW_FIXTURE_STOP && fixtureIds.size > 0) break;
    }
  }

  if (!DRY_RUN && fixtureIds.size > 0) {
    const rebuilt = await apiPost('/api/v1/admin/rebuild-predictions', { from: FROM_DATE, to: TO_DATE });
    if (!rebuilt.ok) throw new Error(rebuilt.body?.error || `Prediction rebuild failed with HTTP ${rebuilt.status}`);
    report.totals = {
      fixtures: Number(rebuilt.body?.fixtures || 0),
      fixtureLeagues: Number(rebuilt.body?.fixtureLeagues || 0),
      fixturesWith1X2: Number(rebuilt.body?.fixturesWith1X2 || 0),
      predictions: Number(rebuilt.body?.predictions || 0),
      fullPicks: Number(rebuilt.body?.fullPicks || 0),
      provisionalPicks: Number(rebuilt.body?.provisionalPicks || 0),
      bankers: Number(rebuilt.body?.bankers || 0)
    };
  } else {
    report.totals.fixtures = fixtureIds.size || Math.max(0, ...report.pages.map((page) => page.fixtures || 0));
    report.totals.fixturesWith1X2 = pricedFixtureIds.size || Math.max(0, ...report.pages.map((page) => page.fixturesWith1X2 || 0));
    report.totals.fixtureLeagues = Math.max(0, ...report.pages.map((page) => page.leagues || 0));
  }
} finally {
  await browser.close();
}

await writeFile('betexplorer-browser-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (report.blocked && report.totals.fixtures < 1) process.exit(24);
if (report.totals.fixtures < 1) {
  console.error('Browser collector failed: no fixtures were parsed.');
  process.exit(22);
}
if (report.totals.fixturesWith1X2 < 1) {
  console.error('Browser collector failed: fixtures were found but no complete 1X2 odds were parsed.');
  process.exit(23);
}
