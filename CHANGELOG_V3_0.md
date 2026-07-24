# Changelog — Betynz v3.0.0

## Added

- Independent Chronos historical-pattern service.
- Independent Ares streak-and-value service.
- Frozen Athena HT/FT transition feed retained as a public god.
- Zeus banker aggregator with conflict rejection, fixture deduplication and strict `< 1.60` odds gate.
- Athena win-either-half safety translation to DNB or double chance when Zeus needs a priced market.
- Generic `god_picks` persistence table and migration 007.
- Public Chronos and Ares tabs.
- Dynamic god tabs that hide gods with no available picks.
- New Olympian smoke and static verification tests.

## Changed

- Public board now supports Zeus, Chronos, Athena and Ares.
- `/api/v1/bankers` now returns Zeus-approved bankers rather than legacy internal predictions.
- Engine version is now `olympian-roles-3.0.0`.
- PWA cache updated to `betynz-shell-v3-0-0`.

## Fixed

- Removed duplicate TypeScript statements left in the previous build.
- Corrected the old internal Athena label so streak intelligence is assigned to Ares.
- Preserved production exclusion of standalone smoke-test files.
