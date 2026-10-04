/* ========================================================================
   Aurora – Nueva Pestaña
   Todo el estado se guarda en chrome.storage.local (con fallback a
   localStorage si el script se abre fuera de la extensión).
   ======================================================================== */

const STORAGE_KEY = 'auroraState';
const COLOR_THEMES = ['aurora', 'blanco', 'negro', 'dorado', 'azul', 'verde', 'violeta', 'rosa'];
const SHORTCUT_STYLES = ['glass', 'round', 'transparent', 'solid', 'outline', 'raised', 'soft', 'neon', 'aurora', 'paper', 'frame', 'tile'];
const SHORTCUT_VIEWS = ['cuadricula', 'compacta', 'lista', 'mosaico', 'tarjetas', 'cinta'];
const SHORTCUT_MOTIONS = ['suave', 'viva', 'ninguna'];
const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
const hasChromeTabs = typeof chrome !== 'undefined' && !!chrome.tabs;

function storageGet(key) {
  return new Promise((resolve) => {
    if (hasChromeStorage) {
      chrome.storage.local.get([key], (res) => resolve(res[key]));
    } else {
      try {
        const v = localStorage.getItem(key);
        resolve(v ? JSON.parse(v) : undefined);
      } catch (e) { resolve(undefined); }
    }
  });
}

function storageSet(key, value) {
  return new Promise((resolve) => {
    if (hasChromeStorage) {
      chrome.storage.local.set({ [key]: value }, resolve);
    } else {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
      resolve();
    }
  });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function normalizeUrl(raw) {
  if (typeof raw !== 'string') return '';
  let u = raw.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    return ['https:', 'http:'].includes(parsed.protocol) && parsed.hostname ? parsed.href : '';
  } catch (error) { return ''; }
}

function openNewTab(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return;
  if (hasChromeTabs) chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener');
}

function browserFaviconUrl(rawUrl) {
  const full = normalizeUrl(rawUrl);
  if (!full || typeof chrome === 'undefined' || !chrome.runtime?.getURL) return '';
  const icon = new URL(chrome.runtime.getURL('/_favicon/'));
  icon.searchParams.set('pageUrl', full);
  icon.searchParams.set('size', '32');
  return icon.href;
}

let genericFaviconPromise;

async function faviconBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Favicon no disponible');
  return new Uint8Array(await response.arrayBuffer());
}

function sameBytes(a, b) {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

async function hasBrowserFavicon(url) {
  if (!genericFaviconPromise) {
    genericFaviconPromise = faviconBytes(browserFaviconUrl('https://aurora-invalid-favicon.invalid/'));
  }
  const [siteIcon, genericIcon] = await Promise.all([faviconBytes(url), genericFaviconPromise]);
  return !sameBytes(siteIcon, genericIcon);
}

function setShortcutIcon(img, iconWrap, rawUrl, name) {
  const full = normalizeUrl(rawUrl);
  const googleUrl = full
    ? `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(full)}` : '';
  const browserUrl = browserFaviconUrl(full);
  const fallback = document.createElement('span');
  fallback.className = 'shortcut-icon-fallback';
  fallback.textContent = typeof name === 'string' ? name.trim().charAt(0).toLocaleUpperCase() || '↗' : '↗';
  iconWrap.appendChild(fallback);
  img.alt = '';
  img.onload = () => {
    fallback.remove();
    iconWrap.appendChild(img);
  };
  img.onerror = () => {
    if (img.src === browserUrl && googleUrl) img.src = googleUrl;
  };
  if (!full) return;
  if (!browserUrl) { img.src = googleUrl; return; }
  // _favicon responde con un globo genérico (HTTP 200) para páginas desconocidas.
  // Compáralo con el del navegador antes de decidir si usar el respaldo remoto.
  hasBrowserFavicon(browserUrl).then((found) => {
    img.src = found ? browserUrl : googleUrl;
  }).catch(() => { img.src = googleUrl; });
}

function validMediaValue(type, value) {
  if (typeof value !== 'string' || !value) return false;
  if (/^https?:\/\//i.test(value)) {
    try { return !!new URL(value).hostname; } catch (error) { return false; }
  }
  return type === 'image'
    ? /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(value)
    : /^data:video\/(?:mp4|webm|ogg);base64,[a-z0-9+/=]+$/i.test(value);
}

function defaultPlaylist() {
  return { ids: [], enabled: false, every: 1, unit: 'days', startedAt: Date.now() };
}

function normalizeMediaState(raw, background) {
  const library = { image: [], video: [] };
  const playlists = { image: defaultPlaylist(), video: defaultPlaylist() };
  for (const type of ['image', 'video']) {
    const source = raw?.library?.[type];
    if (Array.isArray(source)) {
      library[type] = source.filter((entry) => entry && typeof entry.id === 'string' &&
        typeof entry.name === 'string' && validMediaValue(type, entry.value));
    }
    if (background?.type === type && validMediaValue(type, background.value) &&
        !library[type].some((entry) => entry.value === background.value)) {
      library[type].unshift({ id: uid(), name: `Fondo ${type === 'image' ? 'de imagen' : 'de video'} anterior`, value: background.value });
    }
    const playlist = raw?.playlists?.[type];
    if (playlist && typeof playlist === 'object') {
      playlists[type] = {
        ids: Array.isArray(playlist.ids) ? [...new Set(playlist.ids.filter((id) =>
          typeof id === 'string' && library[type].some((entry) => entry.id === id)))] : [],
        enabled: playlist.enabled === true && Array.isArray(playlist.ids) &&
          playlist.ids.filter((id) => library[type].some((entry) => entry.id === id)).length > 1,
        every: Number.isInteger(playlist.every) && playlist.every >= 1 && playlist.every <= 365 ? playlist.every : 1,
        unit: ['minutes', 'hours', 'days'].includes(playlist.unit) ? playlist.unit : 'days',
        startedAt: Number.isFinite(playlist.startedAt) && playlist.startedAt > 0 ? playlist.startedAt : Date.now(),
        baseId: typeof playlist.baseId === 'string' && library[type].some((entry) => entry.id === playlist.baseId)
          ? playlist.baseId : undefined,
      };
    }
  }
  return { library, playlists };
}

/* ---------------------------- Estado por defecto ---------------------------- */

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultWidgets() {
  return {
    note: '',
    focus: { duration: 1500, remaining: 1500, endsAt: 0, completed: 0, day: localDayKey() },
    habits: ['Tomar agua', 'Moverme un rato', 'Leer algo'].map((name) => ({ id: uid(), name, completedOn: '' })),
  };
}

function validDayKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return localDayKey(new Date(year, month - 1, day)) === value;
}

function normalizeWidgets(raw, strict = false) {
  const widgets = defaultWidgets();
  if (raw === undefined) return widgets;
  const reject = () => { if (strict) throw new Error('Las notas, hábitos o el temporizador de la copia no son válidos.'); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { reject(); return widgets; }
  if (typeof raw.note === 'string' && raw.note.length <= 4000) widgets.note = raw.note;
  else if (raw.note !== undefined) reject();
  const focus = raw.focus;
  if (focus !== undefined) {
    if (focus && [300, 1500, 3000].includes(focus.duration) &&
        Number.isInteger(focus.remaining) && focus.remaining >= 0 && focus.remaining <= focus.duration &&
        Number.isFinite(focus.endsAt) && focus.endsAt >= 0 && focus.endsAt <= 8640000000000000 &&
        (focus.endsAt === 0 || focus.endsAt <= Date.now() + focus.duration * 1000) &&
        Number.isSafeInteger(focus.completed) && focus.completed >= 0 && validDayKey(focus.day)) {
      widgets.focus = { duration: focus.duration, remaining: focus.remaining, endsAt: focus.endsAt,
        completed: focus.completed, day: focus.day };
    } else reject();
  }
  if (raw.habits !== undefined) {
    if (Array.isArray(raw.habits) && raw.habits.length <= 8 &&
        raw.habits.every((habit) => habit && typeof habit.id === 'string' && habit.id.length > 0 && habit.id.length <= 100 &&
          typeof habit.name === 'string' && habit.name.trim().length > 0 && habit.name.length <= 60 &&
          (habit.completedOn === '' || validDayKey(habit.completedOn))) &&
        new Set(raw.habits.map((habit) => habit.id)).size === raw.habits.length) {
      widgets.habits = raw.habits.map(({ id, name, completedOn }) => ({ id, name, completedOn }));
    } else reject();
  }
  return widgets;
}

function defaultState() {
  return {
    background: { type: 'gradient', value: '' },
    media: { library: { image: [], video: [] }, playlists: { image: defaultPlaylist(), video: defaultPlaylist() } },
    categories: ['General'],
    activeCategory: 'General',
    shortcuts: [
      { id: uid(), name: 'YouTube', url: 'https://youtube.com', category: 'General' },
      { id: uid(), name: 'Gmail', url: 'https://gmail.com', category: 'General' },
      { id: uid(), name: 'Facebook', url: 'https://facebook.com', category: 'General' },
      { id: uid(), name: 'Wikipedia', url: 'https://wikipedia.org', category: 'General' },
      { id: uid(), name: 'Instagram', url: 'https://instagram.com', category: 'General' },
      { id: uid(), name: 'X / Twitter', url: 'https://x.com', category: 'General' },
      { id: uid(), name: 'Amazon', url: 'https://amazon.com', category: 'General' },
      { id: uid(), name: 'LinkedIn', url: 'https://linkedin.com', category: 'General' },
    ],
    todos: [
      { id: uid(), text: 'Terminar las tareas de hoy', done: false },
      { id: uid(), text: 'Llamar a la familia', done: false },
    ],
    widgets: defaultWidgets(),
    settings: {
      theme: 'aurora',
      accent: '#f4a54b',
      cardStyle: 'glass',      // 'glass' | 'solid' | 'minimal'
      layout: 'lateral',       // 'lateral' | 'superior' | 'oculto'
      overlayDim: 40,          // 0-80
      bgBlur: 0,               // 0-15 px
      showClock: true,
      showWeather: true,
      showQuote: true,
      showTodo: true,
      showCalendars: true,
      showFocus: true,
      showNotes: true,
      showHabits: true,
      showTimeProgress: true,
      clockFormat: '24',       // '24' | '12'
      showSeconds: false,
      tempUnit: 'C',           // 'C' | 'F'
      searchEngine: 'google',  // 'google' | 'bing' | 'duckduckgo' | 'ecosia'
      greetingName: '',
      videoMuted: true,
      videoVolume: 50,
      videoFit: 'cover',       // 'cover' | 'contain' | 'fill'
      videoFillColor: '#24170e',
      shortcutView: 'cuadricula',
      shortcutStyle: 'glass',
      shortcutMotion: 'suave',
      shortcutLabels: true,
      listRows: 8,
      dockPosition: 'derecha', // 'derecha' | 'izquierda' | 'arriba' | 'abajo' | 'oculta'
      trackPages: false,
    },
  };
}

let state = null;
let lastWeatherData = null;

function removeAllCategory() {
  const previous = Array.isArray(state.categories) ? state.categories : [];
  state.categories = previous.filter((category) => typeof category === 'string' && category !== 'Todos');
  if (!state.categories.length) state.categories = ['General'];
  const changed = state.categories.length !== previous.length || !state.categories.includes(state.activeCategory);
  if (!state.categories.includes(state.activeCategory)) {
    state.activeCategory = state.categories.includes('General') ? 'General' : state.categories[0];
  }
  if (Array.isArray(state.shortcuts)) {
    state.shortcuts.forEach((shortcut) => {
      if (shortcut.category === 'Todos') shortcut.category = state.activeCategory;
    });
  }
  return changed;
}

async function loadState() {
  const saved = await storageGet(STORAGE_KEY);
  const defaults = defaultState();
  state = saved ? { ...defaults, ...saved, settings: { ...defaults.settings, ...(saved.settings || {}) },
    media: normalizeMediaState(saved.media, saved.background), widgets: normalizeWidgets(saved.widgets) } : defaults;
  const migrated = removeAllCategory();
  const invalidTheme = !COLOR_THEMES.includes(state.settings.theme);
  if (invalidTheme) state.settings.theme = defaults.settings.theme;
  const invalidShortcutStyle = !SHORTCUT_STYLES.includes(state.settings.shortcutStyle);
  const invalidShortcutView = !SHORTCUT_VIEWS.includes(state.settings.shortcutView);
  const invalidShortcutMotion = !SHORTCUT_MOTIONS.includes(state.settings.shortcutMotion);
  if (invalidShortcutStyle) state.settings.shortcutStyle = defaults.settings.shortcutStyle;
  if (invalidShortcutView) state.settings.shortcutView = defaults.settings.shortcutView;
  if (invalidShortcutMotion) state.settings.shortcutMotion = defaults.settings.shortcutMotion;
  if (!saved || migrated || invalidTheme || invalidShortcutStyle || invalidShortcutView || invalidShortcutMotion) persist();
}

function persist() { return storageSet(STORAGE_KEY, state); }

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
    focus.endsAt = 0;
    focus.remaining = 0;
    if (focus.duration !== 300) focus.completed += 1;
    changed = true;
  }
  if (changed) persist();
  renderFocus();
  if (document.getElementById('habits-list').dataset.day !== day) renderHabits();
  renderTimePerspective();
}

