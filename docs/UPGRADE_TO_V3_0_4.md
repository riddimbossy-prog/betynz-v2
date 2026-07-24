# Upgrade to Betynz v3.0.4

1. Replace the repository contents with this package.
2. Commit and push to GitHub.
3. Let both Render services redeploy.
4. Confirm these API-service environment values:

```env
FIXTURE_PROVIDER=api-football
BETEXPLORER_ENABLED=false
ODDS_API_FALLBACK_ENABLED=true
ODDS_API_INCLUDE_UNMATCHED_FIXTURES=false
API_FOOTBALL_HISTORY_ENABLED=true
API_FOOTBALL_HISTORY_PREVIOUS_SEASON_ENABLED=true
API_FOOTBALL_HISTORY_MAX_LEAGUES=36
```

5. Press **Refresh** once after deployment.
6. Open the safe pipeline summary:

```text
https://betynz-v2.onrender.com/api/v1/pipeline/status
```

Look for:

- `oddsApiMatchedToPrimary` greater than zero when fallback was used;
- `fixtureHistoryCoverage.bothTeamsAtLeast4` greater than zero;
- non-zero `chronosPicks`, `athenaPicks`, or `aresPicks` when fixtures qualify;
- `topRejectionReasons` when no pick qualifies.

The private endpoint remains available with `x-admin-token` at `/api/v1/admin/pipeline-diagnostics`.
