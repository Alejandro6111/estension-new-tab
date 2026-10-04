/* Editor de widgets: arrastre y controles equivalentes para teclado. */
let editingPage = false;
function freeWidgetsEnabled() { return state.settings.widgetPlacement === 'free' && state.settings.layout === 'lateral' && innerWidth > 900; }
function captureFreeWidgetPositions() {
  state.widgetLayout.forEach((entry) => {
    const card = document.querySelector(WIDGETS.find((widget) => widget.id === entry.id).selector);
    const box = card.getBoundingClientRect();
    entry.x = Math.round(Math.max(0, Math.min(4000, box.x + scrollX)));
    entry.y = Math.round(Math.max(80, Math.min(4000, box.y + scrollY)));
    if (box.width) entry.width = Math.max(160, Math.min(1200, Math.round(box.width)));
  });
}
function widgetColumn(column) {
  return document.querySelector(column === 1 ? '.widgets:not(.widgets-right):not(.widgets-center)' : column === 3 ? '.widgets-right' : '.widgets-center');
}
function applyWidgetLayout() {
  const focused = document.activeElement;
  const free = freeWidgetsEnabled();
  document.body.classList.toggle('widget-free', free);
  document.body.classList.toggle('dashboard-stacked', !free && innerWidth > 1200 && state.settings.layout === 'lateral' &&
    state.settings.leftWidgetWidth + state.settings.rightWidgetWidth + 500 > innerWidth);
  document.body.style.setProperty('--widget-gap', `${state.settings.widgetGap}px`);
  document.body.style.setProperty('--shortcuts-width', `${state.settings.shortcutsWidth}px`);
  [1, 2, 3].forEach((column) => {
    const root = widgetColumn(column);
    const entries = state.widgetLayout.filter((entry) => entry.column === column).sort((a, b) => a.order - b.order);
    const zone = column === 1 ? 'left' : column === 3 ? 'right' : 'center';
    const width = state.settings[`${zone}WidgetWidth`];
    const height = state.settings[`${zone}WidgetHeight`];
    root.style.setProperty('--zone-columns', state.settings[`${zone}WidgetColumns`]);
    root.style.setProperty('--zone-height', height ? `${height}px` : column === 2 ? 'none' : 'calc(100dvh - 112px)');
    root.style.height = height && !free ? `${height}px` : '';
    root.style.maxWidth = column === 2 && width ? `${width}px` : '';
    entries.forEach((entry) => {
      const definition = WIDGETS.find((widget) => widget.id === entry.id);
      const card = document.querySelector(definition.selector);
      if (!card) return;
      root.append(card);
      card.dataset.widget = entry.id; card.dataset.size = entry.size;
      card.style.width = entry.width ? `${entry.width}px` : '';
      card.style.maxWidth = entry.width ? '100%' : '';
      card.style.height = entry.height ? `${entry.height}px` : '';
      card.dataset.customHeight = String(!!entry.height);
      card.style.setProperty('--widget-x', `${Math.min(entry.x || 0, Math.max(0, document.body.clientWidth - (entry.width || width || 236) - 12))}px`);
      card.style.setProperty('--widget-y', `${entry.y || 80}px`);
      card.hidden = !editingPage && (entry.hidden || !state.settings[definition.preference]);
      card.style.removeProperty('display');
      const controls = card.querySelector('.widget-edit-controls');
      if (controls) {
        controls.querySelector('select').value = String(entry.column); controls.querySelectorAll('select')[1].value = entry.size;
        controls.querySelector('.widget-drag-handle').draggable = false;
        controls.querySelectorAll('[data-dimension]').forEach((input) => {
          input.value = entry[input.dataset.dimension] || 0;
          input.closest('label').hidden = ['x', 'y'].includes(input.dataset.dimension) && state.settings.widgetPlacement !== 'free';
        });
      }
      card.classList.toggle('widget-was-hidden', entry.hidden || !state.settings[definition.preference]);
    });
    root.hidden = !editingPage && ![...root.children].some((card) => !card.hidden);
    document.body.style.setProperty(column === 1 ? '--left-widgets-width' : column === 3 ? '--right-widgets-width' : '--center-widgets-width', `${width}px`);
  });
  if (free) {
    const bottom = Math.max(innerHeight, ...state.widgetLayout.map((entry) => {
      const card = document.querySelector(`[data-widget="${entry.id}"]`);
      return card && !card.hidden ? (entry.y || 80) + card.offsetHeight + 40 : 0;
    }));
    document.body.style.setProperty('--free-page-height', `${bottom}px`);
  } else document.body.style.removeProperty('--free-page-height');
  renderHiddenWidgets();
  if (focused?.isConnected && focused !== document.body && focused.getClientRects().length) focused.focus({ preventScroll: true });
}
function saveWidgetLayout() { state.settings.widgetDesign = 'custom'; applyWidgetLayout(); persist(); syncWidgetDesignSettings(); }
function moveWidget(id, column, beforeId = '') {
  const entry = state.widgetLayout.find((widget) => widget.id === id);
  if (!entry || ![1, 2, 3].includes(column)) return;
  const siblings = state.widgetLayout.filter((widget) => widget.column === column && widget.id !== id).sort((a, b) => a.order - b.order);
  const position = siblings.findIndex((widget) => widget.id === beforeId);
  siblings.splice(position < 0 ? siblings.length : position, 0, entry);
  siblings.forEach((widget, order) => { widget.column = column; widget.order = order; });
  saveWidgetLayout();
}
function moveWidgetOrder(id, direction) {
  const entry = state.widgetLayout.find((widget) => widget.id === id);
  const siblings = state.widgetLayout.filter((widget) => widget.column === entry.column).sort((a, b) => a.order - b.order);
  const index = siblings.indexOf(entry), target = index + direction;
  if (target < 0 || target >= siblings.length) { announce('El widget ya está en ese extremo.'); return; }
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  siblings.forEach((widget, order) => { widget.order = order; }); saveWidgetLayout();
}
function renderHiddenWidgets() {
  const root = document.getElementById('hidden-widgets'); root.replaceChildren();
  const hidden = WIDGETS.filter((widget) => state.widgetLayout.find((entry) => entry.id === widget.id).hidden || !state.settings[widget.preference]);
  root.append(el('span', 'widget-hint', hidden.length ? 'Añadir de nuevo: ' : 'Todos los widgets están visibles.'));
  hidden.forEach((widget) => root.append(action(widget.label, () => {
    state.widgetLayout.find((entry) => entry.id === widget.id).hidden = false;
    state.settings[widget.preference] = true; saveWidgetLayout();
  }, 'restore-widget')));
}
function setEditingPage(value) {
  editingPage = value;
  document.body.classList.toggle('editing-page', value);
  document.getElementById('layout-editor').hidden = !value;
  document.getElementById('edit-page').setAttribute('aria-pressed', String(value));
  document.getElementById('edit-page').textContent = value ? 'Terminar edición' : 'Editar página';
  document.querySelectorAll('.widget-edit-controls').forEach((controls) => { controls.hidden = !value; });
  applyWidgetLayout();
  if (!value) document.getElementById('edit-page').focus();
}
function setupWidgetEditor() {
  WIDGETS.forEach((widget) => {
    const card = document.querySelector(widget.selector);
    const controls = el('div', 'widget-edit-controls'); controls.hidden = true;
    const handle = el('button', 'widget-drag-handle', `Mover ${widget.label}`); handle.type = 'button';
    setupWidgetPointerDrag(handle, card, widget.id);
    controls.append(handle, action('↑', () => moveWidgetOrder(widget.id, -1), 'widget-move'), action('↓', () => moveWidgetOrder(widget.id, 1), 'widget-move'));
    controls.children[1].setAttribute('aria-label', `Subir ${widget.label}`); controls.children[2].setAttribute('aria-label', `Bajar ${widget.label}`);
    const column = el('select'); column.setAttribute('aria-label', `Columna de ${widget.label}`);
    [['1', 'Izquierda'], ['2', 'Centro'], ['3', 'Derecha']].forEach(([value, text]) => { const option = el('option', '', text); option.value = value; column.append(option); });
    column.addEventListener('change', () => moveWidget(widget.id, Number(column.value)));
    const size = el('select'); size.setAttribute('aria-label', `Tamaño de ${widget.label}`);
    [['small', 'Pequeño'], ['medium', 'Mediano'], ['large', 'Grande']].forEach(([value, text]) => { const option = el('option', '', text); option.value = value; size.append(option); });
    size.addEventListener('change', () => { state.widgetLayout.find((entry) => entry.id === widget.id).size = size.value; saveWidgetLayout(); });
    controls.append(column, size, action('Ocultar', () => { state.widgetLayout.find((entry) => entry.id === widget.id).hidden = true; saveWidgetLayout(); }, 'widget-hide'));
    [['width', 'Ancho', 1200], ['height', 'Alto', 1600], ['x', 'X', 4000], ['y', 'Y', 4000]].forEach(([key, label, max]) => {
      const field = el('label', 'widget-dimension', label);
      const input = el('input'); input.type = 'number'; input.min = '0'; input.max = String(max); input.step = '1'; input.dataset.dimension = key;
      input.setAttribute('aria-label', `${label} de ${widget.label}`); input.title = key === 'width' || key === 'height' ? 'Píxeles; 0 = automático' : 'Posición en píxeles';
      input.addEventListener('change', () => {
        const value = Number(input.value);
        const minimum = key === 'width' ? 160 : key === 'height' ? 80 : 0;
        state.widgetLayout.find((entry) => entry.id === widget.id)[key] = Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(minimum, Math.round(value))) : 0;
        saveWidgetLayout();
      });
      field.append(input); controls.append(field);
    });
    card.prepend(controls);
  });
  document.getElementById('edit-page').addEventListener('click', () => setEditingPage(!editingPage));
  document.getElementById('edit-page-done').addEventListener('click', () => setEditingPage(false));
  document.getElementById('layout-reset').addEventListener('click', () => applyWidgetDesign('original'));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && editingPage && !modalStack.length) setEditingPage(false); });
  applyWidgetLayout();
  let resizeFrame;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(applyWidgetLayout); });
}

