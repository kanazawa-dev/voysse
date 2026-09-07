# Single-responder execution foundation

**Dormant backend protocol, not activated handoffs.** Migration 0032 adds durable
ownership and turn records. No router, widget or worker calls this service yet;
existing message behavior is unchanged. Draft saving and simulation never call it.

## Identity and context

`Conversation.agent_id` remains the entry/channel agent. `ConversationRuntime`
stores a separate current responder, monotonic revision and active turn. Messages
stay in the original conversation; a turn pins an existing user-message ID without
copying private history. Deleting a responder leaves it unavailable, never silently
switching back to the entry agent. Conversation deletion cascades to these records.

## Internal transaction contract

1. A trusted transport adapter must authenticate/revalidate access, admit/dedupe the
   incoming message, and obtain an explicitly activated policy. This service does
   **not** publish policies or decide whether a routing rule is authorized.
2. `claim` locks the conversation, validates agency/client/responder and context,
   and returns `(turn, created)`. **Commit before any external work.** Only a new
   claim may run providers/tools. Replayed keys return `created=false`, including
   completed/uncertain turns; another key cannot reclaim the same context message.
3. `transfer` requires the active turn and expected revision. It validates same-
   client agents, configuration version, cycles and hop bound; a UUID-keyed journal
   makes repeated transitions no-ops. Human fallback remains possible at the hop
   limit and stops the turn, without changing entry identity or sending messages.
4. `settle` checks ownership/version and human takeover. Only `true` authorizes a
   successful local completion: the adapter must append the reply **in this same
   transaction**, then commit. External sends still require the transport's durable
   outbox and immediate permission/ownership revalidation; this is not exactly-once
   external delivery and does not fence a provider/tool call by itself.
5. Failed/ambiguous work becomes `uncertain` and retains the active claim. There is
   no automatic expiry, retry, lease stealing or release. Recovery needs an explicit
   audited workflow; do not clear a claim just because its process disappeared.

Callers own transactions and must roll back errors. Conversation and responder locks use NOWAIT
(409 on contention), never waiting behind external work. Claims serialize only adapters
that use this protocol; existing workers do not yet participate. Agent tools may
already have side effects when interrupted, so never replay them blindly.

## Deployment and remaining work

Back up before migration 0032. Its empty tables do not activate anything. Downgrade
removes ownership/journal data: export first, and never downgrade once adapters use
it without stopping those adapters and reconciling in-flight work.
Next: audited uncertain-turn recovery, activated/versioned policy snapshots,
transport adapters and UI, then production acceptance. Canvas layout persistence
and versioned publication also remain pending. No production migration was run.

Verification: 13 focused protocol tests and the full 232-test API suite passed on
isolated PostgreSQL, including concurrent claims and responder-lock contention.
Migration base → 0032 → base → 0032 passed on that disposable database. No UI or
network behavior changed; live transport acceptance is still pending.

## Administrative review (no activation)

Agency administrators can inspect `GET /studio/{client_id}/execution` (25 rows by
default, maximum 50, offset capped at 10000). Results expose turn status, timestamps,
transition journal and **current** runtime ownership/revision, not messages, provider
credentials or tool results. Pagination is a live view, not a historical snapshot.
`runtime_enabled: false` remains explicit: current transports still ignore this ledger.

To quarantine a stranded `running` or `uncertain` turn, use
`POST /studio/{client_id}/execution/{conversation_id}/{turn_id}/review-human` with
`request_id` UUID, `expected_revision`, a nonblank `reason` (maximum 500 characters),
and `acknowledge_external_effects: true`. Verify provider/channel logs first.

- Under the conversation NOWAIT lock, validate client/agency, administrator session,
  active turn and revision. Stale/closed owners return 409; scope mismatches return 404.
- Record actor, reason, timestamp, previous status and request identity in the journal.
  Set `reviewed_human`, increment revision, clear responder/active claim and set human mode.
- Identical request replay returns the original audit entry with `applied: false`;
  changed input or a second review key returns 409. Entry agent/messages stay untouched.
- This only fences future commits by **adapted** producers. It cannot cancel a provider
  call, tool or delivery already in flight; it neither retries nor compensates effects.
  There is no automatic expiry or AI resume. Existing legacy mode routes/workers do
  not consume this protocol yet; do not treat this endpoint as their cancellation API.

Verification: 26 focused tests passed (13 new); full suite 244 passed before the final
pagination/lock test, then focused suite passed again. Tests cover running/uncertain
review, replay/conflict/concurrency,
late completion rejection, unchanged history, authorization/scope and bounded listing
on disposable PostgreSQL. Browser N/A: this unit adds no UI. Rollback: remove the
`studio_execution` router registration/module and its tests; retain the audit rows and
0032 schema. Producer adoption remains pending. The ES/EN Studio review panel now
provides explicit loading, paginated audit and acknowledged/confirmed human review.
Errors discard stale actions and require fresh inspection, never automatic retries.
See [current checkpoint and remaining work](../studio-progress.md).

## Política fijada por turno (0034, todavía interno)

`claim_published` elige la publicación actual del cliente únicamente para un turno
nuevo. Bloquea cliente con NOWAIT, revalida referencias y persiste `policy_revision_id`
y el máximo de saltos junto al claim. Publicar/restaurar después no altera ese turno.
Retirar la publicación impide nuevos claims publicados; no cancela uno ya iniciado.
Un replay conserva el pin original y nunca habilita repetir trabajo externo.

