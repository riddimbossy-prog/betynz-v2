# Betynz Chronos Fusion v2.5

Betynz prediction platform for **today plus the next five days**, using BetExplorer browser-rendered fixtures and visible 1X2 prices.

## What v2.5 adds

- Controlled competition-page crawling for future fixtures across the six-day window
- Country and league names carried into every fixture
- **Full Chronos** selections when local league, team, venue and historical odds data are ready
- **Provisional global-odds** selections when local history is limited
- Provisional selections are clearly marked, medium risk and can never be Bankers
- Banker section remains restricted to fully qualified 4/4-engine selections
- One best market per fixture
- Low-odds rule: prices below 1.19 require a validated stronger market; otherwise the match is rejected
- Simple-English explanation for every published pick
- Fixture-league counts are based on imported fixtures, not only qualified picks
- Predictions are rebuilt once after the complete browser crawl, avoiding stale or duplicated engine runs

## Main endpoints

- `GET /api/v1/providers/status`
- `GET /api/v1/upcoming-fixtures`
- `GET /api/v1/predictions`
- `GET /api/v1/bankers?date=YYYY-MM-DD`
- `POST /api/v1/admin/parse-betexplorer-html`
- `POST /api/v1/admin/ingest-betexplorer-html`
- `POST /api/v1/admin/rebuild-predictions`
- `POST /api/v1/admin/sync-upcoming`

Install `supabase/migrations/004_prediction_tiers.sql`, then follow `docs/UPGRADE_TO_V2_5.md`.
