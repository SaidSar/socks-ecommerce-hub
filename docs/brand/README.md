# Marca SOKKO (ソッコ) — Guía de uso del logotipo

> **Regla principal:** el logotipo es el entregado por el cliente y **no se modifica**. Los archivos de este paquete son el mismo dibujo vectorizado del original (`sokko-logo-original-cliente.jpg`): mismas formas, mismos colores medidos. Las variantes solo recortan o reacomodan esas formas, sin redibujarlas.

## 1. Archivos

| Archivo | Contenido | Uso en el sitio |
|---|---|---|
| `apps/web-store/src/assets/brand/sokko-logo.svg` | Bloque vertical completo: calceta, sol, ソッコ y SOKKO | Footer, pantallas de bienvenida, documentos |
| `…/sokko-logo-horizontal.svg` | Isotipo a la izquierda y SOKKO a la derecha | **Navbar** y panel del acceso de cuenta |
| `…/sokko-isotipo.svg` | Calceta, sol y ソッコ | Avatares, sellos, espacios cuadrados |
| `…/sokko-simbolo.svg` | Calceta y sol | Favicon y tamaños muy pequeños |
| `…/sokko-wordmark.svg` | Solo SOKKO | Usos tipográficos puntuales |
| `…/*-on-dark.svg` | Igual, con la tinta en lino `#F4F0EB` | Solo sobre fondo tinta `#23211E` |
| `apps/web-store/public/favicon.svg`, `favicon.ico` | Símbolo en cuadrado | Pestaña del navegador |
| `…/apple-touch-icon.png`, `icon-192.png`, `icon-512*.png` | Isotipo sobre lino | iOS, Android y PWA |
| `…/og-image.png` (1200 × 630) | Logo vertical sobre lino | Vista previa al compartir el enlace |
| `docs/brand/sokko-logo-1920.png`, `-3840.png` | Logo vertical transparente en Full HD y 4K | Presentaciones e impresos |
| `docs/brand/sokko-logo-fullhd-washi.png`, `-tinta.png` | 1920 × 1080 sobre papel y sobre tinta | Portadas de presentación |
| `docs/brand/sokko-logo-original-cliente.jpg` | Archivo original del cliente | Referencia, no usar en el sitio |

## 2. Colores del logotipo

| Elemento | Hex | Nota |
|---|---|---|
| Tinta (calceta y SOKKO) | `#1E1B19` | Medido del original |
| Rojo (sol y ソッコ) | `#D91F25` | Medido del original. **Exclusivo del logo**: no se usa en la interfaz, que sigue con `laca #A62B2B` |

## 3. Reglas

- **Área de protección:** alrededor del logo deja libre, como mínimo, el diámetro del sol.
- **Tamaño mínimo:** horizontal 110 px de ancho · vertical 96 px de ancho · símbolo 16 px.
- **Fondos permitidos:** lino `#F4F0EB`, arena `#ECE5DC`, blanco y papel washi para la versión normal; tinta `#23211E` solo con las versiones `-on-dark`.
- **No permitido:** cambiar colores, deformar o estirar, rotar, quitar o mover el sol, separar ソッコ de la calceta en el isotipo, añadir sombras o contornos, ni colocarlo sobre fotografías con poco contraste.
- **Variante horizontal:** reacomoda las piezas originales sin modificarlas para que quepan en una barra de navegación. Conviene confirmarla con el cliente; si no la aprueba, el Navbar usa el isotipo solo.
