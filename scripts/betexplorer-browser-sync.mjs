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
const REQUEST_DELAY_MS = Math.max(900, Number(process.env.BETEXPLORER_BROWSER_RATE_MS || 1800));
const NO_NEW_FIXTURE_STOP = Math.max(8, Number(process.env.BETEXPLORER_NO_NEW_STOP || 24));
const MIN_LEAGUE_PAGES = DRY_RUN ? 1 : Math.max(10, Math.min(150, Number(process.env.BETEXPLORER_MIN_LEAGUE_PAGES || 40)));
const REQUEST_JITTER_MS = Math.max(0, Number(process.env.BETEXPLORER_BROWSER_JITTER_MS || 500));
const INTELLIGENCE_TAB_LIMIT = Math.max(0, Math.min(4, Number(process.env.BETEXPLORER_INTELLIGENCE_TAB_LIMIT || 2)));
const NAVIGATION_TIMEOUT_MS = Math.max(20_000, Math.min(120_000, Number(process.env.BETEXPLORER_BROWSER_TIMEOUT_MS || 65_000)));
const NAVIGATION_RETRIES = Math.max(1, Math.min(4, Number(process.env.BETEXPLORER_BROWSER_RETRIES || 2)));
const COLLECTOR_BUDGET_MS = Math.max(120_000, Math.min(30 * 60_000, Number(process.env.BETEXPLORER_BROWSER_BUDGET_MS || 10 * 60_000)));
const COLLECTOR_STARTED_AT = Date.now();
const FAILURE_DIAGNOSTICS = !['0', 'false', 'no', 'off'].includes(String(process.env.BETEXPLORER_FAILURE_DIAGNOSTICS ?? 'true').toLowerCase());
const DIRECT_URL_TEMPLATES = splitConfig(process.env.BETEXPLORER_DIRECT_URL_TEMPLATES).length
  ? splitConfig(process.env.BETEXPLORER_DIRECT_URL_TEMPLATES)
  : [
      `${BASE_URL}/football/?year={YYYY}&month={MM}&day={DD}`,
      `${BASE_URL}/next/soccer/?year={YYYY}&month={MM}&day={DD}`,
      `${BASE_URL}/?year={YYYY}&month={MM}&day={DD}`
    ];
const LANDING_URLS = splitConfig(process.env.BETEXPLORER_BROWSER_LANDING_URLS).length
  ? splitConfig(process.env.BETEXPLORER_BROWSER_LANDING_URLS)
  : [`${BASE_URL}/football/`, `${BASE_URL}/next/soccer/`];
const visitedIntelligenceUrls = new Set();

function browserBudgetExceeded() {
  return Date.now() - COLLECTOR_STARTED_AT >= COLLECTOR_BUDGET_MS;
}

if (!API_URL || !ADMIN_TOKEN) {
  console.error('API_URL and ADMIN_TOKEN are required.');
  process.exit(2);
}

