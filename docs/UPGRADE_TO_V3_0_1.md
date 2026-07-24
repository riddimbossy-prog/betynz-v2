# Upgrade to Betynz v3.0.1

## 1. Run Supabase migrations

Open Supabase SQL Editor and run, in order:

```text
supabase/migrations/007_olympian_roles.sql
supabase/migrations/008_pipeline_hotfix.sql
```

Do not skip migration 007. The rebuild intentionally fails when `god_picks` is unavailable so an empty public board cannot be mistaken for a successful pipeline.

## 2. Replace and push the repository

Replace the repository contents with this package, commit in GitHub Desktop, and push to the branch connected to Render.

## 3. Confirm Render secrets

Required secret values:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_TOKEN
API_FOOTBALL_KEY
ODDS_API_KEY
```

The included Render blueprint already sets:

```text
FIXTURE_PROVIDER=api-football
ODDS_API_FALLBACK_ENABLED=true
PIPELINE_STARTUP_REBUILD_ENABLED=true
PIPELINE_DAILY_REBUILD_ENABLED=true
PIPELINE_DAILY_HOUR=3
PIPELINE_DAILY_MINUTE=15
PREDICTION_TIMEZONE=Africa/Accra
```

## 4. Deploy

Render runs the API build and starts the service. As soon as the server begins listening, the startup pipeline starts automatically without blocking health checks.

## 5. Verify

Health:

```text
GET /api/v1/health
```

Private diagnostics, with `x-admin-token`:

```text
GET /api/v1/admin/pipeline-diagnostics
```

A successful diagnostic run should show:

- `status: succeeded`;
- provider mode `api-football`;
- fixture counts above zero;
- `godPicksPublished` equal to the combined Chronos, Athena, Ares, and Zeus count;
- Zeus picks at odds below 1.60 only.

The public Refresh button now invokes:

```text
POST /api/v1/predictions/refresh
```

It performs a real rebuild. Requests made during an active rebuild join it; repeated requests during the cooldown return the newly generated dashboard without starting another provider sync.
