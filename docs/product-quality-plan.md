# Voysse: de producto funcional a producto confiable y vendible

Evaluación acotada del repositorio, 4 de septiembre de 2026. **Plan propuesto,
no tareas ejecutadas ni fecha de entrega comprometida.** No reemplaza el roadmap
público ni la especificación comercial existente.

**Ejecución iniciada:** ver [estado de implementación](implementation-status.md)
para distinguir código entregado, pruebas y tareas todavía pendientes. No marcar
una fase completa por tener solo parte de sus criterios implementados.

## Respuesta corta

**Alcance actualizado por Alex:** completar Instagram DM y Facebook Messenger
forma parte del producto principal, junto con WhatsApp y chat web. No quedan
postergados. Ver [tareas de canales](social-channels-plan.md).

No hace falta otra reescritura visual. Hace falta demostrar que una agencia puede
activar un cliente, responder correctamente, intervenir cuando algo falla y operar
sin depender de Alex para cada paso. Primero confiabilidad y activación; después
comodidad operativa y crecimiento.

Estimación para una persona con 30–35 horas semanales de producto y 5–10 de ventas:
**3–5 semanas para un piloto limitado con supervisión; 7–10 para una versión sólida;
12–16 para una versión muy buena en un segmento concreto sin los dos canales nuevos**.
Con Instagram y Messenger completos, reservar **16–22 semanas** para el conjunto,
incluyendo su estabilización pero **sin garantizar los tiempos de revisión de Meta**.
A media jornada, aproximadamente 7–11 meses para ese alcance. Las fechas dependen de acceso a cuentas, incidencias,
validación comercial y clientes dispuestos a probar. No equivalen a madurez enterprise.

## Lo que sabemos y lo que no

| Evidencia revisada | Lectura correcta |
| --- | --- |
| `README.md`, routers y servicios | Ya hay multi-cliente, agentes, conocimiento, herramientas HTTP/MCP, widget, WhatsApp, Inbox/handoff y marca blanca. No hay que reconstruirlos. |
| `apps/api/tests/` | Hay 49 funciones de test, incluyendo firma, duplicados, handoff y algunos controles entre agencias. No se midió cobertura ni se ejecutó toda la suite en esta revisión. |
| `.github/workflows/publish-images.yml` | Único workflow visible: construir/publicar imágenes. No hay un job explícito de tests en PR. Esto no descarta controles externos. |
| `whatsapp_inbound.py` y `whatsapp_cloud_webhook.py` | Se guarda la entrada antes de generar/enviar; fallos registran error y retornan. Riesgo identificado de entrada aceptada sin respuesta recuperable. Ya existe deduplicación y constraint DB; falta probar fallos/concurrencia y recuperación durable. |
| `main.py`, `ratelimit.py` | Health devuelve OK estático; limitador por proceso en memoria. No demuestran disponibilidad de DB ni límites compartidos al escalar. |
| `routers/auth.py`, `docs/roadmap.md` | No se encontró recuperación de contraseña en el router; invitaciones y permisos de equipo figuran como idea, aunque el modelo User tiene role. |
| `docs/self-hosting.md` | Hay instrucciones de backups. No se verificaron backups automáticos, restauración ni alertas de la instalación remota. |
| `specs/001-business-model-redesign/` | Ya hay validación económica/comercial pendiente: preservar US$99 + US$25/cliente extra, BYOK y controles antes de pilotos/cobros. |

La UI pasó lint y pruebas visuales previas con fixtures; hoy pasaron cuatro casos
de hidratación. **Esto no prueba el recorrido real con proveedor IA, cliente y
WhatsApp de producción.** No se auditó todo el producto ni se contactó a clientes.

## Tareas y orden de ejecución

Responsable por defecto: desarrollo (Alex con asistencia). Las tareas C requieren
trabajo directo de Alex con compradores; un agente no puede sustituir esa evidencia.
Estimaciones por tarea: días de unas seis horas de trabajo enfocado, incluyendo
pruebas. No sumar plazos comerciales como si fueran horas de programación.

