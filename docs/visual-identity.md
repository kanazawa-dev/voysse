# Voysse — identidad Cypon

**La nueva referencia central es [Cypon Analytics](https://cypon-analytics.nextjsshop-preview.workers.dev/), elegida por el usuario el 5 septiembre 2026.** Sustituye la dirección Rivr para la landing y guía las siguientes superficies del producto. La implementación es propia: composición y lenguaje visual cercanos a la referencia, contenido y marca Voysse.

## Base visual

| Elemento   | Regla                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| Superficie | `#f4f4f5`, alternando con blanco y `#fafafa`                                              |
| Texto      | `#18181b`; secundario `#666670`                                                           |
| Acento     | `#5135ff`, reservado para acciones principales, indicadores y diagramas                   |
| Líneas     | `#d4d4d8`, 1px, sin sombras pesadas                                                       |
| Tipografía | Geist para contenido; Geist Mono para navegación, etiquetas y números de sección          |
| Hero       | Alineación izquierda, 80px en escritorio, peso500, dos líneas, ancho contenido1280px      |
| Secciones  | Cabecera centrada, títulos hasta60px, índice técnico y esquinas de registro               |
| Botones    | Rectangulares, monoespaciados, mayúsculas, acento violeta y esquinas abiertas             |
| Tarjetas   | Grillas y divisores compartidos; radios mínimos, no píldoras o grandes tarjetas flotantes |
| Decoración | Separadores diagonales, tramas de puntos violetas y diagramas simples                     |
| Producto   | Preview oscuro propio en marco violeta; datos marcados explícitamente como ejemplo        |
| Voxy       | Se conserva, integrado en violeta; sin controles de pausar/activar                        |

Los tokens viven en `apps/marketing/app/identity.css` y se cargan desde el layout, también para las páginas legales y diálogos. `cypon.css` compone la landing. Las fuentes son archivos locales con licencia OFL; no se descargan durante el build ni al navegar desde terceros.

## Alcance actual

- Landing reconstruida con hero, vista ilustrativa del producto, capacidades, canales, workspace, comparación, planes, FAQ y CTA.
- ES/EN, enlaces reales, acceso a la app, formulario de interés Cloud y FAQ conservados.
- Sin vídeo, testimonios inventados, logos de clientes, métricas de conversión ni promesas de disponibilidad tomadas de la referencia. Los nombres de proveedores identifican opciones, no clientes ni patrocinadores.
- Instagram/Messenger distinguen configuración manual/beta. No se presenta OAuth como terminado.
- El dashboard real ya adopta esta base: Geist/Mono, grises/violeta, sidebar y topbar, formularios, tarjetas, tablas y diálogos. El preview de la landing continúa siendo una ilustración, no datos en vivo.
- `rivr.css` y los fondos anteriores quedan como material histórico no importado por la landing. El documento rivr-ui-review.md describe la dirección anterior, no el estándar vigente.

## Verificación y reversión

- `npm --prefix apps/marketing run lint` y TypeScript sin errores.
- `npm --prefix apps/marketing run build -- --webpack` correcto.
- `scripts/ui/cypon-identity-smoke.cjs`: ES/EN, anchors, menú móvil, FAQ, diálogo Cloud sin envío real, ausencia de vídeo, reduced motion y consola de hidratación; anchos1440/1024/768/390/320 sin overflow.
- Capturas escritorio/móvil inspeccionadas frente a la referencia.
- Reversión acotada: restaurar page/layout y las dos variables tipográficas de globals al estado anterior; retirar cypon.css, identity.css, fuentes y prueba/documento nuevos. No afecta API, migraciones, datos, workers ni PR #2.

## Siguiente aplicación

La base visual está aplicada al dashboard y a los componentes compartidos. Los colores de estado (error/advertencia/éxito) y el color propio de cada portal/widget permanecen semánticos. No se cambian precios, permisos ni lógica de canales para conseguir parecido visual.

## Interacciones y dashboard

- La referencia se inspeccionó en navegador: botones cambian color en 200 ms y sus
  esquinas se recogen; no hay elevación/3D. Se reproduce ese comportamiento en
  landing y botones principales del dashboard.
- Menús de marketing abren por hover solo con ratón/puntero fino en escritorio;
  mantienen navegación nativa por clic/teclado y móvil. Escape cierra incluso
  un menú abierto por hover sin foco. Chevron gira y dropdown aparece suavemente.
- Tarjetas responden con fondo/borde sutil, enlaces y FAQ cambian de énfasis.
  Focus-visible sigue visible; disabled no adquiere hover; reduced motion elimina
  transiciones y animación de menú sin ocultar los estados.
- Web tiene identity.css equivalente y fuentes locales OFL en su propio contexto
  de build Docker. Mantener equivalencia con marketing al actualizar los tokens.
  El modo oscuro usa carbón/violeta, no la anterior paleta azul marino.
- Revisiones específicas: scripts/ui/cypon-hover-smoke.cjs y
  scripts/ui/cypon-dashboard-smoke.cjs. Se ejecutan además auth-team-smoke,
  human-delivery-smoke y portal-delivery-smoke para detectar regresiones de flujos.
- Builds webpack y lint de ambas apps pasan. Las pruebas de UI usan fixtures,
  no crean clientes reales ni envían mensajes. Dashboard: 14 rutas en 1440/390/320 px,
  tema oscuro y hover de botones, tarjetas y navegación.
- Reversión de esta extensión: revertir hooks/CSS hover de marketing y cambios
  de layout/componentes/tokens/fonts del dashboard. No hay migraciones ni cambios
  en API. La landing Cypon previa puede conservarse independientemente.

### Selector de idioma

- Ambas apps usan el mismo control rectangular, Geist Mono, chevron y estados
  violeta. El menú portalled hereda el tema en lugar de forzar modo oscuro.
- Elegir idioma cierra el menú; se conservan radio seleccionado, navegación por
  teclado, Escape y persistencia del idioma existentes.
- `scripts/ui/cypon-language-smoke.cjs` verifica ambas apps, ES/EN, geometría,
  selección, teclado y ancho móvil. Reversión: componentes LanguageSwitcher,
  bloque CSS correspondiente y eliminación del `dark` forzado en dropdown.

### Sidebar: botones como la landing

Los enlaces principales y adicionales usan borde rectangular y marcadores de
esquina que se recogen de -3px a 0px en 200ms, tanto con hover como con foco de
teclado. Activo y hover usan violeta; no hay saltos de tamaño. El espacio entre
botones evita superponer los marcadores. En modo colapsado se oculta la etiqueta,
conservando icono y tooltip. Reduced motion elimina la transición, no el estado.
La prueba dashboard verifica esquinas, foco, tema oscuro y sidebar colapsado.
Reversión acotada: clase `cy-sidebar-action`, su bloque CSS y espacio de navegación;
no afecta rutas ni permisos.

### Acceso sencillo

Login y registro comparten un único formulario centrado (sin panel lateral ni
métricas de ejemplo), logo compacto, controles rectangulares y selector de idioma.
Los mismos endpoints, validaciones y pantalla de aprobación pendiente permanecen.
Autocompletado distingue contraseña actual/nueva. Revertir `app/login/page.tsx`
restaura la composición anterior sin cambios de backend.

### Campos visibles sin interacción

Input, Textarea y Select usan borde permanente `--input: #85858f`, también en
modo oscuro; no dependen del hover. El foco mantiene su anillo y el hover no
sobrescribe errores. Marketing comparte la corrección de Input. Los campos
compuestos que declaran `border-0` conservan el borde de su contenedor.
La prueba social cubre reposo, foco, error+hover y claro/oscuro.

### Catálogo de canales consistente

La pestaña de canales del cliente enlaza a las configuraciones ya implementadas
igual que el catálogo general. Webchat está disponible; Instagram y Messenger
indican configuración manual en validación, con credenciales/permisos propios y
OAuth guiado pendiente. No se representan como funciones terminadas ni conectadas
sin verificar su conexión real. Prueba social cubre ambas entradas y móvil.
