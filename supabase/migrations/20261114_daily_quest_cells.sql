alter table public.habits
  drop constraint if exists habits_weekly_goal_check;

alter table public.habits
  add constraint habits_weekly_goal_range_check
  check (weekly_goal between 1 and 7);

alter table public.habit_quest_weeks
  drop constraint if exists habit_quest_weeks_weekly_goal_check;

alter table public.habit_quest_weeks
  add constraint habit_quest_weeks_weekly_goal_range_check
  check (weekly_goal between 1 and 7);

