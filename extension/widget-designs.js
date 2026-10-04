/* Diseños locales: solo cambian disposición y dimensiones, nunca contenido. */
const WIDGET_DESIGNS = [
  { id: 'original', name: 'Original', description: 'La vista inicial: seis widgets a la izquierda y cinco a la derecha.', left: 'clock weather quote todo focus notes', right: 'calendar sports habits time statistics' },
  { id: 'slim', name: 'Laterales compactos', description: 'Columnas estrechas para dar más espacio a los accesos.', left: 'clock weather quote todo focus notes', right: 'calendar sports habits time statistics', settings: { leftWidgetWidth: 200, rightWidgetWidth: 200, widgetGap: 10 } },
  { id: 'wide', name: 'Laterales amplios', description: 'Más ancho para las tareas, notas y calendarios.', left: 'clock weather quote todo focus notes', right: 'calendar sports habits time statistics', settings: { leftWidgetWidth: 320, rightWidgetWidth: 320 } },
  { id: 'balance', name: 'Equilibrado', description: 'Cuatro widgets por lateral y tres en una fila inferior.', left: 'clock weather quote todo', right: 'calendar sports habits time', center: 'focus notes statistics', settings: { centerWidgetColumns: 3 } },
  { id: 'center-two', name: 'Centro en dos columnas', description: 'Enfoque, notas y estadísticas debajo de los accesos, en dos columnas.', left: 'clock weather quote todo', right: 'calendar sports habits time', center: 'focus notes statistics', settings: { centerWidgetColumns: 2 } },
  { id: 'center-stack', name: 'Centro vertical', description: 'Los tres widgets centrales se apilan debajo de los accesos.', left: 'clock weather quote todo', right: 'calendar sports habits time', center: 'focus notes statistics' },
  { id: 'productivity', name: 'Productividad', description: 'Tareas y enfoque a la izquierda; notas y seguimiento en el centro.', left: 'clock todo focus', right: 'calendar sports', center: 'weather quote notes habits time statistics', settings: { centerWidgetColumns: 3 } },
  { id: 'study', name: 'Estudio', description: 'Clima, tareas y notas a la izquierda; enfoque y hábitos debajo.', left: 'clock weather todo notes', right: 'calendar sports', center: 'quote focus habits time statistics', settings: { centerWidgetColumns: 3, leftWidgetWidth: 280 } },
  { id: 'focus', name: 'Enfoque', description: 'Temporizador, tareas y notas juntos en una fila central.', left: 'clock weather quote', right: 'calendar sports time', center: 'focus todo notes habits statistics', settings: { centerWidgetColumns: 3 } },
  { id: 'calendar', name: 'Agenda', description: 'Calendarios amplios a la derecha y seguimiento en el centro.', left: 'clock weather quote todo', right: 'calendar sports', center: 'focus notes habits time statistics', settings: { rightWidgetWidth: 340, centerWidgetColumns: 3 } },
  { id: 'habits', name: 'Rutinas', description: 'Hábitos y tiempo juntos a la izquierda; herramientas en el centro.', left: 'clock weather habits time', right: 'calendar sports', center: 'quote todo focus notes statistics', settings: { centerWidgetColumns: 3 } },
  { id: 'notes', name: 'Cuaderno', description: 'Notas primero, en un bloque central de dos columnas.', left: 'clock weather quote todo', right: 'calendar sports', center: 'notes focus habits time statistics', settings: { centerWidgetColumns: 2 } },
  { id: 'left', name: 'Todo a la izquierda', description: 'Todos los widgets en una única columna izquierda.', left: 'clock weather quote todo focus notes calendar sports habits time statistics', settings: { leftWidgetWidth: 300 } },
  { id: 'right', name: 'Todo a la derecha', description: 'Todos los widgets en una única columna derecha.', right: 'clock weather quote todo focus notes calendar sports habits time statistics', settings: { rightWidgetWidth: 300 } },
  { id: 'center', name: 'Panel inferior', description: 'Todos los widgets debajo de los accesos, en tres columnas.', center: 'clock weather quote todo focus notes calendar sports habits time statistics', settings: { centerWidgetColumns: 3 } },
  { id: 'top', name: 'Franja superior', description: 'Herramientas personales y calendarios encima de los accesos.', left: 'clock weather quote todo focus notes', right: 'calendar sports habits time statistics', settings: { layout: 'superior' } },
  { id: 'free', name: 'Posición libre', description: 'Parte de los laterales originales y arrastra cada widget a cualquier posición.', left: 'clock weather quote todo focus notes', right: 'calendar sports habits time statistics', settings: { widgetPlacement: 'free' } },
  { id: 'board', name: 'Tablero libre', description: 'Todos los widgets en un tablero de cuatro columnas debajo de los accesos, con posiciones libres.', center: 'clock weather quote todo focus notes calendar sports habits time statistics', settings: { widgetPlacement: 'free', centerWidgetColumns: 4 } },
  { id: 'reference', name: 'Referencia de tu captura', description: 'Accesos de 700 px, laterales estrechos y herramientas repartidas en el espacio inferior. Puedes arrastrarlas libremente.', left: 'clock weather quote todo focus notes', right: 'calendar sports habits time statistics', settings: { widgetPlacement: 'free' } },
];

