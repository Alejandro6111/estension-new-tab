/* Registro local de la pestaña activa. Se activa solo tras conceder tabs e idle. */
importScripts('privacy.js');
const ACTIVITY_KEY = 'auroraActivity';
const ALARM_NAME = 'aurora-activity-checkpoint';
const KEEP_MS = 30 * 86400000;
let work = Promise.resolve();

function schedule() {
  work = work.then(reconcile).catch((error) => console.warn('Aurora: actividad', error));
}

function trackable(tab) {
  if (!tab || tab.incognito || typeof tab.url !== 'string') return false;
  try { return ['http:', 'https:'].includes(new URL(tab.url).protocol); }
  catch { return false; }
}

async function candidate() {
  const permissions = await chrome.permissions.contains({ permissions: ['tabs', 'idle'] });
  if (!permissions) return null;
  chrome.idle.setDetectionInterval(60);
  if (await chrome.idle.queryState(60) !== 'active') return null;
  const win = await chrome.windows.getLastFocused();
  if (!win?.focused || win.incognito || win.type !== 'normal') return null;
  const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
  return trackable(tabs[0]) ? tabs[0] : null;
}

async function reconcile() {
  const { auroraTrackingEnabled, auroraActivity, auroraState } = await chrome.storage.local.get(['auroraTrackingEnabled', ACTIVITY_KEY, 'auroraState']);
  const privacy = activityPrivacy(auroraState?.privacy);
  let enabled = auroraTrackingEnabled === true;
  if (auroraTrackingEnabled === undefined) {
    enabled = auroraState?.settings?.trackPages === true;
    await chrome.storage.local.set({ auroraTrackingEnabled: enabled });
  }
  const now = Date.now();
  const activity = auroraActivity && typeof auroraActivity === 'object' ? auroraActivity : { sessions: [], current: null };
  if (!Array.isArray(activity.sessions)) activity.sessions = [];
  let tab = enabled ? await candidate() : null;
  if (tab) {
    const url = privateActivityUrl(tab.url, privacy);
    tab = url ? { ...tab, url, title: privacy.domainOnly ? new URL(url).hostname : tab.title } : null;
  }
  activity.sessions = activity.sessions.map((entry) => filterActivitySession(entry, privacy)).filter(Boolean);
  if (activity.current) {
    const url = privateActivityUrl(activity.current.url, privacy);
    if (!url) activity.current = null;
    else { activity.current.url = url; if (privacy.domainOnly) activity.current.title = new URL(url).hostname; }
  }
  const old = activity.current;
  const same = old && tab && old.tabId === tab.id && old.url === tab.url;

  if (old && !same) {
    const end = Math.min(now, Math.max(old.start, (old.last || old.start) + 65000));
    if (end - old.start >= 2000) {
      activity.sessions.push({ url: old.url, title: old.title, start: old.start, end });
    }
    activity.current = null;
  }
  if (same) {
    old.title = (tab.title || old.title || tab.url).slice(0, 200);
    old.last = now;
  } else if (tab) {
    activity.current = { tabId: tab.id, url: tab.url, title: (tab.title || tab.url).slice(0, 200), start: now, last: now };
  }
  activity.sessions = activity.sessions.filter((entry) => entry && Number.isFinite(entry.start) &&
    Number.isFinite(entry.end) && entry.end >= now - KEEP_MS).slice(-2000);
  await chrome.storage.local.set({ [ACTIVITY_KEY]: activity });
  if (enabled && !await chrome.alarms.get(ALARM_NAME)) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }
  else if (!enabled) await chrome.alarms.clear(ALARM_NAME);
}

let recentWork = Promise.resolve();
function rememberRecent(tabId) {
  recentWork = recentWork.catch(() => {}).then(async () => {
    const { auroraTabsEnabled, auroraRecentTabs } = await chrome.storage.local.get(['auroraTabsEnabled', 'auroraRecentTabs']);
    if (!auroraTabsEnabled || !await chrome.permissions.contains({ permissions: ['tabs'] })) return;
    const tab = await chrome.tabs.get(tabId);
    if (!trackable(tab) || !tab.active) return;
    const url = privateActivityUrl(tab.url, {});
    if (!url) return;
    const recent = Array.isArray(auroraRecentTabs) ? auroraRecentTabs : [];
    const now = Date.now();
    await chrome.storage.local.set({ auroraRecentTabs: [{ url, title: (tab.title || url).slice(0, 200), lastVisited: now },
      ...recent.filter((entry) => entry.url !== url && entry.lastVisited >= now - KEEP_MS)].slice(0, 100) });
  }).catch(() => {});
}
chrome.tabs.onActivated.addListener((info) => { schedule(); rememberRecent(info.tabId); });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title || changeInfo.status === 'complete')) schedule();
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) rememberRecent(tabId);
});
chrome.tabs.onRemoved.addListener(schedule);
chrome.windows.onFocusChanged.addListener(schedule);
chrome.idle.onStateChanged.addListener(schedule);
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM_NAME) schedule(); });
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'aurora-tracking-changed' || message?.type === 'aurora-privacy-changed') {
    schedule(); work.then(() => respond({ ok: true })); return true;
  }
});
chrome.runtime.onStartup.addListener(schedule);
chrome.runtime.onInstalled.addListener(schedule);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.auroraState) {
    if (changes.auroraState.newValue?.settings?.trackPages !== changes.auroraState.oldValue?.settings?.trackPages) {
      chrome.storage.local.set({ auroraTrackingEnabled: changes.auroraState.newValue?.settings?.trackPages === true }).then(schedule);
    } else if (JSON.stringify(changes.auroraState.newValue?.privacy) !== JSON.stringify(changes.auroraState.oldValue?.privacy)) schedule();
  }
});
schedule();
