# Betynz Zeus + Ares v2.8.1

Betynz predicts **today plus the next five days** using BetExplorer, API-Football, The Odds API, historical results, streaks and HT/FT patterns. Zeus still selects one best market per qualified fixture, while Ares identifies streak-supported 1X2 favorites priced from **1.19 to 1.59**. Odds of exactly **1.60 are rejected**.

## v2.8.1 sync-rescue build

The browser collector no longer depends on the BetExplorer football landing page. It opens direct date pages first, retries safely, captures partial HTML after slow navigation and stops browser work after a configurable collection budget.

When BetExplorer returns no usable board:

1. API-Football supplies upcoming fixtures.
2. The Odds API fills missing Home/Draw/Away prices when a fixture can be matched safely by teams and kickoff time.
3. If every fresh provider fails, the existing Supabase fixtures are retained and used to rebuild Zeus and Ares predictions.

A failed sync never deletes valid upcoming fixtures.

## Prediction engines retained

- **Chronos** — historical odds-neighbourhood comparison
- **Athena** — statistics, streak and HT/FT validation
- **Zeus** — one-tip market competition
- **Ares** — sub-1.60 streak-favorite identification
- **Leonidas** — contradiction and final rejection gate

Bankers remain restricted to fully validated selections. Provisional picks can appear in Auto Picks but can never become Bankers.

## Main endpoints

- `GET /api/v1/health`
- `GET /api/v1/providers/status`
- `GET /api/v1/upcoming-fixtures`
- `GET /api/v1/predictions`
- `GET /api/v1/bankers?date=YYYY-MM-DD`
- `POST /api/v1/admin/sync-upcoming`
- `POST /api/v1/admin/rescue-upcoming`
- `POST /api/v1/admin/rebuild-predictions`
- `GET /api/v1/admin/rejected-battles`

Admin endpoints require `x-admin-token`.

## Upgrade

Follow `docs/UPGRADE_TO_V2_8_1.md`. No new Supabase migration is required. Keep `supabase/migrations/005_zeus_streak_intelligence.sql` applied.

The collector respects access controls. It does not bypass CAPTCHA, login requirements or rate limits.
