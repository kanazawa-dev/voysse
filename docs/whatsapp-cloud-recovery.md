# WhatsApp Cloud: recepción persistida y revisión segura

El webhook guarda eventos antes de responder. IA, descarga de medios y envío
ocurren en un worker separado. Solo cambia WhatsApp oficial: el bridge QR mantiene
su protocolo actual y aún necesita su propia entrega durable.

## Arranque obligatorio

Tras aplicar migración0027, arrancar `whatsapp-cloud-worker` junto con la API.
Docker Compose lo incluye sin profile; **no actualizar solo la API en producción**.
Fuera de Compose, ejecutar otro proceso con el mismo DB/entorno/claves:

```sh
python -m app.scripts.whatsapp_cloud_worker
```

El worker necesita dos conexiones DB durante procesamiento: trabajo y advisory
lock dedicado. No requiere Redis. `/ready` comprueba DB, no heartbeat del worker;
monitorización/alerta de cola atascada sigue pendiente. Si está detenido, los
mensajes quedan en cola y se ven en Canales → WhatsApp oficial → Actividad.

## Estados y recuperación

| Estado | Significado / acción |
| --- | --- |
| queued | Persistido, esperando worker; se recupera al arrancar |
| preparing | Preparación/IA/herramientas en curso |
| ready | Respuesta ya persistida; continuar sin repetir IA |
| sending | Se inició envío; esperar confirmación |
| sent | API confirmó un ID; no equivale a leído/entregado al dispositivo |
| needs_review | Fallo, contenido no soportado, ventana cerrada o preparación interrumpida |
| uncertain | Pudo enviarse; comprobar canal antes de responder otra vez |
| ignored | Control humano, destino inactivo o duplicado heredado; sin autorespuesta |

Un lock PostgreSQL por canal impide otro worker activo en ese canal y no bloquea
la admisión del webhook durante una llamada lenta. Al adquirir el lock libre,
`preparing` abandonado pasa a revisión y `sending` a incierto. No se usan tiempos
arbitrarios para robar trabajo activo. El lock vive en una conexión dedicada,
no en la sesión que hace commits. `ready` tiene prioridad antes de otro evento.

**Herramientas pueden producir efectos externos.** Por eso no se reejecuta
preparación interrumpida automáticamente. Revisar sus efectos y responder desde
Inbox. Si hay conversación asociada, los fallos de preparación/envío incierto
la ponen en modo humano. No hay botón de reenvío ciego ni reconciliación automática.
Un fallo antes de crear conversación queda igualmente visible en Actividad.

## Integridad y compatibilidad

- Firma HMAC sobre bytes y límite1MiB antes de JSON. Solo destino phone_number_id
  configurado. DedupeDB por canal+external_id. Fallo de almacenamiento no recibe200.
- Eventos no elegibles/malformados se omiten; canales/clientes/agencias inactivos
  no generan trabajo. Esto no implica conservar todo payload arbitrario.
- Conserva remitente/texto/mediaID y referencia de cuenta/agente, no secretos.
  Cambiar cuenta/agente con trabajo pendiente lo manda a revisión.
- Proveedor timestamp y llegada local son distintos. `external_received_at`
  controla ventana, `created_at` orden local. Fecha externa ausente/inválida se
  considera fuera de ventana, nunca la abre artificialmente. Legacy usa fecha local.
- No se guarda respuesta IA como Message antes de confirmar envío. Sources y
  trazas se conservan para el Message confirmado; no se exponen en Actividad.
- Texto/image/audio mantienen capacidades previas. Archivo inaccesible y tipos
  no soportados quedan para humanos, no desaparecen silenciosamente.
- Listado50eventos exclusivo administradores; link abre conversación concreta.
  Operadores atienden la conversación marcada como humana desde Inbox.

No incluye callbacks de entrega/lectura, nuevos medios, QR, portal, OAuth ni
validación con cuentas reales. La admisión es durable, **no una garantía de
exactly-once externo**. Q05 sigue abierto para el resto del alcance.

## Verificación y rollback

Tests: test_cloud_events.py y test_whatsapp_cloud.py. Helper de tests admite y
luego ejecuta explícitamente el worker; los casos de admisión no lo ejecutan.
Pruebas separan red simulada de PostgreSQL real. Smoke UI:
scripts/ui/cloud-events-smoke.cjs. No se enviaron mensajes reales.

Backup antes de0027. Para revertir, detener admisión/worker, revisar y archivar
cola (especialmente preparing/sending), y revertir código junto con esquema0027.
Downgrade borra eventos y fechas externas: no hacerlo con pendientes. No revertir
0026 de envíos humanos ni0024/0025 de permisos. Preferir arreglar hacia adelante.
Unidad revisable: modelo/schema0027, webhook/worker/configCompose, adaptación de
process_inbound, estadoUI/deep-link y sus pruebas/documentación.
