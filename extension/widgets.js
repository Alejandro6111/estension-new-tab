/* -------------------------- Widgets personales -------------------------- */

function focusSecondsLeft() {
  const focus = state.widgets.focus;
  return focus.endsAt ? Math.max(0, Math.ceil((focus.endsAt - Date.now()) / 1000)) : focus.remaining;
}

function tickPersonalWidgets() {
  const focus = state.widgets.focus;
  const day = localDayKey();
  let changed = false;
  if (focus.day !== day) { focus.day = day; focus.completed = 0; changed = true; }
  if (focus.endsAt && focusSecondsLeft() === 0) {
    const completedDay = localDayKey(new Date(focus.endsAt));
    focus.endsAt = 0;
    focus.remaining = 0;
    if (focus.kind !== 'break') {
      if (completedDay === day) focus.completed += 1;
      const entry = state.widgets.focusHistory.find((item) => item.day === completedDay);
      if (entry) { entry.sessions++; entry.seconds += focus.duration; }
      else state.widgets.focusHistory.push({ day: completedDay, seconds: focus.duration, sessions: 1 });
      state.widgets.focusHistory.sort((a, b) => a.day.localeCompare(b.day));
      state.widgets.focusHistory = state.widgets.focusHistory.slice(-366);
      renderStatistics();
    }
    changed = true;
  }
  if (changed) persist();
  renderFocus();
  if (document.getElementById('habits-list').dataset.day !== day) { renderHabits(); renderStatistics(); renderTodos(); }
  renderTimePerspective();
}

function renderFocus() {
  const focus = state.widgets.focus;
  const seconds = focusSecondsLeft();
  const running = focus.endsAt > 0;
  const isBreak = focus.kind === 'break';
  document.getElementById('focus-time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  document.getElementById('focus-kind').textContent = isBreak ? 'Descanso' : 'Enfoque';
  document.getElementById('focus-sessions').textContent = `${focus.completed} hoy`;
  document.getElementById('focus-toggle').textContent = running ? 'Pausar' : seconds === 0 ? 'Otra vez' : seconds < focus.duration ? 'Continuar' : 'Comenzar';
  document.querySelectorAll('[data-focus-minutes]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.focusMinutes) * 60 === focus.duration && (Number(button.dataset.focusMinutes) === 5 ? 'break' : 'focus') === focus.kind));
    button.disabled = running;
  });
  const message = seconds === 0 ? (isBreak ? 'Pausa lista. ¿Volvemos al enfoque?' : '¡Sesión lista! Te mereces una pausa.')
    : running ? (isBreak ? 'Estira, respira, vuelve con calma.' : 'Este rato es para lo que importa.')
      : seconds < focus.duration ? 'En pausa. Continúa cuando quieras.' : 'Una cosa a la vez.';
  const status = document.getElementById('focus-status');
  if (status.textContent !== message) status.textContent = message;
}

function renderNotes() {
  const note = document.getElementById('quick-note');
  if (note.value !== state.widgets.note) note.value = state.widgets.note;
  document.getElementById('notes-count').textContent = `${state.widgets.note.length} / 4000`;
}

