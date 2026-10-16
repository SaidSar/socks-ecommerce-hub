# DESIGN.md — Home "Kyoto Artisan" · SOKKO (ソッコ)

> **Propósito:** especificación ejecutable para que Claude Code implemente el Home de SOKKO en `apps/web-store` a partir del mockup aprobado **"SOKKO Kyoto Artisan Mockup"** (Propuesta 3).
> **Referencia visual:** `docs/design/mockups/kyoto-artisan.html` (abrir en navegador; es la fuente de verdad visual).
> **Fuente de verdad arquitectónica:** `CONTEXTO_MAESTRO.md`. Si este documento contradice al maestro en rutas o stack, gana el maestro; en tokens visuales del Home, gana este documento (ver §1.3).
> **Equipo:** NEXUS CODE · UAdeO · Asignatura SOA · 7.º semestre.

---

## 0. Instrucciones para Claude Code

1. Lee completos `CONTEXTO_MAESTRO.md`, este archivo y `docs/design/mockups/kyoto-artisan.html` antes de escribir código.
2. Trabaja en la rama `feat/home-kyoto-artisan`. Un commit por fase (§5), mensaje en formato `feat(web-store): fase N — <resumen>`.
3. Ejecuta **una fase a la vez**. Al terminar cada fase: `npm run build` y `npm run lint` sin errores, luego marca las casillas de la fase en este archivo.
4. No copies el HTML del mockup tal cual: el mockup usa Tailwind por CDN, Babel en el navegador y `Math.random()` para IDs de SVG. Todo eso se reemplaza (ver §7).
5. No inventes endpoints ni toques `apps/api-service` en este trabajo. El Home funciona con datos mock detrás de `services/` (§4) y queda listo para conectar a la API.
6. Componentes en **JSX funcional** con hooks. Sin librerías de UI externas (no shadcn, no MUI). Sin estilos inline salvo valores dinámicos (color de swatch, `strokeDashoffset`).
7. Si un paso es ambiguo, elige la opción que replique el mockup y deja un `// TODO(design):` con la duda.

---

## 1. Identidad visual (tokens)

### 1.1 Paleta

| Token Tailwind | Hex | Uso |
|---|---|---|
| `linen` | `#F4F0EB` | Fondo base de la página y del drawer |
| `sand` | `#ECE5DC` | Secciones alternas, tarjetas de imagen, top bar |
| `sand-2` | `#E3DACD` | Estados deshabilitados, hover de superficies |
| `ink` | `#23211E` | Texto principal, trazos, bordes al 10–20 % de opacidad |
| `ink-soft` | `#6A645C` | Texto secundario y metadatos |
| `laca` | `#A62B2B` | Acento único: CTA de pago, sello, "pocos ejemplares", énfasis en itálica |
| `laca-hover` | `#8F2424` | Hover del CTA de pago |
| `laca-dark-bg` | `#C8473F` | Solo sobre fondo `ink` (kanji 侘寂 de Filosofía); contraste 3.4:1, válido para texto grande |
| `matcha` | `#5A6654` | Etiquetas de sección (eyebrows), tags de material, estado "agregado" · ajustado para pasar 4.5:1 sobre sand |
| `moss` | `#8F9779` | **Solo bordes y puntos decorativos.** No usar como color de texto (no pasa contraste AA) |

**Regla del rojo:** `laca` aparece como máximo en: sol del logo, sol del hero, palabra *Renace*, filtro activo, numeración de láminas, aviso de pocos ejemplares, progreso de envío, sello 無料配送 y botón "Proceder al Pago Seguro". Nada más.

### 1.2 Tipografía

| Rol | Familia | Pesos | Uso |
|---|---|---|---|
| `font-serif` | Cormorant Garamond | 300, 400, 500 + itálica 300/400 | Titulares, nombres de pieza, precios, citas |
| `font-sans` | Work Sans | 300, 400, 500 | Cuerpo, botones, etiquetas en versalitas |
| `font-jp` | Shippori Mincho | 400, 600 | Kanji y katakana decorativos (siempre `aria-hidden` salvo que sea contenido) |

Escala de referencia (clamp donde aplica):
- H1 hero: `clamp(46px, 7.4vw, 104px)`, `font-light`, `leading-[.98]`.
- H2 sección: `clamp(32px, 4.6vw, 64px)`, `font-light`.
- Eyebrow: `11px`, `tracking-[.32em]`, `uppercase`, color `matcha`.
- Cuerpo: `15–15.5px`, `leading-[1.8]`, color `ink-soft`.
- Botones: `11.5–12px`, `tracking-[.26em]`, `uppercase`.

