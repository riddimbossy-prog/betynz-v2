# Betynz v2.8.2 — Refined Ares Favorites

## Fixed

- Ares no longer disappears because Zeus selected another market for the same fixture.
- Removed the unrelated 120-match historical-odds-neighbor requirement from the independent Ares feed.
- Reduced over-strict streak and data thresholds while retaining contradiction protection.
- Exact odds of 1.60 remain rejected.

## Added

- Independent Ares prediction rows using engine version `ares-streak-favourites-2.8.2`.
- Ares `ELITE`, `STRONG` and `WATCHLIST` grades.
- A visible watchlist for every complete sub-1.60 favorite that did not become a pick.
- Exact rejection explanations for missing sample, weak streak agreement, low data quality or opposite streak contradiction.
- Dashboard metrics for Ares candidates, picks and watchlist entries.
- Separate settlement handling so watchlist entries are not counted as settled predictions.
- New PWA cache `betynz-shell-v2-8-2-ares-refined`.

## Engine versions

- Main engine: `zeus-chronos-ares-2.8.2`
- Independent Ares engine: `ares-streak-favourites-2.8.2`

## Database

No new migration is required. The existing predictions unique key `(fixture_id, engine_version)` allows Zeus and Ares to store separate records for the same fixture.