const WIDGET_ZONE_CONTROLS = [
  ['left', 'Izquierda', 1], ['right', 'Derecha', 3], ['center', 'Centro inferior', 2],
];

function defaultWidgetAreaSettings() {
  const defaults = defaultState().settings;
  return Object.fromEntries(['widgetPlacement', 'leftWidgetWidth', 'rightWidgetWidth', 'centerWidgetWidth',
    'leftWidgetHeight', 'rightWidgetHeight', 'centerWidgetHeight', 'leftWidgetColumns', 'rightWidgetColumns',
    'centerWidgetColumns', 'widgetGap', 'shortcutsWidth'].map((key) => [key, defaults[key]]));
}

function applyWidgetDesign(id) {
  const design = WIDGET_DESIGNS.find((item) => item.id === id);
  if (!design) return;
  const previous = state.widgetLayout;
  Object.assign(state.settings, defaultWidgetAreaSettings(), { layout: 'lateral', widgetDesign: id }, design.settings);
  state.widgetLayout = [];
  [['left', 1], ['center', 2], ['right', 3]].forEach(([zone, column]) => {
    (design[zone] || '').split(' ').filter(Boolean).forEach((widgetId, order) => {
      const saved = previous.find((entry) => entry.id === widgetId);
      state.widgetLayout.push({ id: widgetId, column, order, size: 'medium', hidden: saved?.hidden === true, width: 0, height: 0, x: 0, y: 0 });
    });
  });
  applyLayout(state.settings.layout);
  const freePlacement = state.settings.widgetPlacement === 'free';
  state.settings.widgetPlacement = 'columns';
  applyWidgetLayout();
  if (freePlacement) {
    if (id === 'board') {
      const width = Math.max(200, Math.min(300, Math.floor((innerWidth - 120) / 4)));
      state.widgetLayout.forEach((entry, index) => {
        entry.width = width; entry.x = 28 + index % 4 * (width + 18); entry.y = 460 + Math.floor(index / 4) * 430;
      });
    } else if (id === 'reference') {
      const right = Math.max(28, innerWidth - 314);
      state.widgetLayout.forEach((entry) => {
        entry.width = ['notes', 'statistics'].includes(entry.id) ? 360 : 236;
      });
      const place = (ids, x, starts) => {
        let next = 90;
        ids.forEach((widgetId, index) => {
          const entry = state.widgetLayout.find((item) => item.id === widgetId);
          const card = document.querySelector(WIDGETS.find((widget) => widget.id === widgetId).selector);
          entry.x = x; entry.y = Math.max(starts[index], next);
          next = entry.y + card.offsetHeight + 14;
        });
      };
      place(['clock', 'weather', 'quote', 'todo', 'focus'], 28, [90, 190, 275, 370, 630]);
      place(['calendar', 'sports', 'habits', 'time'], right, [90, 350, 650, 845]);
      state.widgetLayout.find((entry) => entry.id === 'notes').x = Math.round(innerWidth * .25);
      state.widgetLayout.find((entry) => entry.id === 'statistics').x = Math.round(innerWidth * .52);
      ['notes', 'statistics'].forEach((widgetId) => { state.widgetLayout.find((entry) => entry.id === widgetId).y = 780; });
    } else captureFreeWidgetPositions();
    state.settings.widgetPlacement = 'free';
    applyWidgetLayout();
  }
  persist();
  syncWidgetDesignSettings();
  if (document.getElementById('settings-modal').hidden) announce(`Diseño ${design.name} aplicado.`);
  else document.getElementById('aurora-announcement').hidden = true;
}