### Fase 0 — Medir antes de prometer (2–3 días)

- [ ] **Q01 — Baseline reproducible (1–2 d).** Levantar staging y DB de pruebas
  aislada; ejecutar suite API, bridge, lint/build y smoke UI. Guardar resultado por
  comando y lista de fallos. **Aceptación:** reproducción desde checkout limpio;
  nunca apuntar pytest a datos reales (`conftest.py` hace `drop_all`).
- [ ] **Q02 — Definir el primer caso de éxito (1 d).** Una agencia, un negocio,
  preguntas frecuentes y derivación humana. **Aceptación:** demo repetible y lista
  de funciones incluidas/excluidas; nada de nuevas integraciones para cerrar la demo.

### Fase 1 — No perder confianza (12–20 días; bloquea clientes de producción)

- [ ] **Q03 — Pruebas obligatorias antes de publicar (1–2 d; Q01).** CI en PR
  para API/bridge/UI y migraciones en DB vacía. **Aceptación:** fallo bloquea la
  entrega; configuración del repositorio verificada, no solo YAML escrito.
- [ ] **Q04 — Aislamiento y abuso (2–3 d; Q01).** Ampliar matriz agencia A/B,
  cliente A/B, portal, widget, archivos y herramientas; revisar secretos/logs,
  confianza en proxy e IP y SSRF existente. **Aceptación:** accesos cruzados
  denegados en todos los casos incluidos; cero hallazgos críticos abiertos.
- [ ] **Q05 — Entrega recuperable de mensajes (4–6 d; Q01).** Diseñar persistencia
  del trabajo/estado de envío, reintentos acotados y errores recuperables; probar
  duplicados concurrentes, reinicio y timeout IA/canal. Evaluar solución con DB
  existente antes de sumar infraestructura. **Aceptación:** ningún mensaje aceptado
  desaparece sin estado; no doble procesamiento ante duplicados; envío ambiguo se
  marca y resuelve sin reenvío ciego. No prometer exactly-once externo.
  Avance5 septiembre: intentos humanos persistidos/idempotentes desde Inbox y portal;
  Cloud oficial también tiene admisión durable/worker probado localmente;
  faltan QR y prueba de proveedores reales. Ver human-delivery.md
  y whatsapp-cloud-recovery.md.
- [ ] **Q06 — Backups restaurables y rollback (1–2 d; Q01).** Verificar y automatizar
  respaldo, restaurar DB/archivos en entorno separado y documentar claves necesarias.
  **Aceptación:** restauración real registrada y objetivos internos de pérdida/tiempo
  definidos para el piloto; propuesta inicial RPO <=24 h, RTO <=4 h, no SLA vendido.
- [ ] **Q07 — Detectar caídas y fallos (1–2 d; Q05).** Separar liveness/readiness,
  comprobar DB, registrar IDs de trazabilidad sin contenido sensible y alertas
  operativas. **Aceptación:** simular caída y recibir aviso; localizar mensaje fallido.
- [ ] **Q08 — Costes y límites comprensibles (2–3 d; Q01).** Comprobar medición de
  consumo, límites de solicitudes/concurrencia y aviso antes del corte; probar
  carreras. No crear facturación ni inventar precios. **Aceptación:** no consumo
  ilimitado por bug/abuso, límites documentados por despliegue; nunca sobrecoste sorpresa.
- [ ] **Q09 — Recorrido real del canal vendido (1–2 d; Q04–Q08).** Prueba con claves
  y cuenta autorizadas, mensajes reales no sensibles, IA/humano, pérdida de conexión.
  **Aceptación:** evidencia del recorrido completo. Para piloto solo web, WhatsApp
  queda explícitamente excluido hasta superar su propia prueba.

**Puerta de piloto:** Q01–Q09 completados para el alcance vendido, sin críticos de
seguridad/pérdida de datos, manual de incidentes y aprobación de preparación comercial.
Demo privada con datos ficticios puede hacerse antes; producción con clientes no.

