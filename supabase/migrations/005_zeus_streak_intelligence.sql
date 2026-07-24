-- Betynz v2.7: Zeus streak intelligence, confrontation records and private rejection audit.

create table if not exists public.streak_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  source text not null check (source in ('computed-history', 'betexplorer')),
  provider_url text,
  league_code text not null,
  league_name text not null,
  country text,
  season text not null,
  team text not null,
  team_key text not null,
  scope text not null check (scope in ('overall', 'home', 'away')),
  matches_sample integer not null default 0,
  streaks jsonb not null default '{}'::jsonb,
  opponent_adjusted jsonb not null default '{}'::jsonb,
  htft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_date, league_code, season, team_key, scope, source)
);

create index if not exists streak_snapshots_lookup_idx
  on public.streak_snapshots (snapshot_date, league_code, team_key, scope);

create table if not exists public.confrontation_records (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null references public.upcoming_fixtures(external_id) on delete cascade,
  engine_version text not null,
  generated_at timestamptz not null,
  match_date date not null,
  league_code text not null,
  league_name text not null,
  country text,
  home_team text not null,
  away_team text not null,
  strongest_signal text,
  score numeric(6,2) not null default 0,
  compatible boolean not null default false,
  signals jsonb not null default '[]'::jsonb,
  home_snapshot jsonb not null default '{}'::jsonb,
  away_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, engine_version)
);

create index if not exists confrontation_records_date_idx
  on public.confrontation_records (match_date, score desc);

create table if not exists public.rejected_battles (
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
  rejection_stage text not null check (rejection_stage in ('data', 'history', 'zeus-competition', 'low-odds-upgrade', 'leonidas')),
  top_market text,
  top_odds numeric(8,3),
  reasons jsonb not null default '[]'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (fixture_id, engine_version)
);

create index if not exists rejected_battles_private_idx
  on public.rejected_battles (match_date, rejection_stage, run_at desc);

alter table public.streak_snapshots enable row level security;
alter table public.confrontation_records enable row level security;
alter table public.rejected_battles enable row level security;

-- No public policies are created. Only the Render API service-role key can access these records.
notify pgrst, 'reload schema';
