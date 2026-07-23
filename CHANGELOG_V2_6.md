# Betynz v2.6 — Coverage Expansion

## Why this release exists

v2.5 correctly refused weak predictions, but it scanned too small a share of the BetExplorer league catalogue. The live board therefore showed only 20 priced fixtures across nine leagues.

## Changes

- Discovers league links from the complete football page, not only tournament headers in the first visible table.
- Raises the production scan ceiling from 30 to 120 league pages.
- Scans at least 60 league pages before the no-new-fixture stop can end a run.
- Uses slower requests plus random jitter to reduce burst traffic.
- Stops on access controls or HTTP 429 and keeps already imported fixtures; it does not bypass blocking.
- Avoids opening a second fixture tab when the main league page already produced fixtures.
- Adds `radarFixtures` and `pricedFixtures` to the prediction dashboard API.
- Adds a Match Radar section showing every captured fixture with complete Home/Draw/Away odds.
- Date tabs now show both prediction and fixture counts.
- Keeps qualified picks, provisional picks and Bankers separate from the raw fixture feed.
- Bumps the engine version to `chronos-fusion-2.6.0`.

## Safety rule

More fixtures do not automatically mean more predictions. Match Radar is a data feed, not a recommendation list. Chronos and Leonidas still reject fixtures that lack enough statistical confirmation.
