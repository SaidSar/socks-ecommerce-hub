# SOKKO · DESIGN_CATALOG_UI.md — Tienda y panel con catálogo multilínea

> **Estado:** aprobado por Said (26-oct-2026).
> **Fuentes:** `DESIGN_DB.md` v0.4.2 (modelo, R-28 a R-32, contratos §3.12) · `DECISIONES_CATALOGO.md` · mockups aprobados en `docs/design/mockups/store-multilinea.html` y `admin-catalogo.html`.
> **Alcance:**
> - `apps/web-store` (rama `said/catalog-store`) y `apps/admin-panel` (rama `said/catalog-admin`).
> - Sin backend: las dos apps siguen con datos simulados, pero **con la forma exacta del contrato de la API**, para que la integración solo cambie la fuente.

---

## 0. Principios

1. **SOKKO Japón es la insignia.** Va primero en el menú, ocupa el hero del Home y mantiene el tratamiento Kyoto completo (Cormorant + Shippori, tonos y kanji). Marcas, Especiales y Accesorios usan los mismos tokens con un registro sobrio: Work Sans, sin kanji ni serif en tarjetas.
2. **Las reglas viven en una sola capa.** La visibilidad por temporada (R-28) y el precio fuera de temporada (R-29) se calculan en `services/catalog` (mock hoy, API mañana). Los componentes **nunca** calculan precio ni deciden visibilidad.
3. **Sin textos de enum escritos a mano.** Las etiquetas salen de `config/enums.js` (tienda) y `domain/enums.js` (panel), igual que en la v0.3.1.
4. **El dinero solo lo ve el Dueño.** Operaciones nunca recibe costo ni margen: ni en la UI ni en los datos que le entrega el servicio mock (R-30).

---

## 1. Tokens

Se mantienen todos los tokens de Kyoto Artisan y del modo de trabajo del panel. **Token nuevo (ambas apps):**

| Token | Valor | Uso |
|---|---|---|
| `--color-ocre-ink` | `#85571F` | Precio con descuento, insignia "Fuera de temporada" (fondo, con texto blanco), aviso de temporada en la ficha. Contraste ≥ 4.5:1 sobre linen y con blanco encima. |

`--color-ocre` (`#B07A3C`) **sigue siendo solo para trazos y bordes**. No se usa para texto.

---

## 2. Datos simulados (ambas apps)

Las semillas reflejan las de DESIGN_DB v0.4.2 §5. Los ejemplos de abajo son el mínimo que debe existir para cubrir todos los casos de UI.

| Línea | Productos mínimos | Casos que cubren |
|---|---|---|
| sokko | Las 6 piezas actuales (SKU sin cambios) | Tonos Kyoto, pocas unidades (Kintsugi, 3) |
| marcas | Nike Everyday Cushion (paquete de 3), Puma Quarter (paquete de 3), Under Armour HeatGear (par), Nike Elite (par) | `UnitsPerPack`, código de barras, filtro por marca |
| especiales | 2 de Navidad (1-nov → 6-ene), 2-3 de Halloween (1-oct → 2-nov), Pokémon (temática Anime), Marvel (temática Superhéroes) | R-28/R-29, colección obligatoria, licencia como marca |
| accesorios | Gorro, guantes (talla guante), bufanda, gorra Nike, lentes, mangas (unitalla) | Sistemas de tallas, "pieza" |

- "Sin marca" tiene `showInFilters: false`.
- Un producto SOKKO **sin costo** (`unitCost: null`), para probar el aviso "sin costo" del panel.
- **Fecha de hoy simulada:** el servicio mock acepta `now` inyectable (por defecto la fecha real en `America/Mazatlan`). En dev se puede forzar con `?hoy=2026-12-15`, solo cuando `import.meta.env.DEV` es verdadero.

### 2.1 Forma de los datos (tienda) = `GET /api/products` y `GET /api/catalog/nav` (§3.12)