### Fase 1B — Completar los canales anunciados (prioridad de Alex)

Ejecutar CH01–CH11 de [canales](social-channels-plan.md). Preparar app/cuentas desde
la semana uno; desarrollar sobre la entrega recuperable Q05. Instagram primero,
Messenger después, reutilizando infraestructura sin mezclar sus reglas. Las mejoras
Q10–Q14 deben probarse también sobre esos canales. La revisión externa puede avanzar
mientras se trabaja en calidad del producto; no requiere agentes paralelos.

### Fase 2 — Fácil de activar y respuestas confiables (11–18 días)

- [ ] **Q10 — Onboarding guiado (3–4 d; Q02,Q09).** Checklist cliente → proveedor
  → conocimiento → prueba → publicación. Errores explican qué corregir y dónde.
  **Aceptación:** tres usuarios nuevos completan el flujo, registrando tiempo y ayuda;
  objetivo mediano <20 min con contenido/credenciales listos, excluyendo aprobaciones externas.
- [ ] **Q11 — Recuperación de acceso (2–3 d; Q04).** Reset con token de un solo uso,
  expiración, sin enumeración y revocación de sesiones según política definida.
  **Aceptación:** tests de token expirado/reutilizado, rate limit y flujo de correo real.
  Implementación y pruebas locales listas; pendiente configurar/verificar SMTP real.
- [ ] **Q12 — Evaluación de IA por caso de uso (2–3 d; Q02,Q09).** Crear 50 preguntas
  con respuestas/rúbricas aprobadas: conocidas, desconocidas, adversariales y handoff.
  **Aceptación:** conjunto versionado, reporte repetible y revisión humana; objetivo
  >=90% aceptables y cero fallos críticos observados, sin interpretar esto como garantía.
- [ ] **Q13 — Mejorar conocimiento y fallback (2–4 d; Q12).** Corregir fallos medidos:
  contenido desactualizado, recuperación irrelevante, evidencia insuficiente,
  derivación; mostrar estado de procesamiento de archivos. **Aceptación:** no empeora
  suite y resuelve errores prioritarios; no inventa respuesta cuando falta información.
- [ ] **Q14 — Inbox y accesibilidad operables (2–4 d; Q05,Q10).** Probar takeover
  durante IA en curso, orden/duplicados, envío fallido, teclado, foco, contraste y móvil.
  **Aceptación:** IA no responde tras takeover confirmado; operador puede recuperar
  conversación y reconocer pendientes sin abrir logs.

### Fase 3 — Operar y mejorar sin depender del fundador (10–17 días)

- [x] **Q15 — Roles e invitaciones reales (3–5 d; Q04,Q11).** Admin y operador,
  autorizados en backend, invitación revocable/expirable. **Aceptación:** operador
  no toca claves ni administración. Implementado5 septiembre: enlaces manuales48h,
  revocación, permisos API y pruebas de concurrencia/aislamiento; ver auth-team-setup.md.
- [ ] **Q16 — Cambios seguros de agentes (2–3 d; Q12,Q13).** Borrador/publicación,
  historial de configuración y rollback, prueba antes de publicar. **Aceptación:**
  comparar dos versiones y restaurar una sin romper conversación activa.
- [ ] **Q17 — Datos y control del cliente (2–3 d; Q04,Q06).** Verificar e implementar
  exportación, eliminación y retención con reglas explícitas para backups y logs.
  **Aceptación:** prueba aislada demuestra alcance por cliente y ausencia de fuga;
  contrastar implementación con compromisos publicados antes de usar datos reales.
- [ ] **Q18 — Capacidad, experiencia y observación (2–4 d; Q05–Q08,Q14).** Ensayo
  de carga representativo al alcance de pilotos; medir p95 de latencia, error, uso y
  coste; corregir cuello de botella medido, no escalar por intuición. **Aceptación:**
  presupuesto de rendimiento documentado y siete días de uso instrumentado sin críticos.
