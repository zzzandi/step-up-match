create table if not exists public.live_state_snapshots (
  workout_date text primary key,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text,
  updated_by_role text,
  snapshot jsonb not null
);

alter table public.live_state_snapshots enable row level security;

drop policy if exists "Allow live state read" on public.live_state_snapshots;
drop policy if exists "Allow live state insert" on public.live_state_snapshots;
drop policy if exists "Allow live state update" on public.live_state_snapshots;
drop policy if exists "Allow live state delete" on public.live_state_snapshots;

create policy "Allow live state read"
on public.live_state_snapshots
for select
using (true);

create policy "Allow live state insert"
on public.live_state_snapshots
for insert
with check (true);

create policy "Allow live state update"
on public.live_state_snapshots
for update
using (true)
with check (true);

create policy "Allow live state delete"
on public.live_state_snapshots
for delete
using (true);

create index if not exists live_state_snapshots_updated_at_idx
on public.live_state_snapshots (updated_at desc);

create or replace function public.save_live_state_snapshot(
  p_workout_date text,
  p_updated_at timestamptz,
  p_updated_by_id text,
  p_updated_by_name text,
  p_updated_by_role text,
  p_snapshot jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.live_state_snapshots (
    workout_date,
    updated_at,
    updated_by_id,
    updated_by_name,
    updated_by_role,
    snapshot
  )
  values (
    p_workout_date,
    p_updated_at,
    p_updated_by_id,
    p_updated_by_name,
    p_updated_by_role,
    p_snapshot
  )
  on conflict (workout_date) do update
  set
    updated_at = excluded.updated_at,
    updated_by_id = excluded.updated_by_id,
    updated_by_name = excluded.updated_by_name,
    updated_by_role = excluded.updated_by_role,
    snapshot = excluded.snapshot
  where public.live_state_snapshots.updated_at <= excluded.updated_at;
$$;

grant execute on function public.save_live_state_snapshot(
  text,
  timestamptz,
  text,
  text,
  text,
  jsonb
) to anon, authenticated;