function splitConfig(value) {
  return String(value || '').split(';').map((item) => item.trim()).filter(Boolean);
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

function datesBetween(from, to) {
  const dates = [];
  for (let cursor = from; cursor <= to && dates.length < 10; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

function renderTemplate(template, date) {
  const [year, month, day] = date.split('-');
  return template
    .replaceAll('{DATE}', date)
    .replaceAll('{YYYY}', year)
    .replaceAll('{MM}', month)
    .replaceAll('{DD}', day);
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

async function postRenderedPage(pageUrl, html, fallbackDate) {
  const endpoint = DRY_RUN ? '/api/v1/admin/parse-betexplorer-html' : '/api/v1/admin/ingest-betexplorer-html';
  return apiPost(endpoint, DRY_RUN
    ? { date: fallbackDate, pageUrl, html }
    : { date: fallbackDate, from: FROM_DATE, to: TO_DATE, pageUrl, html });
}

async function postRenderedStreakPage(pageUrl, html) {
  const endpoint = DRY_RUN ? '/api/v1/admin/parse-betexplorer-streak-html' : '/api/v1/admin/ingest-betexplorer-streak-html';
  return apiPost(endpoint, { snapshotDate: FROM_DATE, pageUrl, html });
}

async function acceptCookies(page) {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    '[id*="accept"]',
    '[class*="accept"]'
  ];
  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible({ timeout: 800 }).catch(() => false)) {
      await button.click({ timeout: 2_000 }).catch(() => undefined);
      break;
    }
  }
}

async function openPage(context, requestedUrl) {
  let last = {
    page: null,
    status: 0,
    finalUrl: requestedUrl,
    title: '',
    bodyText: '',
    html: '',
    error: '',
    blocked: false,
    attempts: 0
  };

  for (let attempt = 1; attempt <= NAVIGATION_RETRIES; attempt += 1) {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
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
      const response = await page.goto(requestedUrl, { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS });
      status = response?.status() || 0;
      await page.waitForLoadState('domcontentloaded', { timeout: Math.min(25_000, NAVIGATION_TIMEOUT_MS) }).catch(() => undefined);
      await page.waitForTimeout(2_500);
      await acceptCookies(page);
      await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight, 4500))).catch(() => undefined);
      await page.waitForTimeout(800);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    finalUrl = page.url() || requestedUrl;
    title = await page.title().catch(() => '');
    bodyText = (await page.locator('body').innerText({ timeout: 8_000 }).catch(() => '')).slice(0, 8_000);
    html = await page.content().catch(() => '');
    const lower = `${title} ${bodyText}`.toLowerCase();
    const blocked = status === 403 || status === 429 || /captcha|verify you are human|access denied|temporarily blocked|cloudflare/.test(lower);
    last = { page, status, finalUrl, title, bodyText, html, error, blocked, attempts: attempt };

    if (blocked || html.length >= 500) return last;
    await page.close().catch(() => undefined);
    await sleep(1_500 * attempt);
  }

  return last;
}

async function discoverLeagueLinks(page) {
  if (!page) return [];
  return page.evaluate(() => {
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
        if (!current || priority > current.priority) byUrl.set(key, { url: key, title: text, priority, inMainTable });
      } catch {
        // Ignore malformed links.
      }
    }
    return [...byUrl.values()];
  });
}

async function discoverFixtureTab(page) {
  if (!page) return null;
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

async function discoverIntelligenceTabs(page) {
  if (!page) return [];
  return page.evaluate(() => {
    const byUrl = new Map();
    for (const anchor of [...document.querySelectorAll('a[href]')]) {
      const text = String(anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const href = anchor.getAttribute('href') || '';
      const combined = `${text} ${href.toLowerCase()}`;
      if (!/(streak|form table|ht\/?ft|half.?time.*full.?time|standings.*form)/.test(combined)) continue;
      try {
        const url = new URL(href, location.href);
        if (!(url.hostname === 'betexplorer.com' || url.hostname.endsWith('.betexplorer.com'))) continue;
        url.hash = '';
        byUrl.set(url.toString(), { url: url.toString(), title: text || 'streak intelligence' });
      } catch {
        // Ignore malformed links.
      }
    }
    return [...byUrl.values()];
  });
}

async function captureDiagnostics(page, index, label, apiResult) {
  if (!page) return;
  await mkdir(DIAGNOSTIC_DIR, { recursive: true });
  const safe = label.replace(/[^a-z0-9-]+/gi, '-').slice(0, 80);
  const prefix = `${String(index).padStart(2, '0')}-${safe}`;
  const html = await page.content().catch(() => '');
  const bodyText = await page.locator('body').innerText({ timeout: 8_000 }).catch(() => '');
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
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-background-networking']
});
const context = await browser.newContext({
  locale: 'en-GB',
  timezoneId: TIMEZONE,
  userAgent: process.env.BETEXPLORER_BROWSER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1440, height: 1100 },
  ignoreHTTPSErrors: false,
  extraHTTPHeaders: {
    'accept-language': 'en-GB,en;q=0.9',
    'cache-control': 'no-cache',
    pragma: 'no-cache'
  }
});