- [ ] **Q19 — Soporte que no dependa de llamadas (1–2 d; Q10–Q18).** Guías cortas,
  diagnóstico de errores, contacto soporte y proceso de actualización. **Aceptación:**
  medir ayuda requerida por cliente; objetivo <1 h/semana tras onboarding, por validar.

Q17 tiene implementación avanzada aquí, pero cualquier obligación asumida de
eliminación/retención necesita procedimiento manual probado antes del piloto.

## Trabajo comercial durante estas fases

- [ ] **C01 — Reabrir controles de la ronda vigente.** Revisar evidencia real de
  economía y preparación de `specs/001-business-model-redesign/tasks.md`; una casilla
  marcada no prueba que obligaciones o costes sigan resueltos. Si hay bloqueo, demo
  e investigación sin cobrar. Validación profesional cuando corresponda, no dictamen legal aquí.
- [ ] **C02 — Cinco entrevistas cualificadas.** Contactos cercanos y prospección
  manual relevante. Preguntar por clientes, solución actual y último problema real.
  Mantener identidades/notas en `work/` ignorado por git, no en documentación pública.
- [ ] **C03 — Tres compromisos de piloto a precio completo.** Solo después de C01
  y controles de la especificación; ejecutar producción después de puerta Q09.
  Preservar US$99/mes con tres clientes +US$25 adicional, BYOK y cobro manual vigente.
  No cambiar hipótesis a mitad de ronda ni construir checkout todavía.
- [ ] **C04 — Evidencia de valor y renovación.** Medir 30 días por agencia:
  activación, uso semanal, respuestas útiles, costes, soporte y voluntad de renovar.
  Obtener autorización para casos/testimonios; sin resultados inventados.

Ver [plan de primeros clientes](first-customers-plan.md). Tiempo semanal reservado
para ventas desde el principio; no esperar 16 semanas para hablar con compradores.

## Cuándo podríamos decir «está muy bueno»

No por tener todas las casillas: debe superar estas pruebas en el segmento elegido.

1. Tres agencias activas durante 30 días con al menos un cliente real cada una;
   al menos dos renuevan/pagan un segundo periodo. Meta de validación, no prueba estadística de PMF.
2. Primera publicación repetible y sin ayuda constante, según Q10.
3. Calidad IA medida por Q12 y mejora documentada, no solo respuestas vistosas.
4. Cero críticos de seguridad abiertos; restore, recovery y takeover probados.
5. Costes y soporte medidos; cumplir los umbrales de margen de la ronda comercial
   (75% caso típico / 60% alto uso) o revisar la oferta antes de escalar.
6. Sin pérdida silenciosa en ensayos de fallos y trazabilidad de incidentes reales.

Trabajo base estimado: 35–58 días enfocados; sumar aproximadamente 19–30 días para
canales (algunos ensayos se comparten), más esperas externas, ventas y revisión.
La ventana revisada de 16–22 semanas no garantiza captación ni aprobaciones.
Empezando en septiembre de 2026, apuntar a diciembre de 2026–febrero de 2027 para
evaluar el conjunto completo, reestimando al acabar Q01/CH01 y cada dos semanas.

## No construir todavía

Marketplace, canales adicionales a Instagram/Messenger/WhatsApp/web, telefonía, app móvil, SSO enterprise, automatización
compleja de cobros u otra landing. Una integración de agenda puede adelantarse solo
si un comprador comprometido la necesita y el alcance sustituye otro trabajo.

## Fuentes y límites

Ordenar primero recuperación y pruebas se apoya en las prácticas de
[Google SRE sobre integridad y restauración](https://sre.google/sre-book/data-integrity/).
Evaluar agentes con tareas/rúbricas reproducibles y revisión humana sigue la guía de
[Anthropic sobre evaluaciones de agentes](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).
Los plazos, umbrales y tareas concretas son estimaciones propias para este repositorio,
no garantías ni valores universales extraídos de esas fuentes.

Actualización: envíos humanos del portal implementados en0028; ver implementation-status.md. Q05 continúa abierto por QR entrante y validación real.
