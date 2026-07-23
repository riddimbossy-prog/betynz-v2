# Upgrade Betynz to Chronos Fusion v2.5

## 1. Run the Supabase migration

Open **Supabase → SQL Editor → New query** and run:

```text
supabase/migrations/004_prediction_tiers.sql
```

This adds `tier` and `qualification` to `predictions` and prevents provisional selections from becoming Bankers.

## 2. Replace the repository files

Extract the patch or full package and copy the files into the root of your local `betynz-v2` repository.

Commit message:

```text
Build Chronos full and provisional six-day engine
```

Push to `main` and wait for both Render services to redeploy.

## 3. Render API environment

Keep:

```text
FIXTURE_PROVIDER=betexplorer
BETEXPLORER_ENABLED=true
PREDICTION_DAYS=6
PREDICTION_TIMEZONE=Africa/Accra
```

Recommended crawler settings:

```text
BETEXPLORER_LEAGUE_PAGE_LIMIT=30
BETEXPLORER_BROWSER_RATE_MS=1800
BETEXPLORER_NO_NEW_STOP=12
```

`BETEXPLORER_LEAGUE_PAGE_LIMIT` may be raised carefully, but a larger value means more page requests and a greater chance of an HTTP 429 response.

## 4. Run the parser test

Open:

```text
GitHub → Actions → Test BetExplorer browser feed → Run workflow
```

The test must report at least one fixture and one complete 1X2 price.

## 5. Run the six-day sync

Open:

```text
GitHub → Actions → Sync upcoming Betynz predictions → Run workflow
```

The report now includes:

```text
fixtures
fixtureLeagues
predictions
fullPicks
provisionalPicks
bankers
```

## 6. Verify

Open:

```text
https://betynz-v2.onrender.com/api/v1/upcoming-fixtures?oddsOnly=true
https://betynz-v2.onrender.com/api/v1/predictions
https://betynz.com
```

### Full Chronos
Requires local league history, team form, venue records and historical odds patterns. Full picks may become Bankers when all strict rules pass.

### Provisional global odds
Used only when local history is incomplete. It relies on complete 1X2 prices and closely matched historical odds profiles. It is always labelled provisional and never enters the Banker section.

## Important operational rule

The collector stops if BetExplorer displays an access page, CAPTCHA or HTTP 429. It does not bypass access controls. Reduce `BETEXPLORER_LEAGUE_PAGE_LIMIT` or increase `BETEXPLORER_BROWSER_RATE_MS` when rate limits occur.