function setupWidgetPointerDrag(handle, card, id) {
  let moving = null;
  const entry = () => state.widgetLayout.find((item) => item.id === id);
  handle.addEventListener('pointerdown', (event) => {
    if (!editingPage || event.button !== 0) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    moving = { moved: false, free: freeWidgetsEnabled(), pointer: event.pointerId, x: event.clientX, y: event.clientY, scroll: scrollY, startX: entry().x, startY: entry().y };
    handle.setPointerCapture(event.pointerId); card.classList.add('widget-dragging');
    card.style.pointerEvents = 'none';
  });
  handle.addEventListener('pointermove', (event) => {
    if (!moving || moving.pointer !== event.pointerId) return;
    if (Math.abs(event.clientX - moving.x) + Math.abs(event.clientY - moving.y) > 4) moving.moved = true;
    if (!moving.moved) return;
    if (!moving.free) {
      const root = document.elementFromPoint(event.clientX, event.clientY)?.closest('.widgets');
      if (root) {
        const box = root.getBoundingClientRect();
        if (event.clientY > box.bottom - 30) root.scrollBy(0, 12);
        if (event.clientY < box.top + 30) root.scrollBy(0, -12);
      }
      if (event.clientY > innerHeight - 40) window.scrollBy(0, 12);
      if (event.clientY < 40) window.scrollBy(0, -12);
      return;
    }
    const item = entry();
    item.x = Math.round(Math.max(0, Math.min(4000, document.body.clientWidth - card.offsetWidth - 12, moving.startX + event.clientX - moving.x)));
    item.y = Math.round(Math.max(80, Math.min(4000, moving.startY + event.clientY - moving.y + scrollY - moving.scroll)));
    card.style.setProperty('--widget-x', `${item.x}px`); card.style.setProperty('--widget-y', `${item.y}px`);
    if (event.clientY > innerHeight - 40) window.scrollBy(0, 12);
    if (event.clientY < 40) window.scrollBy(0, -12);
  });
  const finish = (event) => {
    if (!moving || moving.pointer !== event.pointerId) return;
    const target = !moving.free && event.type === 'pointerup' ? document.elementFromPoint(event.clientX, event.clientY) : null;
    const root = target?.closest('.widgets');
    const didMove = moving.moved;
    if (event.type === 'pointercancel' && moving.free) { entry().x = moving.startX; entry().y = moving.startY; }
    moving = null; card.classList.remove('widget-dragging');
    card.style.removeProperty('pointer-events');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (!didMove) return;
    if (root) moveWidget(id, root.classList.contains('widgets-right') ? 3 : root.classList.contains('widgets-center') ? 2 : 1, target.closest('[data-widget]')?.dataset.widget);
    else saveWidgetLayout();
  };
  handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish);
  handle.addEventListener('keydown', (event) => {
    if (!editingPage || !freeWidgetsEnabled() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const item = entry(), step = event.shiftKey ? 1 : 10;
    item.x = Math.max(0, Math.min(4000, document.body.clientWidth - card.offsetWidth - 12, item.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)));
    item.y = Math.max(80, Math.min(4000, item.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)));
    saveWidgetLayout();
  });
}

