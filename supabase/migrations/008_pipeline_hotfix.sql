-- Betynz v3.0.1 Olympian Pipeline Hotfix.
-- Allows unmatched premium Odds API fallback fixtures to be stored safely.

alter table public.upcoming_fixtures
  drop constraint if exists upcoming_fixtures_provider_check;

alter table public.upcoming_fixtures
  add constraint upcoming_fixtures_provider_check
  check (provider in ('api-football', 'betexplorer', 'odds-api', 'hybrid'));

notify pgrst, 'reload schema';
