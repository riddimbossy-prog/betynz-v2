# Upgrade to Betynz v2.9.0

1. Keep the existing Supabase project.
2. Confirm migration `006_athena_transition_shadow.sql` has been run.
3. Replace the repository files with this package.
4. Add `ODDS_API_KEY` as a private Render environment variable.
5. Confirm `ATHENA_PUBLIC_ENABLED=true`.
6. Deploy the API and web app.
7. Open `/api/v1/health` and verify `providers.oddsApi.enabled` is true.
8. Open the website and verify Zeus/Athena tabs appear only when picks exist.

Do not expose `ODDS_API_KEY` through `VITE_` variables or frontend code.
