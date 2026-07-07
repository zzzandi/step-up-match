create table if not exists public.workout_report_snapshots (
  id uuid primary key,
  workout_date date not null,
  created_at timestamptz not null,
  snapshot jsonb not null
);

create index if not exists workout_report_snapshots_workout_date_idx
  on public.workout_report_snapshots (workout_date desc, created_at desc);

alter table public.workout_report_snapshots enable row level security;

drop policy if exists "workout_report_snapshots_select_all" on public.workout_report_snapshots;
create policy "workout_report_snapshots_select_all"
  on public.workout_report_snapshots
  for select
  using (true);

drop policy if exists "workout_report_snapshots_insert_all" on public.workout_report_snapshots;
create policy "workout_report_snapshots_insert_all"
  on public.workout_report_snapshots
  for insert
  with check (true);

drop policy if exists "workout_report_snapshots_update_all" on public.workout_report_snapshots;
create policy "workout_report_snapshots_update_all"
  on public.workout_report_snapshots
  for update
  using (true)
  with check (true);
