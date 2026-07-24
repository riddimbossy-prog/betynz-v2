# Betynz Zeus + Ares Streak Intelligence v2.8.0

Betynz prediction platform for **today plus the next five days**, combining browser-rendered BetExplorer fixtures and visible odds with historical results, team streaks, HT/FT patterns and strict one-tip validation.

## What v2.8.0 includes

- BetExplorer streak and HT/FT page discovery in the browser collector
- Wins, draws, losses, no-win, no-draw and unbeaten streak snapshots
- Over/Under 2.5 streak analysis for home, away and overall form
- HT/FT overall, home and away profiles
- Opponent-adjusted streak strength using the historical PPG of recent opponents
- Team-v-team confrontation signals such as unbeaten vs no-win and wins vs losses
- **Ares Streak Favorites**: identifies home or away win favorites priced from 1.19 to 1.59 only when the favorite’s positive streak and the opponent’s negative streak agree
- **Zeus market competition**: all available markets compete and only one tip can win per fixture
- **Chronos** historical-odds neighbourhood comparison
- **Athena** statistical, streak and HT/FT validation
- **Leonidas** contradiction and rejection gate
- A dedicated **Ares Streak Favorites** section plus the existing responsive **Zeus Auto Picks** section
- Simple-English explanations with confrontation, streak and HT/FT evidence
- Private admin rejected-battles audit endpoint
- Supabase tables for streak snapshots, confrontation records and rejected battles
- Bankers restricted to fully validated, four-engine selections
- Existing 1.19 minimum and strict market-upgrade rule retained


## v2.8.0 Ares favorite-streak build

Ares now scans every fully analyzed fixture for a clear 1X2 favorite below 1.60. It also has a provisional fallback for thinner leagues when the venue streaks and global historical price pattern are strong enough; provisional Ares picks never become Bankers. It requires at least two independent confirmations from favorite wins/unbeaten form, opponent losses/no-win form, directional confrontation signals, HT/FT lead protection, or decisive no-draw runs. It rejects the pick when the favorite is on a no-win/loss run, the opponent is winning or strongly unbeaten, or the opposite streak signal dominates. The v2.7.1 Auto Picks fallback remains included.

## Main endpoints

- `GET /api/v1/providers/status`
- `GET /api/v1/upcoming-fixtures`
- `GET /api/v1/predictions`
- `GET /api/v1/bankers?date=YYYY-MM-DD`
- `GET /api/v1/admin/rejected-battles` — requires `x-admin-token`
- `POST /api/v1/admin/parse-betexplorer-html`
- `POST /api/v1/admin/ingest-betexplorer-html`
- `POST /api/v1/admin/parse-betexplorer-streak-html`
- `POST /api/v1/admin/ingest-betexplorer-streak-html`
- `POST /api/v1/admin/rebuild-predictions`

## Upgrade

Run `supabase/migrations/005_zeus_streak_intelligence.sql`, deploy the repository, then run a new browser sync. Full v2.8 steps are in `docs/UPGRADE_TO_V2_8.md`.

The collector respects access controls. It stops on blocking or rate limits and does not attempt a bypass.
