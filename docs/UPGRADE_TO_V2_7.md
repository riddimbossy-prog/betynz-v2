# Upgrade Betynz to v2.7

## 1. Run the new Supabase migration

Open Supabase → SQL Editor → New query. Paste and run:

```text
supabase/migrations/005_zeus_streak_intelligence.sql
```

This creates:

- `streak_snapshots`
- `confrontation_records`
- `rejected_battles`

All three tables have Row Level Security enabled and no public policies. The Render API accesses them with the service-role key. Run this migration **before** deploying the v2.7 API so the next scheduled sync cannot reach missing tables.

## 2. Replace the repository

Extract the v2.7 ZIP and copy the contents of `betynz-v2.7-zeus` into the root of the existing Betynz repository. Replace matching files.

In GitHub Desktop, use this commit message:

```text
Add Zeus streak intelligence v2.7
```

Push to `main` and wait for Render to redeploy the API and website.

## 3. Confirm the collector setting

The recommended workflow value is:

```text
BETEXPLORER_INTELLIGENCE_TAB_LIMIT=2
```

The collector will inspect up to two relevant streak/form/HTFT tabs per league page. Keep the existing crawl delay and jitter settings.

## 4. Run a fresh workflow

Use:

```text
GitHub → Actions → Sync upcoming Betynz predictions → Run workflow
```

Start a new run rather than re-running an old execution, because an old execution can use the previous workflow files.

The run order is:

1. collect rendered fixture pages;
2. discover and collect streak/HTFT pages;
3. save external streak snapshots;
4. rebuild the six-day prediction window;
5. save confrontation records and rejected battles.

## 5. Verify the API

Open:

```text
https://betynz-v2.onrender.com/api/v1/health
```

Confirm:

```text
engineVersion: zeus-chronos-fusion-2.7.0
```

Then open:

```text
https://betynz-v2.onrender.com/api/v1/predictions
```

Check:

```text
metrics.zeusAutoPicks
zeusAutoPicks.length
metrics.bankers
```

For the private rejected log, send the same Render admin token in the `x-admin-token` header:

```text
GET /api/v1/admin/rejected-battles?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Do not expose that token in the browser or frontend environment variables.

## 6. Verify the website

Open `https://betynz.com` and press `Ctrl + F5`.

You should see:

- Zeus Auto Picks below the date and metric area;
- one selection per fixture;
- confrontation text on each auto-pick row;
- streak and HT/FT fields inside “Why this pick?”;
- Bankers only when the full 4/4 validation passes.

## Important limits

The parser uses rendered BetExplorer page labels and data attributes. BetExplorer can change its DOM, so the workflow test should be run after deployment. The collector stops on access controls and does not bypass them. An external streak snapshot is only used when the team and competition can be matched; otherwise the engine falls back to streaks computed from Betynz historical results.
