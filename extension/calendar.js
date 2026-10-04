/* Calendarios: Google iCal privado y feeds públicos de fútbol. */
const GOOGLE_ICAL_KEY = 'auroraGoogleIcalUrl';
const FOOTBALL_TEAMS = {
  barcelona: { label: 'FC Barcelona', feed: 'https://ics.fixtur.es/v2/fc-barcelona.ics', page: 'https://fixtur.es/es/team/fc-barcelona' },
  millonarios: { label: 'Millonarios', feed: 'https://ics.fixtur.es/v2/millonarios.ics', page: 'https://fixtur.es/es/team/millonarios' },
  colombia: { label: 'Colombia', feed: 'https://ics.fixtur.es/v2/co.ics', page: 'https://fixtur.es/es/team/co' },
};
let googleIcalUrl = '';
let activeFootballTeam = 'barcelona';
const footballCache = new Map();

function validGoogleIcalUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return '';
  try {
    const url = new URL(raw.trim());
    if (url.origin !== 'https://calendar.google.com' || url.username || url.password ||
        !/^\/calendar\/ical\/[^/]+\/(?:private-[^/]+|public)\/basic\.ics$/.test(url.pathname) ||
        url.search || url.hash) return '';
    return url.href;
  } catch (error) { return ''; }
}

function icalText(value) {
  return value.replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

function icalDate(value, property) {
  const date = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!date) return null;
  const [, year, month, day, hour, minute, second, utc] = date;
  const y = Number(year), m = Number(month), d = Number(day);
  const h = Number(hour || 0), min = Number(minute || 0), sec = Number(second || 0);
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59 || sec > 59) return null;
  const allDay = !hour || property.includes('VALUE=DATE');
  let timestamp;
  if (allDay) timestamp = new Date(y, m - 1, d, 0, 0, 0).getTime();
  else if (utc) timestamp = Date.UTC(y, m - 1, d, h, min, sec);
  else {
    const tzid = /(?:^|;)TZID=([^;:]+)/.exec(property)?.[1]?.replace(/^"|"$/g, '');
    if (tzid) {
      try {
        const target = Date.UTC(y, m - 1, d, h, min, sec);
        let guess = target;
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tzid, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
        for (let i = 0; i < 2; i++) {
          const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, Number(part.value)]));
          guess += target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
        }
        timestamp = guess;
      } catch (error) { timestamp = new Date(y, m - 1, d, h, min, sec).getTime(); }
    } else timestamp = new Date(y, m - 1, d, h, min, sec).getTime();
  }
  const result = new Date(timestamp);
  return Number.isNaN(result.getTime()) ? null : { date: result, allDay };
}

