"""Verifica diseños, dimensiones y arrastre con perfiles de Chromium aislados."""
import runpy
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

qa = runpy.run_path(str(Path(__file__).with_name('test_aurora.py')))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 952})
    context.route('https://**/*', qa['route_external'])
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    qa['ready'](page, (qa['EXTENSION'] / 'newtab.html').as_uri())
    qa['settings'](page, 'vista')
    assert page.locator('[data-widget-design]').count() == 19
    original_data = page.evaluate('JSON.stringify({todos:state.todos,widgets:state.widgets,shortcuts:state.shortcuts})')
    page.evaluate("state.widgetLayout.find(w => w.id === 'weather').hidden = true")
    designs = page.evaluate('WIDGET_DESIGNS.map(design => design.id)')
    for design in designs:
        page.locator(f'[data-widget-design="{design}"]').click()
        assert page.evaluate('state.widgetLayout.length') == 11
        assert page.evaluate('new Set(state.widgetLayout.map(w => w.id)).size') == 11
        assert page.evaluate('JSON.stringify({todos:state.todos,widgets:state.widgets,shortcuts:state.shortcuts})') == original_data
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), design
        qa['assert_no_overflow'](page)
        assert page.evaluate('normalizeDashboard(dashboardSnapshot(), true).settings.widgetDesign') == design
        assert page.evaluate("state.widgetLayout.find(w => w.id === 'weather').hidden")
    print('PASS 19 diseños completos, sin duplicados ni cambios de datos; validación estricta')
    page.evaluate("state.widgetLayout.find(w => w.id === 'weather').hidden = false")

    page.locator('[data-widget-design="balance"]').click()
    for selector, value in [('#widget-left-width','300'),('#widget-left-height','420'),('#widget-right-width','280'),
                            ('#widget-right-height','460'),('#widget-center-width','600'),('#widget-center-height','260'),
                            ('#shortcuts-width','680'),('#widget-gap','20')]:
        page.locator(selector).fill(value)
        page.locator(selector).press('Tab')
    page.locator('#widget-center-columns').select_option('2')
    page.keyboard.press('Escape')
    assert page.locator('.widgets-right').bounding_box()['width'] == 280
    assert page.locator('.widgets-right').bounding_box()['height'] == 460
    assert page.locator('.widgets-center').bounding_box()['width'] == 600
    assert page.locator('.widgets-center').bounding_box()['height'] == 260
    assert page.locator('.main-area').bounding_box()['width'] == 680
    page.evaluate('persist()')
    qa['ready'](page, page.url)
    assert page.evaluate('state.settings.leftWidgetHeight') == 420
    assert page.evaluate('state.settings.centerWidgetColumns') == 2
    qa['settings'](page, 'vista')
    page.screenshot(path=str(qa['OUTPUT'] / 'widget-settings-1920.png'))
    print('PASS ancho y alto independientes de las tres zonas y ancho de accesos; persistencia')

    page.locator('[data-widget-design="board"]').click()
    page.locator('#settings-edit-page').click()
    handle = page.locator('[data-widget="clock"] .widget-drag-handle')
    before = page.evaluate("({...state.widgetLayout.find(w => w.id === 'clock')})")
    handle.click()
    assert page.evaluate("({...state.widgetLayout.find(w => w.id === 'clock')})") == before
    box = handle.bounding_box()
    page.mouse.move(box['x']+20, box['y']+10)
    page.mouse.down()
    page.mouse.move(box['x']+140, box['y']+110, steps=8)
    page.mouse.up()
    after = page.evaluate("({...state.widgetLayout.find(w => w.id === 'clock')})")
    assert after['x'] == before['x'] + 120 and after['y'] == before['y'] + 100, (before, after)
    handle.focus(); page.keyboard.press('ArrowRight'); page.keyboard.press('Shift+ArrowDown')
    assert page.evaluate("state.widgetLayout.find(w => w.id === 'clock').x") == after['x'] + 10
    assert page.evaluate("state.widgetLayout.find(w => w.id === 'clock').y") == after['y'] + 1
    for dimension, value in [('width','340'),('height','280')]:
        control = page.locator(f'[data-widget="clock"] [data-dimension="{dimension}"]')
        control.fill(value); control.press('Tab')
    page.keyboard.press('Escape')
    assert not page.evaluate('editingPage')
    page.evaluate('persist()')
    qa['ready'](page, page.url)
    expect(page.locator('body')).to_have_class('widget-free')
    assert page.locator('[data-widget="clock"]').bounding_box()['width'] == 340
    assert page.locator('[data-widget="clock"]').bounding_box()['height'] == 280
    assert page.evaluate("state.widgetLayout.find(w => w.id === 'clock').x") == after['x'] + 10
    page.screenshot(path=str(qa['OUTPUT'] / 'widget-free-1920.png'), full_page=True)
    print('PASS arrastre libre real, flechas, tamaño por widget y recarga')

    qa['settings'](page, 'datos')
    with page.expect_download() as download:
        page.locator('#data-export').click()
    import json
    backup_file = qa['OUTPUT'] / 'widget-backup.json'
    download.value.save_as(backup_file)
    backup = json.loads(backup_file.read_text(encoding='utf-8'))
    page.evaluate("state.widgetLayout.find(w => w.id === 'clock').x = 0; applyWidgetLayout()")
    qa['file_import'](page, backup)
    expect(page.locator('#data-status')).to_contain_text('Copia importada')
    assert page.evaluate("state.widgetLayout.find(w => w.id === 'clock').x") == after['x'] + 10
    assert page.evaluate("state.widgetLayout.find(w => w.id === 'clock').height") == 280
    assert page.evaluate('state.settings.widgetPlacement') == 'free'
    print('PASS exportación e importación de coordenadas, dimensiones y modo libre')

    qa['settings'](page, 'vista')
    page.locator('[data-widget-design="balance"]').click()
    page.locator('#settings-edit-page').click()
    notes = page.locator('[data-widget="notes"] .widget-drag-handle')
    notes.drag_to(page.locator('.widgets-right [data-widget="calendar"] .widget-drag-handle'))
    assert page.evaluate("state.widgetLayout.find(w => w.id === 'notes').column") == 3
    page.keyboard.press('Escape')
    assert not page.evaluate('editingPage')
    print('PASS arrastre entre zonas y cierre del editor con Esc')

    assert page.evaluate("""() => {
        const raw = dashboardSnapshot();
        for (const [key, value] of [['width', '900'], ['height', -1], ['x', 9000]]) {
            const copy = structuredClone(raw); copy.widgetLayout[0][key] = value;
            try { normalizeDashboard(copy, true); return false; } catch {}
        }
        const invalid = structuredClone(raw); invalid.settings.leftWidgetWidth = 'huge';
        try { normalizeDashboard(invalid, true); return false; } catch {}
        return true;
    }""")
    print('PASS rechazo de dimensiones y posiciones importadas no válidas')

    for width, height in [(1440,1000),(1024,768),(768,1024),(375,812),(320,568)]:
        page.set_viewport_size({'width':width, 'height':height})
        qa['settings'](page, 'vista')
        for design in designs:
            page.locator(f'[data-widget-design="{design}"]').click()
            qa['assert_no_overflow'](page)
        page.locator('[data-widget-design="reference"]').click()
        page.screenshot(path=str(qa['OUTPUT'] / f'widget-settings-{width}.png'))
        page.keyboard.press('Escape')
        page.screenshot(path=str(qa['OUTPUT'] / f'widget-dashboard-{width}.png'), full_page=True)
        if width <= 900:
            left = page.locator('.widgets:not(.widgets-right):not(.widgets-center)').bounding_box()
            right = page.locator('.widgets-right').bounding_box()
            assert right['y'] >= left['y'] + left['height'], (width, left, right)
    assert not errors, errors
    print('PASS todos los diseños y Ajustes entre 320 y 1920 px; sin errores JS')
    browser.close()
