create table if not exists public.backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  schema_version int not null,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

grant select, insert, update on table public.backups to authenticated;

create policy "Users can read their own backup"
  on public.backups
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own backup"
  on public.backups
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own backup"
  on public.backups
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.daily_nutrition (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  logged_calories numeric not null check (logged_calories >= 0),
  target_calories numeric not null check (target_calories >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

alter table public.daily_nutrition enable row level security;

grant select, insert, update on table public.daily_nutrition to authenticated;

create policy "Users can read their own daily nutrition"
  on public.daily_nutrition
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own daily nutrition"
  on public.daily_nutrition
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own daily nutrition"
  on public.daily_nutrition
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
