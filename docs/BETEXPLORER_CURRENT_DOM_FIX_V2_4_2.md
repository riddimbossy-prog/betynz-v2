# Betynz v2.4.2 — Current BetExplorer DOM parser fix

The uploaded browser artifact confirmed that BetExplorer is returning live fixtures and visible 1X2 odds, but the old parser was looking for obsolete selectors.

## Confirmed current structure

- Competition header: `tr.js-tournament`
- Match row: `table.table-main tr[data-dt]`
- Teams: first football link inside `td.h-text-left`
- Kickoff: `.table-main__time`
- 1X2 odds: three ordered `td.table-main__odds` cells
- Match URL: direct `/football/.../MATCH_ID/` link
- Date attribute: `day,month,year,hour,minute`

The parser now reads this exact structure, ignores yesterday's result table, permits equal odds values, keeps only the requested date, and requires complete Home/Draw/Away prices.

## Install

1. Extract `betynz-v2.4.2-current-dom-patch.zip`.
2. Copy everything inside the extracted folder into the root of the local `betynz-v2` repository.
3. Replace matching files.
4. Commit in GitHub Desktop:

   `Fix BetExplorer current fixture DOM parser`

5. Push origin.
6. Wait for the Render API deployment to return to Live.

## Test

Run a fresh workflow, not an old rerun:

`Actions → Test BetExplorer browser feed → Run workflow`

A successful report must show:

- `fixtures > 0`
- `fixturesWith1X2 > 0`

The supplied captured page contains 10 correctly priced fixtures, so the first successful test on the football landing fallback should normally parse 10. The `/football/next/` candidate can return more.

## Production sync

After the test passes, run:

`Actions → Sync upcoming Betynz predictions → Run workflow`

Then check:

- `/api/v1/upcoming-fixtures?oddsOnly=true`
- `/api/v1/predictions`

## Files changed

- `apps/api/src/betexplorer.ts`
- `apps/api/src/betexplorer-smoke.ts`
- `apps/api/src/server.ts`
- `scripts/betexplorer-browser-sync.mjs`
- `.github/workflows/test-betexplorer.yml`
