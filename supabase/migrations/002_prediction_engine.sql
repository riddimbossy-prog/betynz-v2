create table if not exists public.upcoming_fixtures (
  external_id text primary key,
  provider_fixture_id bigint not null unique,
  league_id integer,
  league_code text not null,
  league_name text not null,
  country text,
  season text not null,
  kickoff timestamptz not null,
  match_date date not null,
  status text not null default 'NS',
  venue text,
  home_team_id bigint,
  away_team_id bigint,
  home_team text not null,
  away_team text not null,
  odds jsonb not null default '{}'::jsonb,
  raw_odds jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists upcoming_fixtures_date_idx
  on public.upcoming_fixtures (match_date, kickoff);
create index if not exists upcoming_fixtures_league_idx
  on public.upcoming_fixtures (league_name, season);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references public.upcoming_fixtures(external_id) on delete cascade,
  engine_version text not null,
  run_at timestamptz not null,
  match_date date not null,
  kickoff timestamptz not null,
  league_code text not null,
  league_name text not null,
  country text,
  home_team text not null,
  away_team text not null,
  market_key text not null,
  market_label text not null,
  selection text not null,
  odds numeric(8,3) not null,
  original_market_key text,
  original_market_label text,
  original_odds numeric(8,3),
  upgraded boolean not null default false,
  probability numeric(6,2) not null,
  confidence numeric(6,2) not null,
  edge numeric(6,2) not null,
  sample integer not null default 0,
  banker boolean not null default false,
  risk text not null check (risk in ('Low','Medium')),
  explanation jsonb not null default '[]'::jsonb,
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  engines jsonb not null default '[]'::jsonb,
  settled_status text not null default 'pending' check (settled_status in ('pending','won','lost','void')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, engine_version)
);

create index if not exists predictions_date_idx
  on public.predictions (match_date, kickoff);
create index if not exists predictions_banker_idx
  on public.predictions (match_date, banker, confidence desc);

alter table public.upcoming_fixtures enable row level security;
alter table public.predictions enable row level security;

-- The browser never reads these tables directly. The Render API uses the service-role key.
notify pgrst, 'reload schema';
