/* ----------------------------------- Modales ----------------------------------- */

const focusBeforeModal = new Map();
const modalStack = [];
function openModal(id) {
  if (!document.getElementById(id).hidden) return;
  closeCommands();
  focusBeforeModal.set(id, document.activeElement);
  modalStack.push(id);
  const modal = document.getElementById(id);
  modal.hidden = false;
  const first = [...modal.querySelectorAll('input, select, textarea, button')]
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
  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay.id); });
  });
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById(modalStack.at(-1));
    if (!modal) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeModal(modal.id); }
    if (e.key === 'Tab') {
      const focusables = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, a[href]')]
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
    if (!boundedText(name, 120) || !url || url.length > 4096 || !state.categories.includes(category) || state.shortcuts.length >= 2000) return;
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
    if (!boundedText(name, 60) || state.categories.length >= 100) return;
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
    if (!boundedText(name, 60)) { status.textContent = 'Escribe un nombre de hasta 60 caracteres.'; return; }
    if (state.categories.some((cat) => cat !== categoryToRename && cat.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      status.textContent = 'Ya existe una categoría con ese nombre.';
      return;
    }
    const index = state.categories.indexOf(categoryToRename);
    if (index < 0) return;
    state.categories[index] = name;
    state.shortcuts.forEach((shortcut) => { if (shortcut.category === categoryToRename) shortcut.category = name; });
    state.todos.forEach((todo) => { if (todo.category === categoryToRename) todo.category = name; });
    if (state.activeCategory === categoryToRename) state.activeCategory = name;
    categoryToRename = null;
    persist();
    renderCategories();
    renderShortcuts();
    closeModal('rename-category-modal');
    renderTodos();
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
