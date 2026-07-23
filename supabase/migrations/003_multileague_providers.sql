-- Betynz v2.2: multi-provider fixture metadata.
-- Safe to run after 002_prediction_engine.sql.

alter table public.upcoming_fixtures
  add column if not exists provider text not null default 'api-football',
  add column if not exists provider_url text,
  add column if not exists odds_source text,
  add column if not exists data_quality integer not null default 60;

alter table public.upcoming_fixtures
  drop constraint if exists upcoming_fixtures_provider_check;

alter table public.upcoming_fixtures
  add constraint upcoming_fixtures_provider_check
  check (provider in ('api-football','betexplorer','hybrid'));

alter table public.upcoming_fixtures
  drop constraint if exists upcoming_fixtures_data_quality_check;

alter table public.upcoming_fixtures
  add constraint upcoming_fixtures_data_quality_check
  check (data_quality between 0 and 100);

create index if not exists upcoming_fixtures_provider_idx
  on public.upcoming_fixtures (provider, match_date, kickoff);

create index if not exists upcoming_fixtures_country_league_idx
  on public.upcoming_fixtures (country, league_name, match_date);

notify pgrst, 'reload schema';
