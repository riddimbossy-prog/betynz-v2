# Betynz Zeus + Ares v2.8.2

Betynz predicts **today plus the next five days** using BetExplorer, API-Football, The Odds API, historical results, streaks and HT/FT patterns.

## What changed in v2.8.2

Ares is now an independent engine instead of depending on whichever market Zeus selected for a fixture.

Every complete 1X2 fixture with a unique favorite priced from **1.19 to 1.59** is assessed by Ares. Odds of exactly **1.60 are rejected**.

Ares now produces two separate outputs:

- **Ares Picks** — favorites that pass the refined price, streak, sample and contradiction gates.
- **Ares Watchlist** — sub-1.60 favorites that were found but are not yet picks. Each card explains the exact missing streak confirmation or contradiction.

The refined engine accepts either:

- Two-sided agreement: the favorite has a positive run and the opponent has a negative run.
- Strong one-sided agreement: a decisive favorite or opponent streak is supported by the market and a compatible directional signal.

Historical-odds-neighbor requirements no longer block Ares because this specialist is built around current 1X2 price plus team streak confrontation. Zeus, Chronos, Athena and Leonidas continue to control the main one-tip board.

## Provider rescue retained

When BetExplorer returns no usable board:

1. API-Football supplies upcoming fixtures.
2. The Odds API fills missing Home/Draw/Away prices when teams and kickoff time match safely.
3. If every fresh provider fails, existing Supabase fixtures are retained.

A failed sync never deletes valid upcoming fixtures.

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

Follow `docs/UPGRADE_TO_V2_8_2.md`. No new Supabase migration is required. Keep `supabase/migrations/005_zeus_streak_intelligence.sql` applied.

The collector respects access controls. It does not bypass CAPTCHA, login requirements or rate limits.
