# Upgrade the live Betynz site to Chronos Fusion v2.1

This package is a full replacement for the current `betynz-v2` repository files. It keeps the existing Render API, Render Static Site and Supabase project.

## 1. Add the new Supabase tables first

Before pushing the new code, open Supabase SQL Editor and run:

```text
supabase/migrations/002_prediction_engine.sql
```

This adds `upcoming_fixtures` and `predictions`. It does not delete the existing 760 historical matches. Running the migration first prevents the live API from requesting tables that do not exist during deployment.

## 2. Replace the GitHub repository files

1. Extract this ZIP.
2. In GitHub Desktop, select `betynz-v2`.
3. Choose **Repository → Show in Explorer**.
4. Copy everything from the extracted folder into the repository folder and replace matching files.
5. Do not copy a `.env` file or any secret key.
6. Commit with: `Build Chronos Fusion six-day prediction board`
7. Push origin.

## 3. Add Render environment variables

Open **Render → betynz-v2 → Environment** and add:

```env
API_FOOTBALL_KEY=your-api-football-key
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
PREDICTION_DAYS=6
PREDICTION_TIMEZONE=Africa/Accra
```

Optional restriction for the first test:

```env
API_FOOTBALL_LEAGUE_IDS=39
API_FOOTBALL_SEASON=2026
```

`39` is the API-Football identifier commonly used for the English Premier League. Remove the league restriction later to broaden coverage, or enter a comma-separated list of league IDs.

Keep these existing variables unchanged:

```env
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_TOKEN
CORS_ORIGINS
NODE_VERSION
```

Save and deploy the latest commit.

## 4. Run the engine once

On GitHub.com:

1. Open **Actions**.
2. Open **Sync upcoming Betynz predictions**.
3. Click **Run workflow**.
4. Wait for a green check.

The same workflow then runs every four hours.

## 5. Verify the API

Open:

```text
https://betynz-v2.onrender.com/api/v1/predictions
```

Expected structure:

```json
{
  "window": { "days": ["today", "...next five dates"] },
  "metrics": { "fixtures": 0, "picks": 0, "bankers": 0 },
  "bankers": [],
  "predictions": []
}
```

The exact counts depend on available fixtures, odds coverage and how many matches pass the filters. An empty day is valid; the engine does not force picks.

## 6. Verify the frontend

The Render Static Site should rebuild automatically. Open:

```text
https://betynz.com
```

Check:

- six date tabs are visible;
- Today’s Bankers appears above the full board;
- each card shows one selection, current odds and four engine checks;
- **Why this pick?** opens simple statistical reasons;
- a market below 1.19 is never published unless upgraded to a valid market at 1.19 or higher;
- mobile bottom navigation remains visible.

## 7. Important data behavior

- Historical results come from Football-Data CSV imports.
- Upcoming fixtures and current bookmaker odds come from API-Football.
- Table position, recent form, venue strength and league profile are rebuilt from settled matches known before kickoff.
- Title or relegation pressure is only a small late-season adjustment; it cannot create a pick by itself.
- Confidence is a model score, not a guarantee.
