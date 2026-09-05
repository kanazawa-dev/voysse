# Detectar workers sin progreso

Los workers social y WhatsApp Cloud tienen healthcheck de Docker independiente
de `/ready` de la API. Un contenedor `running` no demuestra que procese la cola.

## Comprobar

```sh
docker compose --env-file .env.docker --profile social ps
# Sustituir por el servicio que se quiere comprobar:
docker compose --env-file .env.docker exec whatsapp-cloud-worker python -m app.services.worker_health
```

La sonda sale con0 si hubo una iteración completada en los últimos300 segundos;
con1 si no hay registro, está caducado, corrupto o tiene una fecha futura.
Comprueba también que el contenedor esperado exista: una sonda local no detecta
un worker que nunca se desplegó. Social sigue siendo un profile opcional.

## Qué mide (y qué no)

- Al arrancar, el worker borra cualquier estado anterior. Solo actualiza después
  de terminar `work_once` y cerrar su sesión DB sin excepción. Una cola vacía
  consultada correctamente también cuenta como progreso.
- Una excepción del bucle no renueva la señal. Una IA/red bloqueada tampoco:
  no hay un temporizador paralelo que maquille la falta de progreso.
- La señal usa reloj monotónico y reemplazo atómico de un archivo local privado
  en `/tmp`, no un volumen compartido. Un worker por contenedor.
- El límite de5min tolera operaciones lentas; una operación legítima más larga
  puede marcar unhealthy y exige diagnóstico, no reenvío automático.
- Docker comprueba cada30s, espera30s al arrancar y marca unhealthy tras3 fallos.
  Puede tardar aproximadamente6–6.5min desde el último progreso. **No es una alerta
  externa ni reinicia un contenedor por sí solo.** `restart: unless-stopped`
  responde a la salida del proceso, no al estado unhealthy.
- Progreso no significa entrega: revisar eventos failed/needs_review/uncertain.
  `/ready` sigue midiendo DB de la API, no salud global de todos los canales.

## Ante unhealthy

1. Comprobar disponibilidad DB, conectividad y estado de los eventos del canal.
2. Revisar logs genéricos; no compartir tokens, payloads ni credenciales.
3. Antes de reiniciar, revisar operaciones en curso y envíos inciertos. No
   reencolar/repetir herramientas ni envíos ambiguos automáticamente.
4. Conectar un monitor externo a estos estados para recibir avisos: sigue pendiente.

## Pruebas y reversión

`tests/test_worker_health.py` cubre señal ausente/caducada/corrupta/futura, permiso
privado, reset al arrancar y ambos workers con éxito, error e interrupción.
Para revertir esta unidad, quitar healthchecks de ambos servicios y hooks de
ambos scripts, junto con helper/pruebas/documento. No hay migración ni cambios
a estados de entrega. No revertir las colas ni auth de la entrega anterior.

Verificación local (5 septiembre 2026): `pytest tests/test_worker_health.py -q`
→13 passed; suite API completa `pytest -q` →143 passed en64s en DB aislada.
Simulación en contenedor desechable, con sonda Docker cada segundo: señal
fresca →healthy, señal caducada →unhealthy. Contenedor de simulación eliminado.
El despliegue conserva el intervalo30s y3 fallos descritos arriba.