```ts
type ProductCard = {
  slug: string; line: "sokko" | "marcas" | "especiales" | "accesorios";
  name: string; nameJp?: string; brand: { name: string; slug: string };
  type: { code: string; unit: "par" | "pieza"; sizeSystem: "calceta" | "guante" | "unitalla" };
  unitsPerPack: number;
  collection?: { slug: string; name: string; kind: "temporada" | "tematica"; inSeason: boolean };
  price: number;            // precio efectivo, ya con R-29 aplicado por el servicio
  listPrice: number;        // precio base; distinto de price solo fuera de temporada
  offSeasonPct?: number;    // 30 si aplica
  colors: { code: string; apiCode: string; name: string; hex: string }[];
  fewUnits: boolean; stock: number;
};
type CatalogNav = {
  lines: { code: string; name: string; count: number }[];
  brands: { slug: string; name: string }[];                    // solo showInFilters = true y con productos visibles
  activeCollections: { slug: string; name: string; start: string; end: string }[];
};
```

- `listProducts({ line, brand, type, collection })` **excluye** los productos de una temporada inactiva (R-28).
- `searchProducts(q)` los **incluye**, con `price` ya rebajado (R-29). La búsqueda no distingue mayúsculas ni acentos.
- `getProduct(slug)` funciona siempre, sin importar la temporada.

### 2.2 Forma de los datos (panel)

Igual que la tienda, más los campos admin. `unitCost` y `margin` **solo** llegan si `role === "owner"`: el servicio construye un DTO distinto para cada rol, no basta con ocultarlos en la UI.

---

## 3. Tienda (`apps/web-store`) — referencia: `mockups/store-multilinea.html`

### 3.1 Rutas

| Ruta | Vista |
|---|---|
| `/` | Home |
| `/linea/:line` | Listado por línea (`sokko`, `marcas`, `especiales`, `accesorios`) |
| `/buscar?q=` | Búsqueda |
| `/producto/:slug` | Ficha |

Si la tienda aún no usa router, usa el mecanismo de navegación actual. Si hace falta agregar `react-router-dom`, justifícalo en el PR.

### 3.2 Header

- **Menú en desktop:** `● SOKKO Japón 日本 · Marcas · Especiales · Accesorios`. El punto laca y el kanji solo van en SOKKO. El ítem activo lleva subrayado de 1 px.
- **Móvil:** segunda fila con el menú horizontal deslizable (sin hamburguesa para las líneas) y un `aria-current` visible.
- **Íconos:** buscar (lleva a `/buscar`), cuenta y bolsa (sin cambios). El logo sigue la regla actual (horizontal o isotipo según la aprobación del cliente).

### 3.3 Home (en este orden)

1. **Hero SOKKO Japón:** el actual con el copy de colección propia. Botones "Ver SOKKO Japón" y la pieza destacada.
2. **Las cuatro líneas:** cuadrícula de 4 bloques, en 2 columnas en móvil. Cada bloque lleva el número de productos visibles, el nombre y una línea de descripción. El bloque de SOKKO va invertido (fondo ink), en serif y con 日本 en `laca-dark-bg`.
3. **SOKKO Japón:** 4 piezas y el enlace "Ver las 6 piezas".
4. **Temporada:** solo si `activeCollections` no está vacío.
   - Fondo sand.
   - **Columna de intro:** kanji de estación (秋 de oct a nov, 冬 de dic a ene; como texto, no como imagen) y el texto "Precio completo del {inicio} al {fin}. Al terminar, estas piezas salen del menú y quedan en el buscador con {pct} % de descuento."
   - Después, hasta 3 productos.
5. **Marcas favoritas:** chips de marca (enlace a `/linea/marcas?brand=`) y los productos de Marcas.
6. **Completa tu look:** 4 accesorios.
7. **Banda de envío:** envío gratis desde $799 en cualquier línea, entrega local $49, pago con tarjeta u OXXO Pay.

### 3.4 Tarjeta de producto

- **Imagen con fondo:** `sand` + textura linen en SOKKO; `#EEE9E2` (o el token equivalente) en las demás líneas.
- **Insignias arriba a la izquierda:**
  - Fuera de temporada → `Fuera de temporada · −30 %` (fondo `ocre-ink`).
  - Temporada activa → nombre de la colección, con borde matcha.
- **Eyebrow:**
  - En SOKKO: nada, o "SOKKO".
  - Con marca: la marca.
  - "Sin marca": el tipo (por ejemplo, "Gorros").
  - En los resultados de búsqueda: la línea.
