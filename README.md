# Aurora — Nueva Pestaña

Aurora es una extensión para navegadores basados en Chromium que reemplaza la nueva pestaña con accesos directos, búsqueda, reloj, clima, una frase diaria, pendientes, calendarios y herramientas personales. Puedes personalizar el fondo y la disposición desde **Ajustes**.

La versión **1.5** incorpora todas las mejoras propuestas para Aurora: paleta de comandos, edición de widgets, perfiles y horarios, estadísticas, actividad con privacidad, tareas avanzadas, eventos rápidos, pronóstico, sincronización y sesiones de pestañas. Los datos de versiones anteriores se conservan en el perfil **Personal**.

La versión **1.6** restaura los accesos contenidos en un bloque central de 700 px y añade 19 diseños, posición libre por arrastre, dimensiones por widget y controles independientes de ancho, alto y columnas para izquierda, derecha y centro inferior. Todo se configura en **Ajustes → Vista**, sin servicios ni permisos nuevos.

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
- **Pendientes:** escribe una tarea y pulsa Enter o `+`. **Nueva tarea con fecha** y **Editar** permiten elegir fecha, prioridad alta/normal/baja, categoría y repetición diaria, semanal o mensual. La repetición semanal conserva el día de la fecha elegida. Al completar una tarea repetida se crea la siguiente ocurrencia; deshacerla elimina esa ocurrencia si aún está pendiente. En meses cortos se usa su último día y se recupera el día original en meses posteriores (31 enero → 28 febrero → 31 marzo). La tarjeta avisa de tareas para hoy y vencidas; **Mi calendario** muestra hasta cuatro tareas con fecha del perfil activo. Usa **Limpiar completadas** para retirar las terminadas.
- **Un rato de enfoque:** bajo los pendientes, inicia una sesión de 25 o 50 minutos, o una pausa de 5 minutos. Puedes pausar, continuar y reiniciar. La cuenta se conserva al recargar o cerrar la pestaña; al volver, se calcula el tiempo que queda y se muestra si terminó. El contador **hoy** registra sesiones de enfoque terminadas y se reinicia cada día. El aviso es visual dentro de Aurora, sin notificaciones ni sonido.
- **Notas al vuelo:** escribe ideas en la libreta bajo el temporizador. Guarda automáticamente hasta 4000 caracteres por perfil y sincroniza el estado entre pestañas de Aurora abiertas en el mismo navegador.
- **Pequeñas victorias:** bajo los partidos, marca tus hábitos de hoy. Incluye tres propuestas que puedes eliminar; añade los tuyos con Enter o `+`, hasta ocho. Las marcas corresponden a la fecha local y vuelven a quedar pendientes al comenzar el siguiente día.
- **El tiempo en perspectiva:** muestra el porcentaje transcurrido del día y del año, y cuánto tiempo queda de hoy. Se calcula localmente, sin consultas externas. En **Ajustes → Vista** puedes ocultar individualmente los cuatro widgets nuevos; ocultar calendarios conserva los hábitos y el avance del tiempo.
- **Mi Google Calendar:** en **Ajustes → Calendarios**, pega la **Dirección secreta en formato iCal** de tu calendario (Google Calendar → Ajustes → elige el calendario → Integrar calendario). Aurora comprueba la dirección y muestra hasta cuatro eventos próximos en la tarjeta **Mi calendario**. Es una conexión de solo lectura: no modifica eventos y no inicia sesión con tu cuenta. La dirección secreta se guarda en `chrome.storage.local` bajo `auroraGoogleIcalUrl`, separada de `auroraState`; no se incluye en las copias exportadas. Usa **Desconectar** para borrarla. Si no ves la dirección secreta en Google Calendar, consulta la configuración de uso compartido o las restricciones de tu cuenta.
- **Partidos:** la tarjeta **Partidos** permite alternar entre FC Barcelona, Millonarios y la Selección Colombia. Muestra hasta cuatro próximos encuentros por equipo, con fechas y horas en la zona horaria del navegador, y enlaza al calendario completo. Estos calendarios son independientes de **Mi Google Calendar**; Aurora no los añade a tu cuenta de Google. Los datos proceden de [Fixtur.es](https://fixtur.es/) y pueden cambiar según la programación de los partidos.
- **Actividad:** en **Ajustes → Tus datos**, activa **Registrar actividad**. Aurora pedirá permiso para conocer la pestaña activa y detectar inactividad. Registra URL, título y tiempo cuando una página web está activa, la ventana del navegador tiene el foco y el equipo está activo. El dashboard ofrece **Hoy**, **7 días** y **30 días**, totales por dominio, gráfica por horas/días, valores accesibles de la gráfica y sesiones recientes. Los tiempos se recortan al periodo elegido, incluso si una sesión cruza medianoche. Puedes detener y borrar el registro; conserva un máximo de 30 días y 2000 sesiones. No registra ventanas privadas ni páginas internas del navegador.
- **Privacidad de actividad:** activa **Guardar solo el dominio** para eliminar rutas, parámetros y títulos; añade dominios excluidos (incluye subdominios) y páginas concretas (incluye rutas descendientes). **Excluir sitios de banca conocidos** usa una lista explícita de bancos y servicios comunes; añade tu banco si falta. Guardar estas opciones también elimina o reduce los registros existentes. Esta reducción es irreversible: desactivarla no recupera URLs ni títulos anteriores. Las exclusiones se aplican al registro de actividad; las sesiones de pestañas se guardan por una acción independiente.
- **Respaldo:** en **Ajustes → Tus datos**, exporta un archivo JSON. Incluye perfiles, horarios, disposiciones, tareas, notas, hábitos e historiales, temporizador, galerías, secuencias, preferencias, privacidad, sesiones guardadas y actividad. Importarlo reemplaza esos datos y, si está incluida, la actividad; las copias antiguas siguen siendo compatibles. Aurora valida toda la copia antes de reemplazarla. Registro y sincronización quedan desactivados tras importar. La dirección iCal privada no se exporta. Guárdalo en un lugar privado: puede contener notas, fondos locales codificados e historial de páginas.
- **Atajos de teclado:** `/` o `Ctrl+K` (`⌘+K`) abren la paleta; flechas arriba/abajo seleccionan y Enter ejecuta. `Ctrl+,` (`⌘+,`) abre Ajustes; `Esc` cierra la paleta, el último diálogo o la edición de página. Los diálogos conservan el foco de teclado, también en sus campos de texto multilínea.

### Comandos del buscador

La búsqueda normal y las URL siguen abriéndose en una pestaña nueva con el buscador elegido. Escribe `/` para descubrir las acciones, o usa directamente:

| Ejemplo | Acción |
| --- | --- |
| `yt re zero opening` | Buscar en YouTube |
| `gh openai` | Buscar en GitHub |
| `@uni github` | Abrir un acceso de una categoría que contenga «uni»; si no existe, buscar en perfiles con ese nombre |
| `todo entregar trabajo SQL` | Añadir una tarea al perfil activo |
| `note revisar ejercicio 4` | Añadir una línea a sus notas |
| `focus 50` | Iniciar enfoque de 50 minutos; admite de 1 a 180 |
| `weather` | Abrir el pronóstico |
| `calc 3500 * 22` | Calcular localmente sin ejecutar código; admite paréntesis y `+ - * / % ^` |
| `> ajustes`, `> fondos`, `> actividad` | Abrir la sección correspondiente |
| `> cambiar perfil`, `> editar`, `> evento`, `> sesiones` | Acceder a perfiles, editor, eventos o pestañas |

### Tu página, tus espacios

- **Diseños y dimensiones:** en **Ajustes → Vista** hay 19 diseños: Original, Laterales compactos, Laterales amplios, Equilibrado, Centro en dos columnas, Centro vertical, Productividad, Estudio, Enfoque, Agenda, Rutinas, Cuaderno, Todo a la izquierda, Todo a la derecha, Panel inferior, Franja superior, Posición libre, Tablero libre y Referencia de tu captura. Cada diseño cambia posiciones y dimensiones y conserva contenido y visibilidad. **Original** recupera seis widgets a la izquierda, cinco a la derecha y accesos centrales de 700 px. La distribución predeterminada introducida anteriormente se restaura sin perder tamaños, visibilidad o datos; las posiciones que hayas personalizado se conservan. Puedes volver a Original con un botón.
- **Editar página:** activa el editor desde la barra superior o **Ajustes → Vista**. En **Por zonas**, arrastra el control **Mover** entre izquierda, centro inferior y derecha, o usa las flechas de orden y el selector de columna. Ajusta en Configuración el ancho, alto y número de columnas de cada zona, el ancho de los accesos y la separación entre widgets. Ancho central 0 ocupa el espacio disponible; altura 0 usa la pantalla en los laterales y altura natural en el centro. Las alturas fijas permiten desplazamiento dentro de la zona.
- **Posición libre:** elige este modo o uno de sus diseños en **Ajustes → Vista**, activa el editor y arrastra **Mover** a cualquier posición de la página debajo de la barra superior. Con el control enfocado, las flechas mueven 10 px y `Mayús` + flecha mueve 1 px. Cada widget permite ajustar **Ancho**, **Alto**, **X** e **Y** en píxeles. Ancho/alto 0 significa automático; una altura fija permite desplazamiento dentro del widget. También puedes ocultarlo y recuperarlo desde **Añadir de nuevo**. **Listo** o `Esc` termina la edición. Se guarda por perfil y se incluye en las copias JSON y la sincronización. En pantallas de 900 px o menos, la posición libre se adapta a zonas sin modificar las coordenadas guardadas; en pantallas estrechas se apila en una columna.
- **Perfiles:** la barra superior permite alternar entre espacios. **Perfiles** abre su administración: crea hasta doce, copia el actual o usa las propuestas Universidad, Trabajo y Gaming/Ocio, renómbralos o elimínalos. Cada uno conserva accesos/categorías, fondo, secuencia activa, tema, buscador, disposición, preferencias de widgets, tareas, notas, hábitos y enfoque. La galería de archivos es compartida; la privacidad, la actividad y las sesiones guardadas pertenecen al equipo. Un perfil Universidad incluye GitHub, ChatGPT, Drive y Calendar; añade tus enlaces propios de Moodle/Génesis. El perfil Personal recibe los datos previos sin sustituirlos.
- **Horarios de perfiles:** en **Ajustes → Perfiles** elige días, inicio y final. También admite horarios que cruzan medianoche. Se comprueba al abrir Aurora, al volver a ella y cada minuto mientras está abierta. Si coinciden horarios, gana el primero; fuera de ellos se mantiene el último perfil. Un cambio manual tiene prioridad hasta el final del día; **Reanudar horarios ahora** cancela esa prioridad. No interrumpe un diálogo ni la edición de widgets.
- **Estadísticas:** **Esta semana** resume minutos reales de enfoque, sesiones y mejor día, con gráfica de lunes a domingo. Los hábitos muestran su historial semanal y su racha por días consecutivos; una racha sigue vigente si completaste ayer y hoy aún está pendiente. Se guardan hasta 366 entradas por historial. El contador previo de sesiones se conserva al migrar; los minutos que antes no se guardaban no se inventan. Las pausas de cinco minutos no suman enfoque. Puedes ocultar la tarjeta en Vista o en el editor.
- **Clima ampliado:** **Ver pronóstico**, o `weather`, muestra sensación térmica, humedad, viento, próximas horas con probabilidad de lluvia y máximas/mínimas, amanecer y atardecer de hoy y mañana. Usa Open-Meteo y las horas locales de la ubicación. Respeta °C/°F y permite actualizar; cuando Aurora está visible refresca el clima cada hora.
- **Nuevo evento:** el botón de **Mi calendario**, o `> evento`, recoge título, fecha, hora/duración o día completo, lugar y descripción. Abre Google Calendar con esos datos para que revises y guardes el evento. No necesita OAuth ni escribir desde la extensión en tu cuenta.

### Sincronización y sesiones

**Ajustes → Tus datos → Sincronizar entre equipos** activa la sincronización nativa del navegador. Requiere la misma cuenta, sincronización de extensiones habilitada y el mismo ID de Aurora en ambos equipos. Una instalación descomprimida en rutas diferentes puede recibir otro ID: en ese caso usa **Exportar/Importar copia** para transferir todos los datos.

Al activarla, Aurora trae la copia existente; si no existe, envía la de este equipo. Después comparte cambios de perfiles, accesos, tareas, notas, hábitos/historiales, temas, buscador y disposiciones. **Enviar este equipo** y **Traer la copia sincronizada** permiten decidir manualmente qué copia usar. Cuando hay cambios simultáneos gana la copia completa con la fecha de edición más reciente; no se fusionan tareas o notas de dos copias. Antes de aplicar una copia remota se conserva el estado previo localmente bajo `auroraBeforeSync`. La opción **Exportar copia anterior a sincronizar** permite recuperarlo.

La copia se divide en fragmentos y se verifica con SHA-256 antes de aplicarla. El máximo es **80 KB**, incluyendo su codificación; un exceso muestra un error y mantiene los datos locales. El navegador determina cuándo llega a otros equipos. Actividad, privacidad, dirección iCal, páginas recientes, sesiones guardadas, galería y secuencias de fondos locales quedan fuera. Los fondos por URL sí se comparten; los archivos de fondo y secuencias existentes en el equipo receptor se conservan. Un temporizador en marcha se conserva en su equipo y no se inicia en el otro. Desactivar la opción detiene envíos/recepciones en ese equipo, pero deja la copia del navegador.

**Pestañas**, o **Ajustes → Pestañas**, solicita por separado el permiso opcional `tabs`. Muestra hasta doce páginas recientes, incluyendo las abiertas; cuando autorizas la función conserva hasta 100 páginas recientes durante 30 días, localmente. Si una pestaña sigue abierta, la activa; si ya se cerró, vuelve a abrir la URL. **Guardar esta ventana** conserva hasta veinte sesiones de cien pestañas HTTP/HTTPS, excluyendo privadas e internas; **Abrir en otra ventana** restaura sus páginas sin cerrar tu ventana actual. Las sesiones se incluyen en el respaldo JSON, no en sincronización. **Retirar acceso a pestañas** borra recientes y detiene su registro; conserva sesiones guardadas. Si sigue activa la actividad, el permiso `tabs` permanece porque la necesita.

## Datos y servicios

Para evitar el salto visual al abrir una pestaña, Aurora guarda una vista previa reducida del fondo en `localStorage` bajo `auroraBootPreview`. Los datos principales permanecen en `auroraState`; la vista previa se regenera al cambiar el fondo.

La configuración, los accesos, las tareas, los perfiles y las galerías se guardan en `chrome.storage.local` bajo `auroraState`. La actividad se guarda bajo `auroraActivity`, las páginas recientes bajo `auroraRecentTabs` y la activación local de sincronización bajo `auroraSyncEnabled`. Solo los datos descritos en la sección de sincronización se envían mediante `chrome.storage.sync` cuando la activas. El clima usa la ubicación que autorices y consulta Open-Meteo; el nombre de la localidad se obtiene de BigDataCloud. Los accesos usan primero el favicon del navegador, después el servicio de Google y, si también falla, la inicial del acceso. Los fondos por URL se cargan desde sus respectivos sitios. Los calendarios consultan `calendar.google.com` e `ics.fixtur.es`; sin conexión se muestran errores y el resto sigue disponible.

La extensión usa `storage` y `unlimitedStorage` para datos, `alarms` para actualizar actividad y `favicon` para iconos. Los accesos a `calendar.google.com` e `ics.fixtur.es` permiten leer iCal. `tabs` e `idle` siguen siendo opcionales: actividad solicita ambos, pestañas solicita solo `tabs`. Desactivar actividad retira `idle` y también `tabs` si no lo usa la función de pestañas. No se añaden permisos obligatorios ni servicios nuevos. Después de actualizar, recarga la extensión para activar el manifiesto y el trabajador nuevos.

## Estructura

| Archivo | Función |
| --- | --- |
| `extension/manifest.json` | Manifest V3 y reemplazo de nueva pestaña |
| `extension/newtab.html` | Estructura de la interfaz |
| `extension/boot.js` | Vista previa inmediata del fondo durante la carga |
| `extension/style.css` | Diseño y adaptación a pantallas estrechas |
| `extension/script.js` | Inicio y barra de herramientas |
| `extension/storage.js`, `extension/models.js` | Persistencia, valores iniciales, validación y migración |
| `extension/commands.js` | Paleta, búsqueda y calculadora |
| `extension/dashboard.js`, `extension/widgets.js` | Editor, estadísticas y widgets personales |
| `extension/widget-designs.js` | Diseños predefinidos y controles de dimensiones de Ajustes |
| `extension/profiles.js` | Perfiles y horarios |
| `extension/tasks.js`, `extension/weather.js` | Tareas avanzadas y pronóstico |
| `extension/backgrounds.js`, `extension/shortcuts.js` | Fondos/galerías y accesos/categorías |
| `extension/settings.js`, `extension/dialogs.js` | Ajustes, respaldo y diálogos accesibles |
| `extension/privacy.js`, `extension/activity-view.js` | Exclusiones compartidas y dashboard de actividad |
| `extension/sync.js`, `extension/sessions.js` | Sincronización opcional y sesiones |
| `extension/calendar.js` | Lectura y presentación de calendarios iCal |
| `extension/activity.js` | Registro local de la pestaña activa |
| `extension/icons/` | Iconos de la extensión |

Para contribuir, consulta `AGENTS.md`.

## Verificación de desarrollo

La extensión no necesita instalar dependencias para funcionar. Para repetir la prueba automática instala Playwright en un entorno de desarrollo y su Chromium, y ejecuta `python tests/test_aurora.py`. Usa perfiles temporales, respuestas de servicios simuladas y una copia temporal con permisos concedidos para probar sesiones y actividad; no toca perfiles del usuario. Comprueba migración, datos no confiables, comandos, recurrencia mensual, perfiles, disposición, historiales, clima, copias, sincronización parcial, sesiones y Ajustes a 1440, 375 y 320 px. Las capturas se guardan en la carpeta temporal `aurora-verification`. También ejecuta `node --check extension/script.js` y comprueba los demás módulos y el JSON del manifiesto.

