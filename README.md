# Betynz Multi-League Chronos Fusion v2.2

Betynz v2.2 supplies a six-day prediction board for all football leagues available to the configured providers.

## Current data architecture

- **BetExplorer collector:** public fixture pages and the 1X2 odds visible with each fixture.
- **API-Football fallback/enrichment:** stable fixture IDs, kickoff metadata and extended markets.
- **Football-Data historical imports:** settled results and historical odds used by Chronos.
- **Supabase:** normalized fixtures, odds, predictions and settlements.
- **Render:** private API and public React frontend.

The collector does not bypass login, CAPTCHA, rate limits or access controls. BetExplorer HTML and current usage terms must be reviewed before enabling it in production. Its selectors and URL template are configurable because websites can change.

## All-league behavior

Leave `API_FOOTBALL_LEAGUE_IDS` blank. A value such as `39` intentionally limits the feed to the EPL.

Set:

```env
FIXTURE_PROVIDER=hybrid
BETEXPLORER_ENABLED=true
API_FOOTBALL_LEAGUE_IDS=
```

Hybrid mode prefers BetExplorer's visible 1X2 prices and fills extended markets from API-Football. It also includes unmatched fixtures from either provider.

## Main endpoints

- `GET /api/v1/providers/status`
- `GET /api/v1/upcoming-fixtures?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/upcoming-fixtures?country=Ghana&oddsOnly=true`
- `GET /api/v1/predictions`
- `GET /api/v1/bankers?date=YYYY-MM-DD`
- `POST /api/v1/admin/test-betexplorer`
- `POST /api/v1/admin/sync-upcoming`

## Database migrations

Run in order:

1. `001_schema.sql`
2. `002_prediction_engine.sql`
3. `003_multileague_providers.sql`

Read `docs/BETEXPLORER_MULTI_LEAGUE_SETUP.md` before deployment.