### 1.3 Cambio frente a `CONTEXTO_MAESTRO.md`

El maestro define la paleta Zen original (`#FAF8F5`, `#1A1A1A`, `#C8102E`). Con la elección de Kyoto Artisan, **actualiza la sección 2 del maestro** con la tabla de §1.1 y agrega la nota: *"Dirección visual aprobada: Kyoto Artisan & Botanical Wabi-Sabi (Propuesta 3)"*. Esto es parte de la Fase 1.

### 1.4 Forma y superficie

- Esquinas **rectas** en tarjetas, botones y drawer. Solo son redondos: swatches, sello, dots de estado y tags de sostenibilidad del footer.
- Bordes: `border-ink/10` (estructura) y `border-ink/15` (separadores de lista).
- Sin sombras de tarjeta. Única sombra permitida: `drop-shadow` suave bajo la calceta del hero.
- Textura de lino (`.linen-tex`) solo en hero y drawer.

---

## 2. Arquitectura de la página

```text
Home (/)
├── TopBar                 aviso de envío de cortesía
├── Navbar (sticky)        logo · 4 enlaces ancla · buscador poético · bolsa (n)
├── HeroEditorial          #origen    kanji 水 / 土 de fondo · H1 · CTA · pieza destacada con swatches
├── MateriaCuration        #materia   3 láminas tipo herbolario (acordeón de una abierta)
├── AtelierCatalog         #atelier   filtro por tono · grid de PieceCard · estado vacío
├── Filosofia              #filosofia banda ink con 侘寂 y cita
├── Footer                 cita ceremonial · columnas · sellos · pagos · legales
└── CartDrawer (portal)    bolsa del atelier · BrushProgress · líneas · furoshiki · totales · CTA
```

Navegación del Navbar (scroll suave a ancla, con offset del header sticky):

| Etiqueta | Destino |
|---|---|
| El Origen | `#origen` |
| Colección Tabi | `#atelier` |
| Tejidos Botánicos | `#materia` |
| Filosofía | `#filosofia` |

---

## 3. Estructura de archivos a crear

```text
apps/web-store/
├── index.html                              # <link> de Google Fonts + <title>SOKKO — Confort que Renace cada paso</title>
├── tailwind.config.js                      # tokens §1 (reemplazar extend actual)
└── src/
    ├── index.css                           # @tailwind + utilidades .linen-tex .swatch-tex .vertical
    ├── App.jsx                             # Router: "/" → Home; CartProvider envolviendo todo
    ├── config/
    │   └── commerce.js                     # FREE_SHIPPING, SHIPPING_COST, IVA_RATE, FEW_UNITS
    ├── utils/
    │   ├── currency.js                     # formatMXN(n, decimals)
    │   └── scroll.js                       # scrollToId(id) con offset del header
    ├── data/
    │   └── catalog.mock.js                 # TONES, SIZES, PIECES (temporal, §4.2)
    ├── services/
    │   └── productService.js               # getHomePieces() → mock hoy, API mañana
    ├── context/
    │   └── CartContext.jsx                 # reducer + selectores + persistencia
    ├── hooks/
    │   ├── useCart.js                      # acceso tipado al contexto
    │   └── useLockBodyScroll.js
    ├── components/
    │   ├── brand/Logo.jsx
    │   ├── layout/TopBar.jsx
    │   ├── layout/Navbar.jsx
    │   ├── layout/Footer.jsx
    │   ├── product/KnitTabi.jsx            # SVG placeholder de la calceta (§6.1)
    │   ├── product/ToneSwatches.jsx
    │   ├── product/SizeSelector.jsx
    │   ├── product/PieceCard.jsx
    │   ├── home/HeroEditorial.jsx
    │   ├── home/MateriaCuration.jsx
    │   ├── home/BotanicalPlate.jsx         # 3 ilustraciones SVG de las láminas
    │   ├── home/AtelierCatalog.jsx
    │   ├── home/Filosofia.jsx
    │   ├── cart/CartDrawer.jsx
    │   ├── cart/CartLine.jsx
    │   └── cart/BrushProgress.jsx
    └── pages/
        └── Home.jsx
```

---

