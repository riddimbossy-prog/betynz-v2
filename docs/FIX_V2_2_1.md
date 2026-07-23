# Betynz v2.2.1 provider fix

This patch addresses the exact results seen in GitHub Actions:

- BetExplorer test returned HTTP 200 but `parsedFixtures: 0`.
- The six-day sync returned HTTP 400.

## What changed

1. **All-league API-Football discovery now requests each date separately** using:

   `GET /fixtures?date=YYYY-MM-DD&timezone=Africa/Accra`

   This avoids the unreliable all-league `from`/`to` request without a league ID.

2. **BetExplorer diagnostics are expanded**. Each tested page now reports:

   - `requestedUrl`
   - `finalUrl`
   - whether a redirect occurred
   - HTML title and byte count
   - candidate fixture-row count
   - whether an interstitial/challenge page was detected

3. **Failed provider reports are retained** at `/api/v1/providers/status`.

4. **The sync GitHub Action prints the API error body** instead of only `curl: (22)`.

## Install

Copy all files into the local `betynz-v2` repository, replace existing files, commit, and push. Render should redeploy automatically.

Render API environment:

```text
FIXTURE_PROVIDER=hybrid
API_FOOTBALL_TIMEZONE=Africa/Accra
API_FOOTBALL_LEAGUE_IDS=
API_FOOTBALL_SEASON=
BETEXPLORER_ENABLED=true
BETEXPLORER_FIXTURE_URL_TEMPLATE=https://www.betexplorer.com/next/soccer/?year={YYYY}&month={MM}&day={DD}
```

Keep `API_FOOTBALL_LEAGUE_IDS` and `API_FOOTBALL_SEASON` blank for global mode.

After deployment:

1. Run **Test BetExplorer fixture feed**.
2. Inspect `requestedUrl`, `finalUrl`, `title`, `rowCandidates`, and `interstitial`.
3. Run **Sync upcoming Betynz predictions**.
4. Open `/api/v1/providers/status`.

The sync should now continue with all-league API-Football fixtures even when BetExplorer yields no parsable rows. BetExplorer remains an opportunistic public-HTML odds source, not an official or guaranteed API.
