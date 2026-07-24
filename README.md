# Betynz v3.0.3 — Olympian Data Qualification Hotfix

This release fixes the zero-pick condition that remained in v3.0.2.

## Root cause fixed

API-Football historical fixture responses provide results and half-time scores but do not provide historical bookmaker prices. The standalone Chronos service required at least 60 historical matches carrying usable odds, so it rejected every API-Football-only history set.

The history bootstrap also queried only the fixture's current season. At the beginning of a new season, that season can contain upcoming fixtures but almost no completed matches, leaving Athena and Ares under-sampled.

## v3.0.3 behaviour

- API-Football remains the primary upcoming-fixture provider.
- Premium Odds API remains the automatic coverage fallback.
- Historical hydration queries the current season first.
- If the current season is below the safe history floor, the preceding season is fetched and merged automatically.
- Chronos keeps its historical-odds pattern mode as the primary path.
- When historical odds are genuinely unavailable, Chronos can use a conservative results-and-form path based on:
  - current market direction;
  - same-league result frequencies;
  - recent home/away team form;
  - minimum league and team samples.
- Chronos fallback picks are not automatically bankers.
- Athena remains the frozen HT/FT transition engine.
- Ares remains the streak and matchup-value engine.
- Zeus still accepts banker-grade inputs only and still rejects odds equal to or above 1.60.
- Chronos, Athena, Ares and Zeus publish through `god_picks`.
- Empty gods remain hidden for the selected day.
- After Refresh, the board automatically opens the first day that actually has picks.
- When no pick qualifies, the empty state reports how many fixtures were scanned and how many had complete 1X2 odds.

## Deploy

1. Replace the current repository contents with this release.
2. Commit and push through GitHub Desktop.
3. Let the Render API and web services redeploy.
4. Confirm the Render secrets still contain:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_TOKEN
API_FOOTBALL_KEY
ODDS_API_KEY
```

5. Confirm these Render values are present:

```text
API_FOOTBALL_HISTORY_ENABLED=true
API_FOOTBALL_HISTORY_PREVIOUS_SEASON_ENABLED=true
CHRONOS_ENGINE_ENABLED=true
ATHENA_ENGINE_ENABLED=true
ARES_ENGINE_ENABLED=true
ZEUS_ENGINE_ENABLED=true
```

6. Press **Refresh** once after deployment. The first rebuild may take longer because the preceding season can be imported.

## Database

No new migration is required for v3.0.3. The following existing migrations must already be installed:

```text
supabase/migrations/007_olympian_roles.sql
supabase/migrations/008_pipeline_hotfix.sql
```

## Private diagnostics

Use the existing private endpoint with the admin token:

```http
GET /api/v1/admin/pipeline-diagnostics
x-admin-token: <ADMIN_IMPORT_TOKEN>
```

The latest run now includes historical coverage totals and per-league current/previous-season fetch counts.
