# Betynz v3.0.4 — Provider Linkage & History Priority Hotfix

## Why v3.0.3 could still show zero picks

The provider status correctly showed API-Football running, but its `matchedAcrossProviders` field only counted the legacy BetExplorer merge. It did not report Odds API-to-API-Football matches. At the same time, unmatched Odds API fixtures could remain as disconnected rows and the historical bootstrap prioritised leagues by raw fixture volume instead of fixtures that actually had usable odds.

## Changes

- Added robust API-Football ↔ Odds API fixture matching using:
  - built-in and custom team aliases;
  - accent/punctuation normalisation;
  - token and Dice similarity;
  - one-day date tolerance and an 18-hour kickoff guard;
  - women/youth/reserve variant protection;
  - global best-match assignment to prevent duplicate links.
- Odds API now fills missing prices on the canonical API-Football fixture.
- Unmatched Odds API fixtures are not appended by default when API-Football returned fixtures.
- The active six-day fixture window is replaced atomically at rebuild time so stale provider duplicates do not remain in Supabase.
- Historical bootstrap now prioritises leagues with priced fixtures and sub-1.60 candidate odds.
- Default history coverage increased from 18 to 36 leagues per rebuild.
- Provider diagnostics now expose:
  - `oddsApi.matchedToPrimary`;
  - `oddsApi.unmatched`;
  - `oddsApi.addedUnmatched`;
  - `oddsApi.includeUnmatched`.
- Added public, secret-free `GET /api/v1/pipeline/status` with last rebuild counts, history coverage, god output counts, and top rejection reasons.
- Zeus remains banker-only and requires odds strictly below 1.60.
- Empty gods remain hidden.

## Database

No new Supabase migration is required.