Las transferencias a agentes deben pertenecer al grafo fijado, además de respetar
responsable/revisión/ciclos/límite. Política perdida, de otro cliente o con referencias
inválidas falla cerrada; la salida humana sigue disponible. El UUID histórico no usa
`SET NULL`: borrar la versión no debe convertir el turno en uno sin restricciones.
Las versiones son inmutables por API, no a prueba de modificaciones manuales en DB.
La inspección administrativa expone el UUID de política, sin nuevas cargas sensibles.

Los turnos antiguos conservan pin nulo: no se migran ni se convierten implícitamente.
`claim` sin política mantiene el protocolo anterior solo para compatibilidad interna;
un adaptador de derivaciones deberá usar `claim_published`, no ese camino legado.
Los productores actuales aún no llaman ninguno: esto NO activa canales ni clasifica
condiciones. Falta conectar el runner, la entrega durable y la revalidación antes de I/O.

Rollback: exportar pins antes de downgrade 0034 → 0033; retirar el campo y helpers.
No hacerlo mientras existan adaptadores dependientes o turnos que deban conservar
su política. Pruebas: pin estable, retiro/restauración, replay, grafo/límites, bloqueo
del cliente, versión ausente/ajena, agentes inactivos y salida humana segura.

Verificación 0034: 8 casos nuevos/21 enfocados y 267 pruebas API completas aprobadas;
base → 0034 → base → 0034 pasó en PostgreSQL desechable. Sin cambios de UI (browser
N/A) ni uso de proveedores. La adopción en transportes sigue pendiente.

## Runner interno de cadena — sin transportes

`execution_runner.run` une claim publicado, clasificación acotada, transferencias y
respuesta final guardada en una transacción con `settle`. **No envía al canal**.
Solo un claim nuevo ejecuta el callback; duplicados devuelven estado sin repetir I/O.
Cada agente usa su configuración y contexto compartido hasta el mensaje reclamado:
como máximo 100 mensajes (según su memoria), 64k caracteres de historial y 64k de
instrucciones. No incluye mensajes posteriores; no trunca silenciosamente un exceso.
El prompt fija su fecha al mensaje ancla para no invalidar resultados al cambiar de minuto.

El callback interno `provider(Input, phase)` devuelve `Completion`: `classify` usa
índices globales del snapshot, `respond` solo se permite sin reglas salientes.
No-match, JSON inválido, índice ajeno o límite de saltos terminan en humano.
El límite no hace una llamada extra. Se vuelve a comprobar responsable, revisión,
política, actividad, configuración y contexto antes/después de I/O. Ninguna sesión
ni bloqueo DB se mantiene durante el callback; tokens se contabilizan antes de
rechazar resultados obsoletos. El mensaje final y cierre se confirman juntos.

Errores/cancelaciones intentan marcar incierto. Si la DB no permite hacerlo, queda
el claim en curso bloqueado: nunca liberar por plazo, reintentar ni continuar desde
un claim existente. Tomar control humano invalida resultados pero no cancela I/O.

**Límite de esta entrega:** callback inyectado y probado con proveedores falsos;
ningún endpoint/worker lo invoca. El callback debe ser estrictamente sin tools/envíos;
rechazar `tool_calls` no puede deshacer efectos externos de un callback incorrecto.
Faltan adaptador real de credenciales/permisos, RAG, límites de gasto, outbox durable,
adopción de todos los productores y reanudación humana auditada antes de activar.
Los cambios coordinados de configuración/credenciales requieren cercado en esos adaptadores.
Rollback: retirar runner/tests; el parámetro opcional `at` del prompt es compatible
con llamadas anteriores. Sin migración nueva ni borrado de turnos/auditoría.

Harness: `TEST_DATABASE_URL=<disposable_postgresql_test> pytest -q tests/test_execution_runner.py`.
Cubre cadena, replay durante I/O, cancelación, respuesta tardía, uso contabilizado,
rollback de respuesta/transferencia, política retirada durante el turno y límite sin
llamada extra. Browser N/A: no interfaz/endpoint/worker cambió en esta entrega.

## Legacy mode control fence

Inbox and client-portal mode changes now take the same conversation NOWAIT lock
as execution claims/settlement. Human takeover leaves the turn, responder and
journal intact for administrative review. It fences late local commits, not I/O
already started. Once a conversation has a runtime row, legacy `mode=ai` returns
409 even after completion/review: resumption needs a dedicated audited workflow.
This prevents a human → AI toggle from making an old in-flight result valid again.
Conversations without runtime state retain ordinary mode switching.

This is a prerequisite, **not producer activation**. Messages/media/widget/workers
still need protocol adoption, and real-provider/outbox integration remains pending.
Rollback: remove `conversation_control.py` and its route calls/tests together;
no schema or execution history is removed. Do not roll back after adopting live
producers without stopping and reconciling them first.

Harness: `pytest -q tests/test_conversation_control.py tests/test_execution_runner.py`
on disposable PostgreSQL covers running/uncertain/completed state, portal scope,
legacy compatibility, lock contention and real runner takeover during fake I/O.
Browser N/A: response contracts/UI are unchanged; HTTP integration tests exercise
both mode routes. No provider credentials or external sends are used in this unit.