function renderFocus() {
  const focus = state.widgets.focus;
  const seconds = focusSecondsLeft();
  const running = focus.endsAt > 0;
  const isBreak = focus.duration === 300;
  document.getElementById('focus-time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  document.getElementById('focus-kind').textContent = isBreak ? 'Descanso' : 'Enfoque';
  document.getElementById('focus-sessions').textContent = `${focus.completed} hoy`;
  document.getElementById('focus-toggle').textContent = running ? 'Pausar' : seconds === 0 ? 'Otra vez' : seconds < focus.duration ? 'Continuar' : 'Comenzar';
  document.querySelectorAll('[data-focus-minutes]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.focusMinutes) * 60 === focus.duration));
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
      persist();
      renderHabits();
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
    Object.assign(state.widgets.focus, { duration, remaining: duration, endsAt: 0 });
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
    state.widgets.habits.push({ id: uid(), name, completedOn: '' });
    input.value = '';
    persist();
    renderHabits();
  });
  // Mantiene los widgets al día al trabajar con varias pestañas de Aurora.
  const syncWidgets = (saved) => {
    if (!saved) return;
    state.widgets = normalizeWidgets(saved.widgets);
    renderNotes();
    renderHabits();
    tickPersonalWidgets();
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

/* ---------------------------------- Reloj ---------------------------------- */

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  let suffix = '';
  if (state.settings.clockFormat === '12') {
    suffix = h >= 12 ? ' PM' : ' AM';
    h = h % 12; if (h === 0) h = 12;
  }
  const hh = state.settings.clockFormat === '12' ? String(h) : String(h).padStart(2, '0');
  let text = `${hh}:${m}`;
  if (state.settings.showSeconds) text += `:${s}`;
  text += suffix;
  document.getElementById('clock-time').textContent = text;
  const dateStr = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  document.getElementById('clock-date').textContent = dateStr;
}

/* ---------------------------------- Clima ----------------------------------- */

const WEATHER_CODES = {
  0: ['☀️', 'Despejado'], 1: ['🌤️', 'Mayormente despejado'], 2: ['⛅', 'Parcialmente nublado'],
  3: ['☁️', 'Nublado'], 45: ['🌫️', 'Niebla'], 48: ['🌫️', 'Niebla helada'],
  51: ['🌦️', 'Llovizna ligera'], 53: ['🌦️', 'Llovizna'], 55: ['🌧️', 'Llovizna intensa'],
  56: ['🌧️', 'Llovizna helada'], 57: ['🌧️', 'Llovizna helada intensa'],
  61: ['🌧️', 'Lluvia ligera'], 63: ['🌧️', 'Lluvia'], 65: ['🌧️', 'Lluvia intensa'],
  66: ['🌧️', 'Lluvia helada'], 67: ['🌧️', 'Lluvia helada intensa'],
  71: ['🌨️', 'Nieve ligera'], 73: ['🌨️', 'Nieve'], 75: ['❄️', 'Nieve intensa'], 77: ['🌨️', 'Granizo fino'],
  80: ['🌦️', 'Chubascos ligeros'], 81: ['🌧️', 'Chubascos'], 82: ['⛈️', 'Chubascos fuertes'],
  85: ['🌨️', 'Chubascos de nieve'], 86: ['❄️', 'Chubascos de nieve intensos'],
  95: ['⛈️', 'Tormenta'], 96: ['⛈️', 'Tormenta con granizo'], 99: ['⛈️', 'Tormenta con granizo fuerte'],
};

function initWeather() {
  const loadingEl = document.getElementById('weather-loading');
  const retryBtn = document.getElementById('weather-retry');
  retryBtn.hidden = true;
  loadingEl.hidden = false;
  loadingEl.textContent = 'Buscando tu ubicación…';
  document.getElementById('weather-body').hidden = true;

  if (!navigator.geolocation) {
    loadingEl.textContent = 'Tu navegador no permite ver la ubicación.';
    return;
  }
  navigator.geolocation.getCurrentPosition(onLocationOk, onLocationFail, { timeout: 8000 });
}

async function onLocationOk(pos) {
  const { latitude, longitude } = pos.coords;
  try {
    const [weatherRes, placeRes] = await Promise.allSettled([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure&timezone=auto`).then(r => r.json()),
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`).then(r => r.json()),
    ]);

    if (weatherRes.status !== 'fulfilled') throw new Error('weather failed');
    const cur = weatherRes.value.current;
    const [icon, label] = WEATHER_CODES[cur.weather_code] || ['🌡️', 'Sin datos'];
    const place = placeRes.status === 'fulfilled'
      ? (placeRes.value.city || placeRes.value.locality || placeRes.value.principalSubdivision || 'Tu ubicación')
      : 'Tu ubicación';

    lastWeatherData = { icon, label, place, humidity: Math.round(cur.relative_humidity_2m), tempC: cur.temperature_2m };

    document.getElementById('weather-loading').hidden = true;
    document.getElementById('weather-retry').hidden = true;
    document.getElementById('weather-body').hidden = false;
    renderWeatherUI();
  } catch (e) {
    onWeatherError('No se pudo cargar el clima.');
  }
}

function renderWeatherUI() {
  if (!lastWeatherData) return;
  document.getElementById('weather-icon').textContent = lastWeatherData.icon;
  document.getElementById('weather-place').textContent = lastWeatherData.place;
  document.getElementById('weather-desc').textContent = lastWeatherData.label;
  document.getElementById('weather-extra').textContent = `Humedad: ${lastWeatherData.humidity}%`;
  const unit = state.settings.tempUnit;
  const tempVal = unit === 'F' ? (lastWeatherData.tempC * 9 / 5 + 32) : lastWeatherData.tempC;
  document.getElementById('weather-temp').textContent = `${Math.round(tempVal)}°${unit}`;
}

function onLocationFail() {
  onWeatherError('Activa la ubicación para ver el clima.');
}

function onWeatherError(msg) {
  const loadingEl = document.getElementById('weather-loading');
  loadingEl.hidden = false;
  loadingEl.textContent = msg;
  document.getElementById('weather-body').hidden = true;
  document.getElementById('weather-retry').hidden = false;
}

/* ---------------------------------- Frase ----------------------------------- */

const QUOTES = [
  ['Haz siempre lo que temes hacer.', 'Ralph Waldo Emerson'],
  ['La vida es lo que pasa mientras hacemos otros planes.', 'John Lennon'],
  ['El único modo de hacer un gran trabajo es amar lo que haces.', 'Steve Jobs'],
  ['No cuentes los días, haz que los días cuenten.', 'Muhammad Ali'],
  ['La mejor forma de predecir el futuro es crearlo.', 'Peter Drucker'],
  ['Cae siete veces, levántate ocho.', 'Proverbio japonés'],
  ['Quien tiene un porqué puede soportar casi cualquier cómo.', 'Friedrich Nietzsche'],
  ['Empieza donde estás, usa lo que tienes, haz lo que puedas.', 'Arthur Ashe'],
  ['La paciencia es amarga, pero su fruto es dulce.', 'Aristóteles'],
  ['No hay viento favorable para quien no sabe a dónde va.', 'Séneca'],
  ['Un viaje de mil millas comienza con un solo paso.', 'Lao Tzu'],
  ['La simplicidad es la máxima sofisticación.', 'Leonardo da Vinci'],
  ['El éxito es la suma de pequeños esfuerzos repetidos.', 'Robert Collier'],
  ['Hazlo con miedo, pero hazlo.', 'Anónimo'],
];

function showQuoteOfTheDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  const [text, author] = QUOTES[dayOfYear % QUOTES.length];
  document.getElementById('quote-text').textContent = `“${text}”`;
  document.getElementById('quote-author').textContent = `— ${author}`;
}

/* ---------------------------------- Saludo ----------------------------------- */

function updateGreeting() {
  const el = document.getElementById('clock-greeting');
  const name = (state.settings.greetingName || '').trim();
  if (name) { el.hidden = false; el.textContent = `Hola, ${name} 👋`; }
  else { el.hidden = true; }
}

/* ----------------------------------- Notas ----------------------------------- */

function renderTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  const remaining = state.todos.filter((todo) => !todo.done).length;
  document.getElementById('todo-count').textContent = `${remaining} pendiente${remaining === 1 ? '' : 's'}`;
  document.getElementById('todo-clear').hidden = remaining === state.todos.length;
  if (!state.todos.length) {
    const empty = document.createElement('li');
    empty.className = 'todo-empty';
    empty.textContent = 'Nada pendiente por ahora.';
    list.appendChild(empty);
  }
  state.todos.forEach((todo) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');

    const check = document.createElement('button');
    check.className = 'todo-check' + (todo.done ? ' done' : '');
    check.type = 'button';
    check.setAttribute('aria-label', todo.done ? `Marcar «${todo.text}» como pendiente` : `Completar «${todo.text}»`);
    check.textContent = todo.done ? '✓' : '';
    check.addEventListener('click', () => {
      todo.done = !todo.done;
      persist();
      renderTodos();
    });

    const span = document.createElement('span');
    span.className = 'txt';
    span.textContent = todo.text;

    const remove = document.createElement('button');
    remove.className = 'todo-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Eliminar tarea');
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
      state.todos = state.todos.filter((t) => t.id !== todo.id);
      persist();
      renderTodos();
    });

    li.append(check, span, remove);
    list.appendChild(li);
  });
}

function setupTodos() {
  document.getElementById('todo-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    state.todos.push({ id: uid(), text, done: false });
    input.value = '';
    persist();
    renderTodos();
  });
  document.getElementById('todo-clear').addEventListener('click', () => {
    state.todos = state.todos.filter((todo) => !todo.done);
    persist();
    renderTodos();
  });
}

/* -------------------------------- Categorías --------------------------------- */

let categoryToRename = null;
let contextFocusTarget = null;
function openRenameCategory(category) {
  categoryToRename = category;
  document.getElementById('rename-category-name').value = category;
  document.getElementById('rename-category-status').textContent = '';
  openModal('rename-category-modal');
  document.getElementById('rename-category-name').select();
}

function closeContextMenu() {
  const menu = document.getElementById('aurora-context-menu');
  if (menu.contains(document.activeElement) && contextFocusTarget?.isConnected) contextFocusTarget.focus();
  menu.hidden = true;
}

function openContextMenu(x, y, kind, id) {
  const menu = document.getElementById('aurora-context-menu');
  contextFocusTarget = document.activeElement;
  menu.replaceChildren();
  const add = (label, action) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    item.addEventListener('click', () => { closeContextMenu(); action(); });
    menu.appendChild(item);
  };
  if (kind === 'category') add('Cambiar nombre', () => openRenameCategory(id));
  if (kind === 'category' || kind === 'page') add('Nueva categoría', () => openModal('category-modal'));
  if (kind === 'shortcut') {
    const shortcut = state.shortcuts.find((item) => item.id === id);
    if (shortcut) {
      add('Abrir en nueva pestaña', () => openNewTab(shortcut.url));
      add('Mover a otra categoría', () => openMoveShortcutModal(shortcut));
      add('Eliminar acceso', () => {
        state.shortcuts = state.shortcuts.filter((item) => item.id !== id);
        persist();
        renderShortcuts();
      });
    }
  }
  if (kind === 'page') {
    add('Nuevo acceso directo', openShortcutModal);
    add('Ajustes', openSettings);
  }
  menu.hidden = false;
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
  menu.querySelector('button')?.focus();
}

function setupContextMenu() {
  document.addEventListener('contextmenu', (event) => {
    if (event.defaultPrevented || event.target.closest('.modal-overlay, #aurora-context-menu, input, textarea, select, video')) return;
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY, 'page');
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('#aurora-context-menu')) closeContextMenu();
  });
  document.addEventListener('keydown', (event) => {
    const menu = document.getElementById('aurora-context-menu');
    if (menu.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeContextMenu(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...menu.querySelectorAll('button')];
      const next = (items.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      items[next].focus();
    }
  });
  window.addEventListener('resize', closeContextMenu);
  document.addEventListener('scroll', closeContextMenu, true);
}

function renderCategories() {
  const nav = document.getElementById('category-tabs');
  nav.innerHTML = '';
  state.categories.forEach((cat) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cat-chip' + (cat === state.activeCategory ? ' active' : '');
    chip.textContent = cat;
    chip.setAttribute('aria-pressed', String(cat === state.activeCategory));
    chip.title = `Suelta aquí un acceso para moverlo a ${cat}`;
    chip.addEventListener('dragover', (event) => {
      if (!draggedShortcutId) return;
      event.preventDefault();
      chip.classList.add('drop-target');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drop-target'));
    chip.addEventListener('drop', (event) => {
      event.preventDefault();
      chip.classList.remove('drop-target');
      const shortcut = state.shortcuts.find((item) => item.id === draggedShortcutId);
      if (!shortcut) return;
      finishShortcutDrag();
      shortcut.category = cat;
      state.shortcuts = state.shortcuts.filter((item) => item.id !== shortcut.id);
      state.shortcuts.push(shortcut);
      state.activeCategory = cat;
      persist();
      renderCategories();
      renderShortcuts();
    });
    chip.addEventListener('click', () => {
      state.activeCategory = cat;
      persist();
      renderCategories();
      renderShortcuts();
    });
    chip.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openContextMenu(event.clientX, event.clientY, 'category', cat);
    });
    chip.addEventListener('keydown', (event) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        const rect = chip.getBoundingClientRect();
        openContextMenu(rect.left, rect.bottom, 'category', cat);
      }
    });
    nav.appendChild(chip);
  });
  const addChip = document.createElement('button');
  addChip.type = 'button';
  addChip.className = 'cat-chip add-chip';
  addChip.textContent = '+ Categoría';
  addChip.addEventListener('click', () => openModal('category-modal'));
  nav.appendChild(addChip);
}

/* -------------------------------- Accesos directos ---------------------------------- */

let draggedShortcutId = null;
let suppressShortcutClick = false;
let shortcutToMoveId = null;
let renderedCategory = null;

function finishShortcutDrag() {
  draggedShortcutId = null;
  suppressShortcutClick = true;
  document.body.classList.remove('shortcut-drag-active');
  document.querySelectorAll('.drop-target, .drop-after, .dragging').forEach((item) => item.classList.remove('drop-target', 'drop-after', 'dragging'));
  setTimeout(() => { suppressShortcutClick = false; }, 0);
}

function openMoveShortcutModal(shortcut) {
  shortcutToMoveId = shortcut.id;
  const select = document.getElementById('move-shortcut-category');
  select.replaceChildren();
  state.categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  select.value = shortcut.category;
  openModal('move-shortcut-modal');
}

function reorderShortcut(draggedId, targetId, after = false) {
  if (draggedId === targetId) return;
  const from = state.shortcuts.findIndex((item) => item.id === draggedId);
  if (from < 0) return;
  const [shortcut] = state.shortcuts.splice(from, 1);
  const to = state.shortcuts.findIndex((item) => item.id === targetId);
  if (to < 0) { state.shortcuts.splice(from, 0, shortcut); return; }
  state.shortcuts.splice(to + Number(after), 0, shortcut);
  persist();
  renderShortcuts();
}

function moveShortcutByKeyboard(id, direction) {
  const visible = state.shortcuts.filter((item) => item.category === state.activeCategory);
  const position = visible.findIndex((item) => item.id === id);
  const target = visible[position + direction];
  if (!target) return;
  reorderShortcut(id, target.id, direction > 0);
  document.querySelector(`[data-shortcut-id="${CSS.escape(id)}"]`)?.focus();
}

function applyShortcutView() {
  const grid = document.getElementById('shortcuts-grid');
  grid.dataset.view = state.settings.shortcutView;
  grid.dataset.style = SHORTCUT_STYLES.includes(state.settings.shortcutStyle) ? state.settings.shortcutStyle : 'glass';
  grid.dataset.motion = SHORTCUT_MOTIONS.includes(state.settings.shortcutMotion) ? state.settings.shortcutMotion : 'suave';
  if (grid.dataset.motion === 'ninguna') grid.classList.remove('category-enter', 'view-change');
  grid.classList.toggle('hide-labels', !state.settings.shortcutLabels);
  grid.style.setProperty('--list-rows', state.settings.listRows);
}

