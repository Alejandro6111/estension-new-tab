/* Sesiones de ventanas y páginas recientes, con permiso tabs opcional. */
function tabsAvailable() { return hasChromeTabs && !!chrome.permissions; }
async function tabsAllowed() { return tabsAvailable() && await chrome.permissions.contains({ permissions: ['tabs'] }); }
function safeSessionTab(tab) {
  return tab && !tab.incognito && typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url) && normalizeUrl(tab.url) ?
    { title: (typeof tab.title === 'string' ? tab.title : tab.url).slice(0, 200), url: normalizeUrl(tab.url) } : null;
}
async function renderRecentTabs() {
  const root = document.getElementById('recent-tabs'); root.replaceChildren();
  if (!await tabsAllowed()) { root.append(el('p', 'settings-hint', 'Permite el acceso para ver páginas recientes y guardar una ventana.')); return; }
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const stored = await storageGet('auroraRecentTabs');
  const current = tabs.map((tab) => ({ ...safeSessionTab(tab), lastVisited: tab.lastAccessed || Date.now(), tabId: tab.id })).filter((tab) => tab.url);
  const entries = [...current, ...(Array.isArray(stored) ? stored : [])].filter((tab) => safeSessionTab(tab)).sort((a, b) => b.lastVisited - a.lastVisited);
  const seen = new Set();
  entries.filter((tab) => !seen.has(tab.url) && seen.add(tab.url)).slice(0, 12).forEach((tab) => {
    const button = action(tab.title || new URL(tab.url).hostname, async () => {
      if (tab.tabId) {
        try {
          const existing = await chrome.tabs.get(tab.tabId);
          if (existing.url === tab.url && !existing.incognito) { await chrome.tabs.update(tab.tabId, { active: true }); await chrome.windows.update(existing.windowId, { focused: true }); return; }
        } catch { /* La pestaña ya se cerró. */ }
      }
      openNewTab(tab.url);
    }, 'recent-tab'); button.title = tab.url; root.append(button);
  });
  if (!root.children.length) root.append(el('p', 'settings-hint', 'Aún no hay páginas recientes.'));
}
function renderSessions() {
  const root = document.getElementById('sessions-list'); root.replaceChildren();
  if (!state.tabSessions.length) root.append(el('p', 'settings-hint', 'Las sesiones que guardes aparecerán aquí.'));
  state.tabSessions.forEach((session) => {
    const row = el('div', 'session-row');
    row.append(el('strong', '', session.name), el('small', '', `${session.tabs.length} pestañas · ${new Date(session.createdAt).toLocaleDateString('es')}`));
    const details = el('details'); details.append(el('summary', '', 'Ver páginas'));
    session.tabs.forEach((tab) => details.append(el('p', 'settings-hint', tab.title || tab.url))); row.append(details);
    row.append(action('Abrir en otra ventana', async () => {
      try {
        if (!tabsAvailable() || !chrome.windows) { announce('Instala la extensión para restaurar una sesión.'); return; }
        await chrome.windows.create({ url: session.tabs.map((tab) => normalizeUrl(tab.url)), focused: true });
        document.getElementById('session-status').textContent = `Sesión «${session.name}» abierta.`;
      } catch { announce('No se pudo abrir la sesión. Reintenta.'); }
    }), action('Eliminar', () => { state.tabSessions = state.tabSessions.filter((entry) => entry.id !== session.id); persist(); renderSessions(); }));
    root.append(row);
  });
}
async function setupSessions() {
  document.getElementById('sessions-open').addEventListener('click', () => { openSettings(); setSettingsSection('sesiones'); renderRecentTabs(); });
  document.getElementById('tabs-connect').addEventListener('click', async () => {
    const status = document.getElementById('session-status');
    if (!tabsAvailable()) { status.textContent = 'Instala Aurora como extensión para usar las pestañas.'; return; }
    try {
      if (!await chrome.permissions.request({ permissions: ['tabs'] })) { status.textContent = 'No se concedió acceso a pestañas.'; return; }
      await storageSet('auroraTabsEnabled', true); status.textContent = 'Acceso permitido. Las páginas visitadas se guardarán localmente como recientes.'; renderRecentTabs();
    } catch { status.textContent = 'No se pudo solicitar acceso a las pestañas.'; }
  });
  document.getElementById('tabs-refresh').addEventListener('click', renderRecentTabs);
  document.getElementById('tabs-disconnect').addEventListener('click', async () => {
    await storageSet('auroraTabsEnabled', false); await storageSet('auroraRecentTabs', []);
    if (tabsAvailable() && !state.settings.trackPages) await chrome.permissions.remove({ permissions: ['tabs'] });
    document.getElementById('session-status').textContent = state.settings.trackPages ? 'Recientes desactivados. La actividad aún necesita permiso para pestañas.' : 'Acceso retirado y páginas recientes borradas. Las sesiones guardadas se conservan.';
    renderRecentTabs();
  });
  document.getElementById('session-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const status = document.getElementById('session-status');
    if (!await tabsAllowed()) { status.textContent = 'Pulsa Permitir acceso a pestañas antes de guardar una ventana.'; return; }
    try {
      const tabs = (await chrome.tabs.query({ currentWindow: true })).map(safeSessionTab).filter(Boolean);
      const name = document.getElementById('session-name').value.trim();
      if (!boundedText(name, 60) || !tabs.length) { status.textContent = 'Escribe un nombre y abre alguna página web en esta ventana.'; return; }
      if (tabs.length > 100 || state.tabSessions.length >= 20) { status.textContent = 'Máximo 20 sesiones de 100 pestañas. Cierra pestañas o elimina una sesión.'; return; }
      state.tabSessions.push({ id: uid(), name, createdAt: Date.now(), tabs }); await persist(); renderSessions();
      document.getElementById('session-name').value = ''; status.textContent = 'Sesión guardada.';
    } catch (error) { status.textContent = error.message || 'No se pudo guardar esta ventana.'; }
  });
  renderSessions();
}
