/* Validación compartida por carga, copias, perfiles y sincronización. */
const WIDGETS = [
  { id: 'clock', label: 'Reloj', selector: '.clock-card', preference: 'showClock', column: 1 },
  { id: 'weather', label: 'Clima', selector: '.weather-card', preference: 'showWeather', column: 1 },
  { id: 'quote', label: 'Frase', selector: '.quote-card', preference: 'showQuote', column: 1 },
  { id: 'todo', label: 'Pendientes', selector: '.todo-card', preference: 'showTodo', column: 1 },
  { id: 'focus', label: 'Enfoque', selector: '.focus-card', preference: 'showFocus', column: 1 },
  { id: 'notes', label: 'Notas', selector: '.notes-card', preference: 'showNotes', column: 1 },
  { id: 'calendar', label: 'Mi calendario', selector: '.google-calendar-card', preference: 'showCalendars', column: 3 },
  { id: 'sports', label: 'Partidos', selector: '.sports-card', preference: 'showCalendars', column: 3 },
  { id: 'habits', label: 'Hábitos', selector: '.habits-card', preference: 'showHabits', column: 3 },
  { id: 'time', label: 'Tiempo', selector: '.time-card', preference: 'showTimeProgress', column: 3 },
  { id: 'statistics', label: 'Estadísticas', selector: '.statistics-card', preference: 'showStatistics', column: 3 },
];
const DASHBOARD_KEYS = ['background', 'backgroundPlaylists', 'categories', 'activeCategory', 'shortcuts', 'todos', 'widgets', 'settings', 'widgetLayout'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly'];

function defaultWidgetLayout() {
  return WIDGETS.map(({ id, column }, order) => ({ id, column, order, size: 'medium', hidden: false, width: 0, height: 0, x: 0, y: 0 }));
}

function validId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 100; }
function boundedText(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

function normalizeSettings(raw, strict = false) {
  const settings = defaultState().settings;
  if (!isRecord(raw)) { if (strict) throw new Error('Los ajustes de la copia no son válidos.'); return settings; }
  const enums = { theme: COLOR_THEMES, cardStyle: ['glass', 'solid', 'minimal'], layout: ['lateral', 'superior', 'oculto'],
    dockPosition: ['derecha', 'izquierda', 'arriba', 'abajo', 'oculta'], videoFit: ['cover', 'contain', 'fill'],
    shortcutView: SHORTCUT_VIEWS, shortcutStyle: SHORTCUT_STYLES, shortcutMotion: SHORTCUT_MOTIONS,
    clockFormat: ['24', '12'], tempUnit: ['C', 'F'], searchEngine: ['google', 'bing', 'duckduckgo', 'ecosia'],
    widgetPlacement: ['columns', 'free'], widgetDesign: ['custom', ...WIDGET_DESIGNS.map((design) => design.id)] };
  const ranges = { overlayDim: [0, 80], bgBlur: [0, 15], videoVolume: [0, 100], listRows: [3, 20],
    leftWidgetWidth: [200, 640], rightWidgetWidth: [200, 640], centerWidgetWidth: [0, 2400],
    leftWidgetHeight: [0, 2000], rightWidgetHeight: [0, 2000], centerWidgetHeight: [0, 2000],
    leftWidgetColumns: [1, 4], rightWidgetColumns: [1, 4], centerWidgetColumns: [1, 4], widgetGap: [4, 48], shortcutsWidth: [320, 1600] };
  for (const key of Object.keys(settings)) {
    if (raw[key] === undefined) continue;
    const value = raw[key];
    const valid = enums[key] ? enums[key].includes(value)
      : ranges[key] ? Number.isFinite(value) && value >= ranges[key][0] && value <= ranges[key][1] &&
        (!['listRows', 'leftWidgetColumns', 'rightWidgetColumns', 'centerWidgetColumns'].includes(key) || Number.isInteger(value))
        : ['accent', 'videoFillColor'].includes(key) ? typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
          : key === 'greetingName' ? typeof value === 'string' && value.length <= 120 : typeof value === 'boolean';
    if (valid) settings[key] = value;
    else if (strict) throw new Error(`El ajuste «${key}» no es válido.`);
  }
  return settings;
}

function normalizeTodos(raw, strict = false) {
  const valid = (todo) => isRecord(todo) && validId(todo.id) && boundedText(todo.text, 120) && typeof todo.done === 'boolean' &&
    (todo.due === undefined || todo.due === '' || validDayKey(todo.due)) &&
    (todo.priority === undefined || ['low', 'normal', 'high'].includes(todo.priority)) &&
    (todo.repeat === undefined || REPEATS.includes(todo.repeat)) &&
    (todo.category === undefined || typeof todo.category === 'string' && todo.category.length <= 60) &&
    (todo.nextId === undefined || validId(todo.nextId)) &&
    (todo.repeatDay === undefined || Number.isInteger(todo.repeatDay) && todo.repeatDay >= 1 && todo.repeatDay <= 31);
  if (!Array.isArray(raw) || raw.length > 2000 || raw.some((todo) => !valid(todo)) || new Set(raw.map((todo) => todo.id)).size !== raw.length) {
    if (strict) throw new Error('Las tareas de la copia no son válidas.');
    raw = Array.isArray(raw) ? raw.filter(valid).slice(0, 2000) : defaultState().todos;
  }
  const seen = new Set();
  return raw.filter((todo) => !seen.has(todo.id) && seen.add(todo.id)).map((todo) => ({ id: todo.id, text: todo.text, done: todo.done,
    due: todo.due || '', priority: todo.priority || 'normal', repeat: todo.repeat || 'none', category: todo.category || '',
    ...(todo.nextId ? { nextId: todo.nextId } : {}), ...(todo.repeatDay ? { repeatDay: todo.repeatDay } : {}) }));
}

function normalizeWidgetLayout(raw, strict = false, restoreInitial = false) {
  const defaults = defaultWidgetLayout();
  if (raw === undefined) return defaults;
  const valid = (entry) => isRecord(entry) && WIDGETS.some((widget) => widget.id === entry.id) &&
    [1, 2, 3].includes(entry.column) && Number.isInteger(entry.order) && entry.order >= 0 && entry.order <= 100 &&
    ['small', 'medium', 'large'].includes(entry.size) && (entry.hidden === undefined || typeof entry.hidden === 'boolean') &&
    ['width', 'height', 'x', 'y'].every((key) => entry[key] === undefined || Number.isInteger(entry[key]) && entry[key] >= 0 &&
      entry[key] <= (key === 'width' ? 1200 : key === 'height' ? 1600 : 4000) &&
      (key !== 'width' || entry[key] === 0 || entry[key] >= 160) && (key !== 'height' || entry[key] === 0 || entry[key] >= 80));
  if (!Array.isArray(raw) || raw.length > WIDGETS.length || raw.some((entry) => !valid(entry)) || new Set(raw.map((entry) => entry.id)).size !== raw.length) {
    if (strict) throw new Error('La disposición de widgets no es válida.');
    return defaults;
  }
  // Deshace únicamente la distribución predeterminada introducida en esta conversación.
  const previousDefault = restoreInitial && raw.length === WIDGETS.length && WIDGETS.every(({ id, column }, order) => {
    const saved = raw.find((entry) => entry.id === id);
    return saved?.column === (['focus', 'notes', 'statistics'].includes(id) ? 2 : column) && saved.order === order;
  });
  return defaults.map((entry) => {
    const saved = raw.find((item) => item.id === entry.id);
    return { ...(saved ? { id: saved.id, column: previousDefault ? entry.column : saved.column, order: saved.order, size: saved.size, hidden: saved.hidden === true } : entry),
      width: saved?.width || 0, height: saved?.height || 0, x: saved?.x || 0, y: saved?.y || 0 };
  });
}

function normalizeDashboard(raw, strict = false) {
  const defaults = defaultState();
  if (!isRecord(raw)) { if (strict) throw new Error('La copia no contiene un panel válido.'); raw = defaults; }
  const reject = (message) => { if (strict) throw new Error(message); };
  let categories = raw.categories;
  if (!Array.isArray(categories) || !categories.length || categories.length > 100 || categories.some((item) => !boundedText(item, 60)) || new Set(categories).size !== categories.length) {
    reject('Las categorías no son válidas.'); categories = defaults.categories;
  }
  categories = categories.filter((item) => item !== 'Todos');
  if (!categories.length) categories = ['General'];
  let activeCategory = raw.activeCategory;
  if (!categories.includes(activeCategory)) {
    if (activeCategory !== 'Todos') reject('La categoría activa no es válida.');
    activeCategory = categories[0];
  }
  const validShortcut = (item) => isRecord(item) && validId(item.id) && boundedText(item.name, 120) &&
    typeof item.url === 'string' && item.url.length <= 4096 && normalizeUrl(item.url) && (categories.includes(item.category) || item.category === 'Todos');
  let shortcuts = raw.shortcuts;
  if (!Array.isArray(shortcuts) || shortcuts.length > 2000 || shortcuts.some((entry) => !validShortcut(entry)) || new Set(shortcuts.map((entry) => entry.id)).size !== shortcuts.length) {
    reject('Los accesos no son válidos.'); shortcuts = Array.isArray(shortcuts) ? shortcuts.filter(validShortcut).slice(0, 2000) : [];
  }
  const seen = new Set();
  shortcuts = shortcuts.filter((entry) => !seen.has(entry.id) && seen.add(entry.id)).map(({ id, name, url, category }) => ({ id, name, url: normalizeUrl(url), category: category === 'Todos' ? activeCategory : category }));
  let background = raw.background;
  if (!isRecord(background) || !['gradient', 'image', 'video'].includes(background.type) || typeof background.value !== 'string' ||
    (background.type !== 'gradient' && !validMediaValue(background.type, background.value))) {
    reject('El fondo no es válido.'); background = defaults.background;
  }
  const backgroundPlaylists = normalizeProfilePlaylists(raw.backgroundPlaylists, strict);
  return { categories: [...categories], activeCategory, shortcuts, backgroundPlaylists,
    background: { type: background.type, value: background.type === 'gradient' ? '' : background.value },
    todos: normalizeTodos(raw.todos, strict), widgets: normalizeWidgets(raw.widgets, strict),
    settings: normalizeSettings(raw.settings, strict), widgetLayout: normalizeWidgetLayout(raw.widgetLayout, strict, raw.settings?.widgetDesign === undefined) };
}

function normalizeProfilePlaylists(raw, strict = false) {
  const result = { image: defaultPlaylist(), video: defaultPlaylist() };
  if (raw === undefined) return result;
  if (!isRecord(raw)) { if (strict) throw new Error('Las secuencias del perfil no son válidas.'); return result; }
  for (const type of ['image', 'video']) {
    const playlist = raw[type];
    if (!isRecord(playlist) || !Array.isArray(playlist.ids) || playlist.ids.length > 2000 || playlist.ids.some((id) => !validId(id)) ||
      typeof playlist.enabled !== 'boolean' || !Number.isInteger(playlist.every) || playlist.every < 1 || playlist.every > 365 ||
      !['minutes', 'hours', 'days'].includes(playlist.unit) || !Number.isFinite(playlist.startedAt) || playlist.startedAt < 0 ||
      playlist.baseId !== undefined && !validId(playlist.baseId)) {
      if (strict) throw new Error('Las secuencias del perfil no son válidas.'); continue;
    }
    result[type] = { ids: [...new Set(playlist.ids)], enabled: playlist.enabled, every: playlist.every, unit: playlist.unit, startedAt: playlist.startedAt,
      ...(playlist.baseId ? { baseId: playlist.baseId } : {}) };
  }
  return result;
}

function normalizeDomain(raw) {
  if (typeof raw !== 'string' || raw.length > 253) return '';
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw.trim()}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash &&
      /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z\d-]+$/i.test(url.hostname) ? url.hostname.toLowerCase() : '';
  } catch { return ''; }
}