function animateShortcutView() {
  const grid = document.getElementById('shortcuts-grid');
  if (state.settings.shortcutMotion === 'ninguna' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  grid.classList.remove('view-change');
  void grid.offsetWidth;
  grid.classList.add('view-change');
  grid.addEventListener('animationend', () => grid.classList.remove('view-change'), { once: true });
}

function renderShortcuts() {
  const grid = document.getElementById('shortcuts-grid');
  grid.innerHTML = '';
  grid.classList.remove('category-enter', 'view-change');
  applyShortcutView();

  const visible = state.shortcuts.filter((s) => s.category === state.activeCategory);

  if (renderedCategory !== state.activeCategory && state.settings.shortcutMotion !== 'ninguna' &&
      !document.documentElement.classList.contains('is-booting') &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    void grid.offsetWidth;
    grid.classList.add('category-enter');
  }
  renderedCategory = state.activeCategory;

  visible.forEach((sc) => {
    const el = document.createElement('div');
    el.className = 'shortcut';
    el.tabIndex = 0;
    el.setAttribute('role', 'link');
    el.setAttribute('aria-label', `Abrir ${sc.name}`);
    el.dataset.shortcutId = sc.id;
    el.draggable = true;
    el.title = 'Arrastra para ordenar o mover de categoría. Alt + flechas para ordenar con teclado.';
    el.addEventListener('dragstart', (event) => {
      draggedShortcutId = sc.id;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', sc.id);
      el.classList.add('dragging');
      document.body.classList.add('shortcut-drag-active');
    });
    el.addEventListener('dragend', finishShortcutDrag);
    el.addEventListener('dragover', (event) => {
      if (!draggedShortcutId || draggedShortcutId === sc.id) return;
      event.preventDefault();
      el.classList.add('drop-target');
      el.classList.toggle('drop-after', state.settings.shortcutView === 'lista'
        ? event.clientY > el.getBoundingClientRect().top + el.offsetHeight / 2
        : event.clientX > el.getBoundingClientRect().left + el.offsetWidth / 2);
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target', 'drop-after'));
    el.addEventListener('drop', (event) => {
      event.preventDefault();
      el.classList.remove('drop-target', 'drop-after');
      if (!draggedShortcutId) return;
      const bounds = el.getBoundingClientRect();
      const after = state.settings.shortcutView === 'lista'
        ? event.clientY > bounds.top + bounds.height / 2
        : event.clientX > bounds.left + bounds.width / 2;
      const draggedId = draggedShortcutId;
      finishShortcutDrag();
      reorderShortcut(draggedId, sc.id, after);
    });

    const iconWrap = document.createElement('div');
    iconWrap.className = 'shortcut-icon';
    const img = document.createElement('img');
    setShortcutIcon(img, iconWrap, sc.url, sc.name);

    const remove = document.createElement('button');
    remove.className = 'shortcut-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Eliminar acceso');
    remove.textContent = '✕';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      state.shortcuts = state.shortcuts.filter((s) => s.id !== sc.id);
      persist();
      renderShortcuts();
    });

    const move = document.createElement('button');
    move.className = 'shortcut-move';
    move.type = 'button';
    move.setAttribute('aria-label', `Mover ${sc.name} a otra categoría`);
    move.textContent = '↗';
    move.addEventListener('click', (event) => {
      event.stopPropagation();
      openMoveShortcutModal(sc);
    });

    const label = document.createElement('div');
    label.className = 'shortcut-label';
    label.textContent = sc.name;

    el.append(iconWrap, move, remove, label);
    el.addEventListener('click', () => { if (!suppressShortcutClick) openNewTab(sc.url); });
    el.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openContextMenu(event.clientX, event.clientY, 'shortcut', sc.id);
    });
    el.addEventListener('keydown', (event) => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        const rect = el.getBoundingClientRect();
        openContextMenu(rect.left, rect.bottom, 'shortcut', sc.id);
        return;
      }
      if (event.altKey && ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        moveShortcutByKeyboard(sc.id, ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1);
        return;
      }
      if (event.target !== el || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      openNewTab(sc.url);
    });
    grid.appendChild(el);
  });

  const addTile = document.createElement('button');
  addTile.className = 'shortcut add-shortcut';
  addTile.type = 'button';
  addTile.setAttribute('aria-label', 'Añadir acceso directo');
  const addIcon = document.createElement('div');
  addIcon.className = 'shortcut-icon';
  addIcon.textContent = '+';
  const addLabel = document.createElement('div');
  addLabel.className = 'shortcut-label';
  addLabel.textContent = 'Añadir';
  addTile.append(addIcon, addLabel);
  addTile.addEventListener('click', openShortcutModal);
  grid.appendChild(addTile);
}

function openShortcutModal() {
  const select = document.getElementById('shortcut-category');
  select.innerHTML = '';
  state.categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    select.appendChild(opt);
  });
  select.value = state.activeCategory;
  document.getElementById('shortcut-name').value = '';
  document.getElementById('shortcut-url').value = '';
  openModal('shortcut-modal');
}

/* ----------------------------------- Fondo ------------------------------------ */

function mediaName(value, fallback) {
  if (value.startsWith('data:')) return fallback;
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname).slice(0, 80);
  } catch (error) { return fallback; }
}

function addMedia(type, value, name) {
  if (!validMediaValue(type, value)) {
    mediaStatus(type, 'Usa una URL http(s) válida o un archivo compatible.');
    return;
  }
  const entries = state.media.library[type];
  let entry = entries.find((item) => item.value === value);
  if (!entry) {
    entry = { id: uid(), name: String(name || mediaName(value, type === 'image' ? 'Imagen' : 'Video')).slice(0, 100), value };
    entries.push(entry);
    state.media.playlists[type].ids.push(entry.id);
  }
  chooseMedia(type, entry);
  renderMediaLibrary(type);
  mediaStatus(type, 'Guardado en tu galería.');
}

function chooseMedia(type, entry) {
  const playlist = state.media.playlists[type];
  playlist.baseId = entry.id;
  playlist.startedAt = Date.now();
  applyBackground({ type, value: entry.value });
}

function mediaStatus(type, message) {
  document.getElementById(`${type}-library`).querySelector('.media-status').textContent = message;
}

let mediaViewerType = null;
let mediaViewerIndex = 0;
function showMediaViewerEntry() {
  const entries = state.media.library[mediaViewerType];
  const entry = entries[mediaViewerIndex];
  if (!entry) { closeModal('media-viewer-modal'); return; }
  document.getElementById('media-viewer-name').textContent = entry.name;
  document.getElementById('media-viewer-index').textContent = `${mediaViewerIndex + 1} de ${entries.length}`;
  const stage = document.getElementById('media-viewer-stage');
  stage.replaceChildren();
  const media = document.createElement(mediaViewerType === 'image' ? 'img' : 'video');
  media.src = entry.value;
  if (mediaViewerType === 'image') media.alt = entry.name;
  else { media.controls = true; media.playsInline = true; media.autoplay = true; }
  stage.appendChild(media);
  document.getElementById('media-viewer-prev').disabled = mediaViewerIndex === 0;
  document.getElementById('media-viewer-next').disabled = mediaViewerIndex === entries.length - 1;
}

function openMediaViewer(type, id) {
  const index = state.media.library[type].findIndex((entry) => entry.id === id);
  if (index < 0) return;
  mediaViewerType = type;
  mediaViewerIndex = index;
  showMediaViewerEntry();
  openModal('media-viewer-modal');
}

function rotateBackground() {
  const type = state.background.type;
  if (!['image', 'video'].includes(type)) return;
  const playlist = state.media.playlists[type];
  if (!playlist.enabled || playlist.ids.length < 2) return;
  const duration = playlist.every * { minutes: 60000, hours: 3600000, days: 86400000 }[playlist.unit];
  const start = Math.max(0, playlist.ids.indexOf(playlist.baseId));
  const steps = Math.floor(Math.max(0, Date.now() - playlist.startedAt) / duration);
  const id = playlist.ids[(start + steps) % playlist.ids.length];
  const entry = state.media.library[type].find((item) => item.id === id);
  if (entry && state.background.value !== entry.value) {
    applyBackground({ type, value: entry.value });
    return true;
  }
  return false;
}

