# Betynz v3.0.3 Changelog

## Fixed

- Fixed Chronos returning zero picks when API-Football history contained results but no historical odds.
- Added a conservative Chronos results-and-form qualification path.
- Added automatic previous-season historical hydration when the current season is under-covered.
- Removed the current-season-only filter when measuring stored league/team history.
- Added historical coverage totals to private pipeline diagnostics.
- Added current-season and previous-season fetched counts per league.
- Fixed the board retaining an empty selected day when another day has picks.
- Improved the empty state to report fixture and pricing coverage.

## Unchanged safeguards

- Zeus requires banker-grade source picks.
- Zeus requires decimal odds greater than 1.00 and strictly below 1.60.
- Athena's frozen HT/FT transition rules remain unchanged.
- Ares' streak and matchup qualification rules remain unchanged.
- Empty gods stay hidden.
- Rebuilds remain single-flight.
