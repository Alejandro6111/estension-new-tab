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
