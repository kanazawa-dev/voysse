# Studio — estado y siguiente paso

Actualizado: 6 de septiembre de 2026. **Studio aún no está completo.** Este es el
punto de entrada para retomar el desarrollo; las notas de entregas anteriores son
históricas. Describe código y verificación, no un despliegue en producción.

## Qué está implementado

| Unidad | Alcance real | Integración previa |
| --- | --- | --- |
| Canvas por cliente | Canales → agentes, inspector, creación/configuración básica, conexión confirmada/versionada, vista del widget | PR #41, #43, #45 |
| Derivaciones en borrador | Guardado con revisión, agentes del mismo cliente, validación de ciclos/límites, editor y recorrido manual | PR #50, #52 |
| Simulación IA | Un paso o cadena acotada; muestra condiciones y razones; consume tokens, sin herramientas/historial/envíos reales | PR #54, #56 |
| Estado durable | Responsable separado del agente de entrada, turnos/contexto idempotentes, transiciones, revisión y salida humana | PR #58, main `af3cdb3` |
| Revisión administrativa API | Listado acotado y cierre auditado de turnos en curso/inciertos hacia humano; sin reintentos | PR #60, main `1c54f73` |
| Panel de revisión | Carga explícita, páginas, registro, estados vacíos/errores, motivo/aceptación/confirmación; ES/EN, claro/oscuro y móvil | PR #62, main `71749be` |
| Publicación API | Instantáneas auditadas, CAS/UUID, restaurar y retirar sin activar runtime | PR #64, main `e624efc` |
| Publicación UI | Historial, comparación del borrador guardado, publicar/restaurar/retirar con motivo y confirmación | PR #66, main `ae0f1a5` |
| Layout API | Posiciones/zoom cosméticos, CAS y límites; no cambia routing | PR #70, main `c414464` |
| Layout UI | Organizar con mouse/teclado, guardar/recargar/restablecer; móvil apilado | PR #72, main `cc9687a` |
| Política por turno | Pin histórico, selección actual bajo bloqueo, replay estable y transferencias dentro del grafo fijado | PR #68, main `8d46f23` |

**No confundir:** el canvas sí cambia la asignación canal → agente al confirmarla.
Las reglas editadas siguen siendo borradores hasta publicar explícitamente por API o desde Studio.
Una versión publicada todavía NO activa derivaciones. La simulación no las publica
ni genera turnos reales. El protocolo durable y su revisión todavía no son usados
por los productores actuales de mensajes; un registro vacío es esperable.

## Runner interno

