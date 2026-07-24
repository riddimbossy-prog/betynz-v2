# Betynz v2.9.0

## Added

- Public Athena picks returned in `/api/v1/predictions` as `athenaPicks`.
- Clean Zeus/Athena tabbed God Picks board.
- Dynamic hiding of gods with no available picks.
- Premium Odds API fallback for insufficient BetExplorer fixture coverage.
- Controlled historical Odds API enrichment endpoint.
- Public-safe raw statistical lines for Athena and Zeus cards.

## Removed from the public board

- Why-this-pick buttons and explanation drawer.
- Engine pass/fail details and method descriptions.
- The public 1.19 minimum notice.
- Empty Bankers, Provisional, Radar and Olympian method sections.
- Long summaries that expose decision logic.

## Engine status

Athena rules remain frozen as RC1. Its qualified selections are now public under mode `FROZEN_PUBLIC_RC1`.
