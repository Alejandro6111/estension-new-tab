"""Pruebas con Chromium aislado: python tests/test_aurora.py.

Requiere Playwright solo para desarrollo. No usa el perfil del usuario ni redes reales.
"""
import json
import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / 'extension'
OUTPUT = Path(tempfile.gettempdir()) / 'aurora-verification'
OUTPUT.mkdir(exist_ok=True)


def route_external(route):
    url = route.request.url
    today = datetime.now().strftime('%Y-%m-%d')
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    if 'api.open-meteo.com' in url:
        route.fulfill(json={
            'current': {'time': today + 'T12:00', 'temperature_2m': 14, 'relative_humidity_2m': 60, 'weather_code': 3, 'apparent_temperature': 13, 'wind_speed_10m': 8},
            'hourly': {'time': [today + f'T{hour:02d}:00' for hour in range(24)], 'temperature_2m': [14] * 24, 'precipitation_probability': [60] * 24, 'weather_code': [3] * 24},
            'daily': {'time': [today, tomorrow], 'temperature_2m_max': [18, 19], 'temperature_2m_min': [9, 10], 'sunrise': [today + 'T05:45', tomorrow + 'T05:46'], 'sunset': [today + 'T18:00', tomorrow + 'T18:01'], 'precipitation_probability_max': [60, 35]}})
    elif 'bigdatacloud.net' in url:
        route.fulfill(json={'city': 'Bogotá'})
    elif url.endswith('.ics'):
        stamp = (datetime.now() + timedelta(days=1)).strftime('%Y%m%dT140000')
        route.fulfill(content_type='text/calendar', body=f'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:{stamp}\r\nSUMMARY:Evento de prueba\r\nEND:VEVENT\r\nEND:VCALENDAR')
    else:
        route.fulfill(content_type='image/svg+xml', body='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#f4a54b"/></svg>')


def ready(page, url):
    page.goto(url)
    expect(page.locator('html')).not_to_have_class('is-booting')
    page.wait_for_load_state('networkidle')


def command(page, value):
    page.locator('#search-input').fill(value)
    page.locator('#search-input').press('Enter')


def settings(page, section):
    if not page.locator('#settings-modal').is_visible():
        page.locator('#settings-btn').click()
    page.locator(f'[data-section="{section}"]').click()


def file_import(page, payload):
    page.locator('#data-import').set_input_files({'name': 'test.json', 'mimeType': 'application/json', 'buffer': json.dumps(payload, ensure_ascii=False).encode()})


def assert_no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    assert page.evaluate("document.querySelector('.settings-content').scrollWidth <= document.querySelector('.settings-content').clientWidth + 1")


