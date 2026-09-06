# Publicar versiones sin activar derivaciones

Estado: API e interfaz implementadas; ejecución real pendiente. Publicar guarda una
instantánea de reglas, no habilita transportes. `runtime_enabled` siempre es `false`.

## Contrato

`GET /api/studio/{client}/policies` devuelve historial descendente (10 por defecto,
máximo 50); `before_revision` pagina sin repetir nuevas publicaciones. La primera
fila sin cursor representa el estado publicado actual; lista vacía equivale a revisión 0.
Las páginas históricas no representan el estado actual. Acceso: administrador de la agencia.

`POST` en la misma ruta exige UUID `request_id`, `expected_revision`, `reason` de
1–500 caracteres y `action`:

| Acción | Entrada adicional | Resultado |
| --- | --- | --- |
| `publish` | `draft_revision` exacta | Copia el borrador guardado en una nueva versión |
| `restore` | `restore_revision` existente con política | Revalida y copia esa instantánea en una nueva versión |
| `unpublish` | Ninguna | Añade una versión con `policy: null`; no borra historial |

Toda escritura incrementa revisión y registra actor, fecha, motivo y solicitud.
Una repetición exacta del UUID devuelve la versión original con `applied: false`,
no necesariamente la actual. Cambiar actor/cliente/entrada con la misma clave da 409.
El borrador nunca se sobrescribe al publicar/restaurar. Las versiones son inmutables
por API; no es almacenamiento a prueba de modificaciones administrativas en la base.
No guardar secretos en motivos o condiciones.

## Concurrencia y seguridad

Orden de bloqueo NOWAIT: agencia → usuario → cliente → agentes ordenados por ID.
Se revalidan rol, versión de sesión, agencia activa y referencias del mismo cliente.
El bloqueo del cliente serializa publicación y guardado del borrador; CAS rechaza
revisiones obsoletas. Recursos ocupados devuelven 409 sin esperar indefinidamente.
Publicar/restaurar exige cliente y agentes activos; retirar publicación sigue siendo
posible para un cliente inactivo. Restaurar revalida referencias actuales: no revive
agentes borrados/inactivos, configuraciones ni credenciales antiguas.

## Conversaciones y siguiente etapa

Ninguna operación cambia conversaciones, mensajes, responsables o turnos. Tampoco
se ejecutan proveedores/herramientas/envíos. Los adaptadores actuales ignoran estas
versiones. Antes de activarlos se debe persistir la versión elegida para cada turno:
un turno en curso no cambia de política a mitad de ejecución; revisiones posteriores
se eligen únicamente en límites explícitos de turno y con revalidación de permisos.
La anulación de publicación deberá impedir nuevos turnos con política; no cancelar
por sí sola efectos externos iniciados. Ese pinning y la activación aún NO existen.

## Verificación, migración y rollback

Verificado: 14 pruebas enfocadas y 259 pruebas API completas aprobadas en
PostgreSQL desechable; round-trip base → 0033 → base → 0033 aprobado. Casos:
snapshot independiente del borrador, restauración/anulación,
historial paginado, UUID/CAS, concurrencia, locks y sesión revocada; no cuentas reales.
La verificación anterior corresponde a la entrega API. Ver abajo la interfaz. Migración `0033_policy_versions` parte de `0032_execution_state`; no aplicar
junto a otra rama Alembic con el mismo padre sin reconciliar primero sus heads.
Rollback: retirar router y modelo, exportar auditoría antes de downgrade; la migración
elimina solo `policy_revisions`. No altera borradores, ledger ni canales. El borrado
de un cliente sí elimina su historial por cascada. No se migró producción.


## Controles en Studio

Dentro de **Derivaciones entre agentes → Versiones publicadas**, cargar el historial
explícitamente. Se compara el borrador **guardado** con la publicación actual:
reglas y orden, condiciones, máximo de saltos y salida humana. Las páginas anteriores
no cambian la revisión actual usada por CAS. Se muestran autor, fecha y motivo.

Publicar/restaurar/retirar exige motivo y confirmación. Restaurar crea otra revisión,
no modifica el borrador. No se ofrece publicar una copia idéntica, un borrador no
válido ni publicar/restaurar para clientes inactivos. Retirar sigue permitido.
Con cambios locales sin guardar o mientras se guarda, se ocultan los controles;
al cambiar la revisión guardada se descarta el historial anterior.

Cualquier resultado de escritura, incluido timeout/conflicto, descarta las acciones
locales. Cargar historial para conciliar y recargar el borrador si cambió: nunca
repetir automáticamente el POST. Cerrar o editar el panel no cancela una solicitud
que ya haya llegado al servidor. No se activan agentes, herramientas ni envíos.

Rollback UI: retirar `policies.tsx`, su entrada en `handoffs.tsx`, estilos de comparación
y `studio-policies-smoke.cjs`; conservar API, versiones y auditoría. La siguiente
etapa es fijar la versión por turno y preparar los adaptadores, todavía desactivados.


Verificación UI: ESLint/build webpack y los seis smokes de Studio aprobados en ES/EN,
1440/390/320, claro/oscuro; captura móvil oscura inspeccionada. El nuevo smoke cubre
comparación, historial sin perder la revisión actual, las tres acciones, cancelar,
respuesta perdida después del commit, conflictos, errores de lectura y borrador sucio.
Las keys de publicación y simulación llevan prefijos distintos: compartir la key de
revisión entre hermanos dejaba un panel DOM obsoleto al editar. La regresión exige
que desaparezcan los controles al quedar cambios sin guardar. Solo fixtures, no cuentas reales.