## 4. Datos y reglas de negocio

### 4.1 `src/config/commerce.js`

```js
// Valores de negocio. En la integración con la API vendrán de GET /api/config.
export const FREE_SHIPPING = 799;   // MXN, subtotal mínimo para envío de cortesía
export const SHIPPING_COST = 99;    // MXN, envío estándar bajo el umbral
export const IVA_RATE = 0.16;       // IVA incluido en precio (solo informativo en el desglose)
export const FEW_UNITS = 4;         // stock <= FEW_UNITS → "Pocos ejemplares en almacén"
```

### 4.2 `src/data/catalog.mock.js`

```js
export const TONES = {
  sumi:   { name: 'Tinta Sumi',   hex: '#2C2925', line: '#F4F0EB' },
  washi:  { name: 'Blanco Washi', hex: '#EFE8DC', line: '#23211E' },
  laca:   { name: 'Rojo Laca',    hex: '#9E2F2C', line: '#F4F0EB' },
  matcha: { name: 'Oliva Matcha', hex: '#6E7A5E', line: '#F4F0EB' },
};

export const SIZES = [
  { code: 'S', label: '22–24 cm' },
  { code: 'M', label: '25–27 cm' },
  { code: 'L', label: '28–30 cm' },
];

export const PIECES = [
  { id: 7,  name: 'Tabi Origami Noche', jp: '折紙・夜', material: 'Algodón peinado D-200 · pliegue en empeine',   price: 420, tones: ['sumi', 'washi'],          stock: { sumi: 3, washi: 12 },          edition: 'Elaboración limitada · 120 pares' },
  { id: 12, name: 'Lino Komorebi',      jp: '木漏れ日', material: 'Lino y algodón · tinte de té verde',          price: 380, tones: ['matcha', 'washi'],        stock: { matcha: 9, washi: 4 } },
  { id: 3,  name: 'Kintsugi Washi',     jp: '金継ぎ',   material: 'Algodón peinado · costura dorada visible',    price: 460, tones: ['washi', 'sumi', 'laca'],  stock: { washi: 2, sumi: 8, laca: 6 },  edition: 'Elaboración limitada · 80 pares' },
  { id: 21, name: 'Hanami Laca',        jp: '花見',     material: 'Algodón peinado · pigmento mineral rojo',     price: 395, tones: ['laca', 'washi'],          stock: { laca: 11, washi: 15 } },
  { id: 15, name: 'Tsuchi Raíz',        jp: '土',       material: 'Algodón y bambú · teñido con tierra ocre',    price: 360, tones: ['matcha', 'sumi'],         stock: { matcha: 14, sumi: 3 } },
  { id: 9,  name: 'Mizu Calma',         jp: '水',       material: 'Algodón peinado · punto tubular sin costura', price: 340, tones: ['washi', 'matcha', 'sumi'], stock: { washi: 20, matcha: 7, sumi: 10 } },
];

export const FEATURED_PIECE_ID = 7; // pieza del hero
```

### 4.3 `src/services/productService.js`

- Exporta `getHomePieces(): Promise<{ pieces, tones, sizes, featuredId }>`.
- Hoy resuelve el mock con un `await` simulado (sin `setTimeout` mayor a 300 ms).
- Deja la firma lista para `fetch(\`${import.meta.env.VITE_API_URL}/api/products?section=home\`)` comentada con `// TODO(api)`.
- `Home.jsx` consume el servicio con `useEffect` y maneja tres estados: `loading` (esqueletos con `bg-sand`), `error` (mensaje + botón "Reintentar"), `ready`.

### 4.4 Reglas del carrito (exactas, no reinterpretar)

| Regla | Definición |
|---|---|
| Clave de línea | `${pieceId}-${tone}-${size}` |
| Agregar existente | `qty + 1`, tope `max` |
| Tope `max` | `stock[tone]` de la pieza (cuando la API dé stock por talla, `stock[tone][size]`) |
| `setQty(key, q)` | `q <= 0` elimina la línea; `q > max` se fija en `max` |
| Subtotal | `Σ price × qty` |
| Envío | `subtotal === 0` → `0` (mostrar "—"); `subtotal >= FREE_SHIPPING` → `0` (mostrar "Cortesía"); otro caso → `SHIPPING_COST` |
| Total | `subtotal + envío` |
| IVA informativo | `total − total / (1 + IVA_RATE)`, 2 decimales |
| Progreso | `min(100, subtotal / FREE_SHIPPING × 100)` |
| Faltante | `max(0, FREE_SHIPPING − subtotal)` |
| Furoshiki | booleano `giftWrap`, **true por defecto**, sin costo |
| Persistencia | `localStorage` key `sokko.cart.v1`, envuelto en `try/catch`; si falla, el carrito sigue en memoria |
| Estado inicial | Vacío en producción. Solo en `import.meta.env.DEV` se precarga 1 × Tabi Origami Noche (Tinta Sumi, M) para revisión visual |

