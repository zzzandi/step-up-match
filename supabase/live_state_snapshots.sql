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