function normalizePrivacy(raw, strict = false) {
  const defaults = defaultState().privacy;
  if (raw === undefined) return defaults;
  if (!isRecord(raw) || typeof raw.domainOnly !== 'boolean' || typeof raw.excludeBanking !== 'boolean' ||
    !Array.isArray(raw.excludedDomains) || raw.excludedDomains.length > 100 || raw.excludedDomains.some((domain) => !normalizeDomain(domain)) ||
    !Array.isArray(raw.excludedUrls) || raw.excludedUrls.length > 100 || raw.excludedUrls.some((url) => typeof url !== 'string' || url.length > 4096 || !normalizeUrl(url))) {
    if (strict) throw new Error('Las exclusiones de privacidad no son válidas.'); return defaults;
  }
  return { domainOnly: raw.domainOnly, excludeBanking: raw.excludeBanking,
    excludedDomains: [...new Set(raw.excludedDomains.map(normalizeDomain))], excludedUrls: [...new Set(raw.excludedUrls.map(normalizeUrl))] };
}

function normalizeTabSessions(raw, strict = false) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 20 || raw.some((session) => !isRecord(session) || !validId(session.id) || !boundedText(session.name, 60) ||
    !Number.isFinite(session.createdAt) || session.createdAt < 0 || !Array.isArray(session.tabs) || session.tabs.length > 100 ||
    session.tabs.some((tab) => !isRecord(tab) || typeof tab.title !== 'string' || tab.title.length > 200 || typeof tab.url !== 'string' || tab.url.length > 4096 || !normalizeUrl(tab.url)))) {
    if (strict) throw new Error('Las sesiones de pestañas no son válidas.'); return [];
  }
  return raw.map(({ id, name, createdAt, tabs }) => ({ id, name, createdAt, tabs: tabs.map(({ title, url }) => ({ title, url: normalizeUrl(url) })) }));
}

