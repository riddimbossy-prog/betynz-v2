# Upgrade Betynz from v2.7.1 to v2.8.0

1. Replace the repository files with this package.
2. In Supabase SQL Editor, run `supabase/migrations/006_athena_transition_shadow.sql`.
3. Confirm Render has these environment variables:

```text
ATHENA_SHADOW_ENABLED=true
ATHENA_HISTORY_LIMIT=24
ATHENA_MIN_HTFT_SAMPLE=6
```

4. Push the repository to GitHub and let Render deploy.
5. Confirm the health response contains `athenaTransition`:

```text
GET /api/v1/health
```

6. Trigger a prediction rebuild through the existing workflow or:

```text
POST /api/v1/admin/rebuild-athena-shadow
```

7. Inspect the private shadow dashboard. Athena selections remain hidden from public users.

## Rollback

Set `ATHENA_SHADOW_ENABLED=false` and rebuild predictions. Zeus continues operating normally. The shadow table can remain in Supabase.