function renderMediaLibrary(type) {
  const root = document.getElementById(`${type}-library`);
  const entries = state.media.library[type];
  const playlist = state.media.playlists[type];
  root.replaceChildren();

  const heading = document.createElement('div');
  heading.className = 'media-heading';
  const title = document.createElement('strong');
  title.textContent = `Mi galería de ${type === 'image' ? 'imágenes' : 'videos'}`;
  const count = document.createElement('span');
  count.textContent = `${entries.length} guardado${entries.length === 1 ? '' : 's'}`;
  heading.append(title, count);
  root.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'settings-hint';
  hint.textContent = entries.length ? 'Marca los fondos de la secuencia y cambia su orden con las flechas.' : 'Añade una URL o un archivo para empezar tu galería.';
  root.appendChild(hint);

  const list = document.createElement('div');
  list.className = 'media-items';
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = 'media-item';
    row.dataset.entryId = entry.id;
    if (state.background.type === type && state.background.value === entry.value) row.classList.add('current');
    const preview = document.createElement('div');
    preview.className = 'media-preview';
    const thumb = document.createElement(type === 'image' ? 'img' : 'video');
    thumb.className = 'media-thumb';
    const previewStatus = document.createElement('span');
    previewStatus.className = 'media-preview-status';
    previewStatus.textContent = 'Cargando vista previa…';
    const ready = () => { previewStatus.hidden = true; };
    const failed = () => { previewStatus.textContent = 'Vista previa no disponible'; };
    if (type === 'image') {
      thumb.src = entry.value;
      thumb.alt = `Vista previa de ${entry.name}`;
      thumb.loading = 'lazy';
      thumb.addEventListener('load', ready);
      thumb.addEventListener('error', failed);
    } else {
      thumb.src = entry.value;
      thumb.preload = 'metadata';
      thumb.controls = true;
      thumb.muted = true;
      thumb.playsInline = true;
      thumb.setAttribute('aria-label', `Vista previa de ${entry.name}`);
      thumb.addEventListener('loadedmetadata', () => {
        if (thumb.duration > 0.2) thumb.currentTime = 0.1;
      });
      thumb.addEventListener('loadeddata', ready);
      thumb.addEventListener('error', failed);
    }
    preview.append(thumb, previewStatus);
    const checkLabel = document.createElement('label');
    checkLabel.className = 'media-check';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = playlist.ids.includes(entry.id);
    check.setAttribute('aria-label', `Incluir ${entry.name} en la secuencia`);
    check.addEventListener('change', () => {
      playlist.ids = playlist.ids.filter((id) => id !== entry.id);
      if (check.checked) playlist.ids.push(entry.id);
      if (playlist.ids.length < 2) playlist.enabled = false;
      playlist.startedAt = Date.now();
      playlist.baseId = playlist.ids[0];
      persist();
      renderMediaLibrary(type);
      root.querySelector(`[data-entry-id="${CSS.escape(entry.id)}"] input`)?.focus();
    });
    const sequenceLabel = document.createElement('span');
    sequenceLabel.textContent = 'Secuencia';
    checkLabel.append(check, sequenceLabel);
    preview.appendChild(checkLabel);
    const caption = document.createElement('div');
    caption.className = 'media-caption';
    const name = document.createElement('strong');
    name.className = 'media-name';
    name.textContent = entry.name;
    name.title = entry.name;
    caption.appendChild(name);
    if (row.classList.contains('current')) {
      const badge = document.createElement('span');
      badge.className = 'media-current-badge';
      badge.textContent = 'En uso';
      caption.appendChild(badge);
    }
    const actions = document.createElement('div');
    actions.className = 'media-actions';
    const button = (label, text, action, disabled = false) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'media-action';
      element.dataset.action = label;
      element.textContent = text;
      element.title = label;
      element.setAttribute('aria-label', `${label}: ${entry.name}`);
      element.disabled = disabled;
      element.addEventListener('click', action);
      actions.appendChild(element);
    };
    button('Ver en grande', 'Ver', () => openMediaViewer(type, entry.id));
    button('Usar como fondo', 'Usar', () => {
      chooseMedia(type, entry);
      renderMediaLibrary(type);
      root.querySelector(`[data-entry-id="${CSS.escape(entry.id)}"] [data-action="Usar como fondo"]`)?.focus();
    });
    const position = playlist.ids.indexOf(entry.id);
    for (const [direction, symbol, label] of [[-1, '↑', 'Subir'], [1, '↓', 'Bajar']]) {
      button(label, symbol, () => {
        const next = position + direction;
        [playlist.ids[position], playlist.ids[next]] = [playlist.ids[next], playlist.ids[position]];
        playlist.startedAt = Date.now();
        persist();
        renderMediaLibrary(type);
        root.querySelector(`[data-entry-id="${CSS.escape(entry.id)}"] button`)?.focus();
      }, position < 0 || position + direction < 0 || position + direction >= playlist.ids.length);
    }
    button('Quitar de galería', 'Quitar', () => {
      state.media.library[type] = entries.filter((item) => item.id !== entry.id);
      playlist.ids = playlist.ids.filter((id) => id !== entry.id);
      if (playlist.ids.length < 2) playlist.enabled = false;
      if (playlist.baseId === entry.id) playlist.baseId = playlist.ids[0];
      playlist.startedAt = Date.now();
      if (state.background.type === type && state.background.value === entry.value) {
        const next = state.media.library[type][0];
        applyBackground(next ? { type, value: next.value } : { type: 'gradient', value: '' });
      } else persist();
      renderMediaLibrary(type);
      root.querySelector('.media-item input, .media-playlist input:not(:disabled)')?.focus();
    });
    row.append(preview, caption, actions);
    list.appendChild(row);
  }
  root.appendChild(list);

  const controls = document.createElement('div');
  controls.className = 'media-playlist';
  const toggle = document.createElement('label');
  toggle.className = 'switch-row';
  const caption = document.createElement('span');
  caption.textContent = 'Rotar esta secuencia';
  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  enabled.checked = playlist.enabled;
  enabled.disabled = playlist.ids.length < 2;
  enabled.addEventListener('change', () => {
    playlist.enabled = enabled.checked;
    playlist.startedAt = Date.now();
    playlist.baseId = state.media.library[type].find((item) => item.value === state.background.value)?.id || playlist.ids[0];
    persist();
    rotateBackground();
  });
  toggle.append(caption, enabled);
  controls.appendChild(toggle);
  const interval = document.createElement('div');
  interval.className = 'media-interval';
  const everyLabel = document.createElement('label');
  everyLabel.textContent = 'Cada';
  const every = document.createElement('input');
  every.type = 'number';
  every.min = '1';
  every.max = '365';
  every.value = playlist.every;
  every.addEventListener('change', () => {
    const value = Number(every.value);
    playlist.every = Number.isInteger(value) ? Math.min(365, Math.max(1, value)) : 1;
    every.value = playlist.every;
    playlist.startedAt = Date.now();
    persist();
  });
  everyLabel.appendChild(every);
  const unit = document.createElement('select');
  unit.setAttribute('aria-label', 'Unidad del intervalo de rotación');
  for (const [value, label] of [['minutes', 'minutos'], ['hours', 'horas'], ['days', 'días']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; unit.appendChild(option);
  }
  unit.value = playlist.unit;
  unit.addEventListener('change', () => { playlist.unit = unit.value; playlist.startedAt = Date.now(); persist(); });
  interval.append(everyLabel, unit);
  controls.appendChild(interval);
  root.appendChild(controls);
  const status = document.createElement('p');
  status.className = 'media-status';
  status.setAttribute('role', 'status');
  root.appendChild(status);
}

let backgroundLoadToken = 0;

function backgroundSignature(bg) {
  const value = typeof bg.value === 'string' ? bg.value : '';
  return value.startsWith('data:')
    ? `${bg.type}:${value.length}:${value.slice(0, 96)}:${value.slice(-96)}`
    : `${bg.type}:${value}`;
}