Recorrido publicado con callback sin herramientas: clasificación acotada, responsable
actual, contexto compartido y una respuesta final guardada con cierre atómico.
Valida antes/después de I/O, contabiliza tokens y bloquea errores/cancelaciones sin
reintentos. Proveedores falsos en pruebas; **aún no integrado en endpoints/canales**.
Ver [contrato y límites](decisions/execution-state.md#runner-interno-de-cadena--sin-transportes).

## Acceso a Studio

**Sidebar → Studio** abre una ventana/pestaña independiente con el último cliente
autorizado. Canvas a pantalla completa sin scroll de página; paneles internos para
configurar, probar y revisar. Tema/idioma y selector integrados en la cabecera.
Búsqueda/selector arriba; cada cliente conserva su canvas. El acceso desde Clientes
sigue funcionando. Cambiar con el selector confirma descartes y bloquea operaciones
en curso. No cambia permisos ni activa las derivaciones reales.

## Organización visual

En escritorio: **Organizar nodos** → arrastrar o usar flechas/Mayús →
**Guardar distribución**. Zoom también se guarda. Recargar descarta con confirmación;
restablecer requiere guardar. No conecta canales en modo organizar. En móvil siguen
las tarjetas apiladas. API con CAS y controles visuales implementados, no despliegue.

## Cómo verificar y usar la revisión

En `/clients/<id>/studio`, al final: **Revisión de ejecuciones → Cargar turnos**.
Solo administradores de la agencia. Diez filas por página, responsable/revisión
**actuales** junto al turno histórico. Expandir **Ver registro** para las transiciones.

Solo el turno activo en curso/incierto permite **Revisar hacia humano**. Comprobar
primero proveedor/canal, escribir motivo sin secretos, aceptar la advertencia y
confirmar. El cierre registra actor/fecha/motivo, invalida la revisión y deja humano.
No cancela efectos externos ya iniciados. Un error o respuesta perdida elimina
las acciones locales: cargar otra vez para conciliar, nunca reenviar automáticamente.

## Pendientes, en orden recomendado

1. **Adoptar el protocolo en todos los productores.** Inventariar `/messages`, `/media`,
   `/mode`, widget y workers QR/Cloud/social; comenzar con una ruta controlada. Confirmar
   claim antes de I/O, una respuesta por propietario, contexto compartido y límites;
   cercar escrituras tardías y coordinar salida humana/resume explícito. No cambiar
   `Conversation.agent_id`. Cubrir borrar/mover/desactivar agentes y cambios de permisos.
2. **Adaptador de IA y entrega reales con política publicada.** El runner interno
   ya clasifica mediante callback y guarda respuesta; faltan credenciales/permisos,
   RAG, tools y outbox durable. No repetir tools/envíos inciertos. Pruebas
   de concurrencia, caída, duplicados, revisión humana y cambios de configuración.
3. **Feedback de ejecución real en el canvas.** La distribución visual ya puede
   moverse/guardarse/restaurarse; falta reflejar el recorrido real cuando los
   productores adopten el protocolo. Solo mostrar estados demostrados por el backend.
4. **Aceptación operativa controlada.** Migraciones/backup/rollback en entorno acordado,
   credenciales y canales de prueba, límites de gasto/concurrencia, monitoreo y recorrido
   completo con cuenta real. Verificar revisión desplegada antes de anunciar activación.

Estos pasos no están implementados por el panel. Ningún reintento automático, plazo
que libere turnos inciertos ni activación de transporte está aprobado implícitamente.

## Evidencia y continuidad

- Backend: 26 pruebas enfocadas (13 de revisión) pasaron; suite local de 244 antes
  de agregar el último caso de paginación/bloqueo, luego enfocadas nuevamente verdes.
  PR #60: seis checks verdes, CI `34043065444`. Solo PostgreSQL desechable.
- Publicación: 14 pruebas enfocadas y 259 API completas aprobadas; migración
  base → 0033 → base → 0033 aprobada en DB desechable.
  Ver [contrato, migración y rollback](decisions/policy-publication.md);
  Pinning interno e interfaz implementados; adopción por productores aún pendiente.
- Runner: 21 casos enfocados finales aprobados; suite local de 297 aprobada antes
  del último caso de rollback. CI vuelve a ejecutar la suite completa. Callback falso,
  sin proveedor/canal real; `tests/test_execution_runner.py`.
- Pin por turno: 8 casos nuevos, 21 enfocados y 267 API completas aprobadas;
  migración base → 0034 → base → 0034 validada solo en PostgreSQL desechable.
- Layout API: 10 pruebas enfocadas y 277 API completas aprobadas;
  base → 0035 → base → 0035 validada en PostgreSQL desechable.
- Navegación global: ESLint/build webpack y smoke de selección aprobados ES/EN,
  claro/oscuro, 1440/390/320; recordar cliente autorizado, errores, descartes y bloqueo
  durante guardado. Script `studio-navigation-smoke.cjs`.
- Layout UI: ESLint/build webpack y siete smokes Studio aprobados ES/EN, claro/oscuro,
  1440/390/320. Arrastre/teclado, líneas, persistencia, CAS, reset y cero escrituras
  de canales en `studio-layout-smoke.cjs`. Captura oscura inspeccionada.
- Migración 0032: base → 0032 → base → 0032 verificada; no ejecutada en producción.
- Panel: ESLint y build webpack pasaron. `studio-execution-smoke.cjs` pasó en ES/EN,
  1440/390/320 y claro/oscuro: vacío, paginación, auditoría, teclado, aceptación,
  cancelar/confirmar, conflicto, respuesta perdida tras commit, errores de lectura
  y cero reintentos automáticos.
  Captura móvil oscura inspeccionada; fixtures, no proveedores reales.
  Reproducir: `WEB_URL=<preview> node scripts/ui/studio-execution-smoke.cjs`
  (requiere Playwright o `PLAYWRIGHT_MODULE` apuntando a su instalación).
- Los otros cuatro smokes de Studio también pasaron: canvas, edición, borradores
  y simulación. Repetir `scripts/ui/studio-*-smoke.cjs` al cambiar estas rutas.
- Publicación UI: ESLint/build webpack y los seis smokes de Studio aprobados
  ES/EN, 1440/390/320, claro/oscuro. Incluye CAS con páginas antiguas, publicar/restaurar/
  retirar, respuesta perdida sin reintento y retiro de controles ante borrador sucio.
  Script: `scripts/ui/studio-policies-smoke.cjs`; captura móvil inspeccionada.
- La copia principal local conserva cambios paralelos de adquisición. Su actualización
  desde main se detuvo para no sobrescribirlos; usar un worktree desde `origin/main`.
  Adquisición ya está en main por PR #78 (`e3e77de`): migración
  `0036_acquisition_counts` sobre `0035_studio_layout`. Las copias locales antiguas
  no deben aplicarse ciegamente sobre main.
- Antes de retomar: `git status`, revisar PR/CI y comparar `main` con `origin/main`.
  No incluir cambios concurrentes de marketing ni carpetas privadas en commits de Studio.
- No hay despliegue ni aceptación externa demostrados por estas pruebas.

## Checkpoint para apagar y retomar

- Navegación global, layout y runner interno ya estaban integrados antes de esta entrega.
- Esta entrega agrega el canvas inmersivo; revisar PR/CI de issue #79 antes de retomar.
- Código y documentación se conservan en Git; no hay servicios de prueba necesarios
  para continuar. Los previews iniciados por esta entrega se detienen al terminar.
- No sobrescribir el checkout principal: conserva trabajo paralelo. Hay un respaldo
  local externo de su diff y archivos sin seguimiento; la ruta exacta queda en memoria
  de sesión y en el reporte de entrega. El respaldo no equivale a un merge.
- Para completar Studio siguen pendientes adaptador real de IA/permisos/RAG/tools,
  outbox, adopción de canales, recuperación humana, activación y aceptación operativa.

## Archivos y rollback

- `apps/web/components/studio/` y `app/clients/[id]/studio/page.tsx`: canvas y paneles.
- `apps/api/app/routers/studio*.py`: mapa, borradores, simulación y revisión.
- `apps/api/app/services/execution_state.py`: contrato transaccional dormante.
- `apps/api/migrations/versions/0032_execution_state.py`: runtime/turnos.
- [Contrato de ejecución](decisions/execution-state.md), [derivaciones](decisions/agent-handoffs.md)
  y [decisiones del canvas](decisions/client-studio.md): límites y diseño.
- Rollback del panel: retirar `execution.tsx`, su entrada/estilos y smoke; conservar
  API, ledger y auditoría. Revertir interfaz no borra los cierres humanos ya registrados.
