# SOKKO · Decisiones del catálogo multilínea (v1)

> Estado: **Acordado con el cliente (26-oct-2026)**. Fuente para actualizar `DESIGN_DB.md` a **v0.4** y para los cambios de tienda y panel.
> Alcance: solo **catálogo**. Pedidos, envíos, pagos, usuarios, zonas y configuración no cambian.

## 1. Contexto de negocio

- La marca y el valor de la empresa son las **calcetas de estilo japonés** de diseño propio. En Los Mochis son un nicho, así que venden menos.
- Para generar volumen, el cliente agrega líneas de mayor rotación local. La línea japonesa **sigue siendo la insignia**.
- Objetivo: que cualquier visitante, sea de nicho o público general, encuentre algo que comprar, sin que SOKKO pierda su posicionamiento premium.

## 2. Líneas de producto

| Código | Nombre en tienda | Qué incluye | Papel |
|---|---|---|---|
| `sokko` | SOKKO Japón | Diseños propios del cliente | **Insignia**: hero de Home, primer lugar en el menú, estética Kyoto completa |
| `marcas` | Marcas | Nike, Puma, Under Armour… (reventa de originales) | Volumen |
| `especiales` | Especiales | Temporada (Navidad, Halloween…) y temáticas (anime, superhéroes…) | Picos de venta |
| `accesorios` | Accesorios | Gorras, gorros, guantes, bufandas, mangas, lentes | Venta cruzada; se venden **todo el año** |

## 3. Decisiones del cliente

| # | Pregunta | Respuesta |
|---|---|---|
| C-01 | "Personalizadas": ¿diseños hechos o a pedido? | **Diseños temáticos ya hechos, en stock.** Se venden como cualquier producto; no hay flujo de pedido a la medida. En la tienda se llaman **"Especiales"**, no "Personalizadas", para no prometer personalización. |
| C-02 | Productos de temporada fuera de fecha | **Se ocultan** de la navegación, el Home y los listados, pero **sí aparecen en la búsqueda y por URL directa, con descuento de fuera de temporada.** |
| C-03 | ¿Registrar el costo de compra? | **Sí.** Costo por variante, para ver margen en el panel (solo Dueño). |
| C-04 | Accesorios | **Todo el año**; no dependen de temporada. |

## 4. Decisiones técnicas propuestas (pendientes de validar por Said)

| # | Decisión | Motivo |
|---|---|---|
| T-01 | **Línea** como enum `VARCHAR + CHECK` (`sokko`, `marcas`, `especiales`, `accesorios`) en `Products.Line`. | Son 4 fijas, igual que los demás enums de §1.6; no justifican una tabla. |
| T-02 | Tabla **`Brands`** (Id, Name, Slug, IsOwnBrand). SOKKO es `IsOwnBrand = 1`. `Products.BrandId` obligatorio. | Filtro "por marca" en Marcas y reportes por marca. |
| T-03 | Tabla **`ProductTypes`** (calcetas, gorras, gorros, guantes, bufandas, mangas, lentes) con `SizeSystem` y `UnitLabel` (`par` / `pieza`). | El tipo define qué tallas aplican y cómo se cuenta. |
| T-04 | **`Sizes` por sistema de tallas**: `Sizes(Id, SizeSystem, Code, Label, SortOrder)`. Sistemas: `calceta` (S/M/L u otras), `guante` (S/M/L), `unitalla` (gorras, gorros, bufandas, mangas, lentes). CHECK de que la talla de la variante pertenezca al sistema de su tipo (validación en servicio y trigger opcional). | Las 3 tallas fijas actuales no alcanzan para accesorios. |
| T-05 | **`Tones` → `Colors`** (Code de 3 letras, Name, Hex, `IsSokkoTone`). Los 4 tonos Kyoto quedan con `IsSokkoTone = 1`; las demás líneas usan colores o diseños genéricos (NEG, BLA, MUL…). | Una sola tabla de color o diseño para todas las líneas. Los tonos Kyoto siguen exclusivos de SOKKO. |
| T-06 | Tabla **`Collections`** (Id, Name, Slug, Kind `temporada` / `tematica`, `StartsAt`, `EndsAt`, `OffSeasonDiscountPct`). `Products.CollectionId` opcional; obligatorio si la línea es `especiales`. Las temáticas no tienen fechas: siempre visibles. | Modela Navidad, Halloween, Anime, Superhéroes… y sus fechas. |
| T-07 | **Regla de visibilidad (R-28):** un producto de una colección `temporada` fuera de `[StartsAt, EndsAt]` se excluye de listados, Home y navegación; se incluye en `GET /api/products?q=` y en `GET /api/products/{slug}`. | Implementa C-02. |
| T-08 | **Precio fuera de temporada (R-29):** se calcula **en el servidor** como `Price × (1 − OffSeasonDiscountPct)`, redondeado a 2 decimales. La tienda muestra el precio original tachado. El precio cobrado queda en `OrderItems.UnitPrice` (histórico, ya existe). Valor por defecto: **30 %**, editable por el Dueño en cada colección. | El cliente pidió descuento; el porcentaje es configurable. |
| T-09 | **Costo (R-30):** `ProductVariants.UnitCost DECIMAL(10,2) NULL`, con CHECK `>= 0`. Solo el Dueño lo ve y lo edita; Operaciones no recibe el campo en la API (DTO distinto). Margen = `UnitPrice − UnitCost`, calculado en reportes; no se guarda. | Implementa C-03 y respeta "Operaciones sin dinero". |
| T-10 | **Unidad genérica:** el sistema cuenta **unidades vendibles**. La UI usa `ProductTypes.UnitLabel` ("par", "pieza") y `Products.UnitsPerPack` (por defecto 1; 3 para un paquete Nike de 3 pares, que se vende como **una** unidad). El ajuste "pocos pares" pasa a llamarse "pocas unidades", con el mismo umbral de 4. | Ahora conviven calcetas sueltas, paquetes y accesorios. |
| T-11 | **Formato del SKU:** `{LÍNEA}-{id 3 dígitos}-{COLOR 3}-{TALLA}`, con prefijos `SKK` (sokko), `MRC` (marcas), `ESP` (especiales) y `ACC` (accesorios). **Los SKU de SOKKO no cambian.** El CHECK del SKU se actualiza para aceptar los 4 prefijos. | Identificar la línea a simple vista y mantener compatibles las semillas. |
| T-12 | `ProductVariants.Barcode VARCHAR(32) NULL UNIQUE` (código de barras o UPC del proveedor). | Las marcas traen código de barras; facilita inventario y búsqueda. |
| T-13 | **Paquetes armados** (por ejemplo, gorro + bufanda + calcetas): **fuera de v1.** | El cliente no lo pidió; se puede agregar después como `Bundles`. |

