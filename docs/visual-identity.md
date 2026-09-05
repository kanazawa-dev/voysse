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
- El dashboard real **no se ha rediseñado en esta entrega**. Usar esta base en su siguiente iteración; no confundir el preview ilustrativo con la UI actual de la aplicación.
- `rivr.css` y los fondos anteriores quedan como material histórico no importado por la landing. El documento rivr-ui-review.md describe la dirección anterior, no el estándar vigente.

## Verificación y reversión

- `npm --prefix apps/marketing run lint` y TypeScript sin errores.
- `npm --prefix apps/marketing run build -- --webpack` correcto.
- `scripts/ui/cypon-identity-smoke.cjs`: ES/EN, anchors, menú móvil, FAQ, diálogo Cloud sin envío real, ausencia de vídeo, reduced motion y consola de hidratación; anchos1440/1024/768/390/320 sin overflow.
- Capturas escritorio/móvil inspeccionadas frente a la referencia.
- Reversión acotada: restaurar page/layout y las dos variables tipográficas de globals al estado anterior; retirar cypon.css, identity.css, fuentes y prueba/documento nuevos. No afecta API, migraciones, datos, workers ni PR #2.

## Siguiente aplicación

Tras validar esta landing: trasladar los tokens al dashboard y adaptar navegación, formularios y estados por grupos de pantallas, manteniendo accesibilidad y flujos. No cambiar precios, permisos ni lógica de canales para conseguir parecido visual.
