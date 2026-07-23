# Betynz v2.4 — Browser-rendered BetExplorer feed

## Why v2.3 returned zero fixtures

The GitHub report showed HTTP 200 for every BetExplorer URL but `parsedFixtures: 0` and `fixturesWith1X2: 0`. The plain HTTP collector received a page that did not contain the rendered fixture rows or usable embedded data. Because `FIXTURE_PROVIDER=betexplorer`, the prediction sync then had no fixtures and correctly returned HTTP 400.

The old test workflow also appeared green because GitHub was still running the previous workflow definition. The v2.4 workflow fails when zero fixtures or zero complete 1X2 prices are parsed.

## What v2.4 changes

- GitHub Actions opens BetExplorer in a real Chromium browser.
- It waits for JavaScript to render the page.
- It captures rendered HTML and public JSON responses from BetExplorer pages.
- It sends the rendered page to the protected Betynz API.
- The API parses, stores and predicts the fixtures in Supabase.
- It does not bypass CAPTCHA, access blocks or login controls.
- A JSON diagnostics report is uploaded after every workflow run.

No Supabase migration is required.

## Install

1. Extract `betynz-v2.4-browser-patch.zip`.
2. Copy everything inside the patch into the local `betynz-v2` repository.
3. Replace destination files when Windows asks.
4. In GitHub Desktop commit: `Use browser-rendered BetExplorer fixture feed`.
5. Push origin.
6. Wait until the Render API deployment is Live.

The patch must include the hidden-looking `.github` folder. In Windows Explorer, copy the folder itself, not only the visible `apps` folder.

## Run the new workflow

Do not click **Re-run all jobs** on an old workflow run. That reuses the old workflow file.

Open:

`GitHub → Actions → Test BetExplorer browser feed → Run workflow`

A successful run must report totals greater than zero for both:

- `fixtures`
- `fixturesWith1X2`

Then run:

`GitHub → Actions → Sync upcoming Betynz predictions → Run workflow`

The sync uploads a `betexplorer-browser-sync-report.json` artifact even when it fails.

## Render settings

Keep:

- `FIXTURE_PROVIDER=betexplorer`
- `BETEXPLORER_ENABLED=true`
- `PREDICTION_DAYS=6`
- `PREDICTION_TIMEZONE=Africa/Accra`

The new browser action uses the existing GitHub secrets:

- `BETYNZ_API_URL`
- `BETYNZ_ADMIN_IMPORT_TOKEN`

## When it still returns zero

Open the workflow run and download `betexplorer-browser-test-report`. Check each attempt for:

- `finalUrl`
- `title`
- `htmlBytes`
- `networkJsonResponses`
- `blocked`
- `apiStatus`
- `error`

If `blocked` is true, the collector stops and does not attempt a bypass. If `htmlBytes` is large but fixtures remain zero, the current BetExplorer DOM/data structure needs another parser update using the diagnostic report.