function renderHabits() {
  const day = localDayKey();
  const list = document.getElementById('habits-list');
  const focused = document.activeElement;
  const focusedId = focused?.closest('.habit-item')?.dataset.id;
  const focusedAction = focused?.className;
  list.replaceChildren();
  list.dataset.day = day;
  const completed = state.widgets.habits.filter((habit) => habit.completedOn === day).length;
  document.getElementById('habits-count').textContent = `${completed} / ${state.widgets.habits.length}`;
  document.getElementById('habits-status').textContent = state.widgets.habits.length === 0 ? 'Añade algo que quieras repetir.'
    : completed === state.widgets.habits.length ? '¡Todo por hoy! Mañana seguimos.' : 'Un poquito, cada día.';
  state.widgets.habits.forEach((habit) => {
    const item = document.createElement('li');
    item.className = 'habit-item';
    item.dataset.id = habit.id;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'habit-toggle';
    toggle.setAttribute('aria-pressed', String(habit.completedOn === day));
    const check = document.createElement('span');
    check.className = 'habit-check';
    check.setAttribute('aria-hidden', 'true');
    // Solo geometría estática; los nombres siempre se insertan como texto.
    check.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4 10-10"/></svg>';
    const name = document.createElement('span');
    name.className = 'habit-name';
    name.textContent = habit.name;
    toggle.append(check, name);
    toggle.addEventListener('click', () => {
      habit.completedOn = habit.completedOn === localDayKey() ? '' : localDayKey();
      habit.history = habit.history.filter((day) => day !== localDayKey());
      if (habit.completedOn) habit.history.push(habit.completedOn);
      habit.history.sort(); habit.history = habit.history.slice(-366);
      persist();
      renderHabits();
      renderStatistics();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'habit-remove';
    remove.setAttribute('aria-label', `Eliminar hábito «${habit.name}»`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    remove.addEventListener('click', () => {
      state.widgets.habits = state.widgets.habits.filter((entry) => entry.id !== habit.id);
      persist();
      renderHabits();
      renderStatistics();
      document.getElementById('habit-input').focus();
    });
    item.append(toggle, remove);
    list.appendChild(item);
    if (focusedId === habit.id && focusedAction === 'habit-toggle') toggle.focus();
    if (focusedId === habit.id && focusedAction === 'habit-remove') remove.focus();
  });
  const full = state.widgets.habits.length >= 8;
  document.getElementById('habit-input').disabled = full;
  document.querySelector('#habit-form button').disabled = full;
  const message = document.getElementById('habit-message');
  message.hidden = !full;
  message.textContent = full ? 'Máximo 8 hábitos. Quita uno para añadir otro.' : '';
}

function renderTimePerspective() {
  const now = new Date();
  const year = now.getFullYear();
  const dayStart = new Date(year, now.getMonth(), now.getDate());
  const dayEnd = new Date(year, now.getMonth(), now.getDate() + 1);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const dayPercent = (now - dayStart) / (dayEnd - dayStart) * 100;
  const yearPercent = (now - yearStart) / (yearEnd - yearStart) * 100;
  document.getElementById('day-progress').value = dayPercent;
  document.getElementById('year-progress').value = yearPercent;
  document.getElementById('day-percent').textContent = `${Math.floor(dayPercent)} %`;
  document.getElementById('year-percent').textContent = `${Math.floor(yearPercent)} %`;
  document.getElementById('year-label').textContent = String(year);
  const minutes = Math.ceil((dayEnd - now) / 60000);
  document.getElementById('time-remaining').textContent = `Quedan ${Math.floor(minutes / 60)} h ${minutes % 60} min de hoy.`;
}

function setupPersonalWidgets() {
  document.getElementById('focus-toggle').addEventListener('click', () => {
    tickPersonalWidgets();
    const focus = state.widgets.focus;
    if (focus.endsAt) { focus.remaining = focusSecondsLeft(); focus.endsAt = 0; }
    else { if (focus.remaining === 0) focus.remaining = focus.duration; focus.endsAt = Date.now() + focus.remaining * 1000; }
    persist();
    renderFocus();
  });
  document.getElementById('focus-reset').addEventListener('click', () => {
    const focus = state.widgets.focus;
    focus.endsAt = 0;
    focus.remaining = focus.duration;
    persist();
    renderFocus();
  });
  document.querySelectorAll('[data-focus-minutes]').forEach((button) => button.addEventListener('click', () => {
    if (state.widgets.focus.endsAt) return;
    const duration = Number(button.dataset.focusMinutes) * 60;
    Object.assign(state.widgets.focus, { kind: duration === 300 ? 'break' : 'focus', duration, remaining: duration, endsAt: 0 });
    persist();
    renderFocus();
  }));
  document.getElementById('quick-note').addEventListener('input', (event) => {
    state.widgets.note = event.target.value.slice(0, 4000);
    renderNotes();
    persist().then(() => { document.getElementById('notes-status').textContent = 'Guardada'; });
  });
  document.getElementById('habit-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('habit-input');
    const name = input.value.trim().slice(0, 60);
    if (!name || state.widgets.habits.length >= 8) return;
    state.widgets.habits.push({ id: uid(), name, completedOn: '', history: [] });
    input.value = '';
    persist();
    renderHabits();
    renderStatistics();
  });
  // Mantiene los widgets al día al trabajar con varias pestañas de Aurora.
  const syncWidgets = (saved) => {
    if (!saved) return;
    if (saved.updatedAt < state.updatedAt || JSON.stringify(saved) === JSON.stringify(state)) return;
    state = normalizeState(saved);
    applyCurrentState();
    if (!document.getElementById('settings-modal').hidden) syncSettingsFormFromState();
  };
  if (hasChromeStorage) chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) syncWidgets(changes[STORAGE_KEY].newValue);
  });
  else window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { syncWidgets(JSON.parse(event.newValue)); } catch (error) { /* otra pestaña escribió datos inválidos */ }
  });
  setInterval(tickPersonalWidgets, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickPersonalWidgets(); });
}
