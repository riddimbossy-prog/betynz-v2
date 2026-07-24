# Betynz v2.8.0 — Ares Streak Favorites

## Added

- New **Ares Streak Favorite Engine**.
- Identifies only `HOME_WIN` or `AWAY_WIN` selections where the clear favorite is priced from **1.19 up to, but not including, 1.60**.
- Requires streak agreement rather than odds alone:
  - favorite venue wins or unbeaten run;
  - opponent venue losses or no-win run;
  - a compatible directional confrontation signal;
  - HT/FT lead-to-win support;
  - mutual no-draw support when the favorite owns the decisive direction.
- Requires at least two confirmations and one core favorite-versus-opponent confrontation.
- Rejects favorite no-win/loss runs, opponent win/unbeaten contradictions, opposite directional signals, thin samples, weak historical fit, and excessive Leonidas contradiction.
- Adds `ARES_STREAK_FAVOURITE` qualification and Ares evidence fields to published predictions.
- Adds a provisional Ares fallback for leagues with fewer than 120 local matches when venue streak samples, global historical price profiles, and all four safety checks still pass; these picks can never be Bankers.
- Adds `streakFavorites` and `metrics.streakFavorites` to the predictions API.
- Adds a dedicated responsive **Ares Streak Favorites** page section and explanation badge.
- PWA cache upgraded to `betynz-shell-v2-8-0`.

## Retained

- Zeus one-tip market competition.
- Chronos historical-odds comparison.
- Athena form, streak, O/U and HT/FT validation.
- Leonidas contradiction gate.
- The 1.19 publication minimum.
- v2.7.1 Auto Picks fallback and automatic rebuild behavior.

## Engine version

`zeus-chronos-ares-2.8.0`