const report = {
  mode: DRY_RUN ? 'test' : 'sync',
  from: FROM_DATE,
  to: TO_DATE,
  strategy: 'direct-date-first-with-provider-rescue',
  directUrlTemplates: DIRECT_URL_TEMPLATES,
  navigationTimeoutMs: NAVIGATION_TIMEOUT_MS,
  navigationRetries: NAVIGATION_RETRIES,
  collectorBudgetMs: COLLECTOR_BUDGET_MS,
  browserBudgetExceeded: false,
  pagesVisited: 0,
  discoveredLeagues: 0,
  selectedLeaguePages: 0,
  leaguePageLimit: LEAGUE_PAGE_LIMIT,
  minimumLeaguePages: MIN_LEAGUE_PAGES,
  partial: false,
  blocked: false,
  selectedSource: 'none',
  rescue: {
    attempted: false,
    ok: false,
    source: 'none',
    retained: false,
    message: ''
  },
  pages: [],
  totals: {
    fixtures: 0,
    fixtureLeagues: 0,
    fixturesWith1X2: 0,
    predictions: 0,
    fullPicks: 0,
    provisionalPicks: 0,
    bankers: 0,
    streakSnapshots: 0,
    intelligencePages: 0
  }
};
const fixtureIds = new Set();
const pricedFixtureIds = new Set();
let diagnosticIndex = 0;
let noNewStreak = 0;

async function processUrl(rawUrl, label, fallbackDate = FROM_DATE) {
  const requestedUrl = allowedBetExplorerUrl(rawUrl);
  if (!requestedUrl) return { newFixtures: 0, newPricedFixtures: 0, links: [], blocked: false };
  const opened = await openPage(context, requestedUrl);
  report.pagesVisited += 1;
  diagnosticIndex += 1;
  let apiResult = { status: 0, ok: false, body: { error: opened.error || 'No HTML captured.' } };
  if (opened.html.length >= 500 && !opened.blocked) apiResult = await postRenderedPage(opened.finalUrl, opened.html, fallbackDate);

  const shouldCapture = DRY_RUN || (FAILURE_DIAGNOSTICS && (!apiResult.ok || opened.blocked || opened.html.length < 500));
  if (shouldCapture) await captureDiagnostics(opened.page, diagnosticIndex, label, apiResult);

  const ids = Array.isArray(apiResult.body?.fixtureIds)
    ? apiResult.body.fixtureIds
    : Array.isArray(apiResult.body?.sample)
      ? apiResult.body.sample.map((fixture) => fixture?.id).filter(Boolean)
      : [];
  const pricedIds = Array.isArray(apiResult.body?.fixturesWith1X2Ids) ? apiResult.body.fixturesWith1X2Ids : [];
  let newFixtures = 0;
  let newPricedFixtures = 0;
  for (const id of ids) {
    if (!fixtureIds.has(id)) {
      fixtureIds.add(id);
      newFixtures += 1;
    }
  }
  for (const id of pricedIds) {
    if (!pricedFixtureIds.has(id)) {
      pricedFixtureIds.add(id);
      newPricedFixtures += 1;
    }
  }

  report.pages.push({
    label,
    fallbackDate,
    requestedUrl,
    finalUrl: opened.finalUrl,
    status: opened.status,
    attempts: opened.attempts,
    blocked: opened.blocked,
    title: opened.title,
    htmlBytes: Buffer.byteLength(opened.html || '', 'utf8'),
    apiStatus: apiResult.status,
    fixtures: Number(apiResult.body?.fixtures || 0),
    fixturesWith1X2: Number(apiResult.body?.fixturesWith1X2 || 0),
    leagues: Number(apiResult.body?.leagues || 0),
    newFixtures,
    newPricedFixtures,
    error: apiResult.body?.error || opened.error || undefined
  });

  if (opened.blocked) {
    report.blocked = true;
    report.partial = fixtureIds.size > 0;
    console.error(`BetExplorer returned an access page for ${requestedUrl}. No bypass was attempted.`);
  }

  const links = await discoverLeagueLinks(opened.page).catch(() => []);
  const fixtureTab = label.startsWith('league:') ? await discoverFixtureTab(opened.page).catch(() => null) : null;
  const intelligenceTabs = label.startsWith('league:') ? await discoverIntelligenceTabs(opened.page).catch(() => []) : [];
  await opened.page?.close().catch(() => undefined);
  return { newFixtures, newPricedFixtures, links, fixtureTab, intelligenceTabs, blocked: opened.blocked };
}

