# Upgrade live Betynz to v2.2

1. Extract the ZIP and replace the contents of the local `betynz-v2` repository.
2. Run `supabase/migrations/003_multileague_providers.sql` in Supabase SQL Editor.
3. Commit and push through GitHub Desktop.
4. In the Render API environment, set `FIXTURE_PROVIDER=hybrid`, configure BetExplorer, and leave `API_FOOTBALL_LEAGUE_IDS` blank.
5. Deploy the API and static site.
6. Test `/api/v1/providers/status`.
7. Test `/api/v1/admin/test-betexplorer` with the admin token.
8. Run the GitHub workflow `Sync upcoming Betynz predictions`.
9. Check `/api/v1/upcoming-fixtures?oddsOnly=true` and `/api/v1/predictions`.

Do not delete the 760 EPL historical records. They remain the EPL learning base while other leagues are backfilled.
