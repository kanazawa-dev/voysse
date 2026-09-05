# Envíos humanos: saber qué ocurrió antes de repetir

El Inbox guarda un intento antes de llamar a WhatsApp/Instagram/Messenger.
Un timeout no significa que el mensaje no llegó. El sistema no reenvía
automáticamente un intento cuyo resultado sea desconocido.

## Interpretar el estado

| Estado API | Qué significa | Qué hacer |
| --- | --- | --- |
| sending | Llamada iniciada; todavía no confirmada | Esperar y consultar la conversación |
| confirmed | El canal devolvió un identificador | No repetir; no equivale a leído/entregado al dispositivo |
| published | Publicado localmente en widget/playground | Disponible en el historial local |
| failed | Validación local impidió llamar al canal | Corregir conexión, modo o longitud y enviar un nuevo intento |
| uncertain | Puede haber salido, pero falta confirmación | Verificar en el canal antes de repetir manualmente |

Un sending de más de dos minutos se presenta como uncertain aunque la fila
conserve sending: una caída del proceso nunca dispara reenvío automático.
Una respuesta tardía aún puede completar ese intento. No prometer exactly-once
en sistemas externos sin soporte de idempotencia del proveedor.

## Protección frente a duplicados

Una respuesta HTTP200 indica que se registró/consultó el intento, no que llegó al
destinatario: revisar deliveries[].status.

El frontend manda request_id (UUID) junto con content y conserva ambos si pierde
la respuesta. «Consultar intento» repite la misma solicitud; el backend devuelve
el registro existente, nunca vuelve a enviarlo. No reutilizar un ID con otro texto,
otra conversación u otro operador. Para clientes API antiguos sin request_id se
genera uno, pero **no tienen deduplicación entre solicitudes independientes**.

La reserva persiste antes de la red. Fallos de validación y envíos inciertos no se
insertan como Message, para no fingir envío ni contaminar contexto de IA. La UI
muestra los últimos50 intentos; registros anteriores siguen en DB. No sustituye
una política de retención/exportación.

Durante una respuesta de red perdida la pantalla mantiene el texto y bloquea
cambiar de conversación hasta consultar. Recargar/cerrar pierde esa reserva del
navegador: revisar el historial de intentos antes de redactar otro envío.

## Controles y concurrencia

- Se verifica agencia/cliente activos, modo humano, destino, propiedad, conexión
  e is_enabled antes del envío; se revalida después de persistir.
- Texto limitado a1000 en social y4096 en Cloud. Cloud ya no recorta silenciosamente.
- Para Cloud se bloquea texto libre fuera de24h desde el último visitante guardado.
  La política admite texto libre dentro de la ventana; fuera requiere plantillas,
  que este flujo no implementa. [Política oficial](https://business.whatsapp.com/policy).
  Cloud usa external_received_at del visitante; mensajes históricos sin ese dato
  conservan el fallback de created_at. Ver whatsapp-cloud-recovery.md.
- La conversación permanece bloqueada durante el envío para serializar cambios
  de modo. NOWAIT evita bloquear el event loop de FastAPI con SQLAlchemy síncrono.
  El endpoint humano corre en el pool de threads de FastAPI: un handler entrante
  que espere síncronamente el lock no puede detener su await de red. Una
  conversación ocupada devuelve409 antes de aceptar otro intento.
- No se exponen excepciones del proveedor en los intentos. Un rechazo externo
  también se trata conservadoramente como incierto.

## Límites de esta entrega

Cubre envíos humanos desde el Inbox de agencia y el portal de clientes sobre
canales existentes. La recepción Cloud ya tiene su propia cola durable; **la
recepción/generación IA de WhatsApp QR sigue pendiente**. La cola social es separada.
No incluye adjuntos nuevos, OAuth, receipts, reintentos automáticos ni reconciliación
con el proveedor. Por eso Q05 sigue abierto. No hubo mensajes externos reales.

## Pruebas y reversión

- API: tests/test_human_delivery.py con PostgreSQL aislado, red simulada;
  concurrencia de mismo ID, timeout, falta de ID, caída, aislamiento, modo y límites.
- Navegador: scripts/ui/human-delivery-smoke.cjs, respuesta perdida, mismo UUID,
  estados y1440/390/320. No sustituye una cuenta real.
- Migración aditiva0026. Sacar backup antes de aplicarla.
- Rollback de esta unidad: router/service/modelo/schema/Inbox/types y0026 con
  sus pruebas/docs. No revertir0024/0025 de permisos. Downgrade0026 destruye intentos:
  archivar/reconciliar los inciertos primero y parar envíos durante la reversión.

## Portal del cliente — entrega 0028

- Mismo servicio y estados; actor portal_client_id separado de actor_id de usuarios.
  La misma clave no puede reutilizarse desde otro actor, cliente o conversación.
- Consultas y envío limitados al cliente autenticado; cliente/agencia activos y
  portal habilitado. Se revalida el portal antes de despachar.
- GET, cambio de modo y respuesta muestran los últimos50 intentos, sin tool_calls
  internos. Los intentos inciertos no se convierten en mensajes confirmados.
- El formulario conserva texto/UUID ante pérdida de respuesta y ofrece Consultar
  intento; bloquea cambio de conversación, modo y salida mientras se consulta.
  La clave vive en memoria de la pestaña: no recargar/cerrar con resultado desconocido.
  Tras recargar, revisar la actividad antes de redactar de nuevo; no hay auto-reenvío.
- Clientes API antiguos sin request_id generan una clave nueva por petición: deben
  adoptar una clave estable para poder consultar de forma idempotente.
- Pruebas: tests/test_portal_delivery.py y scripts/ui/portal-delivery-smoke.cjs
  (fixtures, pérdida de respuesta, mismo UUID, estados y1440/390/320).
- Reversión acotada: parar envíos portal, archivar/reconciliar intentos, revertir
  router portal, cambios de actor en servicio/modelo, UI portal y0028. No revertir
  auth/equipo/colas. Downgrade0028 pierde atribución del actor portal; no es seguro
  retomar el antiguo envío directo con intentos pendientes.
