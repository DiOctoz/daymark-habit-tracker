-- Upgrade existing Daymark projects to weekly Habit Quest check-ins.
alter table public.habits
  add column weekly_goal integer not null default 3 check (weekly_goal between 1 and 7);

alter table public.completions
  drop constraint if exists one_checkin_per_habit_per_day;

create index if not exists completions_habit_date_idx
  on public.completions (habit_id, completed_on desc);

create table public.habit_quest_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  week_start date not null,
  weekly_goal integer not null check (weekly_goal between 1 and 7),
  created_at timestamptz not null default now(),
  constraint habit_quest_weeks_habit_week_unique unique (habit_id, week_start)
);

alter table public.habit_quest_weeks enable row level security;
revoke all on table public.habit_quest_weeks from anon, authenticated;
grant select, insert, update on table public.habit_quest_weeks to authenticated;

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

create index habit_quest_weeks_user_start_idx
  on public.habit_quest_weeks (user_id, week_start desc);

insert into public.habit_quest_weeks (user_id, habit_id, week_start, weekly_goal)
select distinct
  c.user_id,
  c.habit_id,
  date_trunc('week', c.completed_on::timestamp)::date,
  h.weekly_goal
from public.completions c
join public.habits h on h.id = c.habit_id
on conflict (habit_id, week_start) do nothing;

