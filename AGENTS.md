# Guía para agentes y colaboradores

## Proyecto

Aurora es una extensión Manifest V3 sin proceso de compilación. El código ejecutable está en `extension/`. La experiencia principal es `newtab.html`; `style.css` define la interfaz y `script.js` maneja el estado. La interfaz y la documentación de uso están en español.

## Al modificarla

- Mantén la extensión funcional al cargar la carpeta `extension/` directamente. Evita introducir dependencias, permisos del navegador o servicios nuevos sin una necesidad clara.
- Conserva los datos existentes en `chrome.storage.local` bajo la clave `auroraState`. Al añadir preferencias, define un valor por defecto en `defaultState()` y mezcla los valores guardados para que instalaciones previas sigan funcionando.
- Trata archivos JSON importados, nombres de tareas, categorías, accesos y URL como datos no confiables. Usa `textContent` para mostrarlos y valida sus tipos antes de guardarlos.
- Si cambias el panel de Ajustes, comprueba que ningún control quede recortado, que solo haya desplazamiento vertical en el contenido y que el panel funcione con teclado y en pantallas estrechas.
- No edites los archivos generados en el navegador ni datos de usuario para probar. Prueba la página local y recarga la extensión cuando corresponda.
- Actualiza `README.md` si cambias funciones, instalación, permisos o servicios externos.

## Verificación mínima

1. Comprueba la sintaxis con `node --check extension/script.js`.
2. Abre `extension/newtab.html` y revisa Ajustes en un ancho amplio y otro estrecho.
3. Prueba una tarea, un cambio de preferencia, exportar/importar datos y cerrar los diálogos con `Esc`.
4. Revisa que `manifest.json` sea JSON válido y que la extensión se cargue sin errores de consola.