function parseIcal(source) {
  if (typeof source !== 'string' || source.length > 5_000_000 || !source.includes('BEGIN:VCALENDAR')) throw new Error('El calendario no devolvió un archivo iCal válido.');
  const lines = source.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const entries = [];
  let entry = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { entry = {}; continue; }
    if (line === 'END:VEVENT') {
      if (entry) entries.push(entry);
      entry = null;
      continue;
    }
    if (!entry) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const property = line.slice(0, colon);
    const name = property.split(';')[0];
    const value = line.slice(colon + 1);
    if (name === 'SUMMARY') entry.title = value.slice(0, 500);
    if (name === 'DTSTART') entry.start = { value, property };
    if (name === 'DTEND') entry.end = { value, property };
    if (name === 'STATUS') entry.status = value;
    if (name === 'UID') entry.uid = value;
    if (name === 'RRULE') entry.rrule = value;
    if (name === 'RECURRENCE-ID') entry.recurrenceId = { value, property };
    if (name === 'EXDATE') (entry.exdates ||= []).push({ value, property });
  }
  const now = Date.now();
  const horizon = now + 366 * 86400000;
  const exceptions = new Map();
  for (const item of entries) {
    if (!item.uid || !item.recurrenceId) continue;
    const date = icalDate(item.recurrenceId.value, item.recurrenceId.property)?.date;
    if (date) (exceptions.get(item.uid) || exceptions.set(item.uid, new Set()).get(item.uid)).add(date.getTime());
  }
  const events = [];
  for (const item of entries) {
    if (!item.start || !item.title || item.status === 'CANCELLED') continue;
    const start = icalDate(item.start.value, item.start.property);
    if (!start) continue;
    const end = item.end && icalDate(item.end.value, item.end.property);
    const duration = Math.max(1, (end?.date.getTime() || start.date.getTime() + (start.allDay ? 86400000 : 3600000)) - start.date.getTime());
    const excluded = new Set(exceptions.get(item.uid) || []);
    for (const exdate of item.exdates || []) {
      for (const value of exdate.value.split(',')) {
        const date = icalDate(value, exdate.property)?.date;
        if (date) excluded.add(date.getTime());
      }
    }
    const add = (date) => {
      if (excluded.has(date.getTime()) && !item.recurrenceId) return;
      if (date.getTime() + duration <= now || date.getTime() >= horizon) return;
      events.push({ title: icalText(item.title), start: date, end: new Date(date.getTime() + duration), allDay: start.allDay });
    };
    if (!item.rrule || item.recurrenceId) { add(start.date); continue; }
    const rule = Object.fromEntries(item.rrule.split(';').map((part) => part.split('=')));
    const frequency = rule.FREQ;
    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(frequency)) { add(start.date); continue; }
    const interval = Math.max(1, Math.min(365, Number(rule.INTERVAL) || 1));
    const count = Math.max(1, Math.min(10000, Number(rule.COUNT) || 10000));
    const until = rule.UNTIL ? icalDate(rule.UNTIL, 'UNTIL')?.date?.getTime() : Infinity;
    const weekdays = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const byDay = rule.BYDAY ? rule.BYDAY.split(',').map((day) => weekdays[day]).filter((day) => day !== undefined) : [start.date.getDay()];
    const monthDays = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number) : [start.date.getDate()];
    const datePart = item.start.value.slice(0, 8);
    const timePart = item.start.value.slice(8);
    const original = new Date(Number(datePart.slice(0, 4)), Number(datePart.slice(4, 6)) - 1, Number(datePart.slice(6, 8)));
    const cursor = new Date(original);
    const last = new Date(horizon);
    let occurrences = 0;
    for (let day = 0; cursor <= last && day < 10000 && occurrences < count; day++, cursor.setDate(cursor.getDate() + 1)) {
      const days = Math.round((cursor - original) / 86400000);
      const weeks = Math.floor((days + (original.getDay() + 6) % 7) / 7);
      const months = (cursor.getFullYear() - original.getFullYear()) * 12 + cursor.getMonth() - original.getMonth();
      const years = cursor.getFullYear() - original.getFullYear();
      const matches = frequency === 'DAILY' ? days % interval === 0
        : frequency === 'WEEKLY' ? weeks % interval === 0 && byDay.includes(cursor.getDay())
          : frequency === 'MONTHLY' ? months % interval === 0 && monthDays.includes(cursor.getDate())
            : years % interval === 0 && cursor.getMonth() === original.getMonth() && monthDays.includes(cursor.getDate());
      if (!matches) continue;
      const ymd = `${cursor.getFullYear()}${String(cursor.getMonth() + 1).padStart(2, '0')}${String(cursor.getDate()).padStart(2, '0')}`;
      const date = icalDate(ymd + timePart, item.start.property)?.date;
      if (!date || date < start.date || date.getTime() > until) continue;
      occurrences++;
      add(date);
    }
  }
  return events.filter((event) => event.end.getTime() > now && event.start.getTime() < horizon)
    .sort((a, b) => a.start - b.start).slice(0, 4);
}

async function fetchIcal(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`No se pudo cargar el calendario (${response.status}).`);
    return parseIcal(await response.text());
  } finally { clearTimeout(timer); }
}

function calendarMessage(id, message) {
  const root = document.getElementById(id);
  const p = document.createElement('p');
  p.className = 'calendar-message';
  p.textContent = message;
  root.replaceChildren(p);
}

