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
  if (key === 'sesiones') { renderSessions(); renderRecentTabs(); }
  if (key === 'perfiles') renderProfiles();
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
  syncWidgetDesignSettings();
  document.getElementById('show-statistics').checked = state.settings.showStatistics && !state.widgetLayout.find((entry) => entry.id === 'statistics').hidden;
  syncPrivacyForm();
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
  WIDGETS.forEach((widget) => {
    const controls = { clock: 'show-clock', weather: 'show-weather', quote: 'show-quote', todo: 'show-todo', focus: 'show-focus', notes: 'show-notes', habits: 'show-habits', time: 'show-time-progress' };
    if (controls[widget.id]) document.getElementById(controls[widget.id]).checked = state.settings[widget.preference] && !state.widgetLayout.find((entry) => entry.id === widget.id).hidden;
  });
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
  setupWidgetDesignSettings();
  document.getElementById('settings-edit-page').addEventListener('click', () => { closeModal('settings-modal'); setEditingPage(true); });
  document.getElementById('show-statistics').addEventListener('change', (event) => { state.settings.showStatistics = event.target.checked; state.widgetLayout.find((entry) => entry.id === 'statistics').hidden = false; applyWidgetLayout(); persist(); });
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
    state.widgetLayout = fresh.widgetLayout;
    persist();
    applyCurrentState();
    syncSettingsFormFromState();
    setSettingsSection('fondo');
    notifyTrackingChanged();
    releaseTrackingPermissions();
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
    state.settings.widgetDesign = 'custom';
    applyWidgetLayout();
    syncWidgetDesignSettings();
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
      state.widgetLayout.filter((entry) => WIDGETS.find((widget) => widget.id === entry.id).preference === key).forEach((entry) => { entry.hidden = false; });
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
    if (!toggle.checked) await releaseTrackingPermissions();
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

async function releaseTrackingPermissions() {
  if (!hasChromeStorage || !chrome.permissions) return;
  const tabsEnabled = await storageGet('auroraTabsEnabled') === true;
  try { await chrome.permissions.remove({ permissions: tabsEnabled ? ['idle'] : ['tabs', 'idle'] }); }
  catch { /* Un navegador administrado puede conservar permisos aunque se detenga el registro. */ }
}

function formatDuration(ms) {
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const minutes = Math.round(ms / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

async function exportData() {
  captureActiveProfile();
  const activity = await storageGet('auroraActivity');
  const backup = { ...state, activity: { sessions: Array.isArray(activity?.sessions) ? activity.sessions : [] } };
  downloadBackup(backup);
  document.getElementById('data-status').textContent = 'Copia descargada.';
}

function downloadBackup(backup, suffix = 'copia') {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aurora-${suffix}-${localDayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = document.getElementById('data-status');
  try {
    if (file.size > 500 * 1024 * 1024) throw new Error('El archivo supera los 500 MB.');
    const imported = JSON.parse(await file.text());
    const next = normalizeState(imported, true);
    let activity;
    if (imported.activity !== undefined) {
      if (!isRecord(imported.activity) || !Array.isArray(imported.activity.sessions) || imported.activity.sessions.some((entry) =>
        !entry || typeof entry.title !== 'string' || !filterActivitySession(entry, {}))) throw new Error('La actividad de la copia no es válida.');
      activity = { sessions: imported.activity.sessions.map((entry) => filterActivitySession(entry, next.privacy)).filter(Boolean).slice(-2000), current: null };
    }
    next.settings.trackPages = false;
    next.profiles.forEach((profile) => { profile.data.settings.trackPages = false; });
    next.updatedAt = Date.now();
    // Toda la copia se valida antes de escribir o reemplazar el estado en memoria.
    syncEnabled = false; clearTimeout(syncTimer);
    const previous = state;
    state = next; captureActiveProfile();
    try {
      if (hasChromeStorage) await chrome.storage.local.set({ auroraState: state, auroraSyncEnabled: false, auroraTrackingEnabled: false,
        ...(activity ? { auroraActivity: activity } : {}) });
      else {
        await storageSet(STORAGE_KEY, state); await storageSet('auroraSyncEnabled', false);
        if (activity) await storageSet('auroraActivity', activity);
      }
    } catch (error) { state = previous; throw error; }
    notifyTrackingChanged();
    await releaseTrackingPermissions();
    applyCurrentState(); syncSettingsFormFromState(); renderSessions(); updateSyncUI();
    status.textContent = 'Copia importada. Registro y sincronización desactivados; puedes activarlos de nuevo.';
  } catch (error) { status.textContent = error.message || 'No se pudo importar el archivo.'; }
  finally { event.target.value = ''; }
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
  applyWidgetLayout();
  renderProfiles();
  renderStatistics();
}
