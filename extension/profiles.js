/* Los datos activos conservan el formato histórico de auroraState. */
function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}
function action(text, callback, className = 'btn-ghost') {
  const button = el('button', className, text);
  button.type = 'button';
  button.addEventListener('click', callback);
  return button;
}
let announcementTimer;
function announce(message) {
  const node = document.getElementById('aurora-announcement');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => { node.hidden = true; }, 6000);
}
function dashboardSnapshot(source = state) {
  return structuredClone(Object.fromEntries(DASHBOARD_KEYS.map((key) => [key, source[key]])));
}
function captureActiveProfile() {
  if (!state) return;
  state.backgroundPlaylists = structuredClone(state.media.playlists);
  const profile = state.profiles.find((entry) => entry.id === state.activeProfile);
  if (profile) profile.data = dashboardSnapshot();
}
function switchProfile(id, manual = true) {
  const profile = state.profiles.find((entry) => entry.id === id);
  if (!profile) return;
  if (manual) {
    const nextDay = new Date(); nextDay.setHours(24, 0, 0, 0);
    state.profileOverrideUntil = nextDay.getTime();
  }
  if (id === state.activeProfile) { persist(); return; }
  tickPersonalWidgets();
  captureActiveProfile();
  const tracking = state.settings.trackPages;
  Object.assign(state, normalizeDashboard(profile.data));
  state.media = normalizeMediaState({ library: state.media.library, playlists: state.backgroundPlaylists }, state.background);
  state.settings.trackPages = tracking;
  state.activeProfile = id;
  modalStack.slice().reverse().forEach((modal) => { if (modal !== 'settings-modal') closeModal(modal); });
  applyCurrentState();
  syncSettingsFormFromState();
  persist();
  announce(`Perfil ${profile.name}`);
}
function profileTemplate(template) {
  if (template === 'copy') { captureActiveProfile(); return dashboardSnapshot(); }
  const result = normalizeDashboard(defaultState());
  result.todos = []; result.widgets.note = '';
  const presets = {
    university: { category: 'Universidad', theme: 'azul', sites: [['GitHub', 'https://github.com'], ['ChatGPT', 'https://chatgpt.com'], ['Drive', 'https://drive.google.com'], ['Google Calendar', 'https://calendar.google.com']] },
    work: { category: 'Trabajo', theme: 'verde', sites: [['Gmail', 'https://mail.google.com'], ['Drive', 'https://drive.google.com'], ['Google Calendar', 'https://calendar.google.com'], ['GitHub', 'https://github.com']] },
    gaming: { category: 'Ocio', theme: 'violeta', sites: [['YouTube', 'https://youtube.com'], ['Crunchyroll', 'https://crunchyroll.com'], ['Reddit', 'https://reddit.com'], ['Discord', 'https://discord.com']] },
    empty: { category: 'General', theme: 'aurora', sites: [] },
  };
  const preset = presets[template] || presets.empty;
  result.categories = [preset.category]; result.activeCategory = preset.category;
  result.shortcuts = preset.sites.map(([name, url]) => ({ id: uid(), name, url, category: preset.category }));
  result.settings.theme = preset.theme;
  result.settings.accent = { azul: '#8ac7ff', verde: '#92d6ad', violeta: '#c9adf5', aurora: '#f4a54b' }[preset.theme];
  return result;
}
function renderProfiles() {
  const tabs = document.getElementById('profile-tabs');
  const list = document.getElementById('profiles-list');
  const select = document.getElementById('rule-profile');
  const selected = select.value;
  tabs.replaceChildren(); list.replaceChildren(); select.replaceChildren();
  state.profiles.forEach((profile) => {
    const tab = action(profile.name, () => switchProfile(profile.id), 'profile-tab');
    tab.setAttribute('aria-pressed', String(profile.id === state.activeProfile)); tabs.append(tab);
    const option = el('option', '', profile.name); option.value = profile.id; select.append(option);
    const row = el('div', 'profile-row');
    const name = el('input'); name.type = 'text'; name.value = profile.name; name.maxLength = 40;
    name.setAttribute('aria-label', `Nombre del perfil ${profile.name}`);
    row.append(name, action('Renombrar', () => {
      if (!boundedText(name.value.trim(), 40)) { announce('Escribe un nombre de hasta 40 caracteres.'); return; }
      profile.name = name.value.trim(); persist(); renderProfiles();
    }), action(profile.id === state.activeProfile ? 'Activo' : 'Usar', () => switchProfile(profile.id)));
    const remove = action('Eliminar', () => {
      if (!confirm(`¿Eliminar «${profile.name}» y sus tareas, notas y accesos? Exporta una copia si quieres conservarlos.`)) return;
      if (profile.id === state.activeProfile) switchProfile(state.profiles.find((entry) => entry.id !== profile.id).id);
      state.profiles = state.profiles.filter((entry) => entry.id !== profile.id);
      state.profileRules = state.profileRules.filter((rule) => rule.profileId !== profile.id);
      persist(); renderProfiles();
    });
    remove.disabled = state.profiles.length === 1; row.append(remove); list.append(row);
  });
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  const rules = document.getElementById('profile-rules'); rules.replaceChildren();
  const weekdays = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  state.profileRules.forEach((rule) => {
    const profile = state.profiles.find((entry) => entry.id === rule.profileId);
    const row = el('div', 'rule-row');
    row.append(el('span', '', `${profile.name} · ${rule.days.map((day) => weekdays[day]).join(' ')} · ${rule.start}–${rule.end}`), action('Quitar', () => {
      state.profileRules = state.profileRules.filter((entry) => entry.id !== rule.id); persist(); renderProfiles();
    })); rules.append(row);
  });
}
function ruleMatches(rule, date = new Date()) {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (rule.start < rule.end) return rule.days.includes(date.getDay()) && time >= rule.start && time < rule.end;
  const previousDay = (date.getDay() + 6) % 7;
  return rule.days.includes(date.getDay()) && time >= rule.start || rule.days.includes(previousDay) && time < rule.end;
}
function checkProfileSchedule() {
  if (Date.now() < state.profileOverrideUntil || !document.getElementById('settings-modal').hidden || modalStack.length || document.body.classList.contains('editing-page')) return;
  const rule = state.profileRules.find((entry) => ruleMatches(entry));
  if (rule && rule.profileId !== state.activeProfile) switchProfile(rule.profileId, false);
}
function setupProfiles() {
  document.getElementById('profiles-open').addEventListener('click', () => { openSettings(); setSettingsSection('perfiles'); });
  document.getElementById('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('profile-name'); const name = input.value.trim();
    if (state.profiles.length >= 12) { announce('Puedes guardar hasta 12 perfiles.'); return; }
    if (!boundedText(name, 40)) return;
    const id = uid();
    const data = profileTemplate(document.getElementById('profile-template').value);
    // Una copia conserva el contenido, pero no duplica un temporizador en marcha.
    data.widgets.focus.remaining = data.widgets.focus.endsAt ? focusSecondsLeft() : data.widgets.focus.remaining;
    data.widgets.focus.endsAt = 0;
    state.profiles.push({ id, name, data }); input.value = '';
    switchProfile(id); renderProfiles();
    document.getElementById('profile-status').textContent = `Perfil «${name}» creado.`;
  });
  document.getElementById('profile-rule-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const days = [...document.querySelectorAll('.rule-days input:checked')].map((input) => Number(input.value));
    const start = document.getElementById('rule-start').value, end = document.getElementById('rule-end').value;
    if (!days.length || !validTime(start) || !validTime(end) || start === end || state.profileRules.length >= 20) { announce('Elige días y horas diferentes. Máximo 20 horarios.'); return; }
    state.profileRules.push({ id: uid(), profileId: document.getElementById('rule-profile').value, days, start, end });
    persist(); renderProfiles();
  });
  document.getElementById('profiles-auto-resume').addEventListener('click', () => {
    state.profileOverrideUntil = 0; persist(); closeModal('settings-modal'); checkProfileSchedule(); announce('Horarios reanudados.');
  });
  renderProfiles(); checkProfileSchedule(); setInterval(checkProfileSchedule, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkProfileSchedule(); });
}