Selectores a exponer desde `useCart()`: `items, count, subtotal, shipping, total, ivaIncluded, progress, missing, isFree, giftWrap, isOpen` y acciones `add(piece, tone, size), setQty(key, q), remove(key), toggleGift(), open(), close()`.

### 4.5 Reglas de catálogo

- Filtro por tono: `Todas | Tinta Sumi | Blanco Washi | Rojo Laca | Oliva Matcha`. Una pieza aparece si **alguno** de sus tonos coincide.
- Búsqueda: coincidencia sin distinción de mayúsculas ni acentos sobre `name + material` (normalizar con `String.prototype.normalize('NFD')` y quitar diacríticos).
- Estado vacío: kanji 無, "Aún no hay una pieza con ese nombre." y sugerencia "Pruebe con “Tabi”, “lino” o elija otro tono."
- Indicador de exclusividad por pieza y tono seleccionado:
  - `stock[tone] <= FEW_UNITS` → texto `laca`: "Pocos ejemplares en almacén · N".
  - si no, `edition` si existe; si no, "Disponible en atelier" (texto `matcha`).

---

## 5. Plan de implementación por fases

### Fase 1 — Fundaciones visuales
- [x] `index.html`: agregar en `<head>`:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Work+Sans:wght@300;400;500&family=Shippori+Mincho:wght@400;600&display=swap" />
  ```
- [x] `tailwind.config.js` con el bloque de §5.1.
- [x] `src/index.css` con el bloque de §5.2.
- [x] Actualizar sección 2 de `CONTEXTO_MAESTRO.md` (§1.3).
- **Criterio de aceptación:** una página de prueba con `bg-linen text-ink font-serif` renderiza Cormorant sobre lino sin fallback visible.

#### 5.1 `tailwind.config.js`
> Si el proyecto usa **Tailwind v4** (sin `tailwind.config.js`, con `@import "tailwindcss"`), traduce este bloque a `@theme { --color-linen: #F4F0EB; … }` en `index.css` y conserva los mismos nombres.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        linen: '#F4F0EB',
        sand: { DEFAULT: '#ECE5DC', 2: '#E3DACD' },
        ink: { DEFAULT: '#23211E', soft: '#6A645C' },
        laca: { DEFAULT: '#A62B2B', hover: '#8F2424' },
        matcha: '#606C5A',
        moss: '#8F9779',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Cormorant', 'Garamond', '"Times New Roman"', 'serif'],
        sans: ['"Work Sans"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        jp: ['"Shippori Mincho"', '"Yu Mincho"', '"Hiragino Mincho ProN"', 'serif'],
      },
      keyframes: {
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        stamp: {
          from: { transform: 'scale(1.6) rotate(-12deg)', opacity: '0' },
          to: { transform: 'scale(1) rotate(-6deg)', opacity: '1' },
        },
      },
      animation: {
        fade: 'fade .6s ease',
        stamp: 'stamp .5s cubic-bezier(.2,1.4,.4,1) forwards',
      },
      transitionDuration: { 500: '500ms' },
    },
  },
  plugins: [],
};
```

#### 5.2 `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { scroll-behavior: smooth; }
  body {
    @apply bg-linen text-ink font-sans font-light antialiased;
  }
  h1, h2, h3 { text-wrap: balance; }
  :focus-visible { outline: 1px solid theme('colors.laca.DEFAULT'); outline-offset: 3px; }
}

