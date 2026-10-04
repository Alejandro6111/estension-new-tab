/* --------------------------------- Barra lateral ---------------------------------- */

function setupDock() {
  document.querySelectorAll('.dock-btn[data-chrome]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.chrome;
      if (hasChromeTabs) chrome.tabs.create({ url });
      else window.open(url, '_blank');
    });
  });
}

/* -------------------------------------- Init --------------------------------------- */

(async function init() {
  await loadState();
  applyCurrentState();
  setInterval(tickClock, 1000);
  setInterval(rotateBackground, 10000);

  initWeather();
  document.getElementById('weather-retry').addEventListener('click', initWeather);

  setupSettingsPanel();
  await setupCalendars();
  setupTodos();
  setupPersonalWidgets();
  setupModals();
  setupSearch();
  setupDock();
  setupContextMenu();
  setupWidgetEditor();
  setupWeatherDetails();
  setupProfiles();
  setupPrivacy();
  setupActivityDashboard();
  await setupSessions();
  await setupSync();

  document.documentElement.classList.remove('is-booting');
  document.getElementById('search-input').focus();
})().catch((error) => {
  document.documentElement.classList.remove('is-booting');
  announce(`No se pudo iniciar Aurora: ${error.message}`);
  console.error('Aurora:', error);
});
