create table if not exists public.user_feedback (
  id uuid primary key,
  author_id text not null,
  author_name text not null,
  author_role text not null check (author_role in ('ADMIN', 'PLAYER', 'MASTER')),
  is_guest boolean not null default false,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revisions jsonb not null default '[]'::jsonb
);

create index if not exists user_feedback_author_created_idx
  on public.user_feedback (author_id, created_at desc);

create index if not exists user_feedback_created_idx
  on public.user_feedback (created_at desc);

alter table public.user_feedback enable row level security;

drop policy if exists "user_feedback_select_all" on public.user_feedback;
create policy "user_feedback_select_all"
  on public.user_feedback
  for select
  using (true);

drop policy if exists "user_feedback_insert_all" on public.user_feedback;
create policy "user_feedback_insert_all"
  on public.user_feedback
  for insert
  with check (true);

drop policy if exists "user_feedback_update_all" on public.user_feedback;
create policy "user_feedback_update_all"
  on public.user_feedback
  for update
  using (true)
  with check (true);
