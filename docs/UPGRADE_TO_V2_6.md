# Upgrade Betynz to v2.6

No Supabase migration is required.

## 1. Replace repository files

Extract the v2.6 patch and copy everything inside it into the root of your local `betynz-v2` repository. Replace matching files.

Commit in GitHub Desktop:

```text
Expand BetExplorer coverage and add Match Radar
```

Push to `main` and wait for the Render API and static site to redeploy.

## 2. Workflow coverage settings

The workflow already contains the recommended values:

```text
BETEXPLORER_LEAGUE_PAGE_LIMIT=120
BETEXPLORER_MIN_LEAGUE_PAGES=60
BETEXPLORER_BROWSER_RATE_MS=2200
BETEXPLORER_BROWSER_JITTER_MS=700
BETEXPLORER_NO_NEW_STOP=30
```

These are GitHub Actions runtime settings. You do not have to add them to Render for the browser workflow to use them.

## 3. Run a fresh sync

Use:

```text
GitHub → Actions → Sync upcoming Betynz predictions → Run workflow
```

Do not re-run an old workflow execution because it may use the older file version.

## 4. Verify API coverage

Open:

```text
https://betynz-v2.onrender.com/api/v1/predictions
```

Check:

```text
metrics.pricedFixtures
radarFixtures.length
metrics.leagues
metrics.picks
metrics.bankers
```

`radarFixtures` contains all complete 1X2 fixtures captured in the six-day window. `predictions` contains only selections that passed the engine.

## 5. Verify the website

Refresh `https://betynz.com` with `Ctrl + F5`.

You should see:

- prediction and fixture counts on each date tab;
- a Match Radar section;
- Home, Draw and Away odds for every captured fixture;
- a Monitoring badge when no pick passed;
- a Qualified Pick badge when that fixture also has an engine selection.

## Important

Your historical database still contains mainly 760 EPL matches. Wider crawling increases visible fixtures immediately, but increasing **full Chronos picks** requires historical results and odds for more leagues. The engine will not pretend EPL history is local evidence for another competition.
