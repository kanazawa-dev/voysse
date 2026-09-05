# Completar Instagram, Messenger, WhatsApp y chat web

Prioridad solicitada por Alex el 4 de septiembre de 2026. **Plan y criterios de
aceptación; implementación parcial enlazada abajo.** Complementa `product-quality-plan.md`.

**Actualización 5 de septiembre:** existe una primera implementación manual de
texto y cola durable, probada con fixtures. Ver [configuración y límites](social-channels-setup.md)
y [estado de ejecución](implementation-status.md). Las casillas siguen abiertas
hasta cumplir también OAuth, cuentas reales y permisos indicados en cada entrega.

## Alcance y estado comprobado

- **Instagram DM y Facebook Messenger:** hoy tarjetas deshabilitadas en
  `apps/web/app/channels/page.tsx`; no se encontraron routers/modelos para ellos.
- **WhatsApp oficial y QR:** ya implementados; endurecer recuperación, estados y
  configuración. QR no equivale a API oficial y conserva sus restricciones propias.
- **Web chat:** widget implementado, pero aparece incorrectamente como futuro en
  la pantalla Canales. Hay que conectar esa entrada al flujo real de publicación.
- Incluye mensajería entrante, respuesta IA y humana, historial y conexión por
  cliente. Texto y adjuntos soportados por cada API; lo no soportado debe indicarse.
- No incluye publicaciones de feed, campañas masivas, scraping, llamadas, Telegram,
  SMS ni comentar automáticamente en publicaciones. No confundir DM con una suite
  de gestión de redes sociales. Comentarios/reacciones/historias requieren alcance
  separado si el cliente los necesita; no anunciar «todo Instagram».

## Tareas ordenadas

Responsable técnico: desarrollo. Alex gestiona propiedad/acceso a cuentas y trámites;
Meta determina permisos y revisión. Días estimados de trabajo enfocado, no de espera.

- [ ] **CH01 — Validar cuentas y camino de acceso (1–2 d).** Inventariar app Meta,
  cuenta Instagram profesional y Página de Facebook de prueba autorizadas. Decidir
  app gestionada por Voysse para Cloud vs credenciales propias en self-host; verificar
  requisitos concretos antes de elegir Instagram Login o Facebook Login. **Salida:**
  matriz de permisos/versiones y prueba autenticada mínima, secretos fuera de git/chat.
- [ ] **CH02 — Diseñar conexiones aisladas y migración (1–2 d; CH01).** Vínculo
  agencia → cliente → cuenta externa → agente, identificadores scoped, estado y
  credenciales cifradas; contratos normalizados compatibles con WhatsApp/widget.
  **Aceptación:** una cuenta no se asigna accidentalmente a clientes distintos,
  migración reversible, ninguna conversación previa cambia de propietario.
- [ ] **CH03 — Conectar y reconectar cuentas (2–3 d; CH02).** Autorización con
  state ligado a sesión/cliente, mínimos permisos, selección de cuenta/Página,
  expiración, renovación según API y desconexión. **Aceptación:** token revocado
  aparece como desconectado y reconectar no pierde historial; sin tokens en frontend/logs.
- [ ] **CH04 — Recepción segura y durable (2–3 d; CH02,Q05).** Webhooks verificados,
  persistencia antes de acuse, procesamiento fuera de petición, dedupe, mensajes
  propios/echo, orden y rutas separadas por cuenta. **Aceptación:** replay y dos
  eventos concurrentes no duplican la conversación/respuesta; reinicio recupera trabajo.
- [ ] **CH05 — Instagram DM de extremo a extremo (3–4 d; CH03,CH04).** Texto y
  adjuntos inicialmente soportados, contexto del agente, respuesta y registro en
  Inbox/portal. **Aceptación:** una persona envía DM real a la cuenta de prueba y
  recibe respuesta; contenido no soportado produce estado claro, no silencio.
- [ ] **CH06 — Facebook Messenger de extremo a extremo (2–3 d; CH05).** Adaptar
  formatos y envío a Página, reutilizando pipeline. **Aceptación:** recorrido real
  equivalente sin mezclar IDs de Instagram, Messenger ni clientes; sin bucles de echo.
