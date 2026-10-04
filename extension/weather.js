/* ---------------------------------- Reloj ---------------------------------- */

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  let suffix = '';
  if (state.settings.clockFormat === '12') {
    suffix = h >= 12 ? ' PM' : ' AM';
    h = h % 12; if (h === 0) h = 12;
  }
  const hh = state.settings.clockFormat === '12' ? String(h) : String(h).padStart(2, '0');
  let text = `${hh}:${m}`;
  if (state.settings.showSeconds) text += `:${s}`;
  text += suffix;
  document.getElementById('clock-time').textContent = text;
  const dateStr = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  document.getElementById('clock-date').textContent = dateStr;
}

/* ---------------------------------- Clima ----------------------------------- */

const WEATHER_CODES = {
  0: ['☀️', 'Despejado'], 1: ['🌤️', 'Mayormente despejado'], 2: ['⛅', 'Parcialmente nublado'],
  3: ['☁️', 'Nublado'], 45: ['🌫️', 'Niebla'], 48: ['🌫️', 'Niebla helada'],
  51: ['🌦️', 'Llovizna ligera'], 53: ['🌦️', 'Llovizna'], 55: ['🌧️', 'Llovizna intensa'],
  56: ['🌧️', 'Llovizna helada'], 57: ['🌧️', 'Llovizna helada intensa'],
  61: ['🌧️', 'Lluvia ligera'], 63: ['🌧️', 'Lluvia'], 65: ['🌧️', 'Lluvia intensa'],
  66: ['🌧️', 'Lluvia helada'], 67: ['🌧️', 'Lluvia helada intensa'],
  71: ['🌨️', 'Nieve ligera'], 73: ['🌨️', 'Nieve'], 75: ['❄️', 'Nieve intensa'], 77: ['🌨️', 'Granizo fino'],
  80: ['🌦️', 'Chubascos ligeros'], 81: ['🌧️', 'Chubascos'], 82: ['⛈️', 'Chubascos fuertes'],
  85: ['🌨️', 'Chubascos de nieve'], 86: ['❄️', 'Chubascos de nieve intensos'],
  95: ['⛈️', 'Tormenta'], 96: ['⛈️', 'Tormenta con granizo'], 99: ['⛈️', 'Tormenta con granizo fuerte'],
};

function initWeather() {
  const loadingEl = document.getElementById('weather-loading');
  const retryBtn = document.getElementById('weather-retry');
  retryBtn.hidden = true;
  loadingEl.hidden = false;
  loadingEl.textContent = 'Buscando tu ubicación…';
  document.getElementById('weather-body').hidden = true;

  if (!navigator.geolocation) {
    loadingEl.textContent = 'Tu navegador no permite ver la ubicación.';
    return;
  }
  navigator.geolocation.getCurrentPosition(onLocationOk, onLocationFail, { timeout: 8000 });
}

async function onLocationOk(pos) {
  const { latitude, longitude } = pos.coords;
  try {
    const [weatherRes, placeRes] = await Promise.allSettled([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&forecast_days=2&timezone=auto`, { signal: AbortSignal.timeout(12000) }).then(r => { if (!r.ok) throw new Error('Clima no disponible'); return r.json(); }),
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`, { signal: AbortSignal.timeout(12000) }).then(r => r.json()),
    ]);

    if (weatherRes.status !== 'fulfilled') throw new Error('weather failed');
    const forecast = weatherRes.value;
    const cur = forecast.current;
    if (!cur || !Number.isFinite(cur.temperature_2m)) throw new Error('Clima inválido');
    const [icon, label] = WEATHER_CODES[cur.weather_code] || ['🌡️', 'Sin datos'];
    const place = placeRes.status === 'fulfilled'
      ? (placeRes.value.city || placeRes.value.locality || placeRes.value.principalSubdivision || 'Tu ubicación')
      : 'Tu ubicación';

    lastWeatherData = { icon, label, place: String(place).slice(0, 120), humidity: Math.round(cur.relative_humidity_2m), tempC: cur.temperature_2m,
      apparent: cur.apparent_temperature, wind: cur.wind_speed_10m, forecast, updatedAt: Date.now() };

    document.getElementById('weather-loading').hidden = true;
    document.getElementById('weather-retry').hidden = true;
    document.getElementById('weather-body').hidden = false;
    renderWeatherUI();
    renderWeatherDetails();
  } catch (e) {
    onWeatherError('No se pudo cargar el clima.');
  }
}

function renderWeatherUI() {
  if (!lastWeatherData) return;
  document.getElementById('weather-icon').textContent = lastWeatherData.icon;
  document.getElementById('weather-place').textContent = lastWeatherData.place;
  document.getElementById('weather-desc').textContent = lastWeatherData.label;
  document.getElementById('weather-extra').textContent = `Humedad: ${lastWeatherData.humidity}%`;
  const unit = state.settings.tempUnit;
  const tempVal = unit === 'F' ? (lastWeatherData.tempC * 9 / 5 + 32) : lastWeatherData.tempC;
  document.getElementById('weather-temp').textContent = `${Math.round(tempVal)}°${unit}`;
  renderWeatherDetails();
}

function onLocationFail() {
  onWeatherError('Activa la ubicación para ver el clima.');
}

