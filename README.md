# Betynz v3.0.4 — Olympian Provider Linkage Hotfix

This release repairs the final zero-pick data path between API-Football, the premium Odds API fallback, historical hydration, and the Olympian engines.

## Core pipeline

1. API-Football discovers canonical fixtures with league and team IDs.
2. API-Football odds are used when available.
3. The premium Odds API fills missing markets on matched canonical fixtures.
4. Historical results and HT/FT data are hydrated for the leagues most likely to publish picks.
5. Chronos, Athena, and Ares write qualified selections into `god_picks`.
6. Zeus aggregates banker selections only when `1.00 < odds < 1.60`.

## Important Render values

```env
FIXTURE_PROVIDER=api-football
BETEXPLORER_ENABLED=false
ODDS_API_FALLBACK_ENABLED=true
ODDS_API_INCLUDE_UNMATCHED_FIXTURES=false
API_FOOTBALL_HISTORY_ENABLED=true
API_FOOTBALL_HISTORY_PREVIOUS_SEASON_ENABLED=true
API_FOOTBALL_HISTORY_MAX_LEAGUES=36
CHRONOS_ENGINE_ENABLED=true
ATHENA_ENGINE_ENABLED=true
ARES_ENGINE_ENABLED=true
ZEUS_ENGINE_ENABLED=true
```

Keep `API_FOOTBALL_LEAGUE_IDS` and `API_FOOTBALL_SEASON` empty unless you intentionally want selected-league mode.

## Diagnostics

Public, secret-free summary:

```text
GET /api/v1/pipeline/status
```

Private full diagnostics:

```text
GET /api/v1/admin/pipeline-diagnostics
x-admin-token: ADMIN_IMPORT_TOKEN
```

Provider report:

```text
GET /api/v1/providers/status
```

## Supabase

No new migration is required for v3.0.4. Existing migrations `007_olympian_roles.sql` and `008_pipeline_hotfix.sql` must already be installed.