> **Ajustes de la revisión (Said, `DESIGN_DB` v0.4.2):** T-06 y T-07 usan una **ventana anual recurrente** (`StartMonth`, `StartDay`, `EndMonth`, `EndDay`, inclusiva, puede cruzar de año) en lugar de `StartsAt`/`EndsAt` con fechas fijas, para que Navidad y Halloween no se capturen cada año. Los productos licenciados usan como marca la licencia y los genéricos la marca "Sin marca" (P-15). El precio efectivo es una capacidad de `CatalogService` (P-17).

## 5. Impacto por componente

### Base de datos (Carlos)
- **Nuevas:** `Brands`, `ProductTypes`, `Collections`.
- **Cambian:** `Products` (Line, BrandId, ProductTypeId, CollectionId, UnitsPerPack), `Sizes` (SizeSystem), `Tones → Colors`, `ProductVariants` (UnitCost, Barcode, CHECK del SKU) y `Users` (`PreferredSizeCode` → `PreferredSizeId`, porque el código de talla deja de ser único con las tallas por sistema; la API no cambia. `DESIGN_DB` P-16).
- **Reglas nuevas:** R-28 (visibilidad por temporada), R-29 (precio fuera de temporada), R-30 (costo solo para el Dueño).
- **Semillas:** se conservan las 6 piezas SOKKO. Se agregan como ejemplo 2 de Marcas (una de ellas un paquete de 3), 3 Especiales (Navidad, Halloween y una temática) y 3 Accesorios (gorro, guantes, lentes), con colecciones y fechas.
- **Sin cambios:** PasswordResetTokens, Orders, OrderItems, OrderStatusHistory, Shipments, Settings, LocalDeliveryZones, InventoryMovements (solo cambia la etiqueta de unidad).

### API
- `GET /api/products`: filtros `line`, `brand`, `type`, `collection`; aplica R-28.
- `GET /api/products?q=`: búsqueda que incluye la temporada inactiva, con el precio de R-29.
- `GET /api/catalog/nav`: líneas, marcas con productos visibles y colecciones activas, para armar el menú.
- Admin: CRUD de Brands, Collections y ProductTypes (solo Dueño). Los DTO de variante tienen dos formas: con costo (Dueño) y sin costo (Operaciones).

### Tienda (web-store)
- **Menú:** SOKKO Japón · Marcas · Especiales · Accesorios · Buscar.
- **Home:** el hero sigue siendo SOKKO Japón. Debajo van "Temporada" (solo si hay una colección activa), "Marcas favoritas" y "Completa tu look" (accesorios).
- **Ficha:** la etiqueta de línea, el precio tachado si aplica R-29, la tabla de tallas según el tipo y la unidad ("par" / "paquete de 3 pares" / "pieza").
- **Búsqueda:** página de resultados nueva; muestra la temporada inactiva con la insignia "Fuera de temporada · −30 %".
- **Estética:** todo el sitio sigue en Kyoto Artisan. SOKKO Japón usa la tipografía serif y los tonos completos; las demás líneas, la versión sobria (Work Sans).

### Panel (admin-panel)
- **Formulario de producto:** línea, marca, tipo (que filtra las tallas), colección, unidades por paquete, costo (solo Dueño) y código de barras.
- **Pantallas nuevas:** Marcas, Colecciones (con fechas y % de descuento) y Tipos.
- **KPIs:** ventas por línea; margen por línea o marca (solo Dueño).
- **Importación CSV:** columnas nuevas (line, brand, type, collection, unit_cost, barcode).

## 6. Pendientes con el cliente
- **P-04:** el % de descuento fuera de temporada (propuesto: 30 %).
- **Licencias:** las calcetas de anime y superhéroes deben ser **mercancía con licencia oficial** comprada a distribuidor. Las de Marcas deben ser **originales**, con factura del proveedor. Diseñar o estampar personajes o logotipos ajenos sin licencia es infracción de derechos de autor y de marca.
- **P-05:** las tallas reales de las calcetas comerciales y de los guantes (¿S/M/L o rango de número de calzado?).
