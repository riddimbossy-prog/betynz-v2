# Betynz v2.7 — Zeus Streak Intelligence

## Engine

- Engine version bumped to `zeus-chronos-fusion-2.7.0`.
- Added current streak calculations for wins, draws, losses, no-win, no-draw, unbeaten, Over 2.5 and Under 2.5.
- Added home, away and overall HT/FT profiles.
- Added opponent-adjusted streak weights based on recent opponent PPG.
- Added confrontation scoring between the home and away profiles.
- Zeus now ranks competing markets and returns one winning market per fixture.
- Chronos historical-odds neighbours, Athena validation and Leonidas rejection now include streak evidence.
- Banker qualification requires 4/4 engine approval, full data status, strong confrontation compatibility, limited contradiction and adequate home/away samples.
- Preserved the existing 1.19 minimum-odds upgrade rule.

## Data collection

- Browser collector discovers relevant streak, form-table and HT/FT tabs on league pages.
- Rendered intelligence pages are sent to private API ingestion endpoints.
- Parsed BetExplorer snapshots are loaded into prediction rebuilds and merged with computed historical snapshots.
- No access-control bypass was introduced.

## API and database

- Added private `streak_snapshots`, `confrontation_records` and `rejected_battles` tables.
- Added admin-only rejected-battles endpoint.
- Added parser and ingestion endpoints for rendered streak/HTFT HTML.
- Prediction dashboard now returns `zeusAutoPicks` and its count.

## Website

- Added Zeus Auto Picks battle board.
- Added confrontation, streak and HT/FT evidence to the explanation drawer.
- Added responsive desktop, tablet, mobile and narrow-screen styling.
