# Upgrade to Betynz v3.0.2

## Why this hotfix exists

v3.0.1 rebuilt upcoming fixtures and odds correctly, but a fresh Supabase deployment could still have too little completed-match history for Athena and Ares. Their qualification rules then returned no picks, leaving Zeus with nothing to aggregate.

v3.0.2 hydrates missing league history from API-Football before rebuilding the gods.

## Deployment

1. Replace the repository contents with this package.
2. Commit and push to the branch used by the Render `betynz-api` service.
3. Allow Render to rebuild and restart the API.
4. Keep these existing secrets configured:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_TOKEN
API_FOOTBALL_KEY
ODDS_API_KEY
```

5. The following settings have safe built-in defaults and are included in `deploy/render.yaml`:

```text
API_FOOTBALL_HISTORY_ENABLED=true
API_FOOTBALL_HISTORY_DAYS=365
API_FOOTBALL_HISTORY_MAX_LEAGUES=18
API_FOOTBALL_HISTORY_CONCURRENCY=3
API_FOOTBALL_HISTORY_MIN_TEAM_MATCHES=6
API_FOOTBALL_HISTORY_MIN_LEAGUE_MATCHES=40
```

6. After deployment, press Refresh once. The first rebuild may take longer because it can import completed fixtures for under-covered leagues. Later rebuilds skip leagues with sufficient history.

## Supabase

No new migration is required for v3.0.2. The historical rows use the existing `matches` table from migration `001_schema.sql`.

The v3 Olympian migrations must still already be installed:

```text
007_olympian_roles.sql
008_pipeline_hotfix.sql
```

## Private verification

Call:

```text
GET /api/v1/admin/pipeline-diagnostics
x-admin-token: <ADMIN_IMPORT_TOKEN>
```

Check the latest successful run for:

```text
historyLeaguesRequested
historyMatchesFetched
historicalMatchesImported
athenaPicks
aresPicks
zeusAutoPicks
```

A zero value can still be legitimate when no fixture passes the strict rules, but it will no longer be caused merely by a fresh database lacking completed-match and HT/FT history.
