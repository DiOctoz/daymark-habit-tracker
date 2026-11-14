create index if not exists completions_habit_date_idx
  on public.completions (habit_id, completed_on desc);

