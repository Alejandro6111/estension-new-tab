/* Paleta accesible con búsqueda, acciones y una calculadora sin eval. */
const SEARCH_ENGINES = { google: 'https://www.google.com/search?q=', bing: 'https://www.bing.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=', ecosia: 'https://www.ecosia.org/search?q=' };
let commandOptions = [], commandIndex = 0;
function fold(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase(); }
function calculate(expression) {
  if (!expression.trim() || expression.length > 200) throw new Error('Escribe una operación de hasta 200 caracteres.');
  const source = expression.replace(/,/g, '.');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%^]/g) || [];
  if (tokens.join('') !== source.replace(/\s/g, '')) throw new Error('Usa números, paréntesis y + − * / % ^.');
  let index = 0, depth = 0;
  const atom = () => {
    if (++depth > 40) throw new Error('La operación tiene demasiados paréntesis.');
    let result;
    if (tokens[index] === '(') { index++; result = sum(); if (tokens[index++] !== ')') throw new Error('Falta cerrar un paréntesis.'); }
    else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(tokens[index] || '')) result = Number(tokens[index++]);
    else throw new Error('La operación está incompleta.');
    depth--; return result;
  };
  const unary = () => {
    if (tokens[index] === '+' || tokens[index] === '-') { const sign = tokens[index++]; if (++depth > 40) throw new Error('Demasiados signos.'); const result = unary(); depth--; return sign === '-' ? -result : result; }
    let result = atom(); if (tokens[index] === '^') { index++; result **= unary(); } return result;
  };
  const product = () => {
    let result = unary();
    while (['*', '/', '%'].includes(tokens[index])) { const op = tokens[index++], right = unary(); result = op === '*' ? result * right : op === '/' ? result / right : result % right; }
    return result;
  };
  const sum = () => {
    let result = product();
    while (['+', '-'].includes(tokens[index])) { const op = tokens[index++], right = product(); result = op === '+' ? result + right : result - right; }
    return result;
  };
  const result = sum();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error('La operación no tiene un resultado finito.');
  return Number(result.toPrecision(12));
}
function startFocus(minutes) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new Error('Elige entre 1 y 180 minutos.');
  Object.assign(state.widgets.focus, { kind: 'focus', duration: minutes * 60, remaining: minutes * 60, endsAt: Date.now() + minutes * 60000 });
  persist(); renderFocus(); announce(`Enfoque de ${minutes} minutos iniciado.`);
}
function settingsCommand(section) { openSettings(); setSettingsSection(section); }
function commandActions() {
  return [
    { label: 'Buscar en el buscador elegido', hint: 'Escribe tu búsqueda', run: () => seedCommand('') },
    { label: 'Abrir YouTube', hint: 'yt palabras', run: () => openNewTab('https://youtube.com') },
    { label: 'Añadir pendiente', hint: 'todo entregar trabajo SQL', run: () => openTaskEditor() },
    { label: 'Crear nota', hint: 'note revisar ejercicio 4', run: () => seedCommand('note ') },
    { label: 'Iniciar enfoque 25 min', hint: 'focus 25', run: () => startFocus(25) },
    { label: 'Cambiar fondo', hint: '> fondos', run: () => settingsCommand('fondo') },
    { label: 'Abrir ajustes', hint: '> ajustes', run: openSettings },
    { label: 'Ver actividad', hint: '> actividad', run: () => settingsCommand('datos') },
    { label: 'Cambiar perfil', hint: '> cambiar perfil', run: () => settingsCommand('perfiles') },
    { label: 'Editar página', hint: '> editar', run: () => setEditingPage(true) },
    { label: 'Ver clima', hint: 'weather', run: openWeatherDetails },
    { label: 'Crear evento', hint: '> evento', run: () => openEventEditor() },
    { label: 'Pestañas y sesiones', hint: '> sesiones', run: () => settingsCommand('sesiones') },
    { label: 'Calcular', hint: 'calc 3500 * 22', run: () => seedCommand('calc ') },
  ];
}
function seedCommand(value) { const input = document.getElementById('search-input'); input.value = value; input.focus(); renderCommands(); }
function searchWeb(value) {
  const looksLikeUrl = /^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(value) && !value.includes(' ');
  if (looksLikeUrl) { if (!normalizeUrl(value)) throw new Error('La URL no es válida.'); openNewTab(value); }
  else openNewTab((SEARCH_ENGINES[state.settings.searchEngine] || SEARCH_ENGINES.google) + encodeURIComponent(value));
}
function runCommand(raw) {
  const value = raw.trim().replace(/^\/\s*/, '');
  const match = /^(yt|gh|todo|note|focus|calc|weather)(?:\s+(.*))?$/i.exec(value);
  if (match) {
    const command = match[1].toLowerCase(), argument = (match[2] || '').trim();
    if (command === 'yt' || command === 'gh') openNewTab(command === 'yt' ? `https://www.youtube.com/results?search_query=${encodeURIComponent(argument)}` : `https://github.com/search?q=${encodeURIComponent(argument)}`);
    if (command === 'todo') { if (argument) { if (addTodo(argument)) announce('Tarea añadida.'); } else openTaskEditor(); }
    if (command === 'note') {
      if (!argument) { seedCommand('note '); return; }
      const note = [state.widgets.note, argument].filter(Boolean).join('\n');
      if (note.length > 4000) throw new Error('La libreta supera 4000 caracteres. Acorta la nota antes de añadirla.');
      state.widgets.note = note; persist(); renderNotes(); announce('Nota guardada.');
    }
    if (command === 'focus') startFocus(argument ? Number(argument) : 25);
    if (command === 'weather') openWeatherDetails();
    if (command === 'calc') { document.getElementById('command-status').textContent = `${argument} = ${calculate(argument).toLocaleString('es-CO', { maximumSignificantDigits: 12 })}`; return; }
    document.getElementById('search-input').value = ''; return;
  }
  if (value.startsWith('>')) {
    const key = fold(value.slice(1).trim());
    const aliases = { ajustes: 'Abrir ajustes', fondos: 'Cambiar fondo', actividad: 'Ver actividad', 'cambiar perfil': 'Cambiar perfil', perfiles: 'Cambiar perfil', editar: 'Editar página', evento: 'Crear evento', sesiones: 'Pestañas y sesiones' };
    const option = commandActions().find((entry) => entry.label === aliases[key] || fold(entry.label) === key);
    if (option) { option.run(); return; }
    throw new Error('Comando desconocido. Escribe / para ver las acciones.');
  }
  if (value.startsWith('@')) {
    const options = shortcutMatches(value); if (!options.length) throw new Error('No hay accesos que coincidan con esa categoría o perfil.'); options[0].run(); return;
  }
  searchWeb(value);
}
function shortcutMatches(query) {
  let dashboards = [{ name: '', data: state }], term = query;
  if (query.startsWith('@')) {
    const scope = /^@([^\s]+)\s*(.*)$/.exec(query);
    if (!scope) return [];
    const category = state.categories.find((name) => fold(name).includes(fold(scope[1])));
    term = scope[2];
    dashboards = category ? [{ name: category, data: { shortcuts: state.shortcuts.filter((shortcut) => shortcut.category === category) } }]
      : state.profiles.filter((profile) => fold(profile.name).includes(fold(scope[1]))).map((profile) => ({ name: profile.name, data: profile.id === state.activeProfile ? state : profile.data }));
  }
  return dashboards.flatMap(({ name, data }) => data.shortcuts.filter((shortcut) => fold(`${shortcut.name} ${shortcut.url}`).includes(fold(term))).map((shortcut) => ({ label: shortcut.name, hint: name || shortcut.category, run: () => openNewTab(shortcut.url) }))).slice(0, 7);
}
function closeCommands() {
  document.getElementById('command-panel').hidden = true;
  const input = document.getElementById('search-input'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
}
function renderCommands() {
  const input = document.getElementById('search-input'), value = input.value.trim();
  if (!value) { closeCommands(); return; }
  if (value.startsWith('/') && !/^\/\s*(yt|gh|todo|note|focus|calc|weather)\s+/i.test(value) || value.startsWith('>')) {
    const term = fold(value.replace(/^[/>]\s*/, ''));
    commandOptions = commandActions().filter((entry) => fold(`${entry.label} ${entry.hint}`).includes(term));
  } else if (value.startsWith('@')) commandOptions = shortcutMatches(value);
  else {
    commandOptions = [{ label: /^(yt|gh|todo|note|focus|calc|weather)(?:\s|$)/i.test(value) ? `Ejecutar: ${value}` : `Buscar: ${value}`, hint: state.settings.searchEngine, run: () => runCommand(value) }, ...shortcutMatches(value)];
  }
  commandIndex = 0;
  const root = document.getElementById('command-results'); root.replaceChildren();
  commandOptions.forEach((option, index) => {
    const row = el('div', 'command-option'); row.id = `command-option-${index}`; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === commandIndex));
    row.append(el('span', '', option.label), el('small', '', option.hint)); row.addEventListener('mousedown', (event) => { event.preventDefault(); executeCommandOption(index); }); root.append(row);
  });
  if (!commandOptions.length) root.append(el('p', 'settings-hint', 'No hay resultados. Prueba otro nombre.'));
  document.getElementById('command-panel').hidden = false; input.setAttribute('aria-expanded', 'true');
  if (commandOptions.length) input.setAttribute('aria-activedescendant', 'command-option-0'); else input.removeAttribute('aria-activedescendant');
}
function executeCommandOption(index) {
  const option = commandOptions[index]; closeCommands();
  try { option?.run(); } catch (error) { document.getElementById('command-status').textContent = error.message; }
}
function setupSearch() {
  const input = document.getElementById('search-input');
  document.getElementById('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    if (!document.getElementById('command-panel').hidden && commandOptions.length) executeCommandOption(commandIndex);
    else { try { runCommand(input.value); } catch (error) { document.getElementById('command-status').textContent = error.message; } }
  });
  input.addEventListener('input', () => { document.getElementById('command-status').textContent = ''; renderCommands(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeCommands(); event.stopPropagation(); return; }
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if (document.getElementById('command-panel').hidden) renderCommands();
    if (!commandOptions.length) return;
    event.preventDefault(); commandIndex = (commandIndex + (event.key === 'ArrowDown' ? 1 : -1) + commandOptions.length) % commandOptions.length;
    document.querySelectorAll('.command-option').forEach((row, index) => row.setAttribute('aria-selected', String(index === commandIndex)));
    input.setAttribute('aria-activedescendant', `command-option-${commandIndex}`); document.getElementById(`command-option-${commandIndex}`).scrollIntoView({ block: 'nearest' });
  });
  input.addEventListener('blur', closeCommands);
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if ((event.key === '/' && !editing || (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') && !modalStack.length) {
      event.preventDefault(); seedCommand('/');
    }
    if ((event.ctrlKey || event.metaKey) && event.key === ',' && !modalStack.length) { event.preventDefault(); openSettings(); }
  });
}
