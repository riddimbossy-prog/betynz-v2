-- Betynz v2.5: separate fully qualified Chronos picks from provisional global-odds picks.
-- Safe to run after 002_prediction_engine.sql and 003_multileague_providers.sql.

alter table public.predictions
  add column if not exists tier text not null default 'full',
  add column if not exists qualification text not null default 'FULL_CHRONOS';

alter table public.predictions
  drop constraint if exists predictions_tier_check;

alter table public.predictions
  add constraint predictions_tier_check
  check (tier in ('full', 'provisional'));

create index if not exists predictions_tier_date_idx
  on public.predictions (tier, match_date, confidence desc);

-- Provisional selections can never be Bankers.
create or replace function public.prevent_provisional_banker()
returns trigger
language plpgsql
as $$
begin
  if new.tier = 'provisional' then
    new.banker := false;
  end if;
  return new;
end;
$$;

drop trigger if exists predictions_provisional_banker_guard on public.predictions;
create trigger predictions_provisional_banker_guard
before insert or update on public.predictions
for each row execute function public.prevent_provisional_banker();

notify pgrst, 'reload schema';
