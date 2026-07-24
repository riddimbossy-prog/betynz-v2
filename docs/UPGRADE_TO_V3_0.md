# Upgrade to Betynz v3.0.0

## 1. Run the database migration

Open Supabase → SQL Editor and run:

```text
supabase/migrations/007_olympian_roles.sql
```

## 2. Replace the repository files

Extract the v3.0 ZIP and copy all contents into the local Betynz repository. Replace matching files.

## 3. Commit in GitHub Desktop

Suggested summary:

```text
Add Olympian engine roles v3.0
```

Push to GitHub.

## 4. Confirm Render variables

Keep the existing Supabase and premium Odds API values. Add the engine switches shown in `.env.example` when they are not already present.

## 5. Rebuild picks

After Render deploys, run the prediction sync workflow or call:

```text
POST /api/v1/admin/rebuild-predictions
x-admin-token: <ADMIN_IMPORT_TOKEN>
```

## 6. Verify

Check `/api/v1/health`. It should report:

- `engineVersion: olympian-roles-3.0.0`
- Chronos, Athena and Ares role versions
- `zeusMaxOddsExclusive: 1.6`

Then open the board. Only gods with available picks should appear.
