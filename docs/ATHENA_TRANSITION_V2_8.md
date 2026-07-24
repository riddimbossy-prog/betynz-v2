# Athena Transition Engine v1.0-RC1 in Betynz v2.8

Athena runs in **FROZEN_SHADOW** mode. It evaluates every upcoming fixture but does not publish its selections to normal users yet.

## Data flow

1. BetExplorer/API Football fixtures enter the existing fixture pipeline.
2. BetExplorer HT/FT and Over/Under tables are parsed into streak snapshots.
3. Historical results fill missing HT/FT and goal samples.
4. Athena calculates compatible routes: W/W–L/L, D/W–D/L, W/D–L/D, L/W–W/L and D/D–D/D.
5. It classifies the game and returns one banker or `NO_PICK`.
6. The run is stored in `athena_shadow_runs`.
7. Imported final results automatically settle pending Athena runs.

## Private API

All routes require `x-admin-token`.

```bash
curl -H "x-admin-token: $ADMIN_IMPORT_TOKEN" \
  "$API_URL/api/v1/admin/athena-shadow?from=2026-07-24&to=2026-07-30"
```

```bash
curl -X POST \
  -H "content-type: application/json" \
  -H "x-admin-token: $ADMIN_IMPORT_TOKEN" \
  -d '{"from":"2026-07-24","to":"2026-07-30"}' \
  "$API_URL/api/v1/admin/rebuild-athena-shadow"
```

## Frozen settings

- `ATHENA_SHADOW_ENABLED=true`
- `ATHENA_HISTORY_LIMIT=24`
- `ATHENA_MIN_HTFT_SAMPLE=6`
- Banker threshold: 80
- One banker maximum per fixture
- Missing or conflicting evidence can return `NO_PICK`

Do not alter the RC1 rules during the 100-match shadow batch. Review performance only after the complete batch.
