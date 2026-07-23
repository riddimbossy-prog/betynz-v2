# Betynz v2.5 changelog

## Fixture collection
- Replaced fake future-date query loops with one football landing-page pass plus controlled competition-page crawling.
- Reads real `data-dt` values and keeps fixtures inside today plus five days.
- Extracts tournament identity from `tr.js-tournament`, competition links and league-page URLs.
- Adds crawl limits, delays, no-new-fixture stopping and access-page detection.

## Prediction engine
- Full Chronos requires at least 120 same-league historical matches, eight matches per team and venue samples.
- Full engine can now evaluate Home Win and Away Win when BetExplorer provides only 1X2 prices.
- Added provisional global-odds tier for complete 1X2 feeds with limited local history.
- Provisional picks use strict nearest historical price-profile matching, are medium risk and never become Bankers.
- The 1.19 minimum remains enforced.

## Data and UI
- Adds `tier` and `qualification` to predictions.
- Adds database guard preventing provisional Bankers.
- Dashboard shows fixture leagues, full picks and provisional picks separately.
- New provisional section and explanation badge in the frontend.
- Predictions are rebuilt once after the complete crawl.
