# Betynz v2.7.1 Auto Picks hotfix

## Why Zeus Auto Picks was empty

The v2.7 rebuild reads `streak_snapshots` before it creates predictions. When migration `005_zeus_streak_intelligence.sql` has not been applied—or Supabase has not refreshed its schema cache—that read fails and the rebuild stops. The website then filters for the new engine version and displays zero Auto Picks.

A second visibility issue was that Zeus Auto Picks only displayed `full` selections. Qualified provisional selections could appear on the board but were hidden from Auto Picks.

## What this hotfix changes

1. Missing optional v2.7 intelligence tables no longer stop prediction generation. The engine temporarily uses computed historical streaks.
2. When the API finds fixtures but no v2.7.1 rows, it starts a background rebuild.
3. While that rebuild runs, the newest compatible prediction feed remains visible instead of showing a blank board.
4. Zeus Auto Picks includes qualified provisional selections, clearly marked **Provisional**. They remain excluded from Bankers.
5. The website opens the first date containing picks and refreshes automatically while a rebuild is running.
6. The PWA cache key is updated so installed devices receive the corrected frontend.

## Deployment

Replace the repository contents with this package, commit, and push to `main`. Wait for both Render services to finish deploying. Then open:

```text
https://betynz-v2.onrender.com/api/v1/health
```

Confirm:

```text
engineVersion: zeus-chronos-fusion-2.7.1
```

Next open:

```text
https://betynz-v2.onrender.com/api/v1/predictions
```

Check `metrics.fixtures`, `metrics.picks`, `metrics.zeusAutoPicks`, `currentEngineReady`, and `rebuilding`.

Migration 005 is still recommended because it stores external streak snapshots, confrontation records, and rejected battles. The hotfix simply prevents those optional records from taking the public picks feed offline.
