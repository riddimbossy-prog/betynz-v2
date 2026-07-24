-- Betynz v2.8: Athena Transition Engine v1.0-RC1 frozen shadow integration.

alter table if exists public.streak_snapshots
  add column if not exists goal_profile jsonb not null default '{}'::jsonb;

create table if not exists public.athena_shadow_runs (
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
  classification text not null,
  side text check (side in ('HOME','AWAY') or side is null),
  story text not null,
  market_key text not null,
  market_label text not null,
  score numeric(6,2) not null default 0,
  banker boolean not null default false,
  reasons jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  secondary jsonb not null default '[]'::jsonb,
  top_markets jsonb not null default '[]'::jsonb,
  routes jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  odds_conflict jsonb not null default '{}'::jsonb,
  input_source jsonb not null default '{}'::jsonb,
  settled_status text not null default 'pending' check (settled_status in ('pending','won','lost','void')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, engine_version)
);

create index if not exists athena_shadow_runs_date_idx
  on public.athena_shadow_runs (match_date, kickoff);

create index if not exists athena_shadow_runs_result_idx
  on public.athena_shadow_runs (settled_status, classification, banker, score desc);

alter table public.athena_shadow_runs enable row level security;

-- No public policies: Athena shadow records are available only through the Render API service role.
notify pgrst, 'reload schema';
