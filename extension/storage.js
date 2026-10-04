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
  return new Promise((resolve, reject) => {
    if (hasChromeStorage) {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    } else {
      try { localStorage.setItem(key, JSON.stringify(value)); resolve(); }
      catch { reject(new Error('No hay espacio para guardar. Exporta una copia y libera fondos locales.')); }
    }
  });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function normalizeUrl(raw) {
  if (typeof raw !== 'string') return '';
  let u = raw.trim();
  if (!u) return '';
  if (/^[a-z][a-z\d+.-]*:/i.test(u) && !/^https?:\/\//i.test(u) && !/^[^:/\s]+:\d+(?:[/?#]|$)/.test(u)) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    return ['https:', 'http:'].includes(parsed.protocol) && parsed.hostname && !parsed.username && !parsed.password ? parsed.href : '';
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
    try { const url = new URL(value); return !!url.hostname && !url.username && !url.password; } catch (error) { return false; }
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
      const seen = new Set();
      library[type] = source.filter((entry) => entry && validId(entry.id) && !seen.has(entry.id) && seen.add(entry.id) &&
        typeof entry.name === 'string' && entry.name.length <= 200 && validMediaValue(type, entry.value))
        .map(({ id, name, value }) => ({ id, name, value }));
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
    focusHistory: [],
    focus: { kind: 'focus', duration: 1500, remaining: 1500, endsAt: 0, completed: 0, day: localDayKey() },
    habits: ['Tomar agua', 'Moverme un rato', 'Leer algo'].map((name) => ({ id: uid(), name, completedOn: '', history: [] })),
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
    if (focus && Number.isInteger(focus.duration) && focus.duration >= 60 && focus.duration <= 10800 &&
        Number.isInteger(focus.remaining) && focus.remaining >= 0 && focus.remaining <= focus.duration &&
        Number.isFinite(focus.endsAt) && focus.endsAt >= 0 && focus.endsAt <= 8640000000000000 &&
        (focus.endsAt === 0 || focus.endsAt <= Date.now() + focus.duration * 1000) &&
        Number.isSafeInteger(focus.completed) && focus.completed >= 0 && validDayKey(focus.day) &&
        (focus.kind === undefined || ['focus', 'break'].includes(focus.kind))) {
      widgets.focus = { kind: focus.kind || (focus.duration === 300 ? 'break' : 'focus'), duration: focus.duration, remaining: focus.remaining, endsAt: focus.endsAt,
        completed: focus.completed, day: focus.day };
    } else reject();
  }
  if (raw.habits !== undefined) {
    if (Array.isArray(raw.habits) && raw.habits.length <= 8 &&
        raw.habits.every((habit) => habit && typeof habit.id === 'string' && habit.id.length > 0 && habit.id.length <= 100 &&
          typeof habit.name === 'string' && habit.name.trim().length > 0 && habit.name.length <= 60 &&
          (habit.completedOn === '' || validDayKey(habit.completedOn))) &&
        new Set(raw.habits.map((habit) => habit.id)).size === raw.habits.length) {
      widgets.habits = raw.habits.map(({ id, name, completedOn, history }) => {
        if (history !== undefined && (!Array.isArray(history) || history.length > 366 || history.some((day) => !validDayKey(day)))) reject();
        return { id, name, completedOn, history: [...new Set([...(Array.isArray(history) ? history.filter(validDayKey) : []), ...(completedOn ? [completedOn] : [])])].sort().slice(-366) };
      });
    } else reject();
  }
  if (raw.focusHistory !== undefined) {
    if (!Array.isArray(raw.focusHistory) || raw.focusHistory.length > 366 || raw.focusHistory.some((entry) =>
      !entry || !validDayKey(entry.day) || !Number.isSafeInteger(entry.seconds) || entry.seconds < 0 ||
      !Number.isSafeInteger(entry.sessions) || entry.sessions < 0) ||
      new Set(raw.focusHistory.map((entry) => entry.day)).size !== raw.focusHistory.length) reject();
    else widgets.focusHistory = raw.focusHistory.map(({ day, seconds, sessions }) => ({ day, seconds, sessions })).sort((a, b) => a.day.localeCompare(b.day));
  } else if (widgets.focus.completed) {
    widgets.focusHistory = [{ day: widgets.focus.day, seconds: 0, sessions: widgets.focus.completed }];
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
    widgetLayout: defaultWidgetLayout(),
    backgroundPlaylists: { image: defaultPlaylist(), video: defaultPlaylist() },
    profiles: [],
    activeProfile: 'personal',
    profileRules: [],
    profileOverrideUntil: 0,
    privacy: { domainOnly: false, excludeBanking: false, excludedDomains: [], excludedUrls: [] },
    tabSessions: [],
    updatedAt: 0,
    settings: {
      theme: 'aurora',
      accent: '#f4a54b',
      cardStyle: 'glass',      // 'glass' | 'solid' | 'minimal'
      layout: 'lateral',       // 'lateral' | 'superior' | 'oculto'
      widgetDesign: 'original',
      widgetPlacement: 'columns',
      leftWidgetWidth: 236,
      rightWidgetWidth: 236,
      centerWidgetWidth: 0,
      leftWidgetHeight: 0,
      rightWidgetHeight: 0,
      centerWidgetHeight: 0,
      leftWidgetColumns: 1,
      rightWidgetColumns: 1,
      centerWidgetColumns: 1,
      widgetGap: 14,
      shortcutsWidth: 700,
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
      showStatistics: true,
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
  state = normalizeState(saved);
  removeAllCategory();
  captureActiveProfile();
  if (!saved || !saved.profiles || !saved.widgetLayout || saved.settings?.widgetDesign === undefined) await persist();
}

let localWrite = Promise.resolve();
function persist() {
  captureActiveProfile();
  state.updatedAt = Math.max(Date.now(), state.updatedAt + 1);
  const snapshot = structuredClone(state);
  const result = localWrite.catch(() => {}).then(() => storageSet(STORAGE_KEY, snapshot));
  localWrite = result;
  result.then(() => scheduleSync()).catch((error) => announce(error.message));
  return result;
}