async function processIntelligenceUrl(rawUrl, label) {
  const requestedUrl = allowedBetExplorerUrl(rawUrl);
  if (!requestedUrl || visitedIntelligenceUrls.has(requestedUrl)) return { snapshots: 0, blocked: false };
  visitedIntelligenceUrls.add(requestedUrl);
  const opened = await openPage(context, requestedUrl);
  report.pagesVisited += 1;
  diagnosticIndex += 1;
  let apiResult = { status: 0, ok: false, body: { error: opened.error || 'No HTML captured.' } };
  if (opened.html.length >= 500 && !opened.blocked) apiResult = await postRenderedStreakPage(opened.finalUrl, opened.html);
  const shouldCapture = DRY_RUN || (FAILURE_DIAGNOSTICS && (!apiResult.ok || opened.blocked || opened.html.length < 500));
  if (shouldCapture) await captureDiagnostics(opened.page, diagnosticIndex, label, apiResult);
  const snapshots = Number(apiResult.body?.snapshots || 0);
  report.totals.streakSnapshots += snapshots;
  report.totals.intelligencePages += 1;
  report.pages.push({
    label,
    requestedUrl,
    finalUrl: opened.finalUrl,
    status: opened.status,
    attempts: opened.attempts,
    blocked: opened.blocked,
    htmlBytes: Buffer.byteLength(opened.html || '', 'utf8'),
    apiStatus: apiResult.status,
    streakSnapshots: snapshots,
    streakRows: Number(apiResult.body?.rows || 0),
    error: apiResult.body?.error || opened.error || undefined
  });
  await opened.page?.close().catch(() => undefined);
  if (opened.blocked) {
    report.blocked = true;
    report.partial = fixtureIds.size > 0;
  }
  return { snapshots, blocked: opened.blocked };
}

function applyRebuildTotals(body) {
  report.totals = {
    ...report.totals,
    fixtures: Number(body?.fixtures || 0),
    fixtureLeagues: Number(body?.fixtureLeagues || 0),
    fixturesWith1X2: Number(body?.fixturesWith1X2 || 0),
    predictions: Number(body?.predictions || 0),
    fullPicks: Number(body?.fullPicks || 0),
    provisionalPicks: Number(body?.provisionalPicks || 0),
    bankers: Number(body?.bankers || 0),
    streakSnapshots: Math.max(report.totals.streakSnapshots, Number(body?.streakSnapshots || 0))
  };
}