- **Nombre:** serif de 21 px en SOKKO; Work Sans de 15 px en el resto.
- **Precio + unidad:** "Par", "Pieza" o "Paquete de 3 pares", alineada a la derecha. Si hay descuento: precio en `ocre-ink` y `listPrice` tachado.
- **"Quedan N"** en laca cuando `fewUnits`. La fila del eyebrow debe medir lo mismo con o sin esta etiqueta, para no desalinear la tarjeta.

### 3.5 Listado por línea

- **Encabezado:**
  - SOKKO: serif grande con 日本 en laca y textura linen.
  - Resto: Work Sans de 34 a 44 px.
- **Faceta única por línea** (chips con `aria-pressed`, deslizable en móvil):
  - SOKKO → tono.
  - Marcas → marca (solo `showInFilters`).
  - Especiales → colección (solo visibles).
  - Accesorios → tipo.
- **Especiales:** si hay productos ocultos por temporada, al pie: "Hay N productos de temporadas que no están activas… los encuentras con el buscador, con descuento."
- Contador "X de Y productos".

### 3.6 Búsqueda

- Input grande con `role="search"`.
- Sugerencias en chips: navidad, halloween, nike, guantes, tabi, pokemon.
- Resultados de las cuatro líneas, incluidos los de temporada inactiva, con su insignia.
- Resumen: "N resultados para «q»". Si hay descuentos, a la derecha: `−30 % · N fuera de temporada, con descuento`.
- **Estado vacío:** "Sin resultados para «q»." + "Prueba con el nombre de una marca, una temporada o un tipo de prenda."

### 3.7 Ficha

- **Ruta de navegación:** Inicio / Línea / Producto.
- **Imagen:** con insignia de fuera de temporada; en SOKKO, nombre en kanji vertical.
- **Eyebrow:** `Línea · Marca · Colección`. Omite "Sin marca" y "SOKKO".
- **Precio grande** + "{unidad} · IVA incluido".
  - Fuera de temporada → aviso en `ocre-ink`: "La temporada de {col} ({ventana}) no está activa. Este producto tiene 30 % de descuento mientras tanto."
  - Temporada activa → aviso en matcha: "Temporada de {col} activa hasta el {fin}."
- **Color / Tono:** "Tono" solo en SOKKO; swatches con `aria-pressed` y `aria-label`.
- **Talla según `sizeSystem`:**
  - calceta: S/M/L con cm.
  - guante: S/M/L con medida de palma; la etiqueta dice "Talla (guante)".
  - unitalla: texto "Talla única", sin selector, preseleccionada.
- **Agregar a la bolsa:**
  - Sin talla elegida → error inline "Elige una talla para agregar a tu bolsa." (`role="alert"`, `aria-describedby`).
  - El precio que se envía al carrito es `price` (efectivo).
- **Pie:**
  - "Quedan N pares/unidades" si `fewUnits`.
  - SKU con prefijo de línea.
- **Notas de procedencia:**
  - Marcas: "Original {marca}, con factura del proveedor."
  - Licencia: "Producto con licencia oficial {marca}. Comprado a distribuidor autorizado."
- **"Completa tu look":** 4 accesorios. No se muestra si el producto ya es un accesorio.

### 3.8 Carrito

- El carrito guarda `price` efectivo y `listPrice`. Si cambia de día y una temporada se activa o desactiva, el checkout real recalculará en el servidor (fuera de alcance; deja un `TODO(api)`).
- Las líneas del carrito muestran la unidad ("Paquete de 3 pares").

---

## 4. Panel (`apps/admin-panel`) — referencia: `mockups/admin-catalogo.html`

### 4.1 Navegación

Sidebar con el grupo **Catálogo**: Productos · Marcas · Colecciones · Tipos y tallas, entre Inventario y Configuración. Todo es visible para los dos roles; editar es solo para Dueño.

**Permisos nuevos:**

| Permiso | Dueño | Operaciones |
|---|---|---|
| `catalog.view` | ✅ | ✅ |
| `catalog.edit` | ✅ | ❌ |
| `brands.edit` | ✅ | ❌ |
| `collections.edit` | ✅ | ❌ |
| `types.edit` | ✅ | ❌ |
| `costs.view` | ✅ | ❌ |

Si Operaciones intenta editar, la API mock responde 403.

### 4.2 Dashboard (cambios)

