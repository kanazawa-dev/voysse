# Decision: Voysse Studio, a canvas per client

Accepted by Alex on 6 September 2026. Deliver in independently tested stages.

## Phase one — operational connections

- A client owns its canvas. Only agency administrators may configure it; existing
  operator and portal permissions are not expanded.
- Show real channels → agents and each agent's web widget. One agent per channel;
  multiple channels may share an agent. Never allow connections across clients.
- Select nodes, connect using a button or drag/drop, inspect settings, try saved
  agent behavior and preview widget appearance without leaving Studio.
- Connection/settings edits require explicit confirmation. Reassigning a channel
  preserves its credentials, connection state and enabled flag. Version checks
  reject stale changes instead of silently overwriting another administrator.
- Credential enrollment remains in existing channel setup screens; Studio does
  not imply OAuth certification or establish a provider connection by drawing a line.
- Preview uses the real configured model and knowledge (provider costs apply), but
  no tools, channel sends or production conversation history. Temporary test chat
  stays in page memory; token usage is recorded. This is not a production-delivery test.
- Widget preview is a visual mock using draft appearance, not a live public iframe.

## Technical and delivery choices

Reuse existing client/channel/agent records; no duplicate workflow database or
migration. Provide a secret-free scoped graph API, narrow version-checked writes
and a tool-free preview endpoint. Use React, semantic HTML and SVG for the bounded
channel map; no extra graph library or arbitrary execution engine in phase one.
Canvas zoom/scroll and drag/drop are enhancements; keyboard/button controls and
mobile stacked layout must work without dragging. Layout is presentation only.

Deliver: (1) scoped API + safety tests; (2) readable canvas + navigation/browser
checks; (3) inline settings, connection confirmation and safe preview + tests.
Each PR carries its docs/tests and remains under 400 changed lines.

## Phase two — draft foundation only

Agent → agent handoff with explicit routing rules, transferred context, one clear
conversation owner, a human exit and bounded hops/cycle detection. Do not show
working handoff connectors before a durable, audited runtime exists.
The [draft foundation](agent-handoffs.md) now persists validated configuration;
it does not execute handoffs or expose an activation switch.

Rollback: remove Studio entry points and routes; existing channel setup, agents,
queues and conversations continue to work. No queued messages are replayed.

## Canvas delivery evidence

The initial view is at `/clients/<id>/studio`, linked from client details. It derives
connections from the scoped API, supports selection/zoom/scroll and a keyboard-
accessible mobile card layout. Empty clients and failed loads do not expose a
previous client's graph. This stage is read-only; inline writes follow separately.
Local web lint/webpack build and ES/EN browser smoke at 1440/390/320px passed,
including edges, keyboard selection, zoom, empty/error cases and zero write requests.

## Inline controls delivery

Studio now supports new agents and inline name/description/instructions/widget
settings. Select a channel and choose its agent, or drag its card onto an agent;
confirm the old → new assignment before applying. Drawing a connection never
implicitly enables a channel. Refresh after a conflict or uncertain network error;
there is no automatic retry or optimistic success. Background refresh responses
cannot replace a newer confirmed write.

The test panel uses saved settings; unsaved appearance is a labeled local mock.
Model/provider setup, knowledge/tools and credential enrollment link to the existing
scoped screens. Temporary test history resets on agent/version change or leaving
Studio. These controls do not implement arbitrary tools/documents as canvas nodes,
infinite pan or live agent handoffs. Layout persistence and policy publication are
delivered separately below and in policy-publication.md.

Verification: isolated web lint/webpack build; read-only and edit browser smokes
in ES/EN at 1440/390/320px, including real drag/drop, cancel/confirm, stale-write
conflicts, settings, preview-only requests, creation, keyboard, overflow and errors.
Backend verification: 189 tests passed with a disposable PostgreSQL database.
No real provider send, production deploy or account certification was performed.

## Persistencia visual — API

`GET/PUT /api/studio/{client}/layout` guarda distribución por cliente, separada de
reglas y asignaciones. Solo administrador de la agencia. PUT exige `expected_revision`
y reemplaza el documento: hasta 200 `positions` por ID visible (`agent:<uuid>`,
`widget:<uuid>`, `channel:<kind>`), puntos enteros x 0–4096/y 70–32768 y `zoom` de
75/100/125/150. Omitir posiciones/zoom restaura la distribución por defecto (100%).

CAS y bloqueo NOWAIT del cliente devuelven 409 ante cambios concurrentes. IDs ajenos
se rechazan; posiciones de agentes borrados/movidos se omiten al leer sin mutar las
reglas. El GET del grafo incluye `layout`. No modifica canales, mensajes ni políticas.
Migración 0035 agrega `Client.studio_layout`; downgrade elimina solo esa preferencia.
La interfaz de organizar/mover/guardar se describe a continuación. No se migró producción.

