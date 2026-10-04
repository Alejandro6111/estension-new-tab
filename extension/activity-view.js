/* Resumen por dominios y distribución por horas o días. */
let activityDays = 1;
let activityRenderVersion = 0;
async function renderActivity() {
  const version = ++activityRenderVersion;
  const root = document.getElementById('activity-summary');
  const raw = await storageGet('auroraActivity');
  if (version !== activityRenderVersion) return;
  const now = Date.now(), startDate = new Date(); startDate.setHours(0, 0, 0, 0); startDate.setDate(startDate.getDate() - activityDays + 1);
  const since = startDate.getTime();
  const sessions = Array.isArray(raw?.sessions) ? [...raw.sessions] : [];
  if (raw?.current && state.settings.trackPages) sessions.push({ ...raw.current, end: Math.min(now, (raw.current.last || raw.current.start) + 65000) });
  const buckets = activityDays === 1 ? Array.from({ length: 24 }, (_, hour) => {
    const start = new Date(startDate); start.setHours(hour); const end = new Date(start); end.setHours(hour + 1);
    return { label: `${hour} h`, start: start.getTime(), end: end.getTime(), ms: 0 };
  }) : Array.from({ length: activityDays }, (_, index) => {
    const start = new Date(startDate); start.setDate(start.getDate() + index); const end = new Date(start); end.setDate(end.getDate() + 1);
    return { label: start.toLocaleDateString('es', { day: 'numeric', month: 'short' }), start: start.getTime(), end: end.getTime(), ms: 0 };
  });
  const totals = new Map(), recent = [];
  sessions.forEach((rawSession) => {
    const session = filterActivitySession(rawSession, state.privacy);
    if (!session) return;
    const start = Math.max(since, session.start), end = Math.min(now, session.end);
    if (end <= start) return;
    const host = new URL(session.url).hostname;
    totals.set(host, (totals.get(host) || 0) + end - start);
    buckets.forEach((bucket) => { bucket.ms += Math.max(0, Math.min(end, bucket.end) - Math.max(start, bucket.start)); });
    recent.push({ ...session, start, end });
  });
  root.replaceChildren();
  const total = [...totals.values()].reduce((sum, ms) => sum + ms, 0);
  root.append(el('p', 'activity-total', total ? `${activityDays === 1 ? 'Hoy' : `Últimos ${activityDays} días`}: ${formatDuration(total)} en páginas` : 'Sin actividad registrada en este periodo.'));
  const chart = el('div', 'activity-chart'); chart.setAttribute('aria-label', activityDays === 1 ? 'Actividad por hora' : 'Actividad por día');
  const max = Math.max(1, ...buckets.map((bucket) => bucket.ms));
  buckets.forEach((bucket) => {
    const column = el('div', 'activity-chart-column'); const bar = el('div', 'activity-chart-bar'); bar.style.height = `${bucket.ms / max * 84}px`;
    column.title = `${bucket.label}: ${bucket.ms ? formatDuration(bucket.ms) : '0 min'}`;
    column.setAttribute('aria-label', column.title); column.append(bar); chart.append(column);
  }); root.append(chart, el('p', 'widget-hint', activityDays === 1 ? '00:00 → 23:00 · Cada barra representa una hora.' : `${buckets[0].label} → ${buckets.at(-1).label} · Cada barra representa un día.`));
  const details = el('details', 'activity-chart-details'); details.append(el('summary', '', 'Ver valores de la gráfica'));
  buckets.forEach((bucket) => details.append(el('div', '', `${bucket.label} · ${bucket.ms ? formatDuration(bucket.ms) : '0 min'}`))); root.append(details);
  const list = el('div', 'activity-sites');
  [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([host, ms]) => {
    const row = el('div'); row.append(el('span', '', host), el('strong', '', formatDuration(ms))); list.append(row);
  }); root.append(list);
  if (recent.length) {
    root.append(el('p', 'settings-hint', 'Sesiones recientes'));
    const history = el('div', 'activity-recent');
    recent.sort((a, b) => b.start - a.start).slice(0, 10).forEach((session) => {
      const row = el('div'); const title = el('span', '', session.title || new URL(session.url).hostname); title.title = session.url;
      row.append(title, el('small', '', `${new Date(session.start).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })} · ${formatDuration(session.end - session.start)}`)); history.append(row);
    }); root.append(history);
  }
}
function setupActivityDashboard() {
  document.querySelectorAll('#activity-periods button').forEach((button) => button.addEventListener('click', () => {
    activityDays = Number(button.dataset.days);
    document.querySelectorAll('#activity-periods button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); renderActivity();
  }));
  setInterval(() => { if (!document.getElementById('settings-modal').hidden && !document.getElementById('section-datos').hidden) renderActivity(); }, 60000);
}
