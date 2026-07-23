# Betynz v2.2 changes

- Added a public-page BetExplorer fixture and 1X2 odds collector.
- Added hybrid provider merging with API-Football extended markets.
- Removed the EPL-only assumption: blank `API_FOOTBALL_LEAGUE_IDS` means all available leagues.
- Added provider/source/data-quality columns in Supabase.
- Added `/api/v1/providers/status`.
- Added provider, country, league and odds filters to `/api/v1/upcoming-fixtures`.
- Added protected `/api/v1/admin/test-betexplorer`.
- Added a GitHub Actions workflow to test the BetExplorer collector.
- Added configurable rate limit, timeout, URL template and fallback templates.
- Added graceful fallback when BetExplorer returns no data or refuses access.
- Preserved the 1.19 low-odds upgrade and the six-day Banker board.