function cacheBackgroundPreview(bg, element) {
  if (typeof bg.value !== 'string') return;
  const signature = backgroundSignature(bg);
  if (bg.type === 'video' && !bg.value.startsWith('data:')) return;
  try {
    const cached = JSON.parse(localStorage.getItem(BOOT_PREVIEW_KEY) || 'null');
    const preview = cached?.preview;
    if (cached?.signature === signature && typeof preview === 'string' && preview.length <= 300000 &&
        (/^data:image\/(?:jpeg|webp);base64,/i.test(preview) || /^https?:\/\//i.test(preview))) return;
  } catch (error) { /* Se regenerará la vista previa. */ }
  setTimeout(() => {
    if (backgroundSignature(state.background) !== signature) return;
    try {
      let preview = bg.value;
      if (preview.startsWith('data:') || bg.type === 'video') {
        const width = element.videoWidth || element.naturalWidth;
        const height = element.videoHeight || element.naturalHeight;
        if (!width || !height) return;
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(640, width);
        canvas.height = Math.max(1, Math.round(canvas.width * height / width));
        canvas.getContext('2d').drawImage(element, 0, 0, canvas.width, canvas.height);
        preview = canvas.toDataURL('image/jpeg', 0.65);
      }
      if (preview.length <= 300000) {
        localStorage.setItem(BOOT_PREVIEW_KEY, JSON.stringify({ signature, preview }));
      }
    } catch (error) { /* Vista previa opcional: puede fallar por CORS o cuota. */ }
  }, 150);
}

function applyBackground(bg, doPersist = true) {
  state.background = bg;
  const gradientEl = document.getElementById('bg-gradient');
  const imageEl = document.getElementById('bg-image');
  const videoEl = document.getElementById('bg-video');
  const bootPreview = document.getElementById('boot-preview');
  const loadToken = ++backgroundLoadToken;

  try {
    const cached = JSON.parse(localStorage.getItem(BOOT_PREVIEW_KEY) || 'null');
    if (cached?.signature !== backgroundSignature(bg)) {
      localStorage.removeItem(BOOT_PREVIEW_KEY);
      bootPreview.style.backgroundImage = 'none';
    }
  } catch (error) { bootPreview.style.backgroundImage = 'none'; }
  bootPreview.hidden = bg.type === 'gradient';
  imageEl.onload = imageEl.onerror = null;
  videoEl.onloadeddata = videoEl.onerror = null;

  gradientEl.style.display = 'none';
  imageEl.hidden = true;
  videoEl.hidden = true;
  videoEl.pause();
  if (bg.type !== 'image') imageEl.removeAttribute('src');
  if (bg.type !== 'video') videoEl.removeAttribute('src');

  if (bg.type === 'image' && bg.value) {
    imageEl.onload = async () => {
      try { await imageEl.decode(); } catch (error) { /* El evento load basta como respaldo. */ }
      if (loadToken !== backgroundLoadToken) return;
      bootPreview.hidden = true;
      cacheBackgroundPreview(bg, imageEl);
    };
    imageEl.onerror = () => { if (loadToken === backgroundLoadToken) bootPreview.hidden = true; };
    imageEl.src = bg.value;
    imageEl.hidden = false;
  } else if (bg.type === 'video' && bg.value) {
    videoEl.onloadeddata = () => {
      if (loadToken !== backgroundLoadToken) return;
      bootPreview.hidden = true;
      cacheBackgroundPreview(bg, videoEl);
    };
    videoEl.onerror = () => { if (loadToken === backgroundLoadToken) bootPreview.hidden = true; };
    videoEl.src = bg.value;
    videoEl.hidden = false;
    videoEl.play().catch(() => {});
  } else {
    gradientEl.style.display = 'block';
  }
  applyVideoAudioSettings();
  applyVideoFit();
  if (doPersist) persist();
}

function applyVideoFit() {
  const video = document.getElementById('bg-video');
  video.style.objectFit = state.settings.videoFit;
  document.getElementById('bg-layer').style.backgroundColor = state.settings.videoFillColor;
  applyBlur(state.settings.bgBlur);
}

function applyDim(percent) {
  document.documentElement.style.setProperty('--dim-alpha', (percent / 100).toFixed(2));
}

function applyBlur(px) {
  const filter = px > 0 ? `blur(${px}px)` : 'none';
  const scale = px > 0 ? `scale(${1 + px / 100})` : 'none';
  const img = document.getElementById('bg-image');
  const vid = document.getElementById('bg-video');
  img.style.filter = filter; img.style.transform = scale;
  vid.style.filter = filter;
  vid.style.transform = state.settings.videoFit === 'contain' ? 'none' : scale;
}

function setAccentColor(target, hex) {
  const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#f4a54b';
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  target.style.setProperty('--amber', color);
  target.style.setProperty('--accent-text', luminance > 0.179 ? '#000' : '#fff');
}

function applyAccentColor(hex) {
  setAccentColor(document.documentElement, hex);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = COLOR_THEMES.includes(theme) ? theme : 'aurora';
}

function applyCardStyle(style) {
  document.body.classList.remove('card-solid', 'card-minimal');
  if (style === 'solid') document.body.classList.add('card-solid');
  if (style === 'minimal') document.body.classList.add('card-minimal');
}

function applyLayout(layout) {
  document.body.classList.remove('layout-superior', 'layout-oculto');
  if (layout === 'superior') document.body.classList.add('layout-superior');
  if (layout === 'oculto') document.body.classList.add('layout-oculto');
}

function applyDockPosition(position) {
  const dock = document.querySelector('.side-dock');
  dock.dataset.position = ['derecha', 'izquierda', 'arriba', 'abajo', 'oculta'].includes(position) ? position : 'derecha';
}

function applyWidgetVisibility() {
  document.querySelector('.clock-card').style.display = state.settings.showClock ? '' : 'none';
  document.querySelector('.weather-card').style.display = state.settings.showWeather ? '' : 'none';
  document.querySelector('.quote-card').style.display = state.settings.showQuote ? '' : 'none';
  document.querySelector('.todo-card').style.display = state.settings.showTodo ? '' : 'none';
  [['focus-card', 'showFocus'], ['notes-card', 'showNotes'], ['habits-card', 'showHabits'], ['time-card', 'showTimeProgress']]
    .forEach(([className, key]) => { document.querySelector(`.${className}`).hidden = !state.settings[key]; });
  applyCalendarVisibility();
}

function applyVideoAudioSettings() {
  const video = document.getElementById('bg-video');
  video.muted = state.settings.videoMuted;
  video.volume = state.settings.videoVolume / 100;

  const checkbox = document.getElementById('video-sound-toggle');
  if (checkbox) checkbox.checked = !state.settings.videoMuted;
  const volumeSlider = document.getElementById('video-volume');
  if (volumeSlider) volumeSlider.value = state.settings.videoVolume;

  const muteBtn = document.getElementById('video-mute-btn');
  if (muteBtn) {
    muteBtn.hidden = state.background.type !== 'video';
    muteBtn.textContent = state.settings.videoMuted ? '🔇' : '🔊';
  }
}

/* ------------------------------- Panel de ajustes ------------------------------- */

function setSettingsSection(key) {
  document.querySelector('.settings-panel').classList.toggle('gallery-layout', key === 'fondo');
  document.querySelectorAll('.settings-nav-btn').forEach((b) => {
    const active = b.dataset.section === key;
    b.classList.toggle('active', active);
    b.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.querySelectorAll('.settings-section').forEach((s) => { s.hidden = s.id !== 'section-' + key; });
  document.querySelector('.settings-content').scrollTop = 0;
}

function showBgTypePanel(type) {
  const panels = { gradient: 'bg-panel-gradient', image: 'bg-panel-image', video: 'bg-panel-video' };
  Object.entries(panels).forEach(([key, id]) => { document.getElementById(id).hidden = key !== type; });
  document.querySelectorAll('.bg-type-btn').forEach((t) => {
    const active = t.dataset.type === type;
    t.classList.toggle('active', active);
    t.setAttribute('aria-pressed', String(active));
  });
}

function setGroupActive(containerId, dataAttr, value) {
  document.querySelectorAll(`#${containerId} button`).forEach((btn) => {
    const active = btn.dataset[dataAttr] === String(value);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function wireGroup(containerId, onSelect) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      onSelect(btn);
    });
  });
}

function syncSettingsFormFromState() {
  document.querySelector('.settings-panel').style.removeProperty('--amber');
  document.querySelector('.settings-panel').style.removeProperty('--accent-text');
  showBgTypePanel(state.background.type);
  document.getElementById('bg-image-url').value = (state.background.type === 'image' && !state.background.value.startsWith('data:')) ? state.background.value : '';
  document.getElementById('bg-video-url').value = (state.background.type === 'video' && !state.background.value.startsWith('data:')) ? state.background.value : '';
  document.getElementById('dim-range').value = state.settings.overlayDim;
  document.getElementById('blur-range').value = state.settings.bgBlur;
  document.getElementById('accent-color').value = state.settings.accent;
  setGroupActive('theme-group', 'theme', state.settings.theme);
  setGroupActive('card-style-group', 'style', state.settings.cardStyle);
  setGroupActive('shortcut-style-group', 'shortcutStyle', state.settings.shortcutStyle);
  setGroupActive('layout-group', 'layout', state.settings.layout);
  setGroupActive('dock-position-group', 'position', state.settings.dockPosition);
  document.getElementById('show-clock').checked = state.settings.showClock;
  document.getElementById('show-weather').checked = state.settings.showWeather;
  document.getElementById('show-quote').checked = state.settings.showQuote;
  document.getElementById('show-todo').checked = state.settings.showTodo;
  [['show-focus', 'showFocus'], ['show-notes', 'showNotes'], ['show-habits', 'showHabits'], ['show-time-progress', 'showTimeProgress']]
    .forEach(([id, key]) => { document.getElementById(id).checked = state.settings[key]; });
  syncCalendarSettings();
  setGroupActive('clock-format-group', 'format', state.settings.clockFormat);
  document.getElementById('show-seconds').checked = state.settings.showSeconds;
  setGroupActive('temp-unit-group', 'unit', state.settings.tempUnit);
  document.getElementById('search-engine-select').value = state.settings.searchEngine;
  document.getElementById('greeting-input').value = state.settings.greetingName;
  setGroupActive('video-fit-group', 'fit', state.settings.videoFit);
  document.getElementById('video-fill-color').value = state.settings.videoFillColor;
  document.getElementById('video-color-hint').textContent = 'Se muestra al elegir «Mostrar completo». También puedes elegir el color manualmente.';
  setGroupActive('shortcut-view-group', 'view', state.settings.shortcutView);
  setGroupActive('shortcut-motion-group', 'motion', state.settings.shortcutMotion);
  document.getElementById('shortcut-labels').checked = state.settings.shortcutLabels;
  document.getElementById('list-rows').value = state.settings.listRows;
  document.getElementById('track-pages').checked = state.settings.trackPages;
  renderMediaLibrary('image');
  renderMediaLibrary('video');
  applyVideoAudioSettings();
  renderActivity();
}

function openSettings() {
  syncSettingsFormFromState();
  setSettingsSection('fondo');
  openModal('settings-modal');
}

function setupSettingsPanel() {
  document.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => setSettingsSection(btn.dataset.section));
  });
  document.querySelectorAll('.bg-type-btn').forEach((tab) => {
    tab.addEventListener('click', () => {
      showBgTypePanel(tab.dataset.type);
      if (tab.dataset.type === 'gradient') applyBackground({ type: 'gradient', value: '' });
      else {
        const first = state.media.library[tab.dataset.type][0];
        if (first && state.background.type !== tab.dataset.type) {
          chooseMedia(tab.dataset.type, first);
          renderMediaLibrary(tab.dataset.type);
        }
      }
    });
  });

  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('dock-settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', () => closeModal('settings-modal'));
  document.getElementById('settings-modal-close').addEventListener('click', () => closeModal('settings-modal'));

  document.getElementById('settings-reset').addEventListener('click', () => {
    const fresh = defaultState();
    state.settings = fresh.settings;
    state.background = fresh.background;
    persist();
    applyCurrentState();
    syncSettingsFormFromState();
    setSettingsSection('fondo');
    notifyTrackingChanged();
    if (hasChromeStorage && chrome.permissions) chrome.permissions.remove({ permissions: ['tabs', 'idle'] }).catch(() => {});
  });

  // --- Fondo: imagen / video por URL o archivo ---
  const imageUrlInput = document.getElementById('bg-image-url');
  const applyImageUrl = () => { if (imageUrlInput.value.trim()) addMedia('image', imageUrlInput.value.trim(), ''); };
  imageUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyImageUrl(); });
  imageUrlInput.addEventListener('change', applyImageUrl);

  const videoUrlInput = document.getElementById('bg-video-url');
  const applyVideoUrl = () => { if (videoUrlInput.value.trim()) addMedia('video', videoUrlInput.value.trim(), ''); };
  videoUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyVideoUrl(); });
  videoUrlInput.addEventListener('change', applyVideoUrl);

  document.getElementById('bg-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      mediaStatus('image', 'Elige una imagen compatible de hasta 15 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => addMedia('image', reader.result, file.name);
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('bg-video-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['video/mp4', 'video/webm', 'video/ogg'].includes(file.type) || file.size > 25 * 1024 * 1024) {
      mediaStatus('video', 'Elige un video mp4, webm u ogg de hasta 25 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => addMedia('video', reader.result, file.name);
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // --- Sonido del video ---
  document.getElementById('video-sound-toggle').addEventListener('change', (e) => {
    state.settings.videoMuted = !e.target.checked;
    applyVideoAudioSettings();
    persist();
  });
  document.getElementById('video-volume').addEventListener('input', (e) => {
    state.settings.videoVolume = Number(e.target.value);
    applyVideoAudioSettings();
    persist();
  });
  document.getElementById('video-mute-btn').addEventListener('click', () => {
    state.settings.videoMuted = !state.settings.videoMuted;
    applyVideoAudioSettings();
    persist();
  });
  wireGroup('video-fit-group', (btn) => {
    state.settings.videoFit = btn.dataset.fit;
    applyVideoFit();
    persist();
  });
  document.getElementById('video-fill-color').addEventListener('input', (event) => {
    state.settings.videoFillColor = event.target.value;
    applyVideoFit();
    persist();
  });
  document.getElementById('video-sample-color').addEventListener('click', () => {
    const video = document.getElementById('bg-video');
    const hint = document.getElementById('video-color-hint');
    if (state.background.type !== 'video' || video.readyState < 2) {
      hint.textContent = 'Primero carga un video y espera a que se vea el primer fotograma.';
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(video, 0, 0, 32, 32);
      const pixels = context.getImageData(0, 0, 32, 32).data;
      const sums = [0, 0, 0];
      let count = 0;
      for (let y = 0; y < 32; y += 2) {
        for (let x = 0; x < 32; x += 2) {
          if (x > 5 && x < 26 && y > 5 && y < 26) continue;
          const offset = (y * 32 + x) * 4;
          for (let channel = 0; channel < 3; channel++) sums[channel] += pixels[offset + channel];
          count++;
        }
      }
      const color = '#' + sums.map((sum) => Math.round(sum / count * 0.7).toString(16).padStart(2, '0')).join('');
      state.settings.videoFillColor = color;
      document.getElementById('video-fill-color').value = color;
      applyVideoFit();
      persist();
      hint.textContent = 'Color tomado de los bordes del video. Puedes ajustarlo manualmente.';
    } catch (error) {
      hint.textContent = 'Este video no permite leer sus colores. Elige un color manualmente.';
    }
  });

  // --- Oscurecer / desenfocar fondo ---
  document.getElementById('dim-range').addEventListener('input', (e) => {
    state.settings.overlayDim = Number(e.target.value);
    applyDim(state.settings.overlayDim);
    persist();
  });
  document.getElementById('blur-range').addEventListener('input', (e) => {
    state.settings.bgBlur = Number(e.target.value);
    applyBlur(state.settings.bgBlur);
    persist();
  });

  // --- Apariencia ---
  const accentInput = document.getElementById('accent-color');
  const settingsPanel = document.querySelector('.settings-panel');
  wireGroup('theme-group', (btn) => {
    if (!COLOR_THEMES.includes(btn.dataset.theme)) return;
    state.settings.theme = btn.dataset.theme;
    applyTheme(state.settings.theme);
    state.settings.accent = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim();
    settingsPanel.style.removeProperty('--amber');
    settingsPanel.style.removeProperty('--accent-text');
    applyAccentColor(state.settings.accent);
    accentInput.value = state.settings.accent;
    persist();
  });
  accentInput.addEventListener('input', (event) => {
    // El selector emite muchos eventos al arrastrar. Previsualizar solo en el panel
    // evita repintar los fondos y serializar toda la galería en cada movimiento.
    setAccentColor(settingsPanel, event.target.value);
  });
  accentInput.addEventListener('change', (event) => {
    state.settings.accent = event.target.value;
    settingsPanel.style.removeProperty('--amber');
    settingsPanel.style.removeProperty('--accent-text');
    applyAccentColor(state.settings.accent);
    persist();
  });
  wireGroup('card-style-group', (btn) => {
    state.settings.cardStyle = btn.dataset.style;
    applyCardStyle(state.settings.cardStyle);
    persist();
  });
  wireGroup('shortcut-style-group', (btn) => {
    state.settings.shortcutStyle = btn.dataset.shortcutStyle;
    applyShortcutView();
    persist();
  });

  // --- Vista ---
  wireGroup('shortcut-view-group', (btn) => {
    state.settings.shortcutView = btn.dataset.view;
    applyShortcutView();
    animateShortcutView();
    persist();
  });
  wireGroup('shortcut-motion-group', (btn) => {
    state.settings.shortcutMotion = btn.dataset.motion;
    applyShortcutView();
    persist();
  });
  document.getElementById('shortcut-labels').addEventListener('change', (event) => {
    state.settings.shortcutLabels = event.target.checked;
    applyShortcutView();
    persist();
  });
  document.getElementById('list-rows').addEventListener('change', (event) => {
    const value = Number(event.target.value);
    state.settings.listRows = Number.isInteger(value) ? Math.min(20, Math.max(3, value)) : 8;
    event.target.value = state.settings.listRows;
    applyShortcutView();
    persist();
  });
  wireGroup('layout-group', (btn) => {
    state.settings.layout = btn.dataset.layout;
    applyLayout(state.settings.layout);
    persist();
  });
  wireGroup('dock-position-group', (btn) => {
    state.settings.dockPosition = btn.dataset.position;
    applyDockPosition(state.settings.dockPosition);
    persist();
  });
  [['show-clock', 'showClock'], ['show-weather', 'showWeather'], ['show-quote', 'showQuote'], ['show-todo', 'showTodo'],
    ['show-focus', 'showFocus'], ['show-notes', 'showNotes'], ['show-habits', 'showHabits'], ['show-time-progress', 'showTimeProgress']].forEach(([id, key]) => {
    document.getElementById(id).addEventListener('change', (e) => {
      state.settings[key] = e.target.checked;
      applyWidgetVisibility();
      persist();
    });
  });

  // --- Reloj y clima ---
  wireGroup('clock-format-group', (btn) => {
    state.settings.clockFormat = btn.dataset.format;
    tickClock();
    persist();
  });
  document.getElementById('show-seconds').addEventListener('change', (e) => {
    state.settings.showSeconds = e.target.checked;
    tickClock();
    persist();
  });
  wireGroup('temp-unit-group', (btn) => {
    state.settings.tempUnit = btn.dataset.unit;
    renderWeatherUI();
    persist();
  });

  // --- Búsqueda ---
  document.getElementById('search-engine-select').addEventListener('change', (e) => {
    state.settings.searchEngine = e.target.value;
    persist();
  });
  document.getElementById('greeting-input').addEventListener('input', (e) => {
    state.settings.greetingName = e.target.value;
    updateGreeting();
    persist();
  });

  document.getElementById('data-export').addEventListener('click', exportData);
  document.getElementById('data-import').addEventListener('change', importData);
  document.getElementById('track-pages').addEventListener('change', async (event) => {
    const status = document.getElementById('tracking-status');
    const toggle = event.target;
    if (!hasChromeStorage || !chrome.permissions) {
      toggle.checked = false;
      status.textContent = 'El registro requiere instalar la extensión en el navegador.';
      return;
    }
    if (toggle.checked) {
      toggle.disabled = true;
      status.textContent = 'Esperando permiso del navegador…';
      try {
        if (!await chrome.permissions.request({ permissions: ['tabs', 'idle'] })) {
          toggle.checked = false;
          status.textContent = 'No se concedió acceso a las pestañas y al estado de actividad.';
          return;
        }
      } catch (error) {
        toggle.checked = false;
        status.textContent = 'No se pudieron solicitar los permisos.';
        return;
      } finally {
        toggle.disabled = false;
      }
    }
    state.settings.trackPages = toggle.checked;
    await persist();
    notifyTrackingChanged();
    if (!toggle.checked) await chrome.permissions.remove({ permissions: ['tabs', 'idle'] });
    status.textContent = toggle.checked ? 'Registro activado.' : 'Registro detenido. Tus datos anteriores siguen guardados.';
    renderActivity();
  });
  document.getElementById('activity-clear').addEventListener('click', async () => {
    await storageSet('auroraActivity', { sessions: [], current: null });
    document.getElementById('tracking-status').textContent = 'Actividad borrada.';
    renderActivity();
    notifyTrackingChanged();
  });
  if (hasChromeStorage) chrome.storage.onChanged.addListener((changes) => {
    if (changes.auroraActivity && !document.getElementById('settings-modal').hidden) renderActivity();
  });
}

function notifyTrackingChanged() {
  if (hasChromeStorage && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'aurora-tracking-changed' }).catch(() => {});
  }
}

