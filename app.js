(() => {
  const config = window.HABIT_TRACKER_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
  const db = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const $ = (selector) => document.querySelector(selector);
  let today = localDate();
  const state = { user: null, habits: [], completions: [], questWeeks: [], selectedWeekStart: "", activeFilter: "all", viewMode: "list", demo: !configured, busy: false, authMode: "signin" };
  let toastTimeout;

  function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function shiftDate(offset) {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return localDate(date);
  }

  function weekStart(day = today) {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return localDate(date);
  }

  function weekEnd(start) {
    const date = new Date(`${start}T12:00:00`);
    date.setDate(date.getDate() + 6);
    return localDate(date);
  }

  function offsetWeek(start, offset) {
    const date = new Date(`${start}T12:00:00`);
    date.setDate(date.getDate() + offset * 7);
    return localDate(date);
  }

  function formatWeekLabel(start) {
    const first = new Date(`${start}T12:00:00`);
    const last = new Date(`${weekEnd(start)}T12:00:00`);
    const year = new Intl.DateTimeFormat("en", { year: "numeric" }).format(last);
    const month = new Intl.DateTimeFormat("en", { month: "short" }).format(first);
    const lastMonth = new Intl.DateTimeFormat("en", { month: "short" }).format(last);
    const firstDay = new Intl.DateTimeFormat("en", { day: "numeric" }).format(first);
    const lastDay = new Intl.DateTimeFormat("en", { day: "numeric" }).format(last);
    return month === lastMonth ? `Week ${month} ${firstDay}–${lastDay}, ${year}` : `Week ${month} ${firstDay}–${lastMonth} ${lastDay}, ${year}`;
  }

  function formatSlotDate(day) {
    return new Intl.DateTimeFormat("en", { month: "2-digit", day: "2-digit" }).format(new Date(`${day}T12:00:00`));
  }

  function formatSlotDay(day) {
    return new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${day}T12:00:00`));
  }

  function seedDemo() {
    state.habits = [
      { id: "demo-water", title: "Drink 8 glasses of water", emoji: "💧", weekly_goal: 5 },
      { id: "demo-reading", title: "Read for 15 minutes", emoji: "📖", weekly_goal: 3 },
      { id: "demo-movement", title: "Move your body", emoji: "🏃", weekly_goal: 4 },
      { id: "demo-journal", title: "Write a quick journal entry", emoji: "✍️", weekly_goal: 2 }
    ];
    const sample = [
      ["demo-water", 0], ["demo-reading", 0], ["demo-water", -1], ["demo-movement", -1],
      ["demo-journal", -1], ["demo-water", -2], ["demo-reading", -2], ["demo-movement", -3],
      ["demo-water", -3], ["demo-reading", -4], ["demo-journal", -4], ["demo-water", -5]
    ];
    state.completions = sample.map(([habit_id, days], index) => ({ id: `demo-log-${index}`, habit_id, completed_on: shiftDate(days), points: 10, created_at: `${shiftDate(days)}T12:00:00` }));
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll("button").forEach((button) => {
      if (button.dataset.close || button.id === "settingsButton" || button.id === "settingsTopButton") return;
      button.disabled = busy || button.dataset.locked === "true";
    });
  }

  function getWeekCompletions(start = state.selectedWeekStart || weekStart()) {
    const end = weekEnd(start);
    return state.completions.filter((row) => row.completed_on >= start && row.completed_on <= end);
  }

  function getQuestGoal(habit, start = state.selectedWeekStart || weekStart()) {
    const snapshot = state.questWeeks.find((row) => row.habit_id === habit.id && row.week_start === start);
    return Math.max(1, Number(snapshot?.weekly_goal || habit.weekly_goal || 3));
  }

  function getHabitWeekCompletions(habitId, start = state.selectedWeekStart || weekStart()) {
    return getWeekCompletions(start)
      .filter((row) => row.habit_id === habitId)
      .sort((a, b) => String(a.completed_on).localeCompare(String(b.completed_on)) || String(a.created_at || a.id).localeCompare(String(b.created_at || b.id)));
  }

  function currentStreak() {
    const doneDays = new Set(state.completions.map((row) => row.completed_on));
    let startOffset = doneDays.has(today) ? 0 : -1;
    let count = 0;
    for (let offset = startOffset; doneDays.has(shiftDate(offset)); offset -= 1) count += 1;
    return count;
  }

  function render() {
    const totalPoints = state.completions.reduce((sum, item) => sum + Number(item.points || 10), 0);
    const selectedWeek = state.selectedWeekStart || weekStart();
    const weekEntries = getWeekCompletions(selectedWeek);
    const weeklyGoalTotal = state.habits.reduce((sum, habit) => sum + getQuestGoal(habit, selectedWeek), 0);
    const completedThisWeek = weekEntries.length;
    const streak = currentStreak();
    const level = Math.floor(totalPoints / 100) + 1;
    const reachedCount = state.habits.filter((habit) => getHabitWeekCompletions(habit.id, selectedWeek).length >= getQuestGoal(habit, selectedWeek)).length;
    const activeCount = state.habits.length - reachedCount;
    const percent = weeklyGoalTotal ? Math.round(completedThisWeek / weeklyGoalTotal * 100) : 0;

    $("#pointsValue").textContent = totalPoints.toLocaleString();
    $("#streakValue").textContent = streak;
    $("#questValue").textContent = `${completedThisWeek}/${weeklyGoalTotal}`;
    $("#habitCount").textContent = state.habits.length;
    $("#levelLabel").textContent = `${level === 1 ? "Seedling" : level < 4 ? "Sprout" : "Bloom"} · ${level}`;
    const extras = Math.max(0, completedThisWeek - weeklyGoalTotal);
    $("#questFoot").textContent = extras ? `${extras} bonus ${extras === 1 ? "check-in" : "check-ins"} beyond your targets` : weeklyGoalTotal ? `${Math.max(0, weeklyGoalTotal - completedThisWeek)} check-ins to your weekly targets` : "Choose your first quest";
    $("#selectedWeekLabel").textContent = formatWeekLabel(selectedWeek);
    $("#nextWeekButton").disabled = selectedWeek >= weekStart();
    $("#questProgressValue").textContent = `${completedThisWeek}/${weeklyGoalTotal}`;
    $("#questProgressPercent").textContent = `${percent}%`;
    $("#questProgressFill").style.width = `${Math.min(100, percent)}%`;
    $(".week-goal-track").setAttribute("aria-valuenow", String(Math.min(100, percent)));
    $("#goalsReachedCount").textContent = reachedCount;
    $("#questsActiveCount").textContent = activeCount;
    $("#questsTotalCount").textContent = state.habits.length;
    $("#filterAllCount").textContent = state.habits.length;
    $("#filterReachedCount").textContent = reachedCount;
    $("#filterActiveCount").textContent = activeCount;
    $("#habitDateDescription").textContent = selectedWeek === weekStart()
      ? "Complete the next open box. Reach your target to unlock bonus check-ins."
      : "Past weeks are saved here for your review. Check-ins are read-only.";
    $("#emptyState").hidden = state.habits.length > 0;
    const visibleHabits = state.habits.filter((habit) => {
      const count = getHabitWeekCompletions(habit.id, selectedWeek).length;
      const reached = count >= getQuestGoal(habit, selectedWeek);
      return state.activeFilter === "all" || (state.activeFilter === "reached" ? reached : !reached);
    });
    $("#habitList").classList.toggle("is-grid", state.viewMode === "grid");
    $("#habitList").innerHTML = visibleHabits.map((habit) => renderQuestCard(habit, selectedWeek)).join("");
    $("#filterEmptyState").hidden = state.habits.length === 0 || visibleHabits.length > 0;
    document.querySelectorAll("[data-quest-filter]").forEach((button) => {
      const active = button.dataset.questFilter === state.activeFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("#listViewButton").classList.toggle("is-active", state.viewMode === "list");
    $("#listViewButton").setAttribute("aria-pressed", String(state.viewMode === "list"));
    $("#gridViewButton").classList.toggle("is-active", state.viewMode === "grid");
    $("#gridViewButton").setAttribute("aria-pressed", String(state.viewMode === "grid"));
    renderWeek();
    renderAchievements(totalPoints, streak);
  }

  function renderQuestCard(habit, selectedWeek) {
    const goal = getQuestGoal(habit, selectedWeek);
    const entries = getHabitWeekCompletions(habit.id, selectedWeek);
    const count = entries.length;
    const extras = Math.max(0, count - goal);
    const slotCount = Math.max(goal, count + 1);
    const editableWeek = selectedWeek === weekStart();
    const percent = Math.round(count / goal * 100);
    const slots = Array.from({ length: slotCount }, (_, index) => {
      const entry = entries[index];
      const isNext = index === count;
      const isLocked = !editableWeek || (!entry && !isNext);
      const slotDay = entry ? (index >= goal ? `Bonus ${index - goal + 1}` : formatSlotDay(entry.completed_on)) : index >= goal ? "Bonus" : `Step ${index + 1}`;
      const slotDate = entry ? formatSlotDate(entry.completed_on) : isNext && editableWeek ? "Ready" : isNext ? "Read only" : "Locked";
      const label = entry ? `${editableWeek ? "Undo" : "View"} check-in ${index + 1} for ${habit.title}, ${formatSlotDay(entry.completed_on)} ${formatSlotDate(entry.completed_on)}` : isNext && editableWeek ? `Complete ${slotDay} for ${habit.title}` : `${slotDay} for ${habit.title} is locked`;
      return `<button class="quest-slot ${entry ? "is-complete" : ""} ${isNext ? "is-next" : ""} ${index >= goal ? "is-bonus" : ""}" type="button" data-quest-slot="true" data-habit-id="${escapeHTML(habit.id)}" ${entry ? `data-completion-id="${escapeHTML(entry.id)}"` : ""} ${isLocked ? 'data-locked="true" disabled' : ""} aria-label="${escapeHTML(label)}" aria-pressed="${Boolean(entry)}"><span class="quest-slot-day">${escapeHTML(slotDay)}</span><span class="quest-slot-date">${escapeHTML(slotDate)}</span><span class="quest-slot-check">${entry ? "✓" : ""}</span></button>`;
    }).join("");
    const status = count >= goal ? "Goal reached" : count ? "In progress" : "Not started";
    const statusClass = count >= goal ? "reached" : count ? "active" : "not-started";
    return `<article class="quest-card ${statusClass}"><div class="quest-main"><div class="quest-icon" aria-hidden="true">${escapeHTML(habit.emoji || "🌱")}</div><div class="quest-details"><div class="quest-name-row"><h3>${escapeHTML(habit.title)}</h3><span class="quest-status">${status}</span></div><p class="quest-target">🎯 Target: ${goal} ${goal === 1 ? "time" : "times"} per week</p><div class="quest-progress-row"><strong>${count}/${goal}</strong><span class="quest-mini-track"><i style="width:${Math.min(100, percent)}%"></i></span><small>${percent}%</small></div>${extras ? `<span class="bonus-note">🏆 ${extras} bonus ${extras === 1 ? "check-in" : "check-ins"}</span>` : ""}</div></div><div class="quest-slots" role="group" aria-label="${escapeHTML(habit.title)} weekly check-ins">${slots}</div></article>`;
  }

  function renderWeek() {
    const selectedWeek = state.selectedWeekStart || weekStart();
    const starts = Array.from({ length: 4 }, (_, index) => offsetWeek(selectedWeek, index - 3));
    const counts = starts.map((start) => getWeekCompletions(start).length);
    const maxCount = Math.max(4, ...counts);
    const labels = ["3w ago", "2w ago", "Last", selectedWeek === weekStart() ? "This" : "Selected"];
    $("#weekChart").innerHTML = starts.map((start, index) => {
      const count = counts[index];
      const height = count ? Math.max(8, Math.round(count / maxCount * 100)) : 4;
      return `<div class="week-column ${index === 3 ? "today" : ""}" title="${labels[index]}: ${count} check-ins"><div class="bar-track"><span class="bar-fill" style="height:${height}%"></span></div><span class="week-day">${labels[index]}</span></div>`;
    }).join("");
    const total = counts.reduce((sum, count) => sum + count, 0);
    $("#weekTotal").textContent = `${total} ${total === 1 ? "check-in" : "check-ins"}`;
  }

  function renderAchievements(points, streak) {
    const completedCount = state.completions.length;
    const badges = [
      { icon: "🌱", title: "First step", description: "Complete your first habit", unlocked: completedCount >= 1 },
      { icon: "🔥", title: "On a roll", description: "Build a 3-day streak", unlocked: streak >= 3 },
      { icon: "⭐", title: "Habit hero", description: "Earn 100 XP", unlocked: points >= 100 },
      { icon: "🏆", title: "Consistency club", description: "Complete 25 check-ins", unlocked: completedCount >= 25 }
    ];
    const unlocked = badges.filter((badge) => badge.unlocked).length;
    $("#achievementCount").textContent = `${unlocked}/${badges.length}`;
    $("#achievementGrid").innerHTML = badges.map((badge) => `<article class="achievement-card ${badge.unlocked ? "" : "is-locked"}"><div class="badge-icon" aria-hidden="true">${badge.icon}</div><div class="badge-copy"><strong>${badge.title}</strong><span>${badge.unlocked ? "Unlocked · " : "Locked · "}${badge.description}</span></div></article>`).join("");
  }

  async function fetchAllCompletions(userId) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("completions")
        .select("id,habit_id,completed_on,points,created_at")
        .eq("user_id", userId)
        .order("completed_on", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) return { data: null, error };
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return { data: rows, error: null };
  }

  async function fetchAllQuestWeeks(userId) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("habit_quest_weeks")
        .select("habit_id,week_start,weekly_goal")
        .eq("user_id", userId)
        .order("week_start", { ascending: true })
        .range(from, from + 999);
      if (error) return { data: null, error };
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return { data: rows, error: null };
  }

  async function loadAccountData() {
    setBusy(true);
    const currentWeek = weekStart();
    const [habitsResult, completionsResult, questWeeksResult] = await Promise.all([
      db.from("habits").select("id,title,emoji,weekly_goal,created_at").eq("user_id", state.user.id).eq("archived", false).order("created_at", { ascending: true }),
      fetchAllCompletions(state.user.id),
      fetchAllQuestWeeks(state.user.id)
    ]);
    const error = habitsResult.error || completionsResult.error || questWeeksResult.error;
    if (error) {
      setBusy(false);
      showToast(`Could not load your data: ${error.message}`);
      return;
    }
    state.habits = habitsResult.data || [];
    state.completions = completionsResult.data || [];
    state.questWeeks = questWeeksResult.data || [];
    const existingWeekHabitIds = new Set(state.questWeeks.filter((row) => row.week_start === currentWeek).map((row) => row.habit_id));
    const missingWeekRows = state.habits.filter((habit) => !existingWeekHabitIds.has(habit.id)).map((habit) => ({
      user_id: state.user.id,
      habit_id: habit.id,
      week_start: currentWeek,
      weekly_goal: Math.max(1, Number(habit.weekly_goal || 3))
    }));
    if (missingWeekRows.length) {
      const { error: snapshotError } = await db.from("habit_quest_weeks").upsert(missingWeekRows, { onConflict: "habit_id,week_start" });
      if (snapshotError) showToast(`Could not prepare this week's quests: ${snapshotError.message}`);
      else state.questWeeks.push(...missingWeekRows);
    }
    setBusy(false);
    render();
  }

  async function toggleHabit(habitId, completionId = null) {
    if (state.busy) return;
    const existing = completionId ? state.completions.find((row) => row.id === completionId) : null;
    if (state.demo) {
      if (existing) state.completions = state.completions.filter((row) => row.id !== completionId);
      else state.completions.push({ id: `demo-${Date.now()}`, habit_id: habitId, completed_on: today, points: 10, created_at: new Date().toISOString() });
      render();
      showToast(existing ? "Check-in removed" : "Habit complete · +10 XP!");
      return;
    }
    setBusy(true);
    const result = existing
      ? await db.from("completions").delete().eq("id", existing.id)
      : await db.from("completions").insert({ habit_id: habitId, user_id: state.user.id, completed_on: today, points: 10 });
    setBusy(false);
    if (result.error) {
      showToast(`Could not save: ${result.error.message}`);
      return;
    }
    await loadAccountData();
    showToast(existing ? "Check-in removed" : "Habit complete · +10 XP!");
  }

  async function addHabit(event) {
    event.preventDefault();
    const title = $("#habitTitle").value.trim();
    const emoji = $("#habitEmoji").value;
    const weeklyGoal = Number($("#weeklyGoal").value);
    if (!title || !Number.isInteger(weeklyGoal) || weeklyGoal < 1) return;
    const button = $("#habitForm button[type=submit]");
    button.disabled = true;
    $("#habitError").textContent = "";
    if (state.demo) {
      state.habits.push({ id: `demo-habit-${Date.now()}`, title, emoji, weekly_goal: weeklyGoal });
    } else {
      const { data, error } = await db.from("habits").insert({ title, emoji, weekly_goal: weeklyGoal, user_id: state.user.id }).select("id,title,emoji,weekly_goal").single();
      if (error) {
        $("#habitError").textContent = `Could not add habit: ${error.message}`;
        button.disabled = false;
        return;
      }
      state.habits.push(data);
    }
    button.disabled = false;
    $("#habitForm").reset();
    $("#habitDialog").close();
    render();
    showToast("Habit added. You've got this!");
  }

  function openSettings() {
    const settings = $("#settingsDialog");
    const signedIn = configured && state.user;
    $("#setupSteps").hidden = Boolean(signedIn);
    $("#accountEmail").hidden = !signedIn;
    $("#signOutButton").hidden = !signedIn;
    $("#settingsDescription").textContent = signedIn ? "Your habits and progress are linked to this account." : configured ? "Sign in to sync your habits across devices." : "Preview mode is active. Connect your Supabase project to use your account and sync data online.";
    if (signedIn) $("#accountEmail").textContent = state.user.email;
    settings.showModal();
  }

  function updateAuthMode(mode) {
    state.authMode = mode;
    const signIn = mode === "signin";
    $("#authTitle").textContent = signIn ? "Welcome back" : "Create your account";
    $("#authCopy").textContent = signIn ? "Sign in to pick up where you left off." : "Your habits and progress will be saved to your account.";
    $("#authSubmit").innerHTML = signIn ? "Sign in <span>→</span>" : "Create account <span>→</span>";
    $("#authSwitchPrompt").textContent = signIn ? "New to Daymark?" : "Already have an account?";
    $("#authModeButton").textContent = signIn ? "Create an account" : "Sign in";
  }

  async function submitAuth(event) {
    event.preventDefault();
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const button = $("#authSubmit");
    const errorBox = $("#authError");
    errorBox.textContent = "";
    button.disabled = true;
    const result = state.authMode === "signin"
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({ email, password });
    button.disabled = false;
    if (result.error) {
      errorBox.textContent = result.error.message;
      return;
    }
    if (state.authMode === "signup" && !result.data.session) {
      errorBox.textContent = "Check your email for a confirmation link, then come back to sign in.";
      return;
    }
    $("#authDialog").close();
    $("#authForm").reset();
  }

  function syncAccountUI() {
    const name = state.user?.email?.split("@")[0] || "Your journey";
    const initial = state.user?.email?.charAt(0).toUpperCase() || "A";
    $("#sidebarUserName").textContent = state.user ? name : "Alex Morgan";
    $("#sidebarUserStatus").textContent = state.user ? "Your journey" : "Your journey";
    $("#sidebarAvatar").textContent = initial;
    $("#topAvatar").textContent = initial;
    $("#demoBanner").hidden = !state.demo;
  }

  function init() {
    state.selectedWeekStart = weekStart();
    const now = new Date();
    $("#todayLabel").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(now);
    if (state.demo) {
      seedDemo();
      syncAccountUI();
      render();
    } else {
      syncAccountUI();
      $("#authDialog").showModal();
      db.auth.getSession().then(({ data }) => {
        if (data.session) {
          state.user = data.session.user;
          $("#authDialog").close();
          syncAccountUI();
          loadAccountData();
        }
      });
      db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          state.user = session.user;
          $("#authDialog").close();
          syncAccountUI();
          loadAccountData();
        } else if (event === "SIGNED_OUT") {
          state.user = null;
          state.habits = [];
          state.completions = [];
          state.questWeeks = [];
          syncAccountUI();
          $("#authDialog").showModal();
          render();
        }
      });
    }
    window.setInterval(() => {
      const currentDate = localDate();
      if (currentDate === today) return;
      const wasViewingCurrentWeek = state.selectedWeekStart === weekStart();
      today = currentDate;
      if (wasViewingCurrentWeek) state.selectedWeekStart = weekStart();
      $("#todayLabel").textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${today}T12:00:00`));
      if (state.user && !state.demo) loadAccountData();
      else render();
    }, 30000);
  }

  document.addEventListener("click", (event) => {
    const questSlot = event.target.closest("[data-quest-slot]");
    if (questSlot && !questSlot.disabled) toggleHabit(questSlot.dataset.habitId, questSlot.dataset.completionId || null);
    const closeButton = event.target.closest("[data-close]");
    if (closeButton) $(`#${closeButton.dataset.close}`).close();
  });
  $("#addHabitButton").addEventListener("click", () => $("#habitDialog").showModal());
  $("#emptyAddButton").addEventListener("click", () => $("#habitDialog").showModal());
  $("#habitForm").addEventListener("submit", addHabit);
  $("#previousWeekButton").addEventListener("click", () => {
    state.selectedWeekStart = offsetWeek(state.selectedWeekStart || weekStart(), -1);
    render();
  });
  $("#nextWeekButton").addEventListener("click", () => {
    if (state.selectedWeekStart < weekStart()) state.selectedWeekStart = offsetWeek(state.selectedWeekStart, 1);
    render();
  });
  document.querySelectorAll("[data-quest-filter]").forEach((button) => button.addEventListener("click", () => {
    state.activeFilter = button.dataset.questFilter;
    render();
  }));
  $("#listViewButton").addEventListener("click", () => { state.viewMode = "list"; render(); });
  $("#gridViewButton").addEventListener("click", () => { state.viewMode = "grid"; render(); });
  $("#settingsButton").addEventListener("click", openSettings);
  $("#settingsTopButton").addEventListener("click", openSettings);
  $("#bannerSettingsButton").addEventListener("click", openSettings);
  $("#authModeButton").addEventListener("click", () => updateAuthMode(state.authMode === "signin" ? "signup" : "signin"));
  $("#authForm").addEventListener("submit", submitAuth);
  $("#signOutButton").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();
    if (error) showToast(`Could not sign out: ${error.message}`);
    $("#settingsDialog").close();
  });
  document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => {
    document.querySelectorAll(".main-nav a").forEach((item) => item.classList.remove("is-active"));
    link.classList.add("is-active");
  }));
  init();
})();

