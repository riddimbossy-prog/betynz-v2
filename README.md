# Betynz v3.0.2 — Historical Bootstrap Hotfix

This hotfix keeps the automatic Olympian pipeline and adds the historical data layer required for Athena and Ares to qualify real picks after deployment.

## Official engine flow

1. **API-Football** supplies the six-day fixture board, available odds, and a bounded historical results/HT-FT bootstrap for leagues that do not yet have enough Supabase history.
2. The **premium Odds API** activates as fallback when API-Football has insufficient 1X2 or O/U 2.5 coverage, or returns no fixtures.
3. **Chronos**, **Athena**, and **Ares** independently build qualified picks.
4. Their public picks are written to Supabase `god_picks`.
5. **Zeus** aggregates banker-grade inputs, rejects conflicts, and publishes only picks with a valid decimal price strictly greater than `1.00` and strictly below `1.60`.

## Automatic rebuilds

The API process now uses a single-flight pipeline runner. Overlapping rebuilds join the active run instead of spending provider quota twice.

- Startup rebuild: enabled by default.
- Daily rebuild: `03:15` in `PREDICTION_TIMEZONE` by default.
- Public Refresh: `POST /api/v1/predictions/refresh` performs a real provider sync and rebuild.
- Public Refresh cooldown: five minutes by default.
- Admin sync: `POST /api/v1/admin/sync-upcoming` uses the same controlled pipeline.

```text
PIPELINE_STARTUP_REBUILD_ENABLED=true
PIPELINE_DAILY_REBUILD_ENABLED=true
PIPELINE_DAILY_HOUR=3
PIPELINE_DAILY_MINUTE=15
PIPELINE_PUBLIC_REFRESH_COOLDOWN_MS=300000
```


## Historical bootstrap

Before the gods rebuild, the pipeline checks upcoming teams against Supabase history. Leagues with insufficient team samples are hydrated from completed API-Football fixtures. This supplies results, full-time scores, and half-time scores without lowering any engine threshold.

```text
API_FOOTBALL_HISTORY_ENABLED=true
API_FOOTBALL_HISTORY_DAYS=365
API_FOOTBALL_HISTORY_MAX_LEAGUES=18
API_FOOTBALL_HISTORY_CONCURRENCY=3
API_FOOTBALL_HISTORY_MIN_TEAM_MATCHES=6
API_FOOTBALL_HISTORY_MIN_LEAGUE_MATCHES=40
```

The import is idempotent and skips leagues once enough history exists, protecting API quota on later startup, daily, and manual rebuilds. Chronos still requires historical odds-pattern evidence; the bootstrap does not fabricate old prices.

## Private diagnostics

`GET /api/v1/admin/pipeline-diagnostics`

Send the existing admin token in the `x-admin-token` header. The response is private/no-store and includes:

- active and recent rebuild runs;
- trigger, status, duration, and safe error message;
- API-Football fixture and coverage counts;
- Odds API fallback trigger reasons and usage;
- Chronos, Athena, Ares, Zeus, and total `god_picks` publication counts;
- schedule configuration;
- historical leagues requested, matches fetched/imported, and safe bootstrap warnings.

No API keys or Supabase credentials are returned.

## Public board behavior

- God tabs are calculated for the selected date.
- A god with zero picks on that date is hidden.
- Zeus picks are guarded again in the frontend with the strict `< 1.60` rule.
- The PWA cache key is bumped to `betynz-shell-v3-0-2` so installed apps receive the hotfix.
- A failed Refresh now returns an actual pipeline failure instead of silently presenting an empty board.

## Required Supabase migrations

Run these in numerical order:

```text
supabase/migrations/007_olympian_roles.sql
supabase/migrations/008_pipeline_hotfix.sql
```

Migration `007` creates `god_picks`. Migration `008` allows unmatched premium Odds API fallback fixtures to be stored with provider `odds-api`.

## Required Render secrets

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_TOKEN
API_FOOTBALL_KEY
ODDS_API_KEY
```

The included `deploy/render.yaml` sets API-Football as primary, enables the premium Odds API fallback, and enables startup/daily rebuilding.

## Validation

```text
npm run test:v3
npm run test:olympian
npm run test:history-bootstrap
npm run build
```

The package also includes `TEST_REPORT_V3_0_2.md` with the checks completed in the build environment.
