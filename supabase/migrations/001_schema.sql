create extension if not exists pgcrypto;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  league_code text not null,
  league_name text not null,
  season text not null,
  date date not null,
  kickoff_time text,
  home_team text not null,
  away_team text not null,
  home_goals integer not null,
  away_goals integer not null,
  ht_home_goals integer,
  ht_away_goals integer,
  result text not null check (result in ('H','D','A')),
  stats jsonb not null default '{}'::jsonb,
  odds jsonb not null default '{}'::jsonb,
  source text not null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_league_season_date_idx on public.matches (league_code, season, date desc);
create index if not exists matches_home_team_idx on public.matches (home_team);
create index if not exists matches_away_team_idx on public.matches (away_team);

alter table public.matches enable row level security;

-- Public website reads through the private API. No anonymous direct-table policy is created.

create or replace view public.matches_api as
select external_id, league_code, league_name, season, date, kickoff_time,
       home_team, away_team, home_goals, away_goals, ht_home_goals,
       ht_away_goals, result, stats, odds, source, imported_at
from public.matches;
