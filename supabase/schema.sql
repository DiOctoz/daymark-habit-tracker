-- Daymark Habit Quest schema. Run once in the Supabase SQL Editor for a new project.
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  emoji text not null default '🌱',
  weekly_goal integer not null default 3 check (weekly_goal between 1 and 7),
  frequency_days integer[] not null default array[0,1,2,3,4,5,6],
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  completed_on date not null default current_date,
  points integer not null default 10 check (points > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.habit_quest_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  week_start date not null,
  weekly_goal integer not null check (weekly_goal between 1 and 7),
  created_at timestamptz not null default now(),
  constraint habit_quest_weeks_habit_week_unique unique (habit_id, week_start)
);

alter table public.habits enable row level security;
alter table public.completions enable row level security;
alter table public.habit_quest_weeks enable row level security;

revoke all on table public.habits from anon, authenticated;
revoke all on table public.completions from anon, authenticated;
revoke all on table public.habit_quest_weeks from anon, authenticated;
grant select, insert, update, delete on table public.habits to authenticated;
grant select, insert, delete on table public.completions to authenticated;
grant select, insert, update on table public.habit_quest_weeks to authenticated;

create policy "Users manage their own habits"
  on public.habits for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read their own check-ins"
  on public.completions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users add check-ins for their own habits"
  on public.completions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits
      where habits.id = completions.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

create policy "Users remove their own check-ins"
  on public.completions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read their own quest weeks"
  on public.habit_quest_weeks for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits
      where habits.id = habit_quest_weeks.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

create policy "Users add their own quest weeks"
  on public.habit_quest_weeks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits
      where habits.id = habit_quest_weeks.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

create policy "Users update their own quest weeks"
  on public.habit_quest_weeks for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits
      where habits.id = habit_quest_weeks.habit_id
        and habits.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits
      where habits.id = habit_quest_weeks.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

create index if not exists habits_user_created_idx on public.habits (user_id, created_at);
create index if not exists completions_user_date_idx on public.completions (user_id, completed_on desc);
create index if not exists completions_habit_date_idx on public.completions (habit_id, completed_on desc);
create index if not exists habit_quest_weeks_user_start_idx on public.habit_quest_weeks (user_id, week_start desc);