def local_tests(p):
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 952}, accept_downloads=True)
    context.route('https://**/*', route_external)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    ready(page, (EXTENSION / 'newtab.html').as_uri())
    assert page.evaluate('state.profiles[0].name') == 'Personal'
    for selector, count in [('.widgets:not(.widgets-right):not(.widgets-center)', 6), ('.widgets-right', 5), ('.widgets-center', 0)]:
        region = page.locator(selector)
        assert region.locator(':scope > .card:visible').count() == count
        if not count:
            continue
        boxes = [card.bounding_box() for card in region.locator(':scope > .card:visible').all()]
        if selector == '.widgets-center':
            assert boxes[0]['x'] < boxes[1]['x'] < boxes[2]['x']
            assert all(abs(box['y'] - boxes[0]['y']) < 1 for box in boxes)
        else:
            assert all(abs(box['x'] - boxes[0]['x']) < 1 for box in boxes)
            assert all(boxes[i+1]['y'] >= boxes[i]['y'] + boxes[i]['height'] for i in range(len(boxes)-1))
        assert region.evaluate("node => getComputedStyle(node).overflowY") == 'auto'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    assert page.evaluate("""() => {
        const old = WIDGETS.map(({id, column}, order) => ({id, order, column: ['focus','notes','statistics'].includes(id) ? 2 : column, size: 'medium', hidden: false}));
        old.find(w => w.id === 'focus').size = 'large';
        old.find(w => w.id === 'notes').hidden = true;
        const migrated = normalizeWidgetLayout(old, true, true);
        if (migrated.filter(w => w.column === 2).length !== 0 || !migrated.find(w => w.id === 'notes').hidden || migrated.find(w => w.id === 'focus').size !== 'large') return false;
        old.find(w => w.id === 'clock').column = 2;
        return normalizeWidgetLayout(old, true, true).every(w => Object.keys(old[0]).every(key => w[key] === old.find(saved => saved.id === w.id)[key]));
    }""")
    page.screenshot(path=str(OUTPUT / 'dashboard-default-1920.png'), full_page=True)
    page.evaluate("""() => {
        window.layoutSample = {shortcuts:state.shortcuts, cardStyle:state.settings.cardStyle};
        state.shortcuts = Array.from({length:21}, (_,i) => ({id:'sample-'+i, name:'Acceso '+(i+1), url:'https://example.com/'+i, category:state.activeCategory}));
        state.settings.cardStyle = 'minimal'; applyCurrentState();
        const events = Array.from({length:4}, (_,i) => ({title:'Evento de prueba '+(i+1), start:new Date(Date.now()+86400000*(i+1)), end:new Date(Date.now()+86400000*(i+1)+3600000), allDay:false}));
        renderCalendarEvents('google-calendar-content', events, '');
        renderCalendarEvents('sports-calendar-content', events, '');
    }""")
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    assert page.locator('.main-area').bounding_box()['width'] == 700
    assert page.locator('.shortcuts-grid').evaluate("node => getComputedStyle(node).gridTemplateColumns.split(' ').length") == 6
    page.screenshot(path=str(OUTPUT / 'dashboard-21-minimal.png'), full_page=True)
    page.evaluate("state.shortcuts = layoutSample.shortcuts; state.settings.cardStyle = layoutSample.cardStyle; applyCurrentState(); delete window.layoutSample;")
    print('PASS distribución original, accesos contenidos en 700 px y conservación de datos al restaurar')
    command(page, 'todo <img src=x onerror=alert(1)> SQL')
    expect(page.locator('#todo-list')).to_contain_text('<img src=x onerror=alert(1)> SQL')
    assert page.locator('#todo-list img').count() == 0
    command(page, 'note revisar ejercicio 4')
    expect(page.locator('#quick-note')).to_have_value('revisar ejercicio 4')
    command(page, 'calc 3500 * 22')
    expect(page.locator('#command-status')).to_contain_text('77.000')
    command(page, 'calc 1 / 0')
    expect(page.locator('#command-status')).to_contain_text('finito')
    assert page.evaluate("calculate('2^3^2')") == 512
    assert page.evaluate("calculate('-2^2 + (10 % 3)')") == -3
    command(page, 'focus 37')
    assert page.evaluate('state.widgets.focus.duration') == 2220
    page.locator('#focus-toggle').click()
    assert page.evaluate('state.widgets.focus.endsAt') == 0
    command(page, 'focus 5')
    expect(page.locator('#focus-kind')).to_have_text('Enfoque')
    page.locator('#focus-toggle').click()
    assert page.evaluate("normalizeWidgets({focus:{duration:300,remaining:300,endsAt:0,completed:0,day:localDayKey()}}).focus.kind") == 'break'
    command(page, '> ajustes')
    expect(page.locator('#settings-modal')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#settings-modal')).to_be_hidden()
    page.keyboard.press('Control+k')
    expect(page.locator('#command-panel')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#command-panel')).to_be_hidden()
    print('PASS comandos, cálculo seguro, notas y teclado')

    page.locator('#todo-advanced').click()
    page.locator('#task-text').fill('Pagar tarjeta')
    page.locator('#task-due').fill('2027-01-31')
    page.locator('#task-priority').select_option('high')
    page.locator('#task-repeat').select_option('monthly')
    page.locator('#task-detail-form button[type=submit]').click()
    row = page.locator('.todo-item').filter(has_text='Pagar tarjeta')
    row.locator('.todo-check').click()
    assert page.evaluate("state.todos.find(t => t.text === 'Pagar tarjeta' && !t.done).due") == '2027-02-28'
    page.locator('.todo-item:not(.done)').filter(has_text='Pagar tarjeta').locator('.todo-check').click()
    assert page.evaluate("state.todos.find(t => t.text === 'Pagar tarjeta' && !t.done).due") == '2027-03-31'
    page.locator('.todo-item.done').filter(has_text='Pagar tarjeta').nth(1).locator('.todo-check').click()
    assert not page.evaluate("state.todos.some(t => t.due === '2027-03-31')")
    page.locator('#calendar-new-event').click()
    page.locator('#event-name').fill('Parcial SQL & redes')
    page.locator('#event-date').fill('2027-10-10')
    page.locator('#event-all-day').check()
    url = page.evaluate("buildCalendarTemplate({title:'Parcial SQL & redes',date:'2027-10-10',time:'14:00',duration:60,allDay:true})")
    assert 'dates=20271010%2F20271011' in url and 'Parcial+SQL+%26+redes' in url
    page.keyboard.press('Escape')
    print('PASS tareas, fin de mes, deshacer repetición y Calendar')

    page.locator('#quick-note').fill('Nota personal')
    settings(page, 'perfiles')
    page.locator('#profile-name').fill('Universidad')
    page.locator('#profile-template').select_option('university')
    page.locator('#profile-form button').click()
    expect(page.locator('#quick-note')).to_have_value('')
    page.locator('[data-section="busqueda"]').click()
    page.locator('#search-engine-select').select_option('duckduckgo')
    page.keyboard.press('Escape')
    page.locator('#quick-note').fill('Nota universidad')
    page.locator('.profile-tab').filter(has_text='Personal').click()
    expect(page.locator('#quick-note')).to_have_value('Nota personal')
    page.locator('.profile-tab').filter(has_text='Universidad').click()
    expect(page.locator('#quick-note')).to_have_value('Nota universidad')
    assert page.evaluate('state.settings.searchEngine') == 'duckduckgo'
    assert page.evaluate("ruleMatches({days:[1],start:'22:00',end:'06:00'},new Date('2026-10-06T02:00:00'))")
    with page.expect_popup() as popup:
        command(page, '@uni github')
    popup.value.close()
    page.locator('#edit-page').click()
    page.locator('[data-widget="notes"] select').first.select_option('2')
    page.locator('[data-widget="notes"] select').nth(1).select_option('large')
    page.locator('[data-widget="clock"] .widget-drag-handle').drag_to(page.locator('.widgets-center .widget-drag-handle').first)
    assert page.evaluate("state.widgetLayout.find(w => w.id === 'clock').column") == 2
    page.locator('[data-widget="weather"] .widget-hide').click()
    page.locator('#edit-page-done').click()
    page.reload(); expect(page.locator('html')).not_to_have_class('is-booting')
    assert page.locator('.widgets-center .notes-card').count() == 1
    expect(page.locator('.weather-card')).to_be_hidden()
    assert page.locator('.notes-card').get_attribute('data-size') == 'large'
    page.locator('#edit-page').click()
    page.locator('#hidden-widgets button').filter(has_text='Clima').click()
    page.locator('#edit-page-done').click()
    expect(page.locator('.weather-card')).to_be_visible()
    print('PASS aislamiento de perfiles, horarios y disposición persistente')

    page.locator('.habit-toggle').first.click()
    assert page.evaluate('state.widgets.habits[0].history.length') == 1
    page.evaluate("Object.assign(state.widgets.focus,{duration:1500,remaining:1,endsAt:Date.now()-1000});tickPersonalWidgets()")
    assert page.evaluate('state.widgets.focusHistory[0].seconds') == 1500
    page.evaluate('tickPersonalWidgets()')
    assert page.evaluate('state.widgets.focusHistory[0].sessions') == 1
    assert page.evaluate("habitStreak(['2026-10-01','2026-10-02','2026-10-03'],new Date('2026-10-04T12:00:00'))") == 3
    page.evaluate('onLocationOk({coords:{latitude:4.6,longitude:-74}})')
    page.locator('#weather-details-open').click()
    expect(page.locator('#weather-forecast')).to_contain_text('Sensación 13°C')
    expect(page.locator('#weather-forecast')).to_contain_text('Mañana')
    page.keyboard.press('Escape')
    print('PASS historial de enfoque sin duplicados, rachas y pronóstico')

    now = datetime.now().timestamp() * 1000
    page.evaluate("async entries => storageSet('auroraActivity', {sessions:entries,current:null})", [
        {'url': 'https://github.com/repo/private?q=secret', 'title': 'Secreto', 'start': now - 3600000, 'end': now - 1800000},
        {'url': 'https://sucursal.bancolombia.com/cuenta', 'title': 'Banca', 'start': now - 7200000, 'end': now - 5400000}])
    settings(page, 'datos')
    page.locator('#privacy-domain-only').check()
    page.locator('#privacy-banking').check()
    expect(page.locator('#privacy-status')).to_contain_text('guardada')
    entries = page.evaluate("JSON.parse(localStorage.getItem('auroraActivity')).sessions")
    assert len(entries) == 1 and entries[0]['url'] == 'https://github.com/' and entries[0]['title'] == 'github.com'
    page.locator('[data-days="7"]').click()
    expect(page.locator('#activity-summary')).to_contain_text('github.com')
    assert page.locator('.activity-chart-column').count() == 7
    with page.expect_download() as download:
        page.locator('#data-export').click()
    backup_path = OUTPUT / 'backup.json'; download.value.save_as(backup_path)
    backup = json.loads(backup_path.read_text(encoding='utf-8'))
    assert len(backup['profiles']) == 2 and backup['widgets']['focusHistory'][0]['seconds'] == 1500
    invalid = json.loads(json.dumps(backup)); invalid['profiles'][0]['data']['shortcuts'][0]['url'] = 'javascript:alert(1)'
    original = page.evaluate('state.activeProfile')
    file_import(page, invalid)
    expect(page.locator('#data-status')).to_contain_text('no son válidos')
    assert page.evaluate('state.activeProfile') == original
    file_import(page, backup)
    expect(page.locator('#data-status')).to_contain_text('Copia importada')
    assert page.evaluate('state.settings.trackPages') is False
    legacy = {key: backup[key] for key in ['categories', 'activeCategory', 'shortcuts', 'background', 'todos', 'settings', 'widgets']}
    legacy['widgets'].pop('focusHistory'); legacy['widgets']['habits'] = [{key: value for key, value in habit.items() if key != 'history'} for habit in legacy['widgets']['habits']]
    file_import(page, legacy)
    expect(page.locator('#data-status')).to_contain_text('Copia importada')
    assert page.evaluate('state.profiles.length') == 1
    assert page.evaluate('state.widgets.habits[0].history.length') == 1
    print('PASS privacidad retroactiva, gráficas, exportación, importación y migración')

    for width, height in [(1920, 952), (1440, 1000), (1024, 768), (768, 1024), (375, 812), (320, 568)]:
        page.set_viewport_size({'width': width, 'height': height})
        for section in ['fondo', 'apariencia', 'vista', 'reloj', 'calendario', 'busqueda', 'datos', 'perfiles', 'sesiones']:
            settings(page, section)
            assert_no_overflow(page)
        settings(page, 'perfiles')
        page.screenshot(path=str(OUTPUT / f'settings-{width}.png'))
        page.keyboard.press('Escape')
        page.screenshot(path=str(OUTPUT / f'dashboard-{width}.png'), full_page=True)
        page.locator('#todo-advanced').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.keyboard.press('Escape')
    assert not errors, errors
    print('PASS ajustes y diálogos a 1920, 1440, 1024, 768, 375 y 320 px; sin errores JS')
    browser.close()


def extension_tests(p):
    with tempfile.TemporaryDirectory(prefix='aurora-chromium-') as profile:
        context = p.chromium.launch_persistent_context(profile, channel='chromium', headless=True,
            args=[f'--disable-extensions-except={EXTENSION}', f'--load-extension={EXTENSION}'], viewport={'width': 1440, 'height': 1000})
        worker = context.service_workers[0] if context.service_workers else context.wait_for_event('serviceworker')
        extension_id = worker.url.split('/')[2]
        context.route('https://**/*', route_external)
        page = context.new_page(); errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        ready(page, f'chrome-extension://{extension_id}/newtab.html')
        assert page.evaluate('hasChromeStorage') is True
        page.locator('#todo-input').fill('Persistencia de extensión')
        page.locator('#todo-input').press('Enter')
        page.reload(); expect(page.locator('html')).not_to_have_class('is-booting')
        expect(page.locator('#todo-list')).to_contain_text('Persistencia de extensión')
        other = context.new_page(); ready(other, page.url)
        page.locator('#quick-note').fill('Compartida entre pestañas')
        expect(other.locator('#quick-note')).to_have_value('Compartida entre pestañas')
        other.close()
        settings(page, 'datos')
        page.locator('#sync-enabled').check()
        expect(page.locator('#sync-status')).to_contain_text('Copia enviada')
        stored = page.evaluate('chrome.storage.sync.get(null)')
        assert stored['auroraSyncManifest']['count'] >= 1
        assert page.evaluate('readSync()').get('schema') == 1
        before_remote = page.evaluate('chrome.storage.sync.get(null)')
        quota_error = page.evaluate("async () => {const saved=structuredClone(state);try {state.widgets.note='界'.repeat(4000);for(let i=0;i<11;i++)state.profiles.push({id:'quota'+i,name:'Perfil '+i,data:dashboardSnapshot()});await uploadSync(true);return ''}catch(error){return error.message}finally{state=saved}}")
        assert '80 KB' in quota_error
        assert page.evaluate('chrome.storage.sync.get(null)') == before_remote
        # Simula un dispositivo remoto sin credenciales ni red.
        page.evaluate("async () => {const data=await readSync();data.dashboard.widgets.note='Desde otro equipo';data.profiles.find(p=>p.id===data.activeProfile).data.widgets.note='Desde otro equipo';data.updatedAt=Date.now()+500;await applySyncedPayload(data)}")
        expect(page.locator('#quick-note')).to_have_value('Desde otro equipo')
        assert page.evaluate("storageGet('auroraBeforeSync')")['widgets']['note'] == 'Compartida entre pestañas'
        with page.expect_download() as previous_download:
            page.locator('#sync-previous-export').click()
        previous_download.value.save_as(OUTPUT / 'previous-sync.json')
        assert json.loads((OUTPUT / 'previous-sync.json').read_text(encoding='utf-8'))['widgets']['note'] == 'Compartida entre pestañas'
        page.evaluate("chrome.storage.sync.set({auroraSyncChunk0:'copia incompleta'})")
        assert page.evaluate('readSync()') is None
        expect(page.locator('#quick-note')).to_have_value('Desde otro equipo')
        page.locator('#sync-enabled').uncheck()
        assert worker.evaluate("privateActivityUrl('https://app.bbva.com/cuenta', {excludeBanking:true})") == ''
        assert worker.evaluate("privateActivityUrl('https://example.com/private', {domainOnly:true})") == 'https://example.com/'
        assert worker.evaluate("privateActivityUrl('https://example.com/private/a', {excludedUrls:['https://example.com/private']})") == ''
        # Prueba real de permiso opcional desde un gesto de usuario.
        settings(page, 'sesiones')
        page.locator('#tabs-connect').click()
        page.wait_for_timeout(1000)
        allowed = page.evaluate('tabsAllowed()')
        if allowed:
            web = context.new_page(); web.goto('https://example.com/estudio')
            page.bring_to_front()
            page.locator('#session-name').fill('Estudio')
            page.locator('#session-form button').click()
            expect(page.locator('#session-status')).to_contain_text('guardada')
            assert page.evaluate('state.tabSessions[0].tabs.length') >= 1
            page.locator('#sessions-list').get_by_text('Abrir en otra ventana', exact=True).click()
            expect(page.locator('#session-status')).to_contain_text('abierta')
            web.close()
            print('PASS permiso tabs, guardado y restauración real de sesión')
        else:
            print('PASS rechazo de permiso opcional en Chromium; el acceso concedido se prueba en la copia temporal')
        assert not errors, errors
        print('PASS carga MV3, almacenamiento real, varias pestañas, sync con hash y privacidad del trabajador')
        context.close()


def granted_permissions_tests(p):
    """Copia temporal con permisos concedidos; el manifiesto entregado no cambia."""
    with tempfile.TemporaryDirectory(prefix='aurora-permissions-') as folder:
        fixture = Path(folder) / 'extension'; shutil.copytree(EXTENSION, fixture)
        manifest_path = fixture / 'manifest.json'
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        manifest['permissions'] += ['tabs', 'idle']; manifest['optional_permissions'] = []
        manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
        context = p.chromium.launch_persistent_context(str(Path(folder) / 'browser'), channel='chromium', headless=True,
            args=[f'--disable-extensions-except={fixture}', f'--load-extension={fixture}'])
        worker = context.service_workers[0] if context.service_workers else context.wait_for_event('serviceworker')
        extension_id = worker.url.split('/')[2]
        context.route('https://**/*', route_external)
        page = context.new_page(); ready(page, f'chrome-extension://{extension_id}/newtab.html')
        errors = []; page.on('pageerror', lambda error: errors.append(str(error)))
        web = context.new_page(); web.goto('https://example.com/estudio')
        settings(page, 'sesiones')
        page.locator('#tabs-connect').click()
        expect(page.locator('#session-status')).to_contain_text('permitido')
        page.locator('#session-name').fill('Ventana de estudio')
        page.locator('#session-form button').click()
        expect(page.locator('#session-status')).to_contain_text('guardada')
        assert page.evaluate('state.tabSessions[0].tabs[0].url') == 'https://example.com/estudio'
        with context.expect_page() as restored:
            page.locator('#sessions-list').get_by_text('Abrir en otra ventana', exact=True).click()
        expect(page.locator('#session-status')).to_contain_text('abierta')
        restored.value.wait_for_load_state()
        assert restored.value.url == 'https://example.com/estudio'
        restored.value.close()
        # Un gesto real en el panel activa el registro con permisos ya concedidos.
        settings(page, 'datos')
        page.locator('#track-pages').check()
        expect(page.locator('#tracking-status')).to_contain_text('activado')
        assert worker.evaluate("chrome.alarms.get('aurora-activity-checkpoint')") is not None
        worker.evaluate('reconcile()')
        assert worker.evaluate("chrome.alarms.get('aurora-activity-checkpoint')") is not None
        now = datetime.now().timestamp() * 1000
        page.evaluate("async entries => storageSet('auroraActivity',{sessions:entries,current:null})", [
            {'url': 'https://github.com/a?secret=1', 'title': 'Privado', 'start': now - 60000, 'end': now - 30000},
            {'url': 'https://bbva.com/bank', 'title': 'Banca', 'start': now - 60000, 'end': now - 30000}])
        page.locator('#privacy-domain-only').check(); page.locator('#privacy-banking').check()
        expect(page.locator('#privacy-status')).to_contain_text('aplicada')
        entries = worker.evaluate("chrome.storage.local.get('auroraActivity')")['auroraActivity']['sessions']
        assert len(entries) == 1 and entries[0]['url'] == 'https://github.com/' and entries[0]['title'] == 'github.com'
        page.locator('#track-pages').uncheck()
        expect(page.locator('#tracking-status')).to_contain_text('detenido')
        assert page.evaluate('chrome.permissions.contains({permissions:["tabs"]})') is True
        assert not errors, errors
        context.close()
        print('PASS sesiones con tabs concedido, restauración en otra ventana, alarma persistente y privacidad real del trabajador')


if __name__ == '__main__':
    with sync_playwright() as playwright:
        local_tests(playwright)
        extension_tests(playwright)
        granted_permissions_tests(playwright)
    print(f'Capturas y copia de prueba: {OUTPUT}')
