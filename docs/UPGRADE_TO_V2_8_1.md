# Upgrade to Betynz v2.8.1

## 1. Replace the repository files

Extract the package into the root of the existing Betynz repository and replace matching files.

Recommended commit message:

```text
Fix BetExplorer sync with automatic provider rescue v2.8.1
```

Push the commit to `main` and let Render redeploy the API.

## 2. Confirm Render environment variables

Required existing values:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_TOKEN
API_FOOTBALL_KEY
```

Add or confirm:

```text
FIXTURE_PROVIDER=betexplorer
AUTO_PROVIDER_RESCUE=true
API_FOOTBALL_TIMEZONE=Africa/Accra
ODDS_API_ENABLED=true
ODDS_API_KEY=<your existing The Odds API key>
ODDS_API_REGIONS=eu,uk
PREDICTION_DAYS=6
PREDICTION_TIMEZONE=Africa/Accra
```

`ODDS_API_KEY` is optional for fixture rescue but required when API-Football fixtures are missing complete 1X2 prices.

## 3. Confirm GitHub Actions secrets

The browser workflow still needs:

```text
BETYNZ_API_URL
BETYNZ_ADMIN_IMPORT_TOKEN
```

The provider API keys stay on Render. They do not need to be exposed to the browser workflow.

## 4. Deploy and test

After Render finishes, open:

```text
/api/v1/health
```

Expected engine version:

```text
zeus-chronos-ares-2.8.1
```

Then run **Sync upcoming Betynz predictions** from GitHub Actions.

Check:

```text
/api/v1/providers/status
/api/v1/predictions
```

The sync report now shows one of these sources:

- `betexplorer-browser`
- `provider-rescue`
- `retained-database`

A healthy prediction response should have `metrics.fixtures > 0` and `metrics.pricedFixtures > 0`. Picks are still subject to the Zeus, Chronos, Athena, Ares and Leonidas qualification rules, so priced fixtures do not guarantee a pick.

## 5. Manual rescue endpoint

When needed, send an authenticated POST request to:

```text
/api/v1/admin/rescue-upcoming
```

Body:

```json
{
  "from": "2026-07-24",
  "to": "2026-07-29"
}
```

The endpoint first attempts API-Football plus The Odds API enrichment. If that also fails, it safely rebuilds from retained Supabase fixtures instead of clearing the board.

No new database migration is required for v2.8.1. Migration `005_zeus_streak_intelligence.sql` should remain applied.
