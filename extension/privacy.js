/* Funciones puras compartidas por la página y el trabajador de actividad. */
const BANKING_DOMAINS = ['bancolombia.com', 'grupobancolombia.com', 'davivienda.com', 'bancodebogota.com', 'bbva.com', 'bbva.com.co',
  'nequi.com.co', 'daviplata.com', 'bancocajasocial.com', 'bancoomeva.com.co', 'bancopopular.com.co', 'avvillas.com.co',
  'itau.co', 'nu.com.co', 'scotiabankcolpatria.com', 'paypal.com'];
function activityPrivacy(raw) {
  return { domainOnly: raw?.domainOnly === true, excludeBanking: raw?.excludeBanking === true,
    excludedDomains: Array.isArray(raw?.excludedDomains) ? raw.excludedDomains.filter((entry) => typeof entry === 'string') : [],
    excludedUrls: Array.isArray(raw?.excludedUrls) ? raw.excludedUrls.filter((entry) => typeof entry === 'string') : [] };
}
function privateActivityUrl(rawUrl, rawPrivacy) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 4096) return '';
  const privacy = activityPrivacy(rawPrivacy);
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    const domains = [...privacy.excludedDomains, ...(privacy.excludeBanking ? BANKING_DOMAINS : [])];
    if (domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return '';
    if (privacy.excludedUrls.some((entry) => {
      try {
        const excluded = new URL(entry);
        return url.origin === excluded.origin && (url.pathname === excluded.pathname || url.pathname.startsWith(`${excluded.pathname.replace(/\/$/, '')}/`)) && (!excluded.search || url.search === excluded.search);
      } catch { return false; }
    })) return '';
    return privacy.domainOnly ? `${url.origin}/` : url.href;
  } catch { return ''; }
}
function filterActivitySession(session, rawPrivacy) {
  if (!session || !Number.isFinite(session.start) || !Number.isFinite(session.end) || session.end < session.start) return null;
  const url = privateActivityUrl(session.url, rawPrivacy);
  if (!url) return null;
  return { url, title: rawPrivacy?.domainOnly ? new URL(url).hostname : (typeof session.title === 'string' ? session.title.slice(0, 200) : new URL(url).hostname), start: session.start, end: session.end };
}
function syncPrivacyForm() {
  document.getElementById('privacy-domain-only').checked = state.privacy.domainOnly;
  document.getElementById('privacy-banking').checked = state.privacy.excludeBanking;
  document.getElementById('privacy-domains').value = state.privacy.excludedDomains.join('\n');
  document.getElementById('privacy-urls').value = state.privacy.excludedUrls.join('\n');
}
async function savePrivacy() {
  const status = document.getElementById('privacy-status');
  try {
    const domains = document.getElementById('privacy-domains').value.split('\n').map((entry) => entry.trim()).filter(Boolean);
    const urls = document.getElementById('privacy-urls').value.split('\n').map((entry) => entry.trim()).filter(Boolean);
    const privacy = normalizePrivacy({ domainOnly: document.getElementById('privacy-domain-only').checked,
      excludeBanking: document.getElementById('privacy-banking').checked, excludedDomains: domains, excludedUrls: urls }, true);
    state.privacy = privacy; await persist();
    if (hasChromeStorage && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'aurora-privacy-changed' });
    } else {
      const activity = await storageGet('auroraActivity');
      await storageSet('auroraActivity', { sessions: (activity?.sessions || []).map((entry) => filterActivitySession(entry, privacy)).filter(Boolean), current: null });
    }
    syncPrivacyForm(); renderActivity(); status.textContent = 'Privacidad guardada y aplicada también al historial existente.';
  } catch (error) { status.textContent = error.message; }
}
function setupPrivacy() {
  syncPrivacyForm();
  document.getElementById('privacy-save').addEventListener('click', savePrivacy);
  ['privacy-domain-only', 'privacy-banking'].forEach((id) => document.getElementById(id).addEventListener('change', savePrivacy));
}
