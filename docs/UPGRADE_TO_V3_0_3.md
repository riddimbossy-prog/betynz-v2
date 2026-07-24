# Upgrade to Betynz v3.0.3

1. Copy the complete v3.0.3 release into the repository.
2. Commit and push.
3. Wait for Render to finish deploying.
4. Verify `/api/v1/health` reports `olympian-roles-3.0.3`.
5. Press **Refresh** once.
6. Check the private pipeline diagnostics if the board remains empty.

No new Supabase SQL migration is required.

The important new Render value is:

```text
API_FOOTBALL_HISTORY_PREVIOUS_SEASON_ENABLED=true
```