function normalizeState(raw, strict = false) {
  const dashboard = normalizeDashboard(raw, strict);
  const result = { ...defaultState(), ...dashboard, media: normalizeMediaState(raw?.media, dashboard.background),
    privacy: normalizePrivacy(raw?.privacy, strict), tabSessions: normalizeTabSessions(raw?.tabSessions, strict) };
  if (raw?.profiles !== undefined && (!Array.isArray(raw.profiles) || raw.profiles.length > 12 || raw.profiles.some((profile) => !isRecord(profile) || !validId(profile.id) || !boundedText(profile.name, 40)) ||
    new Set(raw.profiles.map((profile) => profile.id)).size !== raw.profiles.length)) {
    if (strict) throw new Error('Los perfiles no son válidos.');
  } else if (raw?.profiles?.length) {
    result.profiles = raw.profiles.map(({ id, name, data }) => ({ id, name, data: normalizeDashboard(data, strict) }));
  }
  if (!result.profiles.length) result.profiles = [{ id: 'personal', name: 'Personal', data: structuredClone(dashboard) }];
  result.activeProfile = result.profiles.some((profile) => profile.id === raw?.activeProfile) ? raw.activeProfile : result.profiles[0].id;
  if (strict && raw?.activeProfile !== undefined && !result.profiles.some((profile) => profile.id === raw.activeProfile)) throw new Error('El perfil activo no existe.');
  const rules = raw?.profileRules;
  if (rules !== undefined) {
    if (!Array.isArray(rules) || rules.length > 20 || rules.some((rule) => !isRecord(rule) || !validId(rule.id) ||
      !result.profiles.some((profile) => profile.id === rule.profileId) || !Array.isArray(rule.days) || !rule.days.length ||
      rule.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || !validTime(rule.start) || !validTime(rule.end) || rule.start === rule.end)) {
      if (strict) throw new Error('Los horarios de perfiles no son válidos.');
    } else result.profileRules = rules.map(({ id, profileId, days, start, end }) => ({ id, profileId, days: [...new Set(days)], start, end }));
  }
  result.profileOverrideUntil = Number.isFinite(raw?.profileOverrideUntil) && raw.profileOverrideUntil >= 0 ? raw.profileOverrideUntil : 0;
  result.updatedAt = Number.isFinite(raw?.updatedAt) && raw.updatedAt >= 0 ? raw.updatedAt : 0;
  return result;
}
