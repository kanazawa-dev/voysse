# Probar Instagram y Messenger: integración inicial

**Estado: implementada y probada con fixtures; pendiente de verificación real en
Meta. No anunciar disponibilidad general.** Esta versión configura credenciales
manualmente: no es todavía el onboarding OAuth de un clic.

## Requisitos

- Migración `0023_social_channels`, API actualizada y worker social activo.
- Una app Meta por instalación con los productos/permisos adecuados; cuentas
  profesionales/de Página autorizadas para las pruebas. No usar contraseñas personales.
- Para Instagram, esta implementación usa Instagram Login y su token; Messenger
  usa token de Página. No mezclar tokens/endpoints de Instagram con Facebook Login.
- HTTPS público para recibir webhooks. `localhost` no es un callback accesible a Meta.

## Configuración del operador

Establecer en el entorno **del servidor** (no en variables `NEXT_PUBLIC_*`):

```dotenv
META_SOCIAL_APP_SECRET=<secreto de la app Meta>
META_SOCIAL_VERIFY_TOKEN=<valor aleatorio largo para verificar el webhook>
META_INSTAGRAM_GRAPH_BASE_URL=https://graph.instagram.com/v23.0
```

Messenger reutiliza `META_GRAPH_BASE_URL`, también usado por WhatsApp Cloud. Las
raíces se pueden configurar por el operador; no son URLs proporcionadas por visitantes.
Verificar versión/scopes vigentes con la app real antes de producción.

Callbacks de la instalación:

- `https://<dominio-api>/api/public/social/instagram/webhook`
- `https://<dominio-api>/api/public/social/messenger/webhook`

Configurar el campo `messages` para la plataforma correspondiente. Compartir
verify token solo con el operador/Meta, no con cada cliente. Se verifica la firma
HMAC sobre los bytes originales, antes de procesar JSON. El callback identifica
la cuenta receptora y la conexión que le pertenece.

Con Docker, después de respaldar y revisar migraciones:

```sh
docker compose --env-file .env.docker --profile social up -d --build api social-worker
```

Fuera de Docker, ejecutar `alembic upgrade head` y un proceso independiente:

```sh
python -m app.scripts.social_worker
```

El worker no expone puertos. Necesita la misma DB y `ENCRYPTION_KEY` que la API.
En Railway debe configurarse un servicio/proceso separado; no se desplegó allí.

## Conectar un cliente

1. Canales → seleccionar cliente → Instagram o Messenger.
2. Seleccionar agente; guardar ID de cuenta/Página y token en el campo protegido.
3. «Verificar y conectar» verifica `/me`, compara ID y solicita suscripción de
   webhook. Guardar por sí solo NO equivale a conectar.
4. Enviar un mensaje de prueba autorizado. El estado pasa de «esperando primer
   mensaje» a «Webhook activo» al recibir eventos firmados de la cuenta.
5. Consultar procesamiento e Inbox. Probar respuesta y control humano en ambos lados.

Las credenciales permanecen cifradas en DB. Una cuenta externa no puede vincularse
a dos clientes de esta instalación. Cambiar identidad de una conexión existente
se rechaza para no reasignar historial. Token vacío conserva el guardado. Desconectar
detiene el procesamiento local; **no revoca el token ni elimina la autorización en
Meta**. La revocación remota se gestiona en Meta; su automatización queda pendiente.

## Qué está soportado y qué falta

- Texto entrante/saliente, conocimiento del agente, Inbox/portal y respuesta humana.
- Respuesta estándar dentro de 24 horas desde la última entrada del cliente;
  nunca usar extensiones de atención humana para enviar respuestas de IA.
- Máximo 1000 caracteres de respuesta en esta primera versión. Si la IA genera
  más, el evento falla de forma visible; no se corta silenciosamente ni se envían fragmentos.
- Adjuntos no interpretados: se registra un aviso y se deriva a modo humano.
  No se descargan URLs arbitrarias ni se presenta visión/transcripción como disponible.
- Herramientas HTTP/MCP NO se ejecutan automáticamente en estos canales todavía:
  sus efectos necesitan un contrato de idempotencia antes de reintentar generación.
- No incluye comentarios, campañas, publicaciones, llamadas, sincronización completa
  del historial anterior, read receipts ni identidad unificada entre plataformas.
- Token válido y webhook activo NO demuestran aprobación para clientes externos.

## Fallos y recuperación

Los eventos se guardan antes del acuse. Si falla DB, el webhook no responde éxito.
La restricción única `(channel_id, external_id)` evita duplicar entradas. El worker
serializa por cuenta con un advisory lock transaccional PostgreSQL; no bloquea
la recepción de webhooks mientras espera a la IA.

| Estado | Acción |
| --- | --- |
| queued / ready | Esperar; confirmar worker activo si no avanza |
| failed | Corregir configuración; reintentar preparación hasta tres intentos, o responder desde Inbox |
| sending | Envío en curso; no reenviar |
| uncertain | Revisar conversación en Meta antes de responder. Nunca reintento automático |
| ignored | Atención humana, canal inactivo u otra condición que impide IA |
| sent | Meta devolvió ID y quedó registrado; no es confirmación de lectura |

Un crash durante generación vuelve a dejar disponible el evento por rollback. Un
crash después de iniciar envío puede haber entregado el mensaje: tras dos minutos
el worker lo marca uncertain, nunca lo reenvía a ciegas. No existe promesa exactly-once
frente a un servicio externo. La respuesta humana usa envío síncrono y tampoco tiene
reintentos automáticos; ante error ambiguo debe verificarse externamente.

## Verificación y rollback

Tests API: `tests/test_social.py`, `tests/test_health.py`, regresión takeover en
`tests/test_whatsapp_cloud.py`; usar DB aislada cuyo nombre termine en `_test`.
UI: `scripts/ui/social-channels-smoke.cjs` con Playwright vía `PLAYWRIGHT_MODULE`.
Fixtures no prueban permisos, formatos de eventos de una cuenta real ni App Review.

Rollback operativo: desconectar canales y detener worker; mantener tablas/historial.
No hacer downgrade en una DB con conversaciones nuevas salvo exportación y aprobación:
`0023` elimina tablas sociales al revertirse. UI/enlaces sociales se revierten juntos
con routers/servicios/modelos si se retira la implementación; cambios Rivr son independientes.