function formatDuration(ms) {
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const minutes = Math.round(ms / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

async function renderActivity() {
  const root = document.getElementById('activity-summary');
  const raw = await storageGet('auroraActivity');
  const sessions = Array.isArray(raw?.sessions) ? [...raw.sessions] : [];
  if (raw?.current && state.settings.trackPages) {
    sessions.push({ ...raw.current, end: Math.min(Date.now(), raw.current.last || Date.now()) });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totals = new Map();
  const recent = [];
  for (const session of sessions) {
    if (!session || !Number.isFinite(session.start) || !Number.isFinite(session.end) ||
        session.end < session.start || !/^https?:\/\//i.test(session.url) || !normalizeUrl(session.url)) continue;
    const duration = Math.max(0, session.end - Math.max(session.start, today.getTime()));
    if (duration > 0) {
      const host = new URL(session.url).hostname;
      totals.set(host, (totals.get(host) || 0) + duration);
    }
    recent.push(session);
  }
  root.replaceChildren();
  const total = [...totals.values()].reduce((sum, ms) => sum + ms, 0);
  const heading = document.createElement('p');
  heading.className = 'activity-total';
  heading.textContent = total ? `Hoy: ${formatDuration(total)} en páginas` : 'Aún no hay actividad registrada hoy.';
  root.appendChild(heading);
  const list = document.createElement('div');
  list.className = 'activity-sites';
  [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([host, ms]) => {
    const row = document.createElement('div');
    const name = document.createElement('span');
    const time = document.createElement('strong');
    name.textContent = host;
    time.textContent = formatDuration(ms);
    row.append(name, time);
    list.appendChild(row);
  });
  root.appendChild(list);
  if (recent.length) {
    const caption = document.createElement('p');
    caption.className = 'settings-hint';
    caption.textContent = 'Sesiones recientes';
    root.appendChild(caption);
    const history = document.createElement('div');
    history.className = 'activity-recent';
    recent.sort((a, b) => b.start - a.start).slice(0, 8).forEach((session) => {
      const row = document.createElement('div');
      const title = document.createElement('span');
      const time = document.createElement('small');
      title.textContent = session.title || new URL(session.url).hostname;
      title.title = session.url;
      time.textContent = `${new Date(session.start).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} · ${formatDuration(session.end - session.start)}`;
      row.append(title, time);
      history.appendChild(row);
    });
    root.appendChild(history);
  }
}

async function exportData() {
  const activity = await storageGet('auroraActivity');
  const backup = { ...state, activity: { sessions: Array.isArray(activity?.sessions) ? activity.sessions : [] } };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aurora-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.getElementById('data-status').textContent = 'Copia descargada.';
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById('data-status');
  try {
    if (file.size > 500 * 1024 * 1024) throw new Error('El archivo supera los 500 MB.');
    const imported = JSON.parse(await file.text());
    const defaults = defaultState();
    const importedSettings = { ...defaults.settings, ...imported?.settings };
    if (!imported || !Array.isArray(imported.categories) || !imported.categories.length ||
        !imported.categories.every((item) => typeof item === 'string') ||
        typeof imported.activeCategory !== 'string' || !imported.categories.includes(imported.activeCategory) ||
        !Array.isArray(imported.shortcuts) ||
        !imported.shortcuts.every((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && normalizeUrl(item.url) && imported.categories.includes(item.category)) ||
        !Array.isArray(imported.todos) ||
        !imported.todos.every((item) => item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.done === 'boolean') ||
        !imported.settings || typeof imported.settings !== 'object' || Array.isArray(imported.settings) ||
        !imported.background || !['gradient', 'image', 'video'].includes(imported.background.type) ||
        typeof imported.background.value !== 'string' ||
        (imported.background.type !== 'gradient' && !validMediaValue(imported.background.type, imported.background.value)) ||
        !COLOR_THEMES.includes(importedSettings.theme) ||
        !/^#[0-9a-f]{6}$/i.test(importedSettings.accent) ||
        !['glass', 'solid', 'minimal'].includes(importedSettings.cardStyle) ||
        !['lateral', 'superior', 'oculto'].includes(importedSettings.layout) ||
        !['derecha', 'izquierda', 'arriba', 'abajo', 'oculta'].includes(importedSettings.dockPosition) ||
        typeof importedSettings.trackPages !== 'boolean' ||
        !['cover', 'contain', 'fill'].includes(importedSettings.videoFit) ||
        !/^#[0-9a-f]{6}$/i.test(importedSettings.videoFillColor) ||
        !SHORTCUT_VIEWS.includes(importedSettings.shortcutView) ||
        !SHORTCUT_STYLES.includes(importedSettings.shortcutStyle) ||
        !SHORTCUT_MOTIONS.includes(importedSettings.shortcutMotion) ||
        typeof importedSettings.shortcutLabels !== 'boolean' ||
        !Number.isInteger(importedSettings.listRows) || importedSettings.listRows < 3 || importedSettings.listRows > 20 ||
        !Number.isFinite(importedSettings.overlayDim) || importedSettings.overlayDim < 0 || importedSettings.overlayDim > 80 ||
        !Number.isFinite(importedSettings.bgBlur) || importedSettings.bgBlur < 0 || importedSettings.bgBlur > 15 ||
        !Number.isFinite(importedSettings.videoVolume) || importedSettings.videoVolume < 0 || importedSettings.videoVolume > 100 ||
        !['24', '12'].includes(importedSettings.clockFormat) ||
        !['C', 'F'].includes(importedSettings.tempUnit) ||
        !['google', 'bing', 'duckduckgo', 'ecosia'].includes(importedSettings.searchEngine) ||
        typeof importedSettings.greetingName !== 'string' ||
        ['showClock', 'showWeather', 'showQuote', 'showTodo', 'showCalendars', 'showFocus', 'showNotes', 'showHabits', 'showTimeProgress', 'showSeconds', 'videoMuted']
          .some((key) => typeof importedSettings[key] !== 'boolean')) {
      throw new Error('El archivo no parece ser una copia de Aurora.');
    }
    const importedActivity = imported.activity;
    if (importedActivity !== undefined && (!importedActivity || !Array.isArray(importedActivity.sessions) ||
        !importedActivity.sessions.every((entry) => entry && typeof entry.url === 'string' &&
          /^https?:\/\//i.test(entry.url) && normalizeUrl(entry.url) &&
          typeof entry.title === 'string' && Number.isFinite(entry.start) && Number.isFinite(entry.end) &&
          entry.end >= entry.start))) {
      throw new Error('La actividad del archivo no es válida.');
    }
    importedSettings.trackPages = false;
    const { activity: _activity, ...importedState } = imported;
    state = { ...defaults, ...importedState, settings: importedSettings,
      media: normalizeMediaState(imported.media, imported.background), widgets: normalizeWidgets(imported.widgets, true) };
    removeAllCategory();
    await persist();
    if (importedActivity) await storageSet('auroraActivity', { sessions: importedActivity.sessions.slice(-2000), current: null });
    notifyTrackingChanged();
    if (hasChromeStorage && chrome.permissions) await chrome.permissions.remove({ permissions: ['tabs', 'idle'] });
    applyCurrentState();
    syncSettingsFormFromState();
    status.textContent = 'Copia importada correctamente.';
  } catch (error) {
    status.textContent = error.message || 'No se pudo importar el archivo.';
  } finally {
    event.target.value = '';
  }
}

function applyCurrentState() {
  applyTheme(state.settings.theme);
  applyAccentColor(state.settings.accent);
  applyCardStyle(state.settings.cardStyle);
  applyLayout(state.settings.layout);
  applyDockPosition(state.settings.dockPosition);
  applyWidgetVisibility();
  applyDim(state.settings.overlayDim);
  applyBlur(state.settings.bgBlur);
  if (!rotateBackground()) applyBackground(state.background, false);
  updateGreeting();
  tickClock();
  renderWeatherUI();
  showQuoteOfTheDay();
  renderTodos();
  renderNotes();
  renderHabits();
  tickPersonalWidgets();
  renderCategories();
  renderShortcuts();
}

/* ----------------------------------- Modales ----------------------------------- */

const focusBeforeModal = new Map();
const modalStack = [];
function openModal(id) {
  focusBeforeModal.set(id, document.activeElement);
  modalStack.push(id);
  const modal = document.getElementById(id);
  modal.hidden = false;
  const first = [...modal.querySelectorAll('input, select, button')]
    .find((element) => element.getClientRects().length);
  if (first) first.focus();
}
function closeModal(id) {
  if (id === 'settings-modal') {
    document.querySelector('.settings-panel').style.removeProperty('--amber');
    document.querySelector('.settings-panel').style.removeProperty('--accent-text');
  }
  document.getElementById(id).hidden = true;
  const index = modalStack.lastIndexOf(id);
  if (index >= 0) modalStack.splice(index, 1);
  if (id === 'media-viewer-modal') document.getElementById('media-viewer-stage').replaceChildren();
  const previous = focusBeforeModal.get(id);
  if (previous?.isConnected) previous.focus();
  else document.getElementById('search-input').focus();
  focusBeforeModal.delete(id);
}

function setupModals() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay.id); });
  });
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById(modalStack.at(-1));
    if (!modal) return;
    if (e.key === 'Escape') closeModal(modal.id);
    if (e.key === 'Tab') {
      const focusables = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')]
        .filter((el) => el.getClientRects().length);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  document.getElementById('media-viewer-close').addEventListener('click', () => closeModal('media-viewer-modal'));
  document.getElementById('media-viewer-prev').addEventListener('click', () => { mediaViewerIndex--; showMediaViewerEntry(); });
  document.getElementById('media-viewer-next').addEventListener('click', () => { mediaViewerIndex++; showMediaViewerEntry(); });
  document.getElementById('media-viewer-use').addEventListener('click', () => {
    const entry = state.media.library[mediaViewerType]?.[mediaViewerIndex];
    if (!entry) return;
    chooseMedia(mediaViewerType, entry);
    closeModal('media-viewer-modal');
    renderMediaLibrary(mediaViewerType);
    document.querySelector(`#${mediaViewerType}-library [data-entry-id="${CSS.escape(entry.id)}"] [data-action="Usar como fondo"]`)?.focus();
  });

  document.getElementById('shortcut-cancel').addEventListener('click', () => closeModal('shortcut-modal'));
  document.getElementById('shortcut-save').addEventListener('click', () => {
    const name = document.getElementById('shortcut-name').value.trim();
    const url = normalizeUrl(document.getElementById('shortcut-url').value);
    const category = document.getElementById('shortcut-category').value;
    if (!name || !url || !state.categories.includes(category)) return;
    state.shortcuts.push({ id: uid(), name, url, category });
    state.activeCategory = category;
    persist();
    renderCategories();
    renderShortcuts();
    closeModal('shortcut-modal');
  });

  document.getElementById('category-cancel').addEventListener('click', () => closeModal('category-modal'));
  document.getElementById('category-save').addEventListener('click', () => {
    const input = document.getElementById('category-name');
    const name = input.value.trim();
    if (!name) return;
    const existing = state.categories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!existing) state.categories.push(name);
    state.activeCategory = existing || name;
    persist();
    input.value = '';
    renderCategories();
    renderShortcuts();
    closeModal('category-modal');
  });
  document.getElementById('rename-category-cancel').addEventListener('click', () => closeModal('rename-category-modal'));
  const saveCategoryName = () => {
    const input = document.getElementById('rename-category-name');
    const name = input.value.trim();
    const status = document.getElementById('rename-category-status');
    if (!name) { status.textContent = 'Escribe un nombre.'; return; }
    if (state.categories.some((cat) => cat !== categoryToRename && cat.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      status.textContent = 'Ya existe una categoría con ese nombre.';
      return;
    }
    const index = state.categories.indexOf(categoryToRename);
    if (index < 0) return;
    state.categories[index] = name;
    state.shortcuts.forEach((shortcut) => { if (shortcut.category === categoryToRename) shortcut.category = name; });
    if (state.activeCategory === categoryToRename) state.activeCategory = name;
    categoryToRename = null;
    persist();
    renderCategories();
    renderShortcuts();
    closeModal('rename-category-modal');
  };
  document.getElementById('rename-category-save').addEventListener('click', saveCategoryName);
  document.getElementById('rename-category-name').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveCategoryName();
  });

  document.getElementById('move-shortcut-cancel').addEventListener('click', () => closeModal('move-shortcut-modal'));
  document.getElementById('move-shortcut-save').addEventListener('click', () => {
    const shortcut = state.shortcuts.find((item) => item.id === shortcutToMoveId);
    const category = document.getElementById('move-shortcut-category').value;
    if (!shortcut || !state.categories.includes(category)) return;
    shortcut.category = category;
    state.shortcuts = state.shortcuts.filter((item) => item.id !== shortcut.id);
    state.shortcuts.push(shortcut);
    state.activeCategory = category;
    persist();
    renderCategories();
    renderShortcuts();
    closeModal('move-shortcut-modal');
    shortcutToMoveId = null;
  });
}