function weatherTemperature(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(state.settings.tempUnit === 'F' ? value * 9 / 5 + 32 : value)}°${state.settings.tempUnit}`;
}
function renderWeatherDetails() {
  const root = document.getElementById('weather-forecast'); root.replaceChildren();
  if (!lastWeatherData) { root.append(el('p', 'settings-hint', 'Autoriza tu ubicación y pulsa Actualizar clima para ver el pronóstico.')); return; }
  const data = lastWeatherData;
  document.getElementById('weather-title').textContent = `El tiempo en ${data.place}`;
  root.append(el('p', 'weather-now', `${data.icon} ${weatherTemperature(data.tempC)} · ${data.label}`));
  root.append(el('p', 'settings-hint', `Sensación ${weatherTemperature(data.apparent)} · Humedad ${data.humidity}% · Viento ${Number.isFinite(data.wind) ? Math.round(data.wind) : '—'} km/h`));
  const hourly = data.forecast.hourly;
  root.append(el('h3', '', 'Próximas horas'));
  const hours = el('div', 'forecast-hours');
  const next = Array.isArray(hourly?.time) ? hourly.time.findIndex((time) => time >= data.forecast.current.time) : -1;
  if (next >= 0) {
    for (let offset = 0; offset < 9 && next + offset < hourly.time.length; offset += 3) {
      const index = next + offset, time = hourly.time[index].slice(11, 16);
      const icon = WEATHER_CODES[hourly.weather_code?.[index]]?.[0] || '🌡️';
      hours.append(el('div', 'forecast-hour', `${time} · ${icon} ${weatherTemperature(hourly.temperature_2m?.[index])} · ${hourly.precipitation_probability?.[index] ?? '—'}% lluvia`));
    }
  } else hours.append(el('p', 'settings-hint', 'El pronóstico por horas no está disponible.'));
  root.append(hours);
  const daily = data.forecast.daily;
  if (Array.isArray(daily?.time)) {
    daily.time.slice(0, 2).forEach((day, index) => {
      root.append(el('h3', '', index === 0 ? 'Hoy' : 'Mañana'));
      root.append(el('p', '', `Máx ${weatherTemperature(daily.temperature_2m_max?.[index])} · Mín ${weatherTemperature(daily.temperature_2m_min?.[index])} · ${daily.precipitation_probability_max?.[index] ?? '—'}% lluvia`));
      root.append(el('p', 'settings-hint', `Amanecer ${daily.sunrise?.[index]?.slice(11, 16) || '—'} · Atardecer ${daily.sunset?.[index]?.slice(11, 16) || '—'}`));
    });
  }
  root.append(el('p', 'settings-hint', `Open-Meteo · Horas locales de la ubicación · Actualizado ${new Date(data.updatedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`));
}
function openWeatherDetails() { renderWeatherDetails(); openModal('weather-modal'); }
function setupWeatherDetails() {
  document.getElementById('weather-details-open').addEventListener('click', openWeatherDetails);
  document.getElementById('weather-refresh').addEventListener('click', () => { initWeather(); announce('Actualizando el clima…'); });
  setInterval(() => { if (state.settings.showWeather && !document.hidden) initWeather(); }, 3600000);
}

function onWeatherError(msg) {
  const loadingEl = document.getElementById('weather-loading');
  loadingEl.hidden = false;
  loadingEl.textContent = msg;
  document.getElementById('weather-body').hidden = true;
  document.getElementById('weather-retry').hidden = false;
}

/* ---------------------------------- Frase ----------------------------------- */

const QUOTES = [
  ['Haz siempre lo que temes hacer.', 'Ralph Waldo Emerson'],
  ['La vida es lo que pasa mientras hacemos otros planes.', 'John Lennon'],
  ['El único modo de hacer un gran trabajo es amar lo que haces.', 'Steve Jobs'],
  ['No cuentes los días, haz que los días cuenten.', 'Muhammad Ali'],
  ['La mejor forma de predecir el futuro es crearlo.', 'Peter Drucker'],
  ['Cae siete veces, levántate ocho.', 'Proverbio japonés'],
  ['Quien tiene un porqué puede soportar casi cualquier cómo.', 'Friedrich Nietzsche'],
  ['Empieza donde estás, usa lo que tienes, haz lo que puedas.', 'Arthur Ashe'],
  ['La paciencia es amarga, pero su fruto es dulce.', 'Aristóteles'],
  ['No hay viento favorable para quien no sabe a dónde va.', 'Séneca'],
  ['Un viaje de mil millas comienza con un solo paso.', 'Lao Tzu'],
  ['La simplicidad es la máxima sofisticación.', 'Leonardo da Vinci'],
  ['El éxito es la suma de pequeños esfuerzos repetidos.', 'Robert Collier'],
  ['Hazlo con miedo, pero hazlo.', 'Anónimo'],
];

function showQuoteOfTheDay() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  const [text, author] = QUOTES[dayOfYear % QUOTES.length];
  document.getElementById('quote-text').textContent = `“${text}”`;
  document.getElementById('quote-author').textContent = `— ${author}`;
}

/* ---------------------------------- Saludo ----------------------------------- */

function updateGreeting() {
  const el = document.getElementById('clock-greeting');
  const name = (state.settings.greetingName || '').trim();
  if (name) { el.hidden = false; el.textContent = `Hola, ${name} 👋`; }
  else { el.hidden = true; }
}
