# Betynz v2.4.1 — BetExplorer DOM diagnostic capture

This patch does not guess another parser. It captures the exact rendered public BetExplorer page so the selectors can be corrected from evidence.

## Why this patch exists

The previous report proved that:

- BetExplorer returned full HTML pages with HTTP 200.
- The current `year/month/day` URLs did not produce parsable fixture rows.
- `/next/soccer/` redirected to the home page.
- Repeated requests eventually returned HTTP 429.
- The existing artifact contained totals only, not the actual DOM needed to repair the parser.

## Install

Copy this patch over the current `betynz-v2` repository, then commit and push:

`Capture BetExplorer rendered DOM diagnostics`

## Run

GitHub → Actions → **Test BetExplorer browser feed** → Run workflow.

The test intentionally checks only one date and at most two pages to avoid triggering another 429.

## Download the artifact

Download `betexplorer-browser-test-report`. It now contains:

- `betexplorer-browser-report.json`
- rendered `.html`
- full-page `.png`
- visible body text `.txt`
- DOM structure `.json`

Upload the artifact ZIP for the final parser correction.
