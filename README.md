# Betynz v3.0.0 — Olympian Engine Roles

This build gives each Betynz god one official responsibility and makes Zeus the final supervisor.

## Engine roles

- **Chronos** matches upcoming fixtures against historical odds, results and successful historical profiles.
- **Athena** runs the frozen HT/FT transition engine: lead protection, comebacks, draw transitions, late separation and swing routes.
- **Ares** compares compatible streaks and value profiles: unbeaten vs winless, winning vs losing, and strong Over/Under 2.5 streak matchups.
- **Zeus** collects banker-grade picks from Chronos, Athena and Ares, rejects conflicts and duplicates, and publishes only selections with valid odds **strictly below 1.60**.

## Public board

- Zeus, Chronos, Athena and Ares each have their own public picks.
- A god with no picks anywhere in the active board window is hidden.
- A visible god with no pick on the chosen date displays only **No picks for today.**
- Public cards show only fixture, kickoff, selection, odds, banker badge and one short stats line.
- Formulas, thresholds, explanations and trade-secret logic stay off the public board.

## Required Supabase migrations

Run migrations in numerical order. The new v3.0 migration is:

```text
supabase/migrations/007_olympian_roles.sql
```

It creates the `god_picks` table used by the four public engines.

## Required Render secrets

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ODDS_API_KEY
```

Keep `ODDS_API_KEY` in Render only. Never expose it through a `VITE_` frontend variable or commit the real key to GitHub.

## Engine switches

```text
CHRONOS_ENGINE_ENABLED=true
ATHENA_ENGINE_ENABLED=true
ARES_ENGINE_ENABLED=true
ZEUS_ENGINE_ENABLED=true
CHRONOS_PUBLIC_ENABLED=true
ATHENA_PUBLIC_ENABLED=true
ARES_PUBLIC_ENABLED=true
ZEUS_PUBLIC_ENABLED=true
```

The Zeus odds ceiling is hard-locked in the backend at `< 1.60`.

## Deployment

1. Run migration `007_olympian_roles.sql` in Supabase.
2. Replace the current repository contents with this package.
3. Commit and push through GitHub Desktop.
4. Render rebuilds the API.
5. Run the existing prediction sync workflow or call the protected rebuild endpoint.

## Validation

- New Chronos historical service: type-checked and synthetic smoke-tested.
- New Ares streak/value service: type-checked and synthetic smoke-tested.
- Zeus consensus, conflict rejection, exact 1.60 rejection and Athena market translation: tested.
- Public React board: targeted TypeScript check passed.
- Static package verification: `npm run test:v3`.