try {
  const leagueMap = new Map();

  // Rescue change 1: visit direct date pages first. The football landing page is no longer a single point of failure.
  for (const date of datesBetween(FROM_DATE, TO_DATE)) {
    if (browserBudgetExceeded()) { report.browserBudgetExceeded = true; break; }
    let foundPricedForDate = false;
    for (let index = 0; index < DIRECT_URL_TEMPLATES.length; index += 1) {
      if (browserBudgetExceeded()) { report.browserBudgetExceeded = true; break; }
      const url = renderTemplate(DIRECT_URL_TEMPLATES[index], date);
      const result = await processUrl(url, `direct:${date}:${index + 1}`, date);
      for (const entry of result.links || []) leagueMap.set(entry.url, entry);
      if (result.newPricedFixtures > 0) foundPricedForDate = true;
      if (foundPricedForDate || result.blocked) break;
      await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * (REQUEST_JITTER_MS + 1)));
    }
    if (report.blocked) break;
  }

  // Landing pages are now secondary discovery sources only.
  if (!report.blocked && (leagueMap.size < 5 || fixtureIds.size === 0)) {
    for (let index = 0; index < LANDING_URLS.length; index += 1) {
      if (browserBudgetExceeded()) { report.browserBudgetExceeded = true; break; }
      const landing = await processUrl(LANDING_URLS[index], `landing:${index + 1}`, FROM_DATE);
      for (const entry of landing.links || []) leagueMap.set(entry.url, entry);
      if (landing.blocked || leagueMap.size >= 5) break;
      await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * (REQUEST_JITTER_MS + 1)));
    }
  }

  report.discoveredLeagues = leagueMap.size;

  if (!report.blocked && leagueMap.size) {
    const leagueLinks = [...leagueMap.values()]
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.title || '').localeCompare(String(b.title || '')))
      .slice(0, LEAGUE_PAGE_LIMIT);
    for (let index = 0; index < leagueLinks.length; index += 1) {
      if (browserBudgetExceeded()) { report.browserBudgetExceeded = true; break; }
      const entry = leagueLinks[index];
      await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * (REQUEST_JITTER_MS + 1)));
      const result = await processUrl(entry.url, `league:${entry.title || index + 1}`, FROM_DATE);
      report.selectedLeaguePages += 1;
      if (result.blocked) break;

      if (result.newFixtures === 0 && result.fixtureTab && result.fixtureTab !== entry.url && !DRY_RUN) {
        await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * (REQUEST_JITTER_MS + 1)));
        const tabResult = await processUrl(result.fixtureTab, `fixtures:${entry.title || index + 1}`, FROM_DATE);
        if (tabResult.blocked) break;
        result.newFixtures += tabResult.newFixtures;
      }

      for (const intelligenceTab of (result.intelligenceTabs || []).slice(0, INTELLIGENCE_TAB_LIMIT)) {
        await sleep(REQUEST_DELAY_MS + Math.floor(Math.random() * (REQUEST_JITTER_MS + 1)));
        const intelligenceResult = await processIntelligenceUrl(intelligenceTab.url, `streak:${entry.title || index + 1}:${intelligenceTab.title}`);
        if (intelligenceResult.blocked) break;
      }
      if (report.blocked) break;

      noNewStreak = result.newFixtures > 0 ? 0 : noNewStreak + 1;
      if (!DRY_RUN && report.selectedLeaguePages >= MIN_LEAGUE_PAGES && noNewStreak >= NO_NEW_FIXTURE_STOP && fixtureIds.size > 0) break;
    }
  }

  if (!DRY_RUN && fixtureIds.size > 0 && pricedFixtureIds.size > 0) {
    const rebuilt = await apiPost('/api/v1/admin/rebuild-predictions', { from: FROM_DATE, to: TO_DATE });
    if (!rebuilt.ok) throw new Error(rebuilt.body?.error || `Prediction rebuild failed with HTTP ${rebuilt.status}`);
    applyRebuildTotals(rebuilt.body);
    report.selectedSource = 'betexplorer-browser';
  } else if (!DRY_RUN) {
    // Rescue change 2: API-Football + The Odds API, then retained database fixtures if fresh providers fail.
    report.rescue.attempted = true;
    const rescued = await apiPost('/api/v1/admin/rescue-upcoming', { from: FROM_DATE, to: TO_DATE });
    report.rescue.ok = rescued.ok;
    report.rescue.source = rescued.body?.syncStatus?.source || rescued.body?.providers?.selectedSource || 'none';
    report.rescue.retained = Boolean(rescued.body?.retained || rescued.body?.syncStatus?.source === 'retained-database');
    report.rescue.message = rescued.body?.syncStatus?.message || rescued.body?.error || '';
    if (!rescued.ok) throw new Error(rescued.body?.error || `Provider rescue failed with HTTP ${rescued.status}`);
    applyRebuildTotals(rescued.body);
    report.selectedSource = report.rescue.source;
  } else {
    report.totals.fixtures = fixtureIds.size || Math.max(0, ...report.pages.map((page) => page.fixtures || 0));
    report.totals.fixturesWith1X2 = pricedFixtureIds.size || Math.max(0, ...report.pages.map((page) => page.fixturesWith1X2 || 0));
    report.totals.fixtureLeagues = Math.max(0, ...report.pages.map((page) => page.leagues || 0));
    report.selectedSource = 'betexplorer-browser-test';
  }
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
}

await writeFile('betexplorer-browser-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (report.failure) {
  console.error(report.failure);
  process.exit(25);
}
if (report.totals.fixtures < 1) {
  console.error('Collector and provider rescue failed: no fixtures are available. Existing data was not deleted.');
  process.exit(22);
}
if (report.totals.fixturesWith1X2 < 1) {
  console.error('Fixtures are available, but none have complete Home/Draw/Away odds after provider rescue.');
  process.exit(23);
}
