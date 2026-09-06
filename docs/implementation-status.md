# Implementation status — 6 September 2026

## Current snapshot (supersedes historical delivery notes below)

The product-quality backlog is **not complete**. At the previous integration
checkpoint, main at `d7f8e6b` included the five delivery batches,
worker healthchecks, dashboard/landing identity, simpler authentication, visible
form fields and links to existing social channel configuration. Historical notes
below about uncommitted work, unmerged PR #2 and separate worker branches describe
earlier checkpoints, not the current integration state.

### Operational follow-up implementation

This section describes the source implementation, not a production deployment.
Verify the running revision and external configuration separately.

| Unit | Implemented | Remaining scope |
| --- | --- | --- |
| Q05 durable QR | Persist-before-ACK admission, dedicated worker, account binding and visible review states; migration 0030; [guide](whatsapp-qr-recovery.md) | Deployment, receipts/session-history reconciliation and real-account validation |
| Q06 full recovery snapshots | Operator-invoked DB/storage/runtime-key restic backups, scoped retention and guarded restore; [guide](full-backup.md) | Remote repository, backup scheduling, enabling/validating freshness alerts and real hosting/database restore drill |
| Q07 service monitor | Missing/stopped/unhealthy Compose detection, opt-in full-backup freshness checks and optional HTTPS alerts; [guide](service-monitor.md) | Configure scheduler/receiver and independently detect host outages; real hosting notification drill |
| Q08 shared quotas | Atomic PostgreSQL public-IP quotas, HMAC keys, bounded cleanup, fail-closed DB errors; migration 0029; [guide](request-limits.md) | Tenant spending caps, provider concurrency limits and trusted-ingress enforcement |

The local monitor detected `proxy:not_running`; other expected services passed,
including the then-required workers (before the QR follow-up). No restart or live alert was attempted. This is a local
environment observation, not a production outage claim.

Verification for Q07/Q08 before the QR follow-up: 11 operations tests passed, including delivery to
a temporary local HTTPS receiver and redirect rejection. The API suite passed
151 tests in 67.93 seconds, including quota-cleanup cases; migration base → 0029 → base
→ 0029 passed in a separate disposable database. No application database was
migrated and no production credentials were used. Those two units did not change frontend files.

QR follow-up verification: 181 API tests, 6 bridge tests and 11 operations tests
passed; web lint/build and QR/Cloud ES/EN browser checks passed. Migration 0030
round-trip passed in a separate disposable database. Source verification is not
a deployment. See the [QR guide](whatsapp-qr-recovery.md) for boundaries.

### UI and repository follow-up

Theme and language controls share a 36px height in both frontend builds; the theme
button retains its 44px width. Responsive theme smoke checks equal heights and
header alignment alongside persistence and keyboard focus.

Main now requires an up-to-date PR and six app-bound checks, including for admins;
force pushes/deletion are disabled. Both frontend locks receive the targeted qs
security fix. See [repository protection](repository-protection.md) for the
solo-maintainer review tradeoff and live verification.

Validation: both frontend lint/webpack builds and npm audits passed (zero reported
vulnerabilities). Theme browser smoke passed on landing, legal, dashboard and both
login routes at 1440/390/320px, including equal height, header alignment, persistence
and keyboard focus. The qs hostile-key regression passed in both frontend installs.
No production deployment or real-account acceptance is implied.

### Backup freshness follow-up

