# Upgrade to Betynz v2.8.2

## 1. Replace the repository files

Extract the v2.8.2 ZIP and copy its contents into the root of the Betynz GitHub repository. Replace matching files.

Commit message:

```text
Refine Ares favorites and add candidate watchlist v2.8.2
```

Push to `main` and wait for both Render services to finish deploying.

## 2. Confirm environment variables

Keep the existing v2.8.1 provider-rescue variables. Important values include:

```env
AUTO_PROVIDER_RESCUE=true
API_FOOTBALL_KEY=your_key
ODDS_API_KEY=your_key
PREDICTION_DAYS=6
PREDICTION_TIMEZONE=Africa/Accra
```

No new environment variable is required for Ares.

## 3. Confirm the API version

Open:

```text
https://betynz-v2.onrender.com/api/v1/health
```

Expected main engine version:

```text
zeus-chronos-ares-2.8.2
```

## 4. Rebuild the board

Run the GitHub workflow **Sync upcoming Betynz predictions**, or call the protected endpoint:

```text
POST /api/v1/admin/rebuild-predictions
```

Then open:

```text
/api/v1/predictions
```

The response now includes:

```json
{
  "metrics": {
    "streakFavorites": 0,
    "aresCandidates": 0,
    "aresWatchlist": 0
  },
  "streakFavorites": [],
  "aresWatchlist": []
}
```

Interpretation:

- `aresCandidates` is every complete unique 1X2 favorite priced 1.19–1.59.
- `streakFavorites` is the number that passed the refined Ares pick gate.
- `aresWatchlist` is the number found but not approved as picks.

If all three remain zero while `pricedFixtures` is above zero, inspect the fixture odds and confirm that at least one home or away price lies between 1.19 and 1.59.

## 5. Clear the old PWA cache

The service worker cache name changed. Reload the site once after deployment. On a stubborn installed PWA, close it fully and reopen it.

## Database

No new migration is required. Migration `005_zeus_streak_intelligence.sql` should remain applied.
