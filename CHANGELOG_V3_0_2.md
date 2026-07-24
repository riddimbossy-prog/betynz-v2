# Changelog — Betynz v3.0.2 Historical Bootstrap Hotfix

## Fixed

- Added automatic API-Football historical results hydration before Olympian engine execution.
- Imported full-time scores and half-time scores into Supabase `matches` for leagues with insufficient local history.
- Made the history bootstrap idempotent and quota-aware: sufficiently covered leagues are skipped on later runs.
- Added bounded league count, concurrency, lookback, and minimum-sample controls.
- Added historical bootstrap metrics and warnings to private pipeline diagnostics.
- Made public Refresh return an actual failure response when the rebuild fails instead of silently showing an empty board.
- Failed public rebuilds now clear the Refresh cooldown so operators can retry immediately after fixing configuration.
- Reworded the no-pick board heading so an empty date no longer says “Pick a god.”
- Bumped the engine, UI, packages, and PWA cache to v3.0.2.
- Corrected the Render blueprint service name to `betynz-api`.

## Preserved

- API-Football remains the primary fixture and odds provider.
- Premium Odds API remains the coverage-aware fallback.
- Chronos, Athena, and Ares continue publishing into `god_picks`.
- Zeus still accepts banker-grade inputs only and requires `1.00 < odds < 1.60`.
- No engine threshold was weakened and no pick is forced.
- Gods with no picks remain hidden for the selected date.

## Notes

The new historical bootstrap directly supports Athena and Ares. Chronos still requires genuine historical odds-pattern evidence; v3.0.2 does not invent or proxy old bookmaker prices.
