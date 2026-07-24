# Changelog — Betynz v3.0.1 Olympian Pipeline Hotfix

## Pipeline

- Added a single-flight rebuild manager in `apps/api/src/pipeline-runtime.ts`.
- Added automatic rebuild on API startup.
- Added an internal daily scheduler using `PREDICTION_TIMEZONE`, defaulting to 03:15.
- Added global cooldown protection for public rebuild requests.
- Routed the protected admin sync through the same pipeline manager.

## Refresh

- Added `POST /api/v1/predictions/refresh`.
- Changed the public Refresh button from cached GET reload to full provider sync + prediction rebuild + dashboard reload.

## Providers

- Changed the default and Render provider mode to `api-football`.
- Disabled BetExplorer as an automatic fixture source while retaining its private/manual tooling.
- Kept the premium Odds API as fallback.
- Added coverage-aware fallback triggers for incomplete API-Football 1X2 and O/U 2.5 odds.
- Added fallback trigger reasons and coverage values to private diagnostics.

## Olympian publication

- Chronos, Athena, and Ares are rebuilt independently and published into `god_picks`.
- Zeus aggregates the published candidate stream.
- Zeus accepts bankers only and hard-rejects missing odds, odds at exactly 1.60, and odds above 1.60.
- Publication now fails clearly when the required `god_picks` migration is missing instead of silently reporting success.

## Diagnostics

- Added protected `GET /api/v1/admin/pipeline-diagnostics`.
- Added recent run status, timing, provider counts, coverage, fallback usage, warnings, and god publication counts.
- Added private/no-store response caching headers.

## UI and PWA

- Empty gods are hidden per selected date.
- Zeus UI repeats the backend odds gate.
- Updated visible version to 3.0.1.
- Bumped the PWA cache key to force installed clients to update.

## Database

- Added `supabase/migrations/008_pipeline_hotfix.sql` to allow `odds-api` fixture rows.
