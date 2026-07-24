# Betynz v2.9.0 — Public Athena God Picks Board

This build is based on Betynz v2.8 and promotes the frozen Athena Transition Engine RC1 from background-only testing to the public God Picks board.

## Public board changes

- Zeus and Athena picks are both displayed.
- Only gods with at least one available pick appear as tabs.
- Selecting a god with no pick on the chosen date shows only **No picks for today.**
- Detailed engine explanations, methodology panels, route logic and the 1.19 notice were removed from the public board.
- Cards show only fixture, selection, available odds, banker badge and a short statistical line.
- Empty Bankers, Provisional, Radar and engine-method sections no longer clutter the main board.

## Data fallback

- BetExplorer remains the primary fixture source.
- When complete 1X2 coverage is below `ODDS_API_FALLBACK_MIN_FIXTURES`, the premium `ODDS_API_KEY` provider automatically adds and enriches fixtures.
- The Odds API can supply H2H and totals prices.
- A protected admin endpoint can backfill missing historical odds into already-settled matches in controlled date windows.

## Required Render secrets

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ODDS_API_KEY
```

Keep the real Odds API key in Render environment secrets. Never put it in the frontend or commit it to GitHub.

## First deployment

Run this migration in Supabase if it has not already been applied:

```text
supabase/migrations/006_athena_transition_shadow.sql
```

Then deploy the repository. The engine version changed to `zeus-athena-public-2.9.0`, which triggers a clean prediction rebuild.

## Historical odds backfill

Use the protected endpoint only when needed because premium historical requests consume API quota:

```text
POST /api/v1/admin/backfill-odds-api-history
x-admin-token: <ADMIN_IMPORT_TOKEN>
Content-Type: application/json

{
  "from": "2026-07-01",
  "to": "2026-07-07"
}
```

The default maximum is seven days per request.