function syncWidgetDesignSettings() {
  if (!state) return;
  document.querySelectorAll('[data-widget-design]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.widgetDesign === state.settings.widgetDesign));
  });
  const name = WIDGET_DESIGNS.find((design) => design.id === state.settings.widgetDesign)?.name || 'Personalizado';
  document.getElementById('widget-design-status').textContent = `Diseño actual: ${name}`;
  document.getElementById('widget-placement').value = state.settings.widgetPlacement;
  setGroupActive('layout-group', 'layout', state.settings.layout);
  document.querySelectorAll('[data-widget-setting]').forEach((input) => { input.value = state.settings[input.dataset.widgetSetting]; });
  document.getElementById('shortcuts-width').value = state.settings.shortcutsWidth;
  document.getElementById('widget-gap').value = state.settings.widgetGap;
}

function setupWidgetDesignSettings() {
  const gallery = document.getElementById('widget-designs');
  WIDGET_DESIGNS.forEach((design) => {
    const button = action('', () => applyWidgetDesign(design.id), 'widget-design-option');
    button.dataset.widgetDesign = design.id;
    button.setAttribute('aria-label', `Aplicar diseño ${design.name}`);
    button.append(el('strong', '', design.name));
    const counts = ['left', 'center', 'right'].map((zone) => (design[zone] || '').split(' ').filter(Boolean).length);
    button.append(el('span', 'widget-design-counts', `Izq. ${counts[0]} · Centro ${counts[1]} · Der. ${counts[2]}`));
    button.append(el('span', 'widget-design-description', design.description));
    gallery.append(button);
  });
  const setNumber = (input, key, min, max) => {
    input.addEventListener('change', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || !input.value.trim()) { syncWidgetDesignSettings(); return; }
      state.settings[key] = Math.max(min, Math.min(max, Math.round(value)));
      state.settings.widgetDesign = 'custom'; applyWidgetLayout(); persist(); syncWidgetDesignSettings();
    });
  };
  const root = document.getElementById('widget-zone-settings');
  WIDGET_ZONE_CONTROLS.forEach(([zone, name]) => {
    const group = el('fieldset', 'widget-zone-group'); group.append(el('legend', '', name));
    const fields = el('div', 'widget-area-fields');
    [['Width', 'Ancho (px)', zone === 'center' ? 0 : 200, zone === 'center' ? 2400 : 640], ['Height', 'Alto (px)', 0, 2000]].forEach(([suffix, label, min, max]) => {
      const field = el('label', '', label), input = el('input');
      input.type = 'number'; input.min = String(min); input.max = String(max); input.step = '10'; input.id = `widget-${zone}-${suffix.toLowerCase()}`;
      input.dataset.widgetSetting = `${zone}Widget${suffix}`; input.setAttribute('aria-label', `${label} de ${name}`);
      setNumber(input, input.dataset.widgetSetting, min, max); field.append(input); fields.append(field);
    });
    const field = el('label', '', 'Columnas'), select = el('select');
    select.id = `widget-${zone}-columns`; select.dataset.widgetSetting = `${zone}WidgetColumns`; select.setAttribute('aria-label', `Columnas de ${name}`);
    [1, 2, 3, 4].forEach((count) => { const option = el('option', '', String(count)); option.value = String(count); select.append(option); });
    setNumber(select, select.dataset.widgetSetting, 1, 4); field.append(select); fields.append(field); group.append(fields); root.append(group);
  });
  setNumber(document.getElementById('shortcuts-width'), 'shortcutsWidth', 320, 1600);
  setNumber(document.getElementById('widget-gap'), 'widgetGap', 4, 48);
  document.getElementById('widget-placement').addEventListener('change', (event) => {
    if (event.target.value === 'free' && state.settings.widgetPlacement !== 'free') captureFreeWidgetPositions();
    state.settings.widgetPlacement = event.target.value === 'free' ? 'free' : 'columns';
    state.settings.layout = 'lateral'; state.settings.widgetDesign = 'custom';
    applyLayout('lateral'); applyWidgetLayout(); persist(); syncWidgetDesignSettings();
    setGroupActive('layout-group', 'layout', 'lateral');
  });
  document.getElementById('widget-design-reset').addEventListener('click', () => applyWidgetDesign('original'));
  document.getElementById('layout-editor-settings').addEventListener('click', () => { openSettings(); setSettingsSection('vista'); });
  syncWidgetDesignSettings();
}
