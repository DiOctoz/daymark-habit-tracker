(() => {
  const config = window.HABIT_TRACKER_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
  const db = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const $ = (selector) => document.querySelector(selector);
  const today = localDate();
  const state = { user: null, habits: [], completions: [], demo: !configured, busy: false, authMode: "signin" };
  let toastTimeout;

  function localDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function shiftDate(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return localDate(date);
  }

  function seedDemo() {
    state.habits = [
      { id: "demo-water", title: "Drink 8 glasses of water", emoji: "💧" },
      { id: "demo-reading", title: "Read for 15 minutes", emoji: "📖" },
      { id: "demo-movement", title: "Move your body", emoji: "🏃" },
      { id: "demo-journal", title: "Write a quick journal entry", emoji: "✍️" }
    ];
    const sample = [
      ["demo-water", 0], ["demo-reading", 0], ["demo-water", -1], ["demo-movement", -1],
      ["demo-journal", -1], ["demo-water", -2], ["demo-reading", -2], ["demo-movement", -3],
      ["demo-water", -3], ["demo-reading", -4], ["demo-journal", -4], ["demo-water", -5]
    ];
    state.completions = sample.map(([habit_id, days], index) => ({ id: `demo-log-${index}`, habit_id, completed_on: shiftDate(days), points: 10 }));
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
      button.disabled = busy;
    });
  }

  function getDone(habitId, day = today) {
    return state.completions.some((row) => row.habit_id === habitId && row.completed_on === day);
  }

  function getDayCount(day) {
    return state.completions.filter((row) => row.completed_on === day).length;
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
    const doneToday = state.habits.filter((habit) => getDone(habit.id)).length;
    const totalToday = state.habits.length;
    const streak = currentStreak();
    const xpInLevel = totalPoints % 100;
    const level = Math.floor(totalPoints / 100) + 1;

    $("#pointsValue").textContent = totalPoints.toLocaleString();
    $("#streakValue").textContent = streak;
    $("#todayValue").textContent = `${doneToday}/${totalToday}`;
    $("#habitCount").textContent = totalToday;
    $("#levelLabel").textContent = `${level === 1 ? "Seedling" : level < 4 ? "Sprout" : "Bloom"} · ${level}`;
    $("#todayFoot").textContent = totalToday && doneToday === totalToday ? "You showed up for every habit!" : doneToday ? `${totalToday - doneToday} more small ${totalToday - doneToday === 1 ? "win" : "wins"} to go` : "Pick one small win";
    $("#habitDateDescription").textContent = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${today}T12:00:00`));
    $("#emptyState").hidden = totalToday > 0;
    $("#habitList").innerHTML = state.habits.map((habit) => {
      const done = getDone(habit.id);
      return `<article class="habit-card"><div class="habit-emoji" aria-hidden="true">${escapeHTML(habit.emoji || "🌱")}</div><div class="habit-info"><strong>${escapeHTML(habit.title)}</strong><span>${done ? "Nice work — you did it today" : "A small step is still a step"}</span></div><span class="habit-xp">+10 XP</span><button class="habit-check ${done ? "is-done" : ""}" type="button" data-habit-id="${escapeHTML(habit.id)}" aria-label="${done ? "Undo" : "Complete"} ${escapeHTML(habit.title)}" aria-pressed="${done}">${done ? "✓" : ""}</button></article>`;
    }).join("");
    renderWeek();
    renderProgress(doneToday, totalToday);
    renderAchievements(totalPoints, streak);
  }

  function renderWeek() {
    const days = Array.from({ length: 7 }, (_, index) => shiftDate(index - 6));
    const maxCount = Math.max(4, ...days.map(getDayCount));
    const labels = days.map((day) => new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${day}T12:00:00`)));
    $("#weekChart").innerHTML = days.map((day, index) => {
      const count = getDayCount(day);
      const height = count ? Math.max(8, Math.round(count / maxCount * 100)) : 4;
      return `<div class="week-column ${day === today ? "today" : ""}" title="${count} check-ins"><div class="bar-track"><span class="bar-fill" style="height:${height}%"></span></div><span class="week-day">${labels[index]}</span></div>`;
    }).join("");
    const total = days.reduce((sum, day) => sum + getDayCount(day), 0);
    $("#weekTotal").textContent = `${total} ${total === 1 ? "check-in" : "check-ins"}`;
  }

  function renderProgress(done, total) {
    const percent = total ? Math.round(done / total * 100) : 0;
    $("#progressPercent").textContent = `${percent}%`;
    $("#progressRing").style.background = `conic-gradient(var(--green) ${percent * 3.6}deg, #edf1e8 ${percent * 3.6}deg)`;
    $("#goalTrackFill").style.width = `${percent}%`;
    $("#goalCount").textContent = `${done} ${done === 1 ? "habit" : "habits"} done${total ? ` · ${total} today` : ""}`;
    $("#goalTitle").textContent = total && percent === 100 ? "You did it!" : total && percent > 0 ? "Nice momentum" : "A fresh start";
    $("#goalMessage").textContent = total && percent === 100 ? "You showed up for yourself today." : total ? "Every check-in moves you forward." : "Add a habit to begin your day.";
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

  async function loadAccountData() {
    setBusy(true);
    const [habitsResult, completionsResult] = await Promise.all([
      db.from("habits").select("id,title,emoji,frequency_days,created_at").eq("user_id", state.user.id).eq("archived", false).order("created_at", { ascending: true }),
      db.from("completions").select("id,habit_id,completed_on,points").eq("user_id", state.user.id).order("completed_on", { ascending: true })
    ]);
    setBusy(false);
    const error = habitsResult.error || completionsResult.error;
    if (error) {
      showToast(`Could not load your data: ${error.message}`);
      return;
    }
    state.habits = habitsResult.data || [];
    state.completions = completionsResult.data || [];
    render();
  }

  async function toggleHabit(habitId) {
    if (state.busy) return;
    const existing = state.completions.find((row) => row.habit_id === habitId && row.completed_on === today);
    if (state.demo) {
      if (existing) state.completions = state.completions.filter((row) => row !== existing);
      else state.completions.push({ id: `demo-${Date.now()}`, habit_id: habitId, completed_on: today, points: 10 });
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
      showToast(result.error.code === "23505" ? "Already checked in today" : `Could not save: ${result.error.message}`);
      return;
    }
    await loadAccountData();
    showToast(existing ? "Check-in removed" : "Habit complete · +10 XP!");
  }

  async function addHabit(event) {
    event.preventDefault();
    const title = $("#habitTitle").value.trim();
    const emoji = $("#habitEmoji").value;
    if (!title) return;
    const button = $("#habitForm button[type=submit]");
    button.disabled = true;
    $("#habitError").textContent = "";
    if (state.demo) {
      state.habits.push({ id: `demo-habit-${Date.now()}`, title, emoji });
    } else {
      const { data, error } = await db.from("habits").insert({ title, emoji, user_id: state.user.id }).select("id,title,emoji").single();
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
          syncAccountUI();
          $("#authDialog").showModal();
          render();
        }
      });
    }
  }

  document.addEventListener("click", (event) => {
    const habitButton = event.target.closest("[data-habit-id]");
    if (habitButton) toggleHabit(habitButton.dataset.habitId);
    const closeButton = event.target.closest("[data-close]");
    if (closeButton) $(`#${closeButton.dataset.close}`).close();
  });
  $("#addHabitButton").addEventListener("click", () => $("#habitDialog").showModal());
  $("#emptyAddButton").addEventListener("click", () => $("#habitDialog").showModal());
  $("#habitForm").addEventListener("submit", addHabit);
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