- **KPIs del Dueño:** Ventas, Pedidos, Ticket promedio y **Margen bruto** ("con costo registrado").
- **KPIs de Operaciones:** Unidades vendidas, Pedidos, Por preparar y **Pocas unidades**.
- **Ventas o unidades por línea:**
  - Barras horizontales en un solo tono (`ai`), etiqueta dentro de la barra y "% del total" a la derecha.
  - Punto laca para SOKKO.
  - Clic en una barra → Productos filtrado por esa línea.
- **Solo Dueño:** tabla Línea / Unidades / Ingreso / Margen bruto, con la pill `N sin costo` (warn) cuando faltan costos. Los productos sin costo no entran en el margen.
- **Tarjeta Temporadas:**
  - Cada temporada con su ventana, el stock y una pill de estado:
    - `Activa · termina en N días` (ok).
    - `Fuera · inicia en N días` (warn si faltan 14 días o menos, mute si faltan más).
  - Texto: fuera de temporada los productos salen del menú y del Home, y quedan en el buscador con descuento.
- **Solo Dueño:** Margen por marca. **Solo Operaciones:** la lista Pocas unidades.

### 4.3 Productos

- **Filtro segmentado por línea con contadores**, más búsqueda por nombre.
- **Columnas:** Producto (swatches + nombre) · Línea · Marca · Tipo · unidad · Colección (+ pill Activa/Fuera) · Precio · **Costo** · **Margen** · Stock. Costo y Margen solo para Dueño.
- **Costo nulo** → pill `Falta`. **Margen menor a 30 %** → texto en tono warn.
- **Stock de 4 o menos** → pill crit.
- **Operaciones:** banner "Como Operaciones ves stock y datos del catálogo. El costo y el margen solo los ve el Dueño."

**Formulario lateral** (560 px; pantalla completa en móvil):
- **Línea:** control segmentado. Al cambiarla se ajustan:
  - la marca (SOKKO ↔ las demás);
  - la colección (se limpia si la línea no es Especiales);
  - los colores (solo tonos Kyoto en SOKKO; el resto, sin ellos).
- **Campos:**
  - Nombre.
  - Marca.
  - Tipo, con la ayuda "Tallas: {sistema} (S / M / L) · se cuenta por {unidad}".
  - Colección (\* en Especiales; con temporada, la ayuda dice la ventana y el descuento).
  - Unidades por paquete (ayuda: "Se vende como Paquete de N…, cuenta como 1 unidad de stock").
  - Precio.
  - **Costo** (solo Dueño; ayuda con margen en $ y %; para Operaciones, campo bloqueado "Solo Dueño").
- **Variantes:** se generan por color × talla del sistema.
  - **Columnas:** SKU automático `{PREFIJO}-{id3}-{COLOR}-{TALLA}` en monoespaciada, Color, Talla con medida, Código de barras (placeholder "UPC del proveedor" en Marcas) y Stock en solo lectura.
  - Nota: "El stock se ajusta en Inventario."
- **Validaciones** (al intentar guardar; se muestran inline con `aria-invalid` y `aria-describedby`):

| Regla | Mensaje |
|---|---|
| R-31 | Elige una colección: es obligatoria en Especiales. |
| R-32 | SOKKO Japón solo admite la marca propia SOKKO. |
| R-32 | La marca SOKKO es exclusiva de la línea SOKKO Japón. |
| R-32 | Los tonos Kyoto (…) son exclusivos de SOKKO Japón. |
| R-30 | El costo no puede ser negativo. |
| — | Escribe el nombre del producto. |
| UNIQUE | Ese código de barras ya está en {SKU}. |

- **Pie:** "Revisa los campos marcados." cuando hay errores · Cancelar · **Guardar producto**. Al guardar sale el toast "Producto {nombre} guardado".

### 4.4 Marcas

- **Tabla:** Marca (pill "Marca propia" en SOKKO) · Líneas donde se usa · Productos · interruptor **Mostrar en el filtro de la tienda** (`role="switch"`, deshabilitado en SOKKO: "Siempre visible").
- **Nueva marca:** fila inline con nombre y validación de duplicados ("Ya existe la marca X.", sin distinguir mayúsculas).
- Una marca con productos **no se borra**; se oculta.
- **Nota al pie:** las licencias usan la licencia como marca; los genéricos usan "Sin marca", oculta en el filtro.

### 4.5 Colecciones

