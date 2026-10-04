# Aurora — Nueva Pestaña

Aurora es una extensión para navegadores basados en Chromium que reemplaza la nueva pestaña con accesos directos, búsqueda, reloj, clima, una frase diaria, pendientes, calendarios y herramientas personales. Puedes personalizar el fondo y la disposición desde **Ajustes**.

## Instalación

1. Abre `chrome://extensions` en Chrome o `brave://extensions` en Brave.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `extension` de este proyecto (la que contiene `manifest.json`).
4. Abre una pestaña nueva. Tras editar los archivos, pulsa **Recargar** en la tarjeta de la extensión para ver los cambios.

No hay compilación ni dependencias de npm: la extensión usa HTML, CSS y JavaScript nativos.

## Uso

- **Ajustes:** abre el engranaje del buscador o de la barra lateral. El panel incluye fondo, apariencia, vista, reloj y clima, búsqueda y respaldo de datos. Los cambios se aplican al instante; al elegir el color de acento, se previsualiza en el panel y se aplica a toda la página al confirmar la selección.
- **Temas de colores:** en **Ajustes → Apariencia**, elige Aurora (original), Blanco, Negro, Dorado, Azul, Verde, Violeta o Rosa. El tema cambia paneles, textos, botones y el fondo predeterminado; conserva las imágenes, videos y secuencias que hayas elegido. Cada tema aplica un acento sugerido que puedes personalizar después. La selección se guarda y se incluye en las copias de datos; las instalaciones y copias anteriores conservan Aurora y su acento personalizado. **Restablecer ajustes** vuelve al tema original.
- **Fondos y galería:** añade imágenes (hasta 15 MB) y videos mp4, webm u ogg (hasta 25 MB) por URL o archivo. La galería ocupa un panel amplio y presenta los fondos en una cuadrícula de vistas previas grandes. Los videos se pueden reproducir desde cada tarjeta; **Ver** abre una vista ampliada para imágenes y videos. Puedes usarlos, quitarlos y marcarlos para una secuencia. Ordena la secuencia con las flechas y configura su rotación en minutos, horas o días. La rotación actúa sobre el tipo de fondo activo y se calcula también al abrir una pestaña nueva. **Cubrir** llena la pantalla sin deformar, **Mostrar completo** enseña todo el fotograma con espacios de color, y **Estirar a pantalla** llena todo aunque cambie la proporción. También puedes ajustar brillo, desenfoque, sonido y volumen. **Tomar color del video** propone un tono; algunos videos remotos no permiten leer sus colores.
- **Accesos y categorías:** crea accesos con el recuadro **Añadir**. Aurora muestra la categoría activa; la categoría automática **Todos** se retiró y las instalaciones anteriores pasan a **General** o a su primera categoría disponible. Arrastra un acceso sobre otro para reordenarlos, o suéltalo sobre una categoría para moverlo. También puedes usar el botón ↗ o `Alt` + flechas. Haz clic derecho sobre una categoría para cambiar su nombre; Aurora actualiza automáticamente los accesos que contiene. El menú contextual también ofrece acciones para accesos y para el área general. Se puede abrir con `Shift+F10` o la tecla de menú cuando un acceso o categoría tiene el foco. Los accesos y los resultados del buscador se abren en una pestaña nueva. En **Ajustes → Apariencia** puedes elegir doce estilos de caja, incluidos Aurora, Papel, Marco y Baldosa. En **Ajustes → Vista** hay seis presentaciones: cuadrícula, compacta, lista, mosaico, tarjetas y cinta horizontal. También puedes mostrar u ocultar nombres, definir las filas de lista, elegir animación suave, viva o ninguna, y situar la barra de herramientas a la derecha, izquierda, arriba o abajo, u ocultarla. El sistema respeta la preferencia de movimiento reducido del navegador.
- **Pendientes:** escribe una tarea en el campo de la tarjeta y pulsa Enter o `+`. Marca tareas hechas y usa **Limpiar completadas** cuando quieras.
- **Un rato de enfoque:** bajo los pendientes, inicia una sesión de 25 o 50 minutos, o una pausa de 5 minutos. Puedes pausar, continuar y reiniciar. La cuenta se conserva al recargar o cerrar la pestaña; al volver, se calcula el tiempo que queda y se muestra si terminó. El contador **hoy** registra sesiones de enfoque terminadas y se reinicia cada día. El aviso es visual dentro de Aurora, sin notificaciones ni sonido.
- **Notas al vuelo:** escribe ideas en la libreta bajo el temporizador. Guarda automáticamente hasta 4000 caracteres y sincroniza el texto entre pestañas de Aurora abiertas en el mismo navegador.
- **Pequeñas victorias:** bajo los partidos, marca tus hábitos de hoy. Incluye tres propuestas que puedes eliminar; añade los tuyos con Enter o `+`, hasta ocho. Las marcas corresponden a la fecha local y vuelven a quedar pendientes al comenzar el siguiente día.
- **El tiempo en perspectiva:** muestra el porcentaje transcurrido del día y del año, y cuánto tiempo queda de hoy. Se calcula localmente, sin consultas externas. En **Ajustes → Vista** puedes ocultar individualmente los cuatro widgets nuevos; ocultar calendarios conserva los hábitos y el avance del tiempo.
- **Mi Google Calendar:** en **Ajustes → Calendarios**, pega la **Dirección secreta en formato iCal** de tu calendario (Google Calendar → Ajustes → elige el calendario → Integrar calendario). Aurora comprueba la dirección y muestra hasta cuatro eventos próximos en la tarjeta **Mi calendario**. Es una conexión de solo lectura: no modifica eventos y no inicia sesión con tu cuenta. La dirección secreta se guarda en `chrome.storage.local` bajo `auroraGoogleIcalUrl`, separada de `auroraState`; no se incluye en las copias exportadas. Usa **Desconectar** para borrarla. Si no ves la dirección secreta en Google Calendar, consulta la configuración de uso compartido o las restricciones de tu cuenta.
- **Partidos:** la tarjeta **Partidos** permite alternar entre FC Barcelona, Millonarios y la Selección Colombia. Muestra hasta cuatro próximos encuentros por equipo, con fechas y horas en la zona horaria del navegador, y enlaza al calendario completo. Estos calendarios son independientes de **Mi Google Calendar**; Aurora no los añade a tu cuenta de Google. Los datos proceden de [Fixtur.es](https://fixtur.es/) y pueden cambiar según la programación de los partidos.
- **Actividad:** en **Ajustes → Tus datos**, activa **Registrar actividad**. Aurora pedirá permiso para conocer la pestaña activa y detectar inactividad. Registra URL, título y tiempo cuando una página web está activa, la ventana del navegador tiene el foco y el equipo está activo. Muestra los sitios de hoy y las sesiones recientes. Puedes detener y borrar el registro; conserva un máximo de 30 días y 2000 sesiones. No registra ventanas privadas ni páginas internas del navegador. Es un registro de navegación en el navegador, no un seguimiento de aplicaciones de escritorio como el de ManicTime.
- **Respaldo:** en **Ajustes → Tus datos**, exporta un archivo JSON. Importarlo reemplaza accesos, tareas, notas, hábitos, temporizador, galerías, secuencias, preferencias y, si está incluida, la actividad. Las copias anteriores siguen siendo compatibles y reciben los valores iniciales de los nuevos widgets. Por privacidad, el registro queda desactivado tras importar y debe activarse de nuevo. Guárdalo en un lugar privado: puede contener tu saludo, notas, fondos locales codificados e historial de páginas, por lo que puede ser grande.
- **Atajos de teclado:** `/` enfoca el buscador; `Ctrl+,` (o `⌘+,` en macOS) abre Ajustes; `Esc` cierra un diálogo.

## Datos y servicios

Para evitar el salto visual al abrir una pestaña, Aurora guarda una vista previa reducida del fondo en `localStorage` bajo `auroraBootPreview`. Los datos principales permanecen en `auroraState`; la vista previa se regenera al cambiar el fondo.

La configuración, los accesos, las tareas y las galerías se guardan en `chrome.storage.local` bajo `auroraState`. La actividad se guarda por separado bajo `auroraActivity` y no sale del navegador, salvo cuando exportas una copia. El clima usa la ubicación que autorices y consulta Open-Meteo; el nombre de la localidad se obtiene de BigDataCloud. Los accesos usan primero el favicon que el navegador guarda para la página exacta; si no puede cargarse, se consulta el servicio de favicons de Google y, si también falla, se muestra la inicial del acceso. Las URL de imagen o video que introduzcas se cargan desde sus respectivos sitios. Los calendarios consultan `calendar.google.com` (solo tras conectarlo) e `ics.fixtur.es` para los partidos; sin conexión se muestran estados de error y el resto de Aurora sigue disponible.

La extensión usa `storage` y `unlimitedStorage` para conservar datos, `alarms` para actualizar el tiempo registrado y `favicon` para mostrar los iconos de las páginas visitadas. Los accesos a `calendar.google.com` e `ics.fixtur.es` permiten leer los archivos iCal desde la extensión. Los permisos `tabs` e `idle` son opcionales y solo se solicitan al activar el registro de actividad. Al desactivarlo se retiran esos permisos. Después de actualizar la extensión, recárgala desde la página de extensiones para que el trabajador de fondo y el manifiesto nuevos entren en vigor.

## Estructura

| Archivo | Función |
| --- | --- |
| `extension/manifest.json` | Manifest V3 y reemplazo de nueva pestaña |
| `extension/newtab.html` | Estructura de la interfaz |
| `extension/boot.js` | Vista previa inmediata del fondo durante la carga |
| `extension/style.css` | Diseño y adaptación a pantallas estrechas |
| `extension/script.js` | Estado, persistencia e interacciones |
| `extension/calendar.js` | Lectura y presentación de calendarios iCal |
| `extension/activity.js` | Registro local de la pestaña activa |
| `extension/icons/` | Iconos de la extensión |

Para contribuir, consulta `AGENTS.md`.