/* ------------------------------------ Búsqueda ------------------------------------ */

const SEARCH_ENGINES = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  ecosia: 'https://www.ecosia.org/search?q=',
};

function setupSearch() {
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = document.getElementById('search-input').value.trim();
    if (!value) return;
    const looksLikeUrl = /^https?:\/\//i.test(value) || (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(value) && !value.includes(' '));
    if (looksLikeUrl) {
      openNewTab(value);
    } else {
      const base = SEARCH_ENGINES[state.settings.searchEngine] || SEARCH_ENGINES.google;
      openNewTab(base + encodeURIComponent(value));
    }
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (event.key === '/' && !editing && !document.querySelector('.modal-overlay:not([hidden])')) {
      event.preventDefault();
      document.getElementById('search-input').focus();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === ',' && !document.querySelector('.modal-overlay:not([hidden])')) {
      event.preventDefault();
      syncSettingsFormFromState();
      setSettingsSection('fondo');
      openModal('settings-modal');
    }
  });
}

/* --------------------------------- Barra lateral ---------------------------------- */

function setupDock() {
  document.querySelectorAll('.dock-btn[data-chrome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.chrome;
      if (hasChromeTabs) chrome.tabs.create({ url });
      else window.open(url, '_blank');
    });
  });
}

/* -------------------------------------- Init --------------------------------------- */

(async function init() {
  await loadState();
  applyCurrentState();
  setInterval(tickClock, 1000);
  setInterval(rotateBackground, 10000);

  initWeather();
  document.getElementById('weather-retry').addEventListener('click', initWeather);

  setupSettingsPanel();
  await setupCalendars();
  setupTodos();
  setupPersonalWidgets();
  setupModals();
  setupSearch();
  setupDock();
  setupContextMenu();

  document.documentElement.classList.remove('is-booting');
  document.getElementById('search-input').focus();
})();