function renderCalendarEvents(id, events, emptyMessage) {
  if (!events.length) { calendarMessage(id, emptyMessage); return; }
  const list = document.createElement('ul');
  list.className = 'calendar-event-list';
  for (const event of events) {
    const item = document.createElement('li');
    item.className = 'calendar-event';
    const date = document.createElement('div');
    date.className = 'calendar-event-date';
    const day = document.createElement('strong');
    day.textContent = new Intl.DateTimeFormat('es', { day: '2-digit' }).format(event.start);
    const month = document.createElement('span');
    month.textContent = new Intl.DateTimeFormat('es', { month: 'short' }).format(event.start);
    date.append(day, month);
    const info = document.createElement('div');
    info.className = 'calendar-event-info';
    const title = document.createElement('div');
    title.className = 'calendar-event-title';
    title.textContent = event.title;
    const time = document.createElement('div');
    time.className = 'calendar-event-time';
    time.textContent = event.allDay ? 'Todo el día' : new Intl.DateTimeFormat('es', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(event.start);
    info.append(title, time);
    item.append(date, info);
    list.append(item);
  }
  document.getElementById(id).replaceChildren(list);
}

async function loadGoogleCalendar() {
  const action = document.getElementById('google-calendar-settings');
  action.textContent = googleIcalUrl ? 'Ajustes' : 'Conectar';
  if (!googleIcalUrl) { calendarMessage('google-calendar-content', 'Conecta tu Google Calendar para ver tus próximos eventos.'); return; }
  calendarMessage('google-calendar-content', 'Cargando eventos…');
  try {
    const events = await fetchIcal(googleIcalUrl);
    if (!googleIcalUrl) return;
    renderCalendarEvents('google-calendar-content', events, 'No hay eventos próximos en este calendario.');
  } catch (error) {
    if (!googleIcalUrl) return;
    calendarMessage('google-calendar-content', 'No se pudieron cargar los eventos. Revisa la conexión o la dirección en Ajustes.');
  }
}

async function loadFootballCalendar(force = false) {
  const team = activeFootballTeam;
  const cached = footballCache.get(team);
  if (!force && cached && Date.now() - cached.time < 6 * 3600000) {
    renderCalendarEvents('sports-calendar-content', cached.events, 'Todavía no hay partidos programados.');
    return;
  }
  calendarMessage('sports-calendar-content', 'Cargando partidos…');
  try {
    const events = await fetchIcal(FOOTBALL_TEAMS[team].feed);
    footballCache.set(team, { time: Date.now(), events });
    if (team === activeFootballTeam) renderCalendarEvents('sports-calendar-content', events, 'Todavía no hay partidos programados.');
  } catch (error) {
    if (team === activeFootballTeam) calendarMessage('sports-calendar-content', 'No se pudieron cargar los partidos. Pulsa Actualizar para reintentar.');
  }
}

function syncCalendarSettings() {
  document.getElementById('show-calendars').checked = state.settings.showCalendars;
  document.getElementById('google-ical-url').value = '';
  document.getElementById('google-ical-url').placeholder = googleIcalUrl ? 'Dirección guardada (pega otra para cambiarla)' : 'https://calendar.google.com/calendar/ical/…/basic.ics';
  document.getElementById('google-ical-disconnect').hidden = !googleIcalUrl;
  document.getElementById('google-ical-status').textContent = googleIcalUrl ? 'Calendario conectado.' : 'Calendario sin conectar.';
}

function applyCalendarVisibility() {
  document.querySelectorAll('.calendar-card').forEach((card) => { card.hidden = !state.settings.showCalendars; });
  document.querySelector('.widgets-right').hidden = !state.settings.showCalendars && !state.settings.showHabits && !state.settings.showTimeProgress;
  applyWidgetLayout();
}

async function setupCalendars() {
  googleIcalUrl = validGoogleIcalUrl(await storageGet(GOOGLE_ICAL_KEY));
  syncCalendarSettings();
  applyCalendarVisibility();
  document.getElementById('google-calendar-settings').addEventListener('click', () => {
    openSettings();
    setSettingsSection('calendario');
    document.getElementById('google-ical-url').focus();
  });
  document.getElementById('show-calendars').addEventListener('change', (event) => {
    state.settings.showCalendars = event.target.checked;
    state.widgetLayout.filter((entry) => ['calendar', 'sports'].includes(entry.id)).forEach((entry) => { entry.hidden = false; });
    applyCalendarVisibility();
    persist();
  });
  document.getElementById('google-ical-connect').addEventListener('click', async () => {
    const input = document.getElementById('google-ical-url');
    const status = document.getElementById('google-ical-status');
    const url = validGoogleIcalUrl(input.value);
    if (!url) { status.textContent = 'Pega la dirección iCal de Google Calendar, terminada en basic.ics.'; input.focus(); return; }
    status.textContent = 'Comprobando calendario…';
    try {
      await fetchIcal(url);
      googleIcalUrl = url;
      await storageSet(GOOGLE_ICAL_KEY, url);
      syncCalendarSettings();
      loadGoogleCalendar();
    } catch (error) {
      status.textContent = 'No se pudo abrir esa dirección. Verifica que sea la dirección secreta iCal y vuelve a intentarlo.';
    }
  });
  document.getElementById('google-ical-disconnect').addEventListener('click', async () => {
    googleIcalUrl = '';
    await storageSet(GOOGLE_ICAL_KEY, '');
    syncCalendarSettings();
    loadGoogleCalendar();
  });
  document.querySelectorAll('.sports-tabs button').forEach((button) => button.addEventListener('click', () => {
    activeFootballTeam = button.dataset.team;
    document.querySelectorAll('.sports-tabs button').forEach((tab) => tab.setAttribute('aria-pressed', String(tab === button)));
    loadFootballCalendar();
  }));
  document.querySelector('.sports-tabs button[data-team="barcelona"]').setAttribute('aria-pressed', 'true');
  document.getElementById('sports-refresh').addEventListener('click', () => loadFootballCalendar(true));
  document.getElementById('sports-source').addEventListener('click', () => openNewTab(FOOTBALL_TEAMS[activeFootballTeam].page));
  loadGoogleCalendar();
  loadFootballCalendar();
  setupEventActions();
}

function openEventEditor(todo) {
  document.getElementById('event-form').reset();
  document.getElementById('event-time').disabled = false;
  document.getElementById('event-duration').disabled = false;
  document.getElementById('event-name').value = todo?.text || '';
  document.getElementById('event-date').value = todo?.due || localDayKey();
  document.getElementById('event-status').textContent = '';
  openModal('event-modal');
}
function buildCalendarTemplate(values) {
  if (!boundedText(values.title, 200) || !validDayKey(values.date) || !values.allDay && !validTime(values.time)) throw new Error('Revisa el título, la fecha y la hora.');
  const start = new Date(`${values.date}T${values.allDay ? '12:00' : values.time}:00`);
  const end = new Date(start);
  let dates;
  if (values.allDay) { end.setDate(end.getDate() + 1); dates = `${values.date.replace(/-/g, '')}/${localDayKey(end).replace(/-/g, '')}`; }
  else {
    if (![30, 60, 120].includes(values.duration)) throw new Error('La duración no es válida.');
    end.setMinutes(end.getMinutes() + values.duration);
    const utc = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    dates = `${utc(start)}/${utc(end)}`;
  }
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE'); url.searchParams.set('text', values.title); url.searchParams.set('dates', dates);
  url.searchParams.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  url.searchParams.set('location', (values.location || '').slice(0, 300)); url.searchParams.set('details', (values.description || '').slice(0, 2000));
  return url.href;
}
function setupEventActions() {
  document.getElementById('calendar-new-event').addEventListener('click', () => openEventEditor());
  document.getElementById('event-all-day').addEventListener('change', (event) => {
    document.getElementById('event-time').disabled = event.target.checked; document.getElementById('event-duration').disabled = event.target.checked;
  });
  document.getElementById('event-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const url = buildCalendarTemplate({ title: document.getElementById('event-name').value.trim(), date: document.getElementById('event-date').value,
        time: document.getElementById('event-time').value, duration: Number(document.getElementById('event-duration').value), allDay: document.getElementById('event-all-day').checked,
        location: document.getElementById('event-location').value, description: document.getElementById('event-description').value });
      openNewTab(url); closeModal('event-modal');
    } catch (error) { document.getElementById('event-status').textContent = error.message; }
  });
}
