# Upgrade to Betynz v2.8.0

1. Extract the v2.8 ZIP.
2. Copy all files into the root of the Betynz GitHub repository and replace matching files.
3. Keep the existing Supabase migration `005_zeus_streak_intelligence.sql` applied.
4. No new database migration is required for v2.8 because Ares uses the existing predictions and streak-intelligence fields.
5. Commit and push:

```text
Add Ares streak favorites engine v2.8
```

6. Wait for the API and web Render services to deploy.
7. Confirm the health endpoint reports:

```text
zeus-chronos-ares-2.8.0
```

8. Run a new upcoming-fixtures/predictions sync.
9. Open the predictions endpoint and verify:

- `metrics.streakFavorites`
- `streakFavorites`
- picks with `qualification: "ARES_STREAK_FAVOURITE"`

Ares does not select every favorite below 1.60. Odds only open the gate; the streak confrontation and rejection checks decide whether the team is identified.
