<p align="center">
  <img src="apps/web/public/brand/only-logo.png" width="96" alt="Voysse" />
</p>

<h1 align="center">Voysse</h1>

<p align="center">
  <strong>Plataforma open-source y white-label para que agencias creen, ejecuten y gestionen agentes de IA para sus clientes.</strong>
</p>

<p align="center">
  <a href="https://openvoiss.com/docs">Documentación</a> ·
  <a href="https://openvoiss.com/docs/getting-started">Inicio rápido</a> ·
  <a href="https://openvoiss.com/docs/self-hosting">Self-hosting</a> ·
  <a href="https://github.com/kanazawa-dev/voysse/discussions">Discusiones</a>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-FSL--1.1--MIT-black" alt="FSL-1.1-MIT" /></a>
  <img src="https://img.shields.io/badge/backend-FastAPI-009688" alt="FastAPI" />
  <img src="https://img.shields.io/badge/frontend-Next.js-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/bridge-Baileys-25D366" alt="Baileys" />
  <a href="./README.md"><img src="https://img.shields.io/badge/README-EN-yellow" alt="English" /></a>
</p>

---

## ¿Qué es Voysse?

Voysse es un espacio de trabajo multi-tenant donde una agencia crea agentes de IA para sus clientes, les entrega un portal con su marca y se comunica con usuarios finales por WhatsApp o a través de un widget de chat embebible.

Usa tus propias claves de OpenAI / Anthropic y despliega todo el stack con un solo comando.

El producto ahora se llama **Voysse**. Las URLs del repositorio y los
identificadores técnicos conservan temporalmente `openvoiss` durante el
renombre gradual y compatible; consulta la
[migración de marca](./docs/brand-migration.md).

## Inicio rápido

```bash
git clone https://github.com/kanazawa-dev/voysse.git
cd openvoiss
make setup
make up
```

Luego abre `http://localhost` y crea tu primera agencia.

Consulta la [guía de inicio rápido](https://openvoiss.com/docs/getting-started) para el paso a paso completo.

## Características

### Agentes
- Instrucciones, personalidad, contexto por cliente y por agente, zona horaria, y controles de temperatura / max-tokens / memoria
- Multimodal: reconocimiento de imágenes (visión) y transcripción de audio para archivos entrantes
- Asistente de creación con contador de tokens en tiempo real y plantillas de inicio por industria
- [Más información](https://openvoiss.com/docs/agents)

### Base de conocimiento
- Contexto manual, pares de preguntas y respuestas estructurados, y carga de PDFs
- Recuperación semántica basada en embeddings con respaldo por palabras clave
- Embeddings portátiles en JSON — sin extensiones de base de datos
- [Más información](https://openvoiss.com/docs/knowledge-base)

### Proveedores de IA
- Claves propias de OpenAI (Responses API) y Anthropic (Messages API) a nivel de agencia, encriptadas y validadas al guardar
- Cualquier endpoint compatible con OpenAI mediante URL base + modelo por conexión
- [Más información](https://openvoiss.com/docs/ai-providers)

### Herramientas personalizadas
- Herramientas HTTP por agente: cualquier endpoint REST con parámetros de ruta, query y body, headers de autenticación encriptados y protección SSRF
- Servidores MCP (Streamable HTTP o SSE) con prueba de conexión antes de guardar y descubrimiento de herramientas en caché
- Uso de herramientas registrado por respuesta y visible en el playground, incluyendo errores
- [Más información](https://openvoiss.com/docs/custom-tools)

### Canales
- **WhatsApp Cloud API** (API oficial de Meta) — usa tus credenciales de app de Meta, webhooks firmados, número por cliente
- **WhatsApp QR** a través de Baileys — enlace QR, número por cliente, sesión persistente encriptada
- **Widget de chat web** embebible para cualquier sitio
- Instagram DM y Facebook Messenger *(próximamente)*
- [Más información](https://openvoiss.com/docs/whatsapp)

### Operaciones
- **Inbox** unificado con búsqueda del lado del servidor, pestañas de filtro, seguimiento de no leídos, paginación y toma de control humana
- **Portal** por cliente con login propio e Inbox, opcionalmente bajo su propio dominio personalizado (verificación DNS y HTTPS automático)
- **Dashboard** con actividad, agentes principales, uso de tokens por modelo y filtro por rango de fechas
- **White-label** de agencia (nombre, identificador, color, logo)
- [Más información](https://openvoiss.com/docs/inbox)

## Arquitectura

Tres servicios más PostgreSQL, orquestados con Docker Compose.

| App | Stack | Rol |
| --- | --- | --- |
| `apps/api` | FastAPI · SQLAlchemy · Alembic | API REST, modelo de datos, servicios de IA / conocimiento / proveedores |
| `apps/web` | Next.js · React · TypeScript · Tailwind | Dashboard de agencia, portal de cliente, playground, widget |
| `apps/whatsapp` | Node.js · Baileys | Puente de WhatsApp Web (sesiones con estado) |

Todos los datos residen en PostgreSQL; las claves de proveedores y las sesiones de WhatsApp están encriptadas en reposo. Cada consulta está acotada por `agency_id` para aislamiento de tenants, y los endpoints públicos tienen rate limiting por IP de cliente. Un gateway de Caddy sirve la app y la API desde un mismo origen (`/api/*` → backend).

[Lee la guía de arquitectura](https://openvoiss.com/docs/architecture)

## Estructura del proyecto

```text
apps/
  api/         Backend FastAPI (app/, migrations/, tests/)
  web/         Frontend Next.js (app/, components/, lib/, types/)
  whatsapp/    Puente de WhatsApp Baileys (src/)
docs/          Guía de self-hosting y operaciones
scripts/       Scripts auxiliares (generate-docker-env.sh)
Makefile       Comandos comunes (make help)
docker-compose.yml
```

## Documentación

La documentación completa está en [**openvoiss.com/docs**](https://openvoiss.com/docs).

| Guía | Qué cubre |
| --- | --- |
| [Inicio rápido](https://openvoiss.com/docs/getting-started) | Ejecutar el stack con Docker y crear tu primera agencia |
| [Configuración](https://openvoiss.com/docs/configuration) | Variables de entorno, secretos, puertos y el gateway |
| [Arquitectura](https://openvoiss.com/docs/architecture) | Los servicios, el modelo de datos y el aislamiento de tenants |
| [Self-hosting](https://openvoiss.com/docs/self-hosting) | Desplegar en un servidor, backups, actualizaciones y troubleshooting |
| [Contribuir](https://openvoiss.com/docs/contributing) | Ejecutar el proyecto localmente, tests y convenciones |
| [Migración de marca](./docs/brand-migration.md) | Nombre visible Voysse e identificadores heredados conservados intencionalmente |

## Licencia

Copyright © 2026 Voysse.

Voysse está licenciado bajo la [Functional Source License, Version 1.1, MIT Future License](./LICENSE) (FSL-1.1-MIT). Consulta el archivo de licencia para los términos completos.

## Comunidad

- [Discusiones](https://github.com/kanazawa-dev/voysse/discussions) para preguntas e ideas
- [Issues](https://github.com/kanazawa-dev/voysse/issues) para reportar errores y solicitar funciones
