# Betynz Chronos Fusion v2.1

Production-ready Betynz rebuild for **today plus the next five days**.

## What this version adds

- Chronos Fusion historical-odds engine
- Four-engine approval: Chronos, Athena, Zeus and Leonidas
- One best market per fixture; weak matches return no pick
- Low-odds upgrade rule: selections below 1.19 must pass a stricter related market
- Daily Banker section with a maximum of the top three strict picks
- Simple-English statistical explanations for every prediction
- League profile, form, strength, home/away splits, table position and late-season pressure
- API-Football fixture and odds synchronization every four hours
- Automatic win/loss/void settlement when new result CSVs are imported
- Responsive desktop, mobile, tablet and 320px/Z Fold interface
- PWA manifest, install prompt, icons and a network-first service worker

## Main endpoints

- `GET /api/v1/predictions`
- `GET /api/v1/bankers?date=YYYY-MM-DD`
- `GET /api/v1/upcoming-fixtures`
- `POST /api/v1/admin/sync-upcoming`
- Existing historical endpoints remain available.

Start with `docs/UPGRADE_TO_V2_1.md`.
