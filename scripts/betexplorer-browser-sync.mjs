import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const API_URL = String(process.env.API_URL || '').replace(/\/$/, '');
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '');
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const TIMEZONE = process.env.PREDICTION_TIMEZONE || 'Africa/Accra';
const DAYS = Math.max(1, Math.min(10, Number(process.env.PREDICTION_DAYS || 6)));
const FROM_DATE = process.env.FROM_DATE || dateInTimeZone(TIMEZONE);
const TO_DATE = process.env.TO_DATE || addDays(FROM_DATE, DAYS - 1);
const BASE_URL = 'https://www.betexplorer.com';

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

function datesBetween(from, to) {
  const dates = [];
  for (let cursor = from; cursor <= to && dates.length < 10; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

function candidatesFor(date) {
  const [year, month, day] = date.split('-');
  return [
    `${BASE_URL}/football/?year=${year}&month=${month}&day=${day}`,
    `${BASE_URL}/next/soccer/?year=${year}&month=${month}&day=${day}`,
    `${BASE_URL}/?year=${year}&month=${month}&day=${day}`
  ];
}

function safeJsonScript(text, index) {
  return `<script type="application/json" data-betynz-network="${index}">${text.replace(/<\/script/gi, '<\\/script')}</script>`;
}

function combineHtml(html, networkJson) {
  let remaining = 1_250_000;
  const scripts = [];
  for (let index = 0; index < networkJson.length && remaining > 0; index += 1) {
    const text = networkJson[index];
    if (text.length > 450_000 || text.length > remaining) continue;
    scripts.push(safeJsonScript(text, index));
    remaining -= text.length;
  }
  const injection = scripts.join('\n');
  if (!injection) return html;
  return html.includes('</body>') ? html.replace('</body>', `${injection}</body>`) : `${html}${injection}`;
}

async function postRenderedPage(date, pageUrl, html) {
  const endpoint = DRY_RUN ? '/api/v1/admin/parse-betexplorer-html' : '/api/v1/admin/ingest-betexplorer-html';
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': ADMIN_TOKEN
    },
    body: JSON.stringify({ date, pageUrl, html })
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text.slice(0, 500) };
  }
  return { status: response.status, ok: response.ok, body };
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

const diagnostics = {
  mode: DRY_RUN ? 'test' : 'sync',
  from: FROM_DATE,
  to: TO_DATE,
  dates: [],
  totals: { fixtures: 0, fixturesWith1X2: 0, predictions: 0, bankers: 0 }
};

try {
  for (const date of datesBetween(FROM_DATE, TO_DATE)) {
    const dateReport = { date, attempts: [], selected: null };

    for (const url of candidatesFor(date)) {
      const page = await context.newPage();
      const networkJson = [];

      await page.route('**/*', async (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media'].includes(type)) await route.abort();
        else await route.continue();
      });

      page.on('response', async (response) => {
        try {
          const contentType = String(response.headers()['content-type'] || '').toLowerCase();
          const host = new URL(response.url()).hostname;
          if (!response.ok() || !contentType.includes('json')) return;
          if (!(host === 'betexplorer.com' || host.endsWith('.betexplorer.com'))) return;
          const text = await response.text();
          if (text.length >= 2 && text.length <= 450_000) networkJson.push(text);
        } catch {
          // Ignore individual response-body failures.
        }
      });

      let finalUrl = url;
      let title = '';
      let html = '';
      let bodyText = '';
      let navigationStatus = 0;
      let error = '';

      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        navigationStatus = response?.status() || 0;
        await page.waitForTimeout(4_000);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1_500);
        finalUrl = page.url();
        title = await page.title();
        bodyText = (await page.locator('body').innerText({ timeout: 10_000 })).slice(0, 3_000);
        html = combineHtml(await page.content(), networkJson);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }

      const lower = `${title} ${bodyText}`.toLowerCase();
      const blocked = /captcha|verify you are human|access denied|temporarily blocked|cloudflare/.test(lower);
      let apiResult = { status: 0, ok: false, body: { error: error || 'No HTML captured.' } };
      if (html.length >= 500 && !blocked) apiResult = await postRenderedPage(date, finalUrl, html);

      const fixtures = Number(apiResult.body?.fixtures || 0);
      const priced = Number(apiResult.body?.fixturesWith1X2 || 0);
      const predictions = Number(apiResult.body?.predictions || 0);
      const bankers = Number(apiResult.body?.bankers || 0);

      dateReport.attempts.push({
        requestedUrl: url,
        finalUrl,
        navigationStatus,
        title,
        htmlBytes: Buffer.byteLength(html || '', 'utf8'),
        networkJsonResponses: networkJson.length,
        blocked,
        apiStatus: apiResult.status,
        fixtures,
        fixturesWith1X2: priced,
        predictions,
        bankers,
        error: apiResult.body?.error || error || undefined
      });

      await page.close();

      if (blocked) {
        console.error(`BetExplorer returned an access page for ${url}. No bypass was attempted.`);
        break;
      }

      if (fixtures > 0 && priced > 0) {
        dateReport.selected = finalUrl;
        diagnostics.totals.fixtures += fixtures;
        diagnostics.totals.fixturesWith1X2 += priced;
        diagnostics.totals.predictions += predictions;
        diagnostics.totals.bankers += bankers;
        break;
      }
    }

    diagnostics.dates.push(dateReport);
  }
} finally {
  await browser.close();
}

await writeFile('betexplorer-browser-report.json', JSON.stringify(diagnostics, null, 2));
console.log(JSON.stringify(diagnostics, null, 2));

if (diagnostics.totals.fixtures < 1) {
  console.error('Browser collector failed: no fixtures were parsed.');
  process.exit(22);
}
if (diagnostics.totals.fixturesWith1X2 < 1) {
  console.error('Browser collector failed: fixtures were found but no complete 1X2 odds were parsed.');
  process.exit(23);
}