- **Tabla:** Colección · Tipo · Ventana anual · Hoy (pill) · Desc. fuera · Productos. La fila seleccionada se resalta.
- **Editor a la derecha** (debajo en pantallas menores a xl):
  - **Tipo** segmentado: Temporada o Temática. En Temática, texto "sin fechas; visibles todo el año, sin descuento automático".
  - **Inicia y Termina:** día (1–31) y mes (enero…diciembre).
    - Error si el día no existe en el mes: "Ese día no existe en el mes elegido (el 29 de febrero no se acepta)."
  - **Barra anual:** 12 meses, la ventana en matcha (con dos segmentos si cruza de año) y una marca laca en el día de hoy. `aria-hidden`; la información también está en texto.
  - **Descuento fuera de temporada:** deslizador de 0 a 60 % en pasos de 5, con el valor y el ejemplo "$199 → ${precio}".
  - **Comprobación:** inicio, fin, 31-dic y 7-ene → "en temporada / fuera". Indica "(cruza de año)" cuando aplica.
  - **Productos en la colección**, con el precio fuera de temporada cuando aplica.
  - Botones: Descartar · **Guardar colección**.
- La lógica de "en temporada hoy" es **la misma función** que usa la tienda (`isInSeason(window, date)`), con zona `America/Mazatlan`.

### 4.6 Tipos y tallas

- Tabla de tipos: Tipo · Sistema · Tallas con medida · Se cuenta por (pill par o pieza) · Productos.
- Tarjetas de los 3 sistemas de tallas.
- Nota de P-13 pendiente.
- Solo lectura en v1; la edición queda para después.

### 4.7 Otros cambios en el panel

- **Inventario, Pedidos e importación CSV:**
  - "pares" → "unidades" en los mensajes (R-27 incluido: "No puede sacar más de N unidades; M están apartadas…"). Excepción: los productos de tipo calcetas sin paquete.
  - **CSV:** columnas nuevas `line, brand, type, collection, units_per_pack, unit_cost, barcode`.
    - Validación por fila con las mismas reglas del formulario.
    - `unit_cost` se ignora (con aviso) si quien importa no es Dueño.
- **Configuración:** "Pocos pares" → **"Pocas unidades"** (mismo umbral, 4).

---

## 5. Accesibilidad y calidad (ambas apps)

- Todos los chips y segmentados usan `aria-pressed`; los interruptores, `role="switch"` + `aria-checked`.
- Precio tachado: `<s>` con texto accesible "Precio anterior $199".
- Contraste AA verificado con el token `ocre-ink`.
- Sin scroll horizontal a 360 px; las tablas del panel van dentro de un contenedor con `overflow-x: auto`.
- `prefers-reduced-motion` respetado.

## 6. Pruebas mínimas (vitest)

| Área | Casos |
|---|---|
| `isInSeason` | Ventana normal y ventana que cruza de año (30-nov, 1-nov, 31-dic, 6-ene, 7-ene), temática siempre activa. |
| Precio efectivo | Fuera de temporada: 199 → 139.30. Temporada activa: precio base. Temática: precio base. |
| Servicio de catálogo | `listProducts` excluye la temporada inactiva; `searchProducts` la incluye rebajada; búsqueda sin acentos ("pokemon" encuentra "Pokémon"). |
| Panel: validaciones | R-31, R-32 (×3), costo negativo, código de barras duplicado. |
| Panel: permisos | Operaciones no recibe `unitCost` ni `margin` en el DTO y recibe 403 al editar marca, colección o producto. |
| Panel: margen | Excluye productos sin costo; pill "N sin costo". |

## 7. Criterios de aceptación

- [ ] La tienda reproduce el mockup aprobado en 1440 px y 390 px: Home, línea, búsqueda y ficha.
- [ ] Con `?hoy=2026-10-26`: Halloween aparece en el Home y Navidad solo por búsqueda, a $139.30.
- [ ] Con `?hoy=2026-12-15`: Navidad aparece en el Home y Halloween pasa a −30 % en la búsqueda.
- [ ] El panel reproduce el mockup aprobado: Dashboard, Productos con formulario, Marcas, Colecciones y Tipos, en las vistas Dueño y Operaciones.
- [ ] Ningún componente calcula precio ni visibilidad; todo sale del servicio.
- [ ] `npm run lint`, `npm test` y `npm run build` pasan en ambas apps, y el CI queda en verde.