function weekDays() {
  const monday = new Date(); monday.setHours(12, 0, 0, 0); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(date.getDate() + index); return localDayKey(date); });
}
function habitStreak(history, today = new Date()) {
  const days = new Set(history || []); const cursor = new Date(today); cursor.setHours(12, 0, 0, 0);
  if (!days.has(localDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDayKey(cursor)) && streak <= 366) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function renderStatistics() {
  const days = weekDays(); const history = state.widgets.focusHistory;
  const totals = days.map((day) => history.find((entry) => entry.day === day) || { day, seconds: 0, sessions: 0 });
  const seconds = totals.reduce((sum, entry) => sum + entry.seconds, 0), sessions = totals.reduce((sum, entry) => sum + entry.sessions, 0);
  const names = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const root = document.getElementById('focus-statistics'); root.replaceChildren();
  root.append(el('p', 'stat-total', `${Math.floor(seconds / 3600)} h ${Math.floor(seconds / 60) % 60} min de enfoque · ${sessions} sesiones`));
  const chart = el('div', 'week-chart'); chart.setAttribute('aria-label', 'Enfoque por día de la semana');
  const max = Math.max(1, ...totals.map((entry) => entry.seconds));
  totals.forEach((entry, index) => {
    const column = el('div', 'week-day'); const bar = el('div', 'week-bar'); bar.style.height = `${entry.seconds / max * 56}px`;
    column.title = `${entry.day}: ${Math.round(entry.seconds / 60)} min · ${entry.sessions} sesiones`;
    column.append(bar, el('small', '', names[index])); chart.append(column);
  }); root.append(chart);
  const best = [...totals].sort((a, b) => b.sessions - a.sessions || b.seconds - a.seconds)[0];
  if (best.sessions) root.append(el('p', 'widget-hint', `Mejor día: ${new Date(`${best.day}T12:00:00`).toLocaleDateString('es', { weekday: 'long' })} · ${best.sessions} sesiones`));
  if (sessions && !seconds) root.append(el('p', 'widget-hint', 'Las sesiones anteriores a esta versión no tienen minutos registrados.'));
  const habits = document.getElementById('habit-statistics'); habits.replaceChildren();
  const header = el('div', 'habit-week'); header.append(el('span', '', 'Hábitos')); names.forEach((name) => header.append(el('small', '', name))); habits.append(header);
  state.widgets.habits.forEach((habit) => {
    const row = el('div', 'habit-week'); const label = el('span', 'habit-week-name', habit.name); label.title = habit.name; row.append(label);
    days.forEach((day) => {
      const dot = el('span', `habit-dot${habit.history.includes(day) ? ' completed' : ''}${day > localDayKey() ? ' future' : ''}`);
      dot.title = `${day} · ${habit.history.includes(day) ? 'Completado' : 'Sin completar'}`; dot.setAttribute('aria-label', dot.title); row.append(dot);
    }); habits.append(row, el('p', 'habit-streak', `Racha: ${habitStreak(habit.history)} días`));
  });
}
