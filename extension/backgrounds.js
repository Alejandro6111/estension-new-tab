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
