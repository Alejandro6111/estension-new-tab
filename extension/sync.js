/* Sincronización voluntaria. El hash impide aplicar conjuntos parciales. */
const SYNC_MANIFEST = 'auroraSyncManifest';
const SYNC_CHUNK_PREFIX = 'auroraSyncChunk';
let syncEnabled = false, syncTimer, syncReadTimer, applyingSync = false;
let syncWork = Promise.resolve();
let lastSyncFingerprint = '';
function syncAvailable() { return hasChromeStorage && !!chrome.storage.sync; }
function syncStatus(message) { document.getElementById('sync-status').textContent = message; }
function portableDashboard(source) {
  const data = dashboardSnapshot(source);
  data.settings.trackPages = false;
  const emptyPlaylist = { ids: [], enabled: false, every: 1, unit: 'days', startedAt: 0 };
  data.backgroundPlaylists = { image: { ...emptyPlaylist }, video: { ...emptyPlaylist } };
  data.widgets.focus.endsAt = 0; data.widgets.focus.remaining = data.widgets.focus.duration;
  if (/^data:/i.test(data.background.value)) data.background = { type: 'gradient', value: '' };
  return data;
}
function syncPayload() {
  captureActiveProfile();
  return { schema: 1, updatedAt: state.updatedAt || Date.now(), dashboard: portableDashboard(state), activeProfile: state.activeProfile,
    profiles: state.profiles.map((profile) => ({ id: profile.id, name: profile.name, data: portableDashboard(profile.id === state.activeProfile ? state : profile.data) })),
    profileRules: structuredClone(state.profileRules) };
}
async function syncDigest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function updateSyncUI() {
  document.getElementById('sync-enabled').checked = syncEnabled;
  document.getElementById('sync-enabled').disabled = !syncAvailable();
  document.getElementById('sync-upload').disabled = !syncAvailable() || !syncEnabled;
  document.getElementById('sync-download').disabled = !syncAvailable() || !syncEnabled;
}
function scheduleSync() {
  if (!syncEnabled || applyingSync || !syncAvailable()) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => queueSync(() => uploadSync(false)), 2500);
}
function queueSync(operation) {
  syncWork = syncWork.catch(() => {}).then(operation).catch((error) => { syncStatus(error.message || 'No se pudo sincronizar. Reintenta cuando haya conexión.'); });
  return syncWork;
}
async function uploadSync(manual = false) {
  if (!syncEnabled || !syncAvailable()) return;
  const payload = syncPayload();
  const serialized = JSON.stringify(payload);
  const fingerprint = await syncDigest(JSON.stringify({ ...payload, updatedAt: 0 }));
  if (!manual && fingerprint === lastSyncFingerprint) return;
  const bytes = new TextEncoder().encode(serialized);
  let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const encoded = btoa(binary), chunks = [];
  for (let index = 0; index < encoded.length; index += 6000) chunks.push(encoded.slice(index, index + 6000));
  const hash = await syncDigest(serialized);
  const manifest = { schema: 1, updatedAt: payload.updatedAt, count: chunks.length, hash };
  const items = { [SYNC_MANIFEST]: manifest };
  chunks.forEach((chunk, index) => { items[`${SYNC_CHUNK_PREFIX}${index}`] = chunk; });
  if (chunks.length > 14 || new TextEncoder().encode(JSON.stringify(items)).length > 80 * 1024) throw new Error('La copia supera 80 KB. Reduce accesos o historial de perfiles, o usa Exportar copia para transferir todo.');
  if (!manual) {
    const remote = await readSync();
    if (remote && remote.updatedAt > state.updatedAt) { await applySyncedPayload(remote); return; }
  }
  syncStatus('Enviando copia al navegador…');
  await chrome.storage.sync.set(items);
  const all = await chrome.storage.sync.get(null);
  const unused = Object.keys(all).filter((key) => key.startsWith(SYNC_CHUNK_PREFIX) && !(key in items));
  if (unused.length) await chrome.storage.sync.remove(unused);
  lastSyncFingerprint = fingerprint;
  syncStatus(`Copia enviada · ${Math.ceil(encoded.length / 1024)} KB. El navegador la distribuirá cuando sincronice.`);
}
async function readSync() {
  if (!syncAvailable()) return null;
  const raw = await chrome.storage.sync.get(null), manifest = raw[SYNC_MANIFEST];
  if (manifest === undefined) return null;
  if (!isRecord(manifest) || manifest.schema !== 1 || !Number.isInteger(manifest.count) || manifest.count < 1 || manifest.count > 14 ||
    !Number.isFinite(manifest.updatedAt) || manifest.updatedAt < 0 || typeof manifest.hash !== 'string' || !/^[a-f\d]{64}$/.test(manifest.hash)) throw new Error('La copia sincronizada no tiene un formato válido.');
  const chunks = Array.from({ length: manifest.count }, (_, index) => raw[`${SYNC_CHUNK_PREFIX}${index}`]);
  if (chunks.some((chunk) => typeof chunk !== 'string' || chunk.length > 6000)) return null;
  let serialized;
  try {
    const binary = atob(chunks.join('')); serialized = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch { return null; }
  if (await syncDigest(serialized) !== manifest.hash) return null;
  const payload = JSON.parse(serialized);
  if (!isRecord(payload) || payload.schema !== 1 || payload.updatedAt !== manifest.updatedAt || !Array.isArray(payload.profiles) || !payload.profiles.length) throw new Error('La copia sincronizada no es válida.');
  return payload;
}
async function applySyncedPayload(payload, manual = false) {
  await localWrite.catch(() => {});
  if (!syncEnabled || !manual && payload.updatedAt <= state.updatedAt) return;
  const next = normalizeState({ ...payload.dashboard, profiles: payload.profiles, activeProfile: payload.activeProfile, profileRules: payload.profileRules }, true);
  // Conserva los datos que nunca salen de este equipo.
  next.media = state.media; next.privacy = state.privacy; next.tabSessions = state.tabSessions;
  next.settings.trackPages = state.settings.trackPages;
  next.updatedAt = payload.updatedAt; next.profileOverrideUntil = state.profileOverrideUntil;
  next.profiles.forEach((profile) => {
    const local = state.profiles.find((entry) => entry.id === profile.id);
    if (local && /^data:/i.test(local.data.background.value)) profile.data.background = structuredClone(local.data.background);
    if (local?.data.widgets.focus.endsAt) profile.data.widgets.focus = structuredClone(local.data.widgets.focus);
    if (local) profile.data.backgroundPlaylists = structuredClone(local.data.backgroundPlaylists);
  });
  const active = next.profiles.find((profile) => profile.id === next.activeProfile);
  next.background = structuredClone(active.data.background);
  next.widgets.focus = structuredClone(active.data.widgets.focus);
  next.backgroundPlaylists = structuredClone(active.data.backgroundPlaylists);
  next.media = normalizeMediaState({ library: next.media.library, playlists: next.backgroundPlaylists }, next.background);
  applyingSync = true;
  try {
    await storageSet('auroraBeforeSync', state);
    if (!manual && payload.updatedAt <= state.updatedAt) return;
    const snapshot = structuredClone(next);
    // Encola la copia antes de permitir nuevas ediciones: sus escrituras van después.
    localWrite = localWrite.catch(() => {}).then(() => storageSet(STORAGE_KEY, snapshot));
    state = next; applyCurrentState(); syncSettingsFormFromState();
    await localWrite;
    lastSyncFingerprint = await syncDigest(JSON.stringify({ ...syncPayload(), updatedAt: 0 }));
    syncStatus('Copia sincronizada aplicada. Se conservan la actividad, las sesiones y los fondos locales.');
  } finally { applyingSync = false; }
}
async function downloadSync(manual = false) {
  if (!syncEnabled) return;
  const payload = await readSync();
  if (!payload) { if (manual) syncStatus('No hay una copia completa. Si acabas de enviarla, espera a que el navegador termine de sincronizar.'); return; }
  if (manual || payload.updatedAt > state.updatedAt) await applySyncedPayload(payload, manual);
}
async function setupSync() {
  syncEnabled = await storageGet('auroraSyncEnabled') === true && syncAvailable(); updateSyncUI();
  if (!syncAvailable()) syncStatus('Disponible al instalar Aurora como extensión.');
  document.getElementById('sync-enabled').addEventListener('change', async (event) => {
    syncEnabled = event.target.checked; await storageSet('auroraSyncEnabled', syncEnabled); updateSyncUI();
    if (syncEnabled) queueSync(async () => {
      const remote = await readSync();
      if (remote) await applySyncedPayload(remote, true); else await uploadSync(true);
    });
    else { clearTimeout(syncTimer); syncStatus('Sincronización desactivada en este equipo. La copia del navegador permanece guardada.'); }
  });
  document.getElementById('sync-upload').addEventListener('click', () => queueSync(async () => { await localWrite.catch(() => {}); state.updatedAt = Date.now(); await uploadSync(true); }));
  document.getElementById('sync-download').addEventListener('click', () => queueSync(() => downloadSync(true)));
  document.getElementById('sync-previous-export').addEventListener('click', async () => {
    const previous = await storageGet('auroraBeforeSync');
    if (!previous) { syncStatus('Aún no se ha aplicado una copia remota en este equipo.'); return; }
    downloadBackup(previous, 'antes-de-sincronizar'); syncStatus('Copia anterior descargada. Puedes recuperarla con Importar copia.');
  });
  if (syncAvailable()) chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.auroraSyncEnabled) { syncEnabled = changes.auroraSyncEnabled.newValue === true; updateSyncUI(); }
    if (area !== 'sync' || !syncEnabled || !Object.keys(changes).some((key) => key === SYNC_MANIFEST || key.startsWith(SYNC_CHUNK_PREFIX))) return;
    clearTimeout(syncReadTimer); syncReadTimer = setTimeout(() => queueSync(() => downloadSync()), 700);
  });
  if (syncEnabled) await queueSync(() => downloadSync());
}