- [ ] **CH07 — Handoff y límites de mensajería (2–3 d; CH05,CH06).** Control humano
  por conversación y validación server-side de ventana/tipo de envío y permisos.
  **Aceptación:** no respuesta IA tras takeover; fuera de ventana se bloquea el envío
  no permitido y se explica. Nunca usar excepciones de atención humana para bots.
- [ ] **CH08 — Pantalla Canales útil (2–3 d; CH03,CH05,CH06).** Estado real,
  cuenta asociada, agente, última actividad, error y acción para resolverlo; filtros
  Inbox/portal por canal. Habilitar acceso al widget existente. **Aceptación:** flujo
  completo en ES/EN y móvil; «conectado» exige verificación, no solo guardar formulario.
- [ ] **CH09 — Recuperación, aislamiento y regresión (2–3 d; CH07,CH08).** Probar
  firma incorrecta, token vencido, límites API, timeout, duplicados, envío ambiguo,
  otra agencia, handoff concurrente y regresión WhatsApp/web. **Aceptación:** matriz
  automatizada verde más evidencia real por canal; no sumar UI sobre mocks y darlo por terminado.
- [ ] **CH10 — Preparar acceso de clientes externos (1–2 d activos; CH01,CH05–CH09).**
  Revisar en dashboard Meta permisos/revisión aplicables, grabar recorridos, facilitar
  cuenta de revisión segura, URLs de privacidad y eliminación implementadas y atender
  observaciones. **Aceptación:** permiso aplicable concedido y prueba con cuenta
  externa autorizada; no basta que funcione para administradores/testers de la app.
- [ ] **CH11 — Validar operación y publicar documentación (1–2 d; CH09,CH10).**
  Piloto instrumentado al menos siete días, guías de conexión/desconexión, límites
  y soporte. **Aceptación:** incidencias críticas cerradas, trazabilidad de cada
  mensaje y funciones anunciadas coinciden con lo verificado.

CH01 y preparación de documentación Meta comienzan de inmediato. CH10 solo se
cierra con requisitos/aprobaciones efectivas. Un bloqueo Meta no justifica simular
disponibilidad: se puede continuar en cuentas de prueba permitidas y avanzar Q10–Q19.

## Cuándo considerar un canal terminado

Conectar → recibir → responder IA → tomar control humano → reconectar → revisar
errores, todo con la cuenta real y separación entre clientes; además, permisos
necesarios para el público al que se ofrece. Los estados serán distintos:
**implementado**, **probado con cuenta de desarrollo**, **habilitado para clientes**.

## Calendario propuesto

Con Q05/base de seguridad lista y cuentas disponibles:

| Entrega acumulada | Estimación técnica |
| --- | --- |
| Base común + Instagram funcional en prueba | 2–3 semanas |
| Instagram + Messenger en Inbox con atención humana | 4–5 semanas |
| Ambos endurecidos, documentados y listos para evaluación externa | 5–7 semanas |

La estimación total de tareas es 19–30 días enfocados, con solapamiento de ensayos
del plan general. Acceso de cuentas externas/revisión Meta es un plazo separado,
**sin fecha garantizada**. Con resto de calidad, reservar 16–22 semanas para una
persona; reevaluar después del primer webhook y envío reales.

## Fuentes consultadas y límites

La documentación directa de developers.facebook.com respondió 429 durante la
revisión. Se consultaron las colecciones oficiales de Meta en Postman:

- [Instagram Conversations API](https://www.postman.com/meta/instagram/folder/23987686-6a91368f-1fa8-4614-9ed6-7d1e08c21e62): distingue acceso estándar y avanzado para cuentas profesionales externas.
- [Messenger Send API](https://www.postman.com/meta/messenger-platform-api/folder/vilwbh4/send-api): token de Página, permiso de mensajería y ventana de respuesta.

No congelar aquí una lista universal de scopes ni versión Graph: verificar en CH01
contra el flujo elegido y el dashboard real. Estas fuentes no garantizan aprobación
de la app ni sostienen los plazos de desarrollo, que son estimaciones propias.