Verificación API de layout: 10 pruebas enfocadas y 277 API completas aprobadas;
migración base → 0035 → base → 0035 aprobada en PostgreSQL desechable. Browser
N/A en esta unidad backend. La interfaz de organización se valida por separado.

## Organización visual — interfaz

En escritorio, **Organizar nodos** separa el movimiento de la conexión de canales.
Arrastrar cualquier tarjeta o usar flechas (10 px; Mayús: 50 px) actualiza sus líneas.
**Guardar distribución** persiste posiciones y zoom; no cambia agentes ni canales.
Ante 409 conserva los cambios locales: **Recargar distribución** pide confirmación
antes de descartarlos. **Restablecer vista** vuelve a columnas/100% localmente;
hay que guardar para aplicarlo a futuras visitas. No hay guardado ni reintento automático.
En móvil se conservan tarjetas apiladas y selección del inspector, sin modo organizar.

Validación: ESLint/build webpack y siete smokes Studio con fixtures ES/EN,
claro/oscuro, escritorio 1440 y móvil 390/320. `studio-layout-smoke.cjs` verifica
arrastre, teclado, líneas, zoom persistente, recarga, conflicto, reset y ausencia de
escrituras de canales; captura oscura inspeccionada. No es aceptación con canal real.
Rollback: revertir layout.tsx, integración de graph/types/CSS y smoke; la API y
preferencias guardadas pueden permanecer, sin tocar reglas o asignaciones.

## Entrada global y selector de cliente

Studio aparece como menú propio. `/studio` abre el último cliente autorizado
recordado para esa agencia/usuario, o el primer cliente activo disponible.
`/studio/<client-id>` y el acceso anterior `/clients/<id>/studio` reutilizan el mismo
workspace; no existe un canvas global mezclando clientes. El menú Clientes no queda
marcado cuando Studio está activo. Operadores conservan acceso únicamente al inbox.

Arriba hay búsqueda y selector nativo accesible, con estados de carga, error/reintento,
sin clientes y sin coincidencias. La selección recordada contiene solo un ID y se
valida contra la lista actual del servidor; nunca concede acceso por localStorage.
Los permisos y el aislamiento del API permanecen sin cambios.

Antes de cambiar mediante el selector se consultan las marcas de estado de los
paneles: cambios de layout/borrador/inspector exigen confirmar descarte; una operación
en curso bloquea el cambio. No se intenta cancelar ni repetir efectos remotos.
El workspace se remonta por cliente y aborta lecturas antiguas. Esta protección es
para el selector; no es un bloqueo global de navegación del navegador/sidebar.

Verificación: ESLint/build webpack, smoke de navegación ES/EN claro/oscuro a
1440/390/320, selección aislada, memoria obsoleta, confirmar/cancelar, guardado en
curso, enlaces anteriores y vacío/error/reintento. Captura móvil oscura inspeccionada.
Rollback: retirar selector/rutas globales/entrada del sidebar y devolver el workspace
al acceso anterior. No hay migración ni modificación de datos del cliente.

## Studio inmersivo — ventana independiente

Los enlaces Studio del menú y del cliente abren un contexto nuevo (`_blank` con
`noopener noreferrer`); el navegador decide si es ventana o pestaña. No usamos
popups automáticos. `/studio/<id>` mantiene autenticación y permisos, pero ocupa
100dvh sin sidebar ni scroll de página. El acceso legado sigue disponible.

El fondo se desplaza arrastrando o con trackpad; las barras del canvas se ocultan,
no sus controles de teclado/zoom. **Vista y distribución** conserva organizar,
guardar, recargar y restablecer. En móvil sigue siendo un mapa, no una página larga.
La cabecera integra cliente/buscador desplegable, tema, idioma y acciones de agente.

Inspector, conexiones/pruebas (incluye publicación/simulación) y ejecuciones abren
paneles dentro del canvas. Se mantienen montados al ocultarse para preservar borradores
y el bloqueo de operaciones. Escape/cerrar devuelve foco a las herramientas. Formularios
largos tienen desplazamiento interno; no se recorta su contenido para fingir que cabe.
Configuraciones avanzadas enlazadas y la activación real de canales no cambian.

Verificar con `studio-immersive-smoke.cjs`: nueva pestaña sin opener, dashboard
original conservado, pan, paneles persistentes, cero escrituras y viewport sin overflow
ES/EN, claro/oscuro a 1440/390/320. Repetir navegación y los siete recorridos previos.
Rollback: quitar shell inmersivo y enlaces nuevos; el workspace legado y datos
persistidos permanecen. No hay migración, despliegue ni activación de transportes.

La regresión de layout espera `^Saved layout` (no substring: también coincidía con
`Unsaved layout`). El smoke inmersivo comprueba además que todos los botones caben
en el viewport móvil; medir solo el ancho del documento no detecta controles recortados.