@layer utilities {
  .linen-tex {
    background-image:
      repeating-linear-gradient(0deg, rgba(35,33,30,.018) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(90deg, rgba(35,33,30,.014) 0 1px, transparent 1px 4px);
  }
  .swatch-tex {
    background-image:
      repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(-45deg, rgba(0,0,0,.08) 0 1px, transparent 1px 3px);
  }
  .vertical { writing-mode: vertical-rl; text-orientation: upright; }
  .tnum { font-variant-numeric: tabular-nums; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

### Fase 2 — Datos, servicio y utilidades
- [x] `config/commerce.js`, `data/catalog.mock.js`, `services/productService.js` (§4.1–4.3).
- [x] `utils/currency.js`: `formatMXN(n, decimals = 0)` → `"$" + n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })`.
- [x] `utils/scroll.js`: `scrollToId(id)` que resta la altura del header (`68px + 12px` de margen) y respeta `prefers-reduced-motion`.
- **Criterio:** `getHomePieces()` devuelve las 6 piezas; `formatMXN(420)` → `"$420"`, `formatMXN(57.93, 2)` → `"$57.93"`.

### Fase 3 — Estado global del carrito
- [x] `context/CartContext.jsx` con `useReducer`; acciones `ADD`, `SET_QTY`, `REMOVE`, `TOGGLE_GIFT`, `OPEN`, `CLOSE`, `HYDRATE`.
- [x] Selectores derivados con `useMemo` según §4.4. No guardar subtotal/total en el estado.
- [x] Persistencia en `localStorage` (`sokko.cart.v1`) con `try/catch`; no persistir `isOpen`.
- [x] `hooks/useCart.js` lanza error claro si se usa fuera del provider.
- [x] `App.jsx`: `<CartProvider>` envolviendo `<BrowserRouter>` con ruta `/` → `<Home />`.
- **Criterio:** agregar la misma pieza/tono/talla tres veces con `stock = 3` deja `qty = 3`; una cuarta no cambia nada.

### Fase 4 — Componentes atómicos
- [x] `brand/Logo.jsx`, `product/KnitTabi.jsx`, `product/ToneSwatches.jsx`, `product/SizeSelector.jsx` según contratos de §6.
- **Criterio:** dos `KnitTabi` en la misma página no comparten IDs de `<pattern>` ni `<clipPath>` (usar `useId()`).

### Fase 5 — Layout
- [x] `TopBar`, `Navbar` (desktop + menú móvil + buscador desplegable), `Footer`.
- **Criterio:** el header es sticky, el menú móvil se abre/cierra con botón con `aria-expanded`, y los cuatro enlaces llevan a su sección sin que el header tape el título.

### Fase 6 — Secciones del Home
- [x] `HeroEditorial`, `MateriaCuration` + `BotanicalPlate`, `AtelierCatalog` + `PieceCard`, `Filosofia`.
- [x] `pages/Home.jsx` compone todo y maneja `loading / error / ready`.
- **Criterio:** visualmente equivalente al mockup en 1440 px, 1024 px y 390 px.

### Fase 7 — Drawer del carrito
- [x] `CartDrawer`, `CartLine`, `BrushProgress` (§6.9–6.11).
- [x] `hooks/useLockBodyScroll.js` activo mientras el drawer está abierto.
- **Criterio:** se abre desde el Navbar y tras "Adquirir Pieza" (500 ms después del clic); cierra con `Esc`, clic en fondo y botón ✕; el foco va al botón de cierre al abrir y regresa al disparador al cerrar.

### Fase 8 — Accesibilidad, responsive y pulido
- [x] Checklist de §8 completo.
- [x] Sin warnings en consola; `npm run build` limpio.
- [x] Lighthouse (móvil) en Accesibilidad ≥ 95.

---

## 6. Contratos de componentes

### 6.1 `KnitTabi`
```txt
props: tone: keyof TONES = 'washi', className?: string, strokeWidth?: number = 2.2
```
- SVG `viewBox="0 0 220 250"`. Silueta Tabi (path exacto en el mockup, función `KnitTabi`).
- Relleno con `<pattern>` de punto (7×6, chevron con `stroke = tone.line` al 16 %), puño con 5 líneas de canalé, sombra de talón al 8 %.
- IDs con `useId()` (no `Math.random()`).
- `role="img"` + `aria-label="Calceta tabi en {tone.name}"`.
- **Es un placeholder.** Cuando existan fotos, `PieceCard` y el hero renderizan `<img>` y `KnitTabi` queda como fallback si `imageUrl` es nulo.

### 6.2 `Logo`
- Círculo `laca` r=7 + silueta Tabi a trazo `ink` 1.6 + wordmark "SOKKO" (`font-serif text-[22px] tracking-[.28em]`) + 足袋工房 (`font-jp text-[10px] tracking-[.6em] text-laca`).
- Envuelto en `<a href="#origen" aria-label="SOKKO inicio">`.

### 6.3 `ToneSwatches`
```txt
props: tones: string[], value: string, onChange(tone), size?: 'sm' | 'md' = 'md', label: string
```
- `role="radiogroup"` + `aria-label`; cada botón `role="radio"`, `aria-checked`, `aria-label={TONES[t].name}`.
- Círculo `w-6 h-6` con clase `swatch-tex` y `backgroundColor` del tono.
- Seleccionado: `ring-1 ring-ink ring-offset-[3px] ring-offset-linen`. No seleccionado: `ring-1 ring-ink/15`.
- **Área táctil mínima 44 × 44 px** (padding invisible alrededor del círculo).

### 6.4 `SizeSelector`
```txt
props: value: 'S'|'M'|'L', onChange(code)
```
- Tres botones en línea: código (`tracking-[.14em]`) + medida (`text-ink-soft tnum`). Seleccionado con `border-b border-ink`.
- Default `'M'` (decisión del mockup aprobado).

### 6.5 `HeroEditorial`
- Grid de 12 columnas en `lg`: col 1 vertical 細部への礼讃 (`laca`, solo `lg`), col 2–7 texto, col 8–12 figura.
- Fondo `linen-tex` con kanji 水 (derecha, arriba) y 土 (centro, abajo) a `text-ink/[.035]`, `aria-hidden`.
- Eyebrow: "El elogio del detalle · Colección I".
- H1: `Confort que <em class="italic text-laca">Renace</em><br/>en Cada Paso`.
- Párrafo de 2–3 líneas (copiar texto del mockup).
- CTA "Descubrir la Colección": borde `ink`, relleno `ink` que sube desde abajo en hover (500 ms), texto cambia a `linen`. Lleva a `#atelier`.
- Enlace secundario en itálica "La materia prima →" a `#materia`.
- Figura: tarjeta `bg-sand aspect-[4/5]` con marco interior `inset-4 border-ink/10`, sol `laca` (30 % del ancho), `KnitTabi` de la pieza destacada, kanji vertical de la pieza. Pie: nombre, "Pieza n.º 07 · Algodón peinado D-200" y `ToneSwatches` con los 4 tonos (estado local, solo visual).

### 6.6 `MateriaCuration`
- Fondo `bg-sand`, `id="materia"`.
- Encabezado en 12 columnas: eyebrow (col 1–3) y H2 "Tres decisiones que *se sienten* antes de verse." (col 4–11).
- Tres filas tipo acordeón (**una sola abierta**; inicia la 01):

| N.º | Título | Resumen | Tag | Kanji |
|---|---|---|---|---|
| 01. | Algodón Peinado Densidad 200 | Suavidad que respira y perdura tras cada lavado. | Fibra natural | 綿 |
| 02. | Patrón Tabi de Punta Dividida | Liberación del pulgar para equilibrar la pisada corporal. | Patrón anatómico | 足袋 |
| 03. | Pigmentos Minerales & Tintes Washi | Colores naturales que no dañan la piel. | Tinte de bajo impacto | 色 |

- Nota expandida: copiar del mockup (`items[].note`).
- Cada fila es `<button aria-expanded>`. Lámina (`BotanicalPlate`, variantes `cotton | tabi | pigment`) a opacidad 60 % cerrada, 100 % abierta; en móvil solo se muestra la lámina de la fila abierta.

### 6.7 `AtelierCatalog`
- `id="atelier"`. Eyebrow "El atelier de calcetas · 工房", H2 "Catálogo de autor".
- Filtros por tono como `role="tablist"`: texto `font-serif text-[17px]`; activo en itálica `laca`.
- Si hay búsqueda activa: "Piezas para “{query}”: {n}".
- Grid: `sm:grid-cols-2 lg:grid-cols-3`, `gap-x-10 gap-y-16`.

### 6.8 `PieceCard`
```txt
props: piece, onAcquire(piece, tone, size)
estado local: tone (primer tono), size ('M'), done (bool, 1.6 s)
```
- Imagen: `bg-sand aspect-[4/5]` con marco interior, `KnitTabi`, "n.º 07" en itálica (arriba izq.), kanji vertical (arriba der.).
- Fila nombre (serif 25 px) + precio (serif 18 px `ink-soft`).
- Material (12.5 px `ink-soft`).
- `ToneSwatches` + nombre del tono en itálica.
- `SizeSelector`.
- Indicador de exclusividad (§4.5) con dot de 6 px.
- Botón "Adquirir Pieza": borde `ink/70`, relleno `ink` que entra desde la izquierda en hover; `active:scale-[.98]`. Tras clic: fondo `matcha`, texto "Pieza reservada ✓" por 1.6 s; luego vuelve.

### 6.9 `CartDrawer`
- Portal a `document.body`. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título.
- Overlay `bg-ink/30`, transición de opacidad 500 ms. Panel `max-w-[460px] bg-linen linen-tex`, entra con `translate-x` 500 ms `ease-out`.
- Respeta `env(safe-area-inset-*)` arriba, abajo y derecha.
- Estructura:
  1. Cabecera: eyebrow "Su selección", título "Bolsa del atelier (n)", botón cerrar.
  2. `BrushProgress` + mensaje en itálica:
     - vacío: "El envío es de cortesía a partir de $799."
     - bajo el umbral: "Faltan **$X** para su envío de cortesía." (`$X` en `laca`, no itálica)
     - alcanzado: "Su envío a cualquier punto de México corre por nuestra cuenta."
  3. Lista de `CartLine` o estado vacío (空 · "Su bolsa aún está vacía" · "Elija una pieza en el atelier.").
  4. Pie `bg-sand/70`: checkbox furoshiki (`accent-color: #606C5A`) con texto "Envolver en furoshiki de lino reutilizable" + "Sin costo. Sin plásticos; el paño sirve después como pañuelo o bolsa."; desglose Subtotal / Envío / IVA incluido (16 %) / **Total MXN**; CTA "Proceder al Pago Seguro" (`bg-laca hover:bg-laca-hover`, deshabilitado si no hay líneas); leyenda "Tarjeta o OXXO Pay".
- El CTA en esta fase solo muestra "Conectando con pago seguro…" 2.2 s. **No** navegar ni llamar API (`// TODO(checkout)`).
- Implementar **focus trap** (Tab/Shift+Tab ciclan dentro del panel).

### 6.10 `CartLine`
- Miniatura `84×100` `bg-sand` con `KnitTabi`.
- Nombre (serif 20 px), importe de línea (serif 17 px), "{tono} · Talla {S|M|L}".
- Stepper circular `−` / cantidad / `+` (`+` deshabilitado en `max`) y botón "Retirar".
- Si `qty >= max`: "Son todos los ejemplares disponibles." en `laca`.

### 6.11 `BrushProgress`
```txt
props: progress: number (0–100), reached: boolean
```
- SVG `viewBox="0 0 620 40"`; path ondulado `M10 22 C 120 14, 220 28, 320 20 S 520 16, 610 22`.
- Pista: `stroke ink` al 12 %, ancho 6. Trazo: `stroke laca`, ancho 7, `strokeDasharray = L`, `strokeDashoffset = L − progress/100 × L`, transición 800 ms.
- Calcular `L` con `pathRef.current.getTotalLength()` en `useLayoutEffect` (el mockup usa 600 fijo; corregirlo).
- Si `reached`: sello cuadrado 48 px, borde `laca` 2 px, texto 無料<br/>配送 en `font-jp`, rotado −6°, animación `animate-stamp`.
- Contenedor con `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=799`, `aria-valuenow={min(subtotal,799)}`, `aria-valuetext="Faltan $X para envío de cortesía"`.

### 6.12 `Filosofia` y `Footer`
- `Filosofia`: banda `bg-ink text-linen`, `id="filosofia"`, kanji 侘寂 en `laca` (col 1–2), cita en serif itálica (col 4–10) y subtítulo "Wabi-sabi · la belleza de lo imperfecto y lo duradero".
- `Footer`: `bg-sand`. Cita ceremonial (texto del mockup) + "— Manifiesto SOKKO"; grid `1.3fr 1fr 1fr 1.2fr` (logo + texto, Atelier, Atención, Atención personalizada con `hola@sokko.mx` como texto seleccionable y horario); tags de sostenibilidad redondos `border-moss/60 text-matcha`; fila inferior con métodos de pago en serif, Aviso de privacidad, Términos y "© 2026 SOKKO ソッコ · NEXUS CODE · UAdeO".

---

## 7. Diferencias obligatorias frente al mockup

| En el mockup | En la implementación |
|---|---|
| Tailwind por CDN y Babel en el navegador | Tailwind compilado por Vite; JSX compilado |
| `Math.random()` para IDs SVG | `useId()` |
| `strokeDasharray` fijo en 600 | `getTotalLength()` real |
| Sin focus trap en el drawer | Focus trap + retorno de foco al disparador |
| Carrito precargado siempre | Precarga solo en `DEV` |
| Búsqueda sensible a acentos | Normalización NFD |
| Datos embebidos en el componente | `services/productService.js` + `data/catalog.mock.js` |
| `body.style.overflow` directo en `App` | `useLockBodyScroll` |

---

## 8. Accesibilidad y responsive (checklist de Fase 8)

- [x] Contraste: `ink-soft` sobre `linen` y `sand` ≥ 4.5:1; `matcha` solo en texto ≥ 11 px; `moss` nunca como texto.
- [x] Todos los kanji y katakana decorativos con `aria-hidden="true"`; los que son contenido (nombre japonés de la pieza) con `lang="ja"`.
- [x] Áreas táctiles ≥ 44 × 44 px en swatches, tallas, stepper, cerrar drawer y menú.
- [x] Navegación completa con teclado: menú, buscador, filtros, acordeón, tarjetas y drawer.
- [x] `prefers-reduced-motion`: sin animaciones de relleno, sello ni scroll suave.
- [x] Breakpoints verificados: 360, 390, 768, 1024, 1280, 1440 px. Sin scroll horizontal en ninguno.
- [x] Gutter lateral mínimo 16 px (`px-4`), 48 px desde `md` (`md:px-12`).
- [x] Imágenes futuras con `alt` descriptivo: "Calceta {nombre} en {tono}".

---

## 9. Contrato esperado de la API (para la siguiente iteración, no implementar ahora)

`GET /api/products?section=home` → `200 OK`

```json
{
  "featuredId": 7,
  "tones": [{ "code": "sumi", "name": "Tinta Sumi", "hex": "#2C2925" }],
  "sizes": [{ "code": "M", "label": "25–27 cm" }],
  "pieces": [{
    "id": 7,
    "pieceNumber": 7,
    "name": "Tabi Origami Noche",
    "nameJp": "折紙・夜",
    "material": "Algodón peinado D-200 · pliegue en empeine",
    "price": 420.00,
    "editionSize": 120,
    "imageUrl": null,
    "variants": [{ "tone": "sumi", "size": "M", "sku": "SKK-007-SUM-M", "stock": 3 }]
  }]
}
```

`GET /api/config` → `{ "freeShippingThreshold": 799, "shippingCost": 99, "ivaRate": 0.16, "fewUnitsThreshold": 4 }`

Implicaciones en BD (para el diseño del esquema SQL Server):
- `Products`: `PieceNumber`, `NameJp`, `Material`, `EditionSize NULL`, `ImageUrl NULL`.
- `ProductVariants`: `ProductId`, `ToneCode`, `SizeCode`, `Sku UNIQUE`, `Stock` (stock por tono **y** talla).
- `Tones` y `Sizes` como catálogos.
- `Orders`: `GiftWrap BIT NOT NULL DEFAULT 1`, `PaymentMethod`, `ShippingCost`, `Subtotal`, `Total`.
- `OrderItems`: `UnitPriceAtPurchase` (precio histórico).

Cuando la API exista, solo cambia `productService.js` (mapear `variants` a `stock[tone][size]`) y `CartContext` lee `max` de la variante exacta.

---

## 10. Definición de terminado

- [x] Las 8 fases con casillas marcadas.
- [x] El Home en `npm run dev` es visualmente equivalente al mockup en escritorio y móvil.
- [x] Todas las interacciones del mockup funcionan: filtro por tono, búsqueda, acordeón de materia, swatches y tallas por tarjeta, "Adquirir Pieza", drawer, pincelada de progreso, sello, furoshiki, cantidades, retirar, desglose con IVA.
- [x] Reglas de §4.4 verificadas manualmente con estos casos:
  - 1 × $420 → falta $379, envío $99, total $519.00, IVA $71.59.
  - 2 × $420 → envío "Cortesía", total $840.00, IVA $115.86, sello visible.
- [x] `CONTEXTO_MAESTRO.md` actualizado (§1.3).
- [ ] PR `feat/home-kyoto-artisan` → `main` con capturas en 1440 px y 390 px.
