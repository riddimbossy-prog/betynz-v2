# Betynz Zeus Streak Intelligence v2.7

Betynz prediction platform for **today plus the next five days**, combining browser-rendered BetExplorer fixtures and visible odds with historical results, team streaks, HT/FT patterns and strict one-tip validation.

## What v2.7 adds

- BetExplorer streak and HT/FT page discovery in the browser collector
- Wins, draws, losses, no-win, no-draw and unbeaten streak snapshots
- Over/Under 2.5 streak analysis for home, away and overall form
- HT/FT overall, home and away profiles
- Opponent-adjusted streak strength using the historical PPG of recent opponents
- Team-v-team confrontation signals such as unbeaten vs no-win and wins vs losses
- **Zeus market competition**: all available markets compete and only one tip can win per fixture
- **Chronos** historical-odds neighbourhood comparison
- **Athena** statistical, streak and HT/FT validation
- **Leonidas** contradiction and rejection gate
- A responsive **Zeus Auto Picks** page section
- Simple-English explanations with confrontation, streak and HT/FT evidence
- Private admin rejected-battles audit endpoint
- Supabase tables for streak snapshots, confrontation records and rejected battles
- Bankers restricted to fully validated, four-engine selections
- Existing 1.19 minimum and strict market-upgrade rule retained

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

Run `supabase/migrations/005_zeus_streak_intelligence.sql`, deploy the repository, then run a new browser sync. Full steps are in `docs/UPGRADE_TO_V2_7.md`.

The collector respects access controls. It stops on blocking or rate limits and does not attempt a bypass.
