create table if not exists public.god_picks (
  fixture_id text not null,
  engine_version text not null,
  god text not null check (god in ('chronos', 'athena', 'ares', 'zeus')),
  match_date date not null,
  kickoff timestamptz not null,
  league_code text not null,
  league_name text not null,
  country text,
  home_team text not null,
  away_team text not null,
  selection text not null,
  market_key text not null,
  score numeric not null default 0,
  banker boolean not null default false,
  odds numeric,
  stats_line text not null default '',
  source_gods jsonb not null default '[]'::jsonb,
  settled_status text not null default 'pending',
  updated_at timestamptz not null default now(),
  primary key (fixture_id, engine_version, god)
);

create index if not exists god_picks_date_idx on public.god_picks(match_date, kickoff);
create index if not exists god_picks_god_idx on public.god_picks(god, match_date);
create index if not exists god_picks_banker_idx on public.god_picks(banker, match_date);

alter table public.god_picks enable row level security;

drop policy if exists "Public can read god picks" on public.god_picks;
create policy "Public can read god picks"
on public.god_picks for select
to anon, authenticated
using (true);
