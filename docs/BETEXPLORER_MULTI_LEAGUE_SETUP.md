# BetExplorer + all-league setup — Betynz v2.2

## What this build actually does

Betynz now has an internal multi-provider API. It can collect public BetExplorer fixture rows and visible 1X2 prices, merge them with API-Football fixture metadata and extended markets, save the merged feed to Supabase, then run Chronos for today plus the next five days.

This is an internal data adapter, not an official BetExplorer API. The collector uses ordinary public HTML requests only. It does not log in, solve CAPTCHAs, rotate proxies, or bypass blocks. Review BetExplorer's current terms and robots rules before enabling it. Because live web inspection was unavailable when this package was produced, the URL template and selectors must be tested against the current site before production use.

## Why hybrid mode is recommended

BetExplorer fixture listings commonly expose the fixture and basic 1X2 prices. Chronos also needs Over/Under, team totals, Double Chance and Draw No Bet. Hybrid mode therefore uses:

- BetExplorer for visible fixture-list 1X2 prices.
- API-Football for stable fixture identity, kickoff metadata and extended markets.
- Football-Data historical CSVs for settled-match learning.

When the same fixture exists in both feeds, BetExplorer's Home/Draw/Away values replace the corresponding API-Football values. Other markets remain available from API-Football.

## Supabase migration

Open Supabase SQL Editor and run:

```text
supabase/migrations/003_multileague_providers.sql
```

This adds provider metadata to `upcoming_fixtures` without deleting existing fixtures or predictions.

## Render environment variables

Open the Render API service and add or change:

```env
FIXTURE_PROVIDER=hybrid
BETEXPLORER_ENABLED=true
BETEXPLORER_BASE_URL=https://www.betexplorer.com
BETEXPLORER_FIXTURE_URL_TEMPLATE=https://www.betexplorer.com/next/soccer/?year={YYYY}&month={MM}&day={DD}
BETEXPLORER_RATE_MS=1800
BETEXPLORER_TIMEOUT_MS=20000
BETEXPLORER_MAX_PAGES=18
BETEXPLORER_UTC_OFFSET_MINUTES=0
```

Keep:

```env
API_FOOTBALL_KEY=your-existing-key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_MAX_ODDS_PAGES=50
PREDICTION_DAYS=6
PREDICTION_TIMEZONE=Africa/Accra
```

For every league available to the provider, make this blank:

```env
API_FOOTBALL_LEAGUE_IDS=
API_FOOTBALL_SEASON=
```

A value such as `39` deliberately restricts the sync to the English Premier League.

## Test BetExplorer before the full sync

After Render deploys, call the protected test endpoint from PowerShell. Replace the token with the same `ADMIN_IMPORT_TOKEN` stored in Render:

```powershell
$headers = @{ "x-admin-token" = "YOUR_ADMIN_IMPORT_TOKEN" }
$body = @{ from = "2026-07-23"; to = "2026-07-23" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "https://betynz-v2.onrender.com/api/v1/admin/test-betexplorer" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

A useful response contains:

```json
{
  "report": {
    "enabled": true,
    "parsedFixtures": 20
  },
  "sample": []
}
```

The fixture count will vary. If `parsedFixtures` is zero, inspect `report.pages` and `report.warnings`.

### If the current BetExplorer URL differs

Change only:

```env
BETEXPLORER_FIXTURE_URL_TEMPLATE=THE_CURRENT_DAILY_FIXTURE_URL
```

Supported placeholders are:

```text
{DATE}  = 2026-07-23
{YYYY}  = 2026
{MM}    = 07
{DD}    = 23
```

Optional fallback templates can be separated with semicolons:

```env
BETEXPLORER_FALLBACK_URL_TEMPLATES=https://example/{DATE};https://example/{YYYY}/{MM}/{DD}
```

Do not add proxy, CAPTCHA or login bypasses. If the site returns 403 or 429, the collector stops and hybrid mode uses API-Football instead.

## Run the six-day sync

GitHub:

```text
Actions → Sync upcoming Betynz predictions → Run workflow
```

Or call the private endpoint:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "https://betynz-v2.onrender.com/api/v1/admin/sync-upcoming" `
  -Headers @{ "x-admin-token" = "YOUR_ADMIN_IMPORT_TOKEN" } `
  -ContentType "application/json" `
  -Body "{}"
```

The response reports both providers, matched fixtures and warnings.

## Verify all-league data

Provider status:

```text
https://betynz-v2.onrender.com/api/v1/providers/status
```

All saved fixtures:

```text
https://betynz-v2.onrender.com/api/v1/upcoming-fixtures
```

Fixtures with odds only:

```text
https://betynz-v2.onrender.com/api/v1/upcoming-fixtures?oddsOnly=true
```

Country filter:

```text
https://betynz-v2.onrender.com/api/v1/upcoming-fixtures?country=Ghana
```

## Important distinction: all fixtures versus all predictions

The API can display fixtures from every available league. Chronos intentionally predicts only where it has enough settled league and team history:

- At least 60 settled matches in that league.
- At least four prior matches for each team.
- Enough comparable odds profiles.
- At least three of four engine approvals.

Therefore, a newly added league may appear on the fixture board before it receives a prediction. Import at least three historical seasons for each important league. This prevents EPL patterns from being presented as if they were proven in Ghana, Brazil, Japan or another competition.

## Data-source fields

Every upcoming fixture now stores:

```text
provider
provider_url
odds_source
data_quality
```

Possible provider values:

```text
betexplorer
api-football
hybrid
```

The explanation evidence also records the fixture provider, odds source and data-quality score for internal auditing.
