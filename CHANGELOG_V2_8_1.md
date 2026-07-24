# Betynz v2.8.1 — BetExplorer Sync Rescue

## Fixed

- Removed the BetExplorer football landing page as the collector's single point of failure.
- Direct date URLs are now opened first for every day in the six-day prediction window.
- Browser navigation now uses commit-first loading, partial-DOM recovery, two attempts and a configurable timeout.
- A ten-minute browser collection budget prevents a slow source from consuming the whole workflow run.
- Cookie consent is handled when visible; CAPTCHA or access controls are never bypassed.
- Failed browser pages now preserve HTML, body text, DOM counts and screenshots in the workflow artifact.

## Automatic rescue

- When BetExplorer returns zero fixtures or zero complete 1X2 prices, the API automatically tries API-Football.
- The Odds API can fill missing Home/Draw/Away prices on safely matched API-Football fixtures.
- When every fresh provider fails, Betynz retains the existing Supabase fixture window and rebuilds predictions from that saved board.
- An unsuccessful collection never deletes or replaces valid upcoming fixtures.
- Zeus Auto Picks and Ares Streak Favorites can therefore continue from a rescued or retained priced board.

## Visibility

- `GET /api/v1/providers/status` now reports the selected source, rescue reason, provider counts and latest prediction-sync outcome.
- `POST /api/v1/admin/rescue-upcoming` runs the rescue path manually.
- The web app shows when the provider-rescue feed or saved-fixture protection is active.

## Version

`zeus-chronos-ares-2.8.1`

No new Supabase migration is required.
