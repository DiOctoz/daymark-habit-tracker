alter table public.habit_quest_weeks
  drop constraint if exists habit_quest_weeks_weekly_goal_check;

alter table public.habit_quest_weeks
  drop constraint if exists habit_quest_weeks_weekly_goal_range_check;

alter table public.habit_quest_weeks
  add constraint habit_quest_weeks_weekly_goal_range_check
  check (weekly_goal between 1 and 7);