The read-only service monitor can now validate the full-backup completion marker:
deployment binding, snapshot ID, timezone-aware completion, maximum age and future
clock detection. Missing, malformed or stale evidence produces fixed redacted
problem codes through the existing HTTPS receiver. Checks are opt-in; no backup
schedule, service restart, remote repository access or live notification is installed.
See [configuration and limits](service-monitor.md#enable-backup-freshness-monitoring).
Verification: 26 operations tests passed, including six focused backup-monitor
cases and a backup-missing alert delivered to a disposable local HTTPS receiver.
The existing disposable restic backup/restore round trip also passed. This does
not validate the hosting scheduler or a production receiver.

### Client Studio — operational canvas

The approved first phase adds a client-scoped channel → agent map, web widget
appearance preview, inline agent creation/settings, confirmed version-checked
channel assignment and tool-free saved-agent testing. Model calls consume provider
tokens; preview does not execute tools or create/send production conversations.
Credential enrollment and advanced agent setup remain in their existing screens.
[Accepted decisions and verification](decisions/client-studio.md) record the staged
scope. Agent → agent handoffs, persistent layouts and publication/rollback remain
future work, not implied by visual connections.

### Handoff drafts — first phase-two delivery

Client-scoped draft configuration now has revision-checked atomic persistence,
same-client agent validation, cycle/duplicate rejection, bounded hop settings and
mandatory human fallback. [Design and rollout](decisions/agent-handoffs.md).
The ES/EN draft editor and manual saved-rule walkthrough are implemented. One-step AI condition
evaluation is available separately with usage accounting; durable channel-aware execution, saved canvas layouts and
versioned publication remain pending. No saved draft changes a live channel or
conversation owner.

### Remaining development and validation

- QR delivery/session-history reconciliation and real-account validation (Q05); Cloud, social
  and human Inbox/portal attempts already have durable records.
- Guided Meta OAuth, remote revocation, supported media/event handling and real
  account certification (CH01–CH11; manual social configuration already exists).
- Complete storage/key-aware backup automation, off-site encrypted retention and
  hosting restore/rollback drill (Q06).
- Guided activation, versioned agent publication/rollback, evaluated AI/RAG,
  comprehensive accessibility and data-lifecycle tests (Q10, Q12–14, Q16–17).
- Capacity measurements, operating guides and real usage observations (Q18–19).
- Authorized Meta accounts, real SMTP delivery, hosting notifications and buyer interviews/pilots require separate evidence. CI execution
  and merged code must not be confused with these external acceptance criteria.

Preserve the existing commercial offer and avoid building roadmap ideas outside
the approved quality/channel scope. No buyer evidence, paid pilots, seven-day
operating history or account verification is implied by automated tests.

## Historical delivery notes

**Cinco entregas técnicas implementadas; el plan completo NO está terminado.**
Sin despliegue público. Push a rama de trabajo solicitado al finalizar. Conservar el diseño Rivr/Voxy existente.

## Primera entrega

| Área | Entrega | Verificación |
| --- | --- | --- |
| API | `/ready` prueba DB, `/health` liveness; timeout de conexión/pool | Tests healthy/unavailable, respuesta pública sin secretos; API local ready |
| Calidad | Workflow reusable API/migraciones, dos frontends y bridge; publicación de imágenes depende del workflow | Configuración local; ejecución GitHub/protección de rama pendiente |
| Pruebas seguras | Guard de nombre DB `_test`, PostgreSQL exclusivo puerto55432 | Suite completa aislada; datos personales no usados en tests |
| Social | Modelos/routers, tokens cifrados, verificación de cuenta y suscripción, HMAC, entrada durable, estados y worker | Tests con fixtures Meta y PostgreSQL real; no cuenta Meta real |
| Concurrencia | Dedupe DB, advisory lock por cuenta, no bloquear webhooks durante IA lenta, estado uncertain tras envío ambiguo | Replay concurrente, segundo worker, recepción durante generación y simulación de crash |
| Atención humana | Revalidar modo tras IA en widget/playground/WhatsApp y canal social | Regresión WhatsApp y social; no es auditoría de todos los interleavings del bridge QR |
| Aislamiento | Impedir mover/borrar agentes asignados también a Cloud/social; cascada cliente-social coherente | Pruebas cross-agency, asignación y borrado sin warnings |
| UI | Configuración social manual ES/EN, estados/eventos/reintento seguro, filtros Inbox, widget habilitado y enlace a su pestaña | Playwright con fixtures: 1440/390/320; lint/TypeScript |
| Respaldo | Script `backup-db.sh`, permisos privados, checksum, copia local | Archivo restaurado realmente en otra DB; no backup remoto programado |
| Primitivas | Button usa modo no nativo al renderizar enlace, evitando advertencia Base UI | Captura console además de pageerror/hidratación en test navegador |

## Evidencia

- Backend: **130 tests pasan** tras portal (122 en cuarta,108 en tercera,90 en segunda,68 en primera).
- Migraciones: upgrade desde cero → downgrade base → upgrade head, DB desechable.
- Bridge: dos tests pasan y build TypeScript.
- Web y marketing: builds webpack pasan; lint y TypeScript pasan.
- Smoke social: formularios con fixtures, token borrado del campo tras guardar,
  conexión/desconexión, links widget y dimensiones móviles. No certifica Meta real.
- Hidratación: script de regresión de landing/login normal y dir inyectado.
- Respaldo local original restaurado en DB aislada en versión0020; API local nueva
  migrada a0023 en primera entrega;0024/0025 verificadas en DB desechable.
  No se han configurado secretos Meta.

## Qué sigue pendiente — no confundir con bloqueos externos

### Trabajo de desarrollo todavía no completado

1. OAuth guiado, revocación remota, adjuntos/medios soportados y validación completa
   de formatos/eventos/capacidades de Instagram/Messenger (CH01/03/05/06/07/09).
2. Recuperación durable también del pipeline WhatsApp existente y de todos los
   envíos humanos; la cola nueva corresponde a canales sociales (Q05).
3. Onboarding guiado y cambios de agente versionados (Q10/16); correo real,
   auditoría y permisos granulares por cliente aún pendientes (Q11/15).
4. Límites económicos/concurrencia compartidos y métricas operativas/alertas
   integrales (Q07/08/18); `/ready` no reemplaza monitorización externa.
5. Evaluaciones de respuestas, mejoras RAG/fallback basadas en sus resultados,
   accesibilidad integral, retención/exportación/eliminación y soporte (Q12–Q19).
6. Prueba de actualización/migración con datos representativos y políticas de
   rollback; la reversión de0023 elimina datos sociales, no ejecutarla a ciegas.

### Evidencia/acceso externo pendiente

- Cuentas Meta autorizadas, permisos/revisión y prueba desde cuentas externas.
- Backup remoto cifrado, retención, programación y restauración en hosting real;
  incluir archivos de storage y material de recuperación de claves, no solo SQL.
- Protección de rama y ejecución de CI en GitHub, despliegue autorizado en Railway.
- Entrevistas, preparación comercial, pilotos y renovaciones: no se inventan ni
  se sustituyen con tests. Mantener especificación99+25/BYOK y cobro manual vigente.

No se cerraron casillas amplias de los planes solo por entregar una parte de ellas.
Ver [plan general](product-quality-plan.md), [canales](social-channels-plan.md) y
[configuración técnica](social-channels-setup.md).

## Unidades reversibles para revisión

1. CI/readiness/test guard: workflow Quality + dependencia de publicación + endpoint
   y test_health. Independiente del rediseño y del canal social.
2. Social: migración/modelos/router/servicios/worker + UI/canales/Inbox + test_social
   + configuración. Desactivar conexiones/worker preserva datos; downgrade requiere revisión.
3. Handoff y agent ownership: guardas y tests de regresión; no depende del pricing.
4. Backups: script y operación local; archivos privados en `backups/` gitignored.
5. Button/hidratación: cambios puntuales en wrappers/layouts y pruebas browser.

Todos siguen sin commit. No mezclar en una reversión los cambios visuales previos,
ni tocar `.agents/`, `.nodeterm/`, `.specify/` o la validación comercial privada.

## Segunda entrega — recuperación y equipo

Recuperación por SMTP con enlace30min/uso único y revocación de sesiones;
roles admin/operator e invitaciones manuales revocables48h. Operadores solo Inbox
de su agencia, sin configurar agentes/canales/proveedores ni ver trazas de tools.
Revalidación de administrador bajo bloqueo de agencia protege carreras de permisos.

SMTP real aún no configurado: respuesta503 honesta. Las invitaciones funcionan
compartiendo el enlace privado, sin envío automático ni verificación de email.
Q15 completado en su alcance admin/operator con invitación manual; Q11 pendiente
de correo real. No equivalen a auditoría/2FA/permisos granulares completados.
Ver [configuración, límites y rollback](auth-team-setup.md).

Verificación segunda entrega:90 tests API, incluyendo carreras de reset/aceptación/
degradación concurrente; upgrade→downgrade→upgrade hasta0025 en DB desechable;
web lint/TypeScript/build webpack pasan; navegador con fixtures en1440/390/320
(recuperación con/sin configuración, formulario, invitación/revocación y operador).

Preview local actualizado a0025; API healthy y worker social reiniciado.
Backup previo: backups/voysse-20260905T061745Z-dLK3rr.dump (privado, checksum e
índice validados; esta copia nueva no fue restaurada). La prueba de restauración
real de la primera entrega sigue registrada arriba. SMTP permanece desconfigurado.

## Tercera entrega — trazabilidad de envíos humanos

Inbox persiste intentos antes de enviar; idempotencia con UUID, estados de fallo
local/confirmación/incertidumbre, sin reenvío automático tras timeout o reinicio.
El texto no confirmado no se mezcla con mensajes enviados ni contexto IA.
Cloud rechaza texto demasiado largo en vez de truncarlo. Validación de destino,
modo y ventana; bloqueo NOWAIT para no congelar el event loop.

Ver [guía y límites](human-delivery.md). **Q05 sigue abierto:** recepción/IA de
WhatsApp y envíos del portal todavía no pasan por este registro. OAuth/medios
Meta y cuentas externas siguen pendientes, sin mensajes reales enviados.

Tercera entrega: migración0026 probada desde DB vacía y downgrade0026→0025→0026;
web lint/TypeScript/build webpack pasan y smoke de respuesta perdida con fixtures
pasa en1440/390/320. Captura móvil inspeccionada.

Suite final:108 tests API pasan después de mover el endpoint humano al pool de
threads. Backup previo a0026: backups/voysse-20260905T154541Z-JB7ZRU.dump, índice
y checksum validados; esta copia nueva no se restauró. Sin deploy público.

## Cuarta entrega — recepción durable de WhatsApp oficial

Webhook Cloud ahora solo admite eventos en PostgreSQL; worker separado procesa
IA/medios/envío. Dedupe por canal/id, recuperación de queued/ready, estados para
caídas de preparación/envío sin repetir herramientas ni envíos inciertos. Fecha
externa separada del orden local, validación de destino y lista de actividad con
link a Inbox. Worker obligatorio en Compose, sin profile.

Ver [operación y límites](whatsapp-cloud-recovery.md). QR, portal, receipts, OAuth
Meta y prueba con cuenta real siguen pendientes. No marcar Q05 completo.

Verificación cuarta entrega:122 tests API pasan; migración0027 desde base vacía
y downgrade0026→upgrade0027; web lint/TypeScript/build webpack y smoke Cloud
en1440/390/320 pasan. Incluye enlace directo a conversación, firma/destino, error
de almacenamiento sinACK, crash preparando/ready/sending y otro worker excluido.

Preview local actualizado a0027: API healthy y `/ready` correcto; workers Cloud
y social activos. Base de pruebas detenida, base original conservada.
Backup previo: `backups/voysse-20260905T161115Z-Zqbmr8.dump`, privado, índice y
checksum validados; esta copia no fue restaurada. Sin deploy público ni prueba
con cuenta real de Meta.

## Quinta entrega — envíos durables del portal

El portal comparte el registro de intentos del Inbox: actor cliente separado,
clave estable por envío, sin reintentos ciegos ni mensajes ficticios ante timeout.
Actividad visible, consulta tras respuesta perdida, límites de canal y control
humano. Bloquea clientes/agencias inactivos y oculta tool_calls internos.

Ver [alcance y reversión](human-delivery.md#portal-del-cliente--entrega-0028).
Q05 sigue parcial: QR entrante, receipts/reconciliación y validación real pendientes.

Verificación quinta entrega:130 tests API pasan,0028 upgrade/downgrade0027/upgrade
probado en DB aislada; web lint/TypeScript y smoke portal con fixtures pasan.

Builds webpack de web y marketing pasan; bridge2 tests y build TypeScript pasan.

Preview local actualizado a0028: API healthy y `/ready` correcto; workers social
 y Cloud arrancados. Base de pruebas detenida, base original conservada.
Backup previo `backups/voysse-20260905T170015Z-ii3Rn4.dump`, privado, índice y
checksum validados; esta copia no se restauró. Sin cuenta Meta real ni SMTP real.
La entrega acumulada se prepara en `feat/product-quality-channels`; main publica
imágenes automáticamente, por eso no se actualiza main en este paso.

## Seguimiento separado — salud de workers (Q07 parcial)

PR #2 hacia main contiene las cinco entregas anteriores y tiene CI verde; no
fusionado. El seguimiento en feat/worker-healthchecks añade healthchecks locales
para workers social/Cloud, sin cambios de migraciones ni a los estados de envío.
Un loop sin progreso caduca; reiniciar borra la señal anterior. Ver worker-health.md.
Las alertas externas siguen pendientes y Docker unhealthy no implica auto-reinicio.

Seguimiento validado:143 tests API (13 nuevos), Compose config correcto y simulación
Docker healthy→unhealthy en contenedor desechable. Sin nuevas migraciones.
Ambos workers locales quedaron healthy tras su primera iteración; API original
healthy, DB de pruebas detenida. La sonda puede fallar justo al arrancar hasta
el primer progreso, cubierto por start_period; no indica un fallo de migración.
