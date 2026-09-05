# Recuperar acceso y gestionar el equipo

Recuperación por SMTP e invitaciones privadas sin proveedor de correo obligatorio.
No se han enviado correos reales ni configurado credenciales externas.

## Probarlo

- `/forgot-password`: sin SMTP devuelve un aviso de servicio no configurado.
- `/team`: un administrador crea invitaciones admin/operator y comparte el enlace
  por un canal privado. Solo se muestra al crear, no puede recuperarse después.
- `/accept-invitation#token=…`: definir nombre/contraseña e iniciar sesión con el
  correo al que se dirigió la invitación.
- Operadores entran en `/inbox`, sin administrar agentes/canales/claves/equipo.

## Correo: entorno privado de la API

```dotenv
AUTH_PUBLIC_URL=https://app.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=Voysse <access@example.com>
SMTP_USERNAME=replace-in-private-environment
SMTP_PASSWORD=replace-in-private-environment
SMTP_STARTTLS=true
```

Recrear API tras cambiar entorno. AUTH_PUBLIC_URL es el origen canónico, no la
lista CORS FRONTEND_URL ni el encabezado Host. Solo HTTP en localhost/127.0.0.1.
STARTTLS valida certificados; no soportamos SSL implícito465. En producción usar
HTTPS, COOKIE_SECURE=true y claves privadas de firma/cifrado. Para SMTP local de
pruebas puede desactivarse STARTTLS explícitamente; nunca para un proveedor público.

## Garantías y límites

| Tema | Comportamiento |
| --- | --- |
| Recuperación | Token aleatorio32bytes, solo SHA256 en DB;30min y uso único bajo bloqueo |
| Repeticiones | Cooldown60s persistido; nuevo enlace invalida el anterior |
| Privacidad |202 idéntico para cuentas conocidas/desconocidas; envío tras respuesta |
| Fallos correo | Log genérico sin token/destinatario; token invalidado, pedir otro tras60s |
| Reinicio API | Puede perder la tarea: no hay cola durable ni reintentos SMTP todavía |
| Reset | Revoca todas las sesiones anteriores, requiere volver a iniciar sesión |
| Contraseñas | Recuperación/invitación12–72 caracteres y máximo72bytes UTF8; registro mínimo8 |
| Invitaciones |48h, revocables, un solo uso; reemitir para mismo correo revoca anterior |
| Identidad | Quien tiene el enlace puede aceptar; sin verificación independiente del email |
| Operadores | Inbox de todos los clientes de su agencia, sin trazas internas de herramientas |
| Administración | Sin autoeliminación/autodegradación; bloqueo protege último administrador |
| Pendiente | Asignación granular por cliente, auditoría integral,2FA,SSO, rate limit distribuido |

Tokens en fragmento de URL, no query del servidor; se eliminan del historial al
abrir. Recargar requiere abrir otra vez el enlace original. No publicarlos.
Cambiar rol o retirar un miembro invalida sus sesiones. La autorización es API,
no depende de ocultar enlaces en la interfaz.

## Verificación y rollback

Tests: tests/test_password_recovery.py y tests/test_team.py; navegador con API
simulada: scripts/ui/auth-team-smoke.cjs. Pytest requiere DB exclusiva `_test`.
Migraciones0024/0025 son aditivas; backup antes de actualizar API.

**No volver al código anterior de permisos con operadores activos:** aquel código
les daría acceso administrativo. Preferir corregir hacia adelante. Una reversión
requiere bloquear esos usuarios, rotar clave de sesiones y evaluar pérdida de
invitaciones/tokens/versiones antes de downgrade0025/0024. No revertir0023 social.

Unidades revisables: recuperación (auth/security/deps/config/schemas/modelos,
servicio y0024, formularios/tests); equipo (router/modelo0025, permisos Inbox,
sidebar/pantallas/tests). Mantener pruebas y documentación con cada unidad;
sin commits ni despliegue público en esta entrega.
