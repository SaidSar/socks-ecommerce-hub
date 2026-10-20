# DESIGN_ADMIN.md — Panel administrativo · SOKKO (ソッコ)

> **Propósito:** especificación ejecutable para que Claude Code construya el backoffice de SOKKO como una **aplicación nueva** `apps/admin-panel` dentro del monorepo.
> **Referencia visual y de copy:** `docs/design/mockups/admin-panel.html` (fuente de verdad visual, de textos y de interacciones).
> **Decisiones del cliente:** `docs/design/DECISIONES_ADMIN.md` (roles, entregas, tarifas, importación desde Excel, KPI principal).
> **Hereda de:** `docs/design/DESIGN.md` (tokens de marca) y `docs/brand/README.md` (uso del logotipo).
> **Alcance:** solo frontend. **No hay backend todavía**: los datos son simulados detrás de `src/services/adminApi.js` y la app queda lista para conectarse a `/api/admin/*`.

---

## 0. Instrucciones para Claude Code

1. Lee `CONTEXTO_MAESTRO.md`, `docs/design/DESIGN.md`, `docs/brand/README.md`, `docs/design/DECISIONES_ADMIN.md`, este archivo y el mockup antes de escribir código.
2. Rama `said/frontend-admin` desde `main` actualizado. Un commit por fase (§8): `feat(admin-panel): fase N — <resumen>`.
3. Al terminar cada fase, desde `apps/admin-panel`: `npm run build`, `npm run lint` y `npm test` sin errores ni warnings. Marca las casillas de la fase.
4. **No toques `apps/web-store` ni `apps/api-service`** salvo lo indicado en §1.3 (scripts raíz y documentación).
5. Usa las **mismas versiones** de React, Vite, Tailwind y ESLint que `apps/web-store` (revisa su `package.json`). Sin librerías de UI, de gráficas ni de formularios. Solo se permite `react-router-dom` y `vitest` (devDependency).
6. El mockup usa Tailwind por CDN, Babel en el navegador, `Math.random` sembrado y un selector de rol de demostración: nada de eso pasa al código (§10).
7. Ante una duda de diseño, replica el mockup y deja `// TODO(design):`. Todo punto de integración con la API lleva `// TODO(api):`.

---

## 1. Arquitectura

### 1.1 Lugar en el monorepo (SOA)

```text
socks-ecommerce-hub/apps/
├── web-store/     consumidor público   (compradores)
├── admin-panel/   consumidor interno   (Dueño y Operaciones)   ← NUEVO
└── api-service/   proveedor único      (.NET + SQL Server)
```

Un proveedor, dos consumidores ligados al mismo contrato OpenAPI (grupos `public` y `admin`). El código del panel nunca se incluye en el bundle de la tienda.

### 1.2 Estructura de `apps/admin-panel`

```text
apps/admin-panel/
├── index.html                    <title>SOKKO · Panel</title>, favicon, theme-color #F4F0EB, <meta name="robots" content="noindex">
├── package.json                  name "@sokko/admin-panel"; scripts dev (puerto 5174), build, preview, lint, test
├── vite.config.js                server.port 5174
├── eslint.config.js              misma configuración que web-store
├── public/favicon.svg            copia byte a byte de apps/web-store/public/favicon.svg
├── README.md                     cómo correrlo y cuentas demo
└── src/
    ├── main.jsx · App.jsx        providers + router
    ├── index.css                 @theme con tokens de §2
    ├── assets/brand/             copia byte a byte de sokko-logo-horizontal.svg y sokko-isotipo.svg (no editar)
    ├── config/roles.js           permisos por rol (§3)
    ├── data/seed.js              datos de ejemplo deterministas (§6.1)
    ├── services/adminApi.js      API simulada (§6.2)
    ├── context/AdminAuthContext.jsx · AdminDataContext.jsx
    ├── hooks/useAdminAuth.js · useAdminData.js · useWidth.js · useLockBodyScroll.js
    ├── domain/                   lógica pura con pruebas (§5)
    │   ├── orders.js · shipping.js · inventory.js · importCsv.js · dashboard.js
    │   └── *.test.js
    ├── utils/format.js           formatMXN, formatDate, formatTime
    ├── components/
    │   ├── layout/ AppShell, Sidebar, Topbar, UserMenu, PageHeader
    │   ├── ui/ Button, Card, CardHead, StatusChip, StockChip, Tabs, SearchField, Icon, EmptyState, SidePanel, Modal
    │   ├── charts/ SalesChart, HBars
    │   ├── dashboard/ KpiRow, WorkQueue, InventoryAlerts, TopPieces, SizeShare, LimitedEditions, RecentOrders
    │   ├── orders/ OrdersTable, OrderDetail, NextStepBox, OrderHistory, CancelOrder
    │   ├── inventory/ InventoryTable, StockPanel, MovementForm, Kardex, ImportCsvModal
    │   └── settings/ ShippingSettings, LocalZoneSettings, InventorySettings, InternalUsers
    └── pages/ Login, Dashboard, Orders, Inventory, Settings, ComingSoon, Forbidden, NotFound
```

### 1.3 Cambios fuera de la app (únicos permitidos)
- `package.json` raíz (si existe) o `README.md` raíz: comando para correr el panel (`npm --prefix apps/admin-panel run dev`).
- `CONTEXTO_MAESTRO.md`: agrega `apps/admin-panel` a la estructura oficial y a la sección SOA (consumidor interno).
- `.gitignore`: nada nuevo si ya cubre `node_modules/` y `dist/` en subcarpetas.

---

## 2. Identidad visual (modo de trabajo)

Misma marca que la tienda, otro ritmo: denso, sans primero, sin flourishes editoriales.

| Token | Hex | Uso |
|---|---|---|
| `linen` | `#F4F0EB` | Fondo del área de trabajo |
| `paper` | `#FFFFFF` | Tarjetas, tablas, paneles |
| `sand` / `sand-2` | `#ECE5DC` / `#E3DACD` | Barra lateral, chips neutros, hover |
| `line` | `#DDD5CA` | Bordes y separadores |
| `ink` / `ink-soft` | `#23211E` / `#6A645C` | Texto principal / secundario |
| `laca` / `laca-hover` | `#A62B2B` / `#8F2424` | Acción principal y alertas críticas **únicamente** |
| `matcha` | `#5A6654` | Variaciones positivas, confirmaciones |
| `ai` | `#2F5E9E` | Serie principal de gráficas, foco, enlaces de acción |
| `ocre` | `#B07A3C` | Serie de comparación (periodo anterior), "Por preparar" |
| `ok-bg` / `warn-bg` / `crit-bg` / `info-bg` | `#E7ECE3` / `#F4E7D3` / `#F3DEDB` / `#E3E9F2` | Fondos de estado |

- Par de gráficas **Ai `#2F5E9E` + Ocre `#B07A3C`** validado (banda de luminosidad, croma, separación CVD y contraste ≥ 3:1). No agregar series con otros colores sin validar.
- Tipografía: **Work Sans** 400/500/600 en toda la interfaz; **Cormorant Garamond** solo en el `h1` de cada página; Shippori Mincho solo para el kanji decorativo de "Próximamente".
- Cifras con `font-variant-numeric: tabular-nums`.
- Radios: `rounded-md` en controles, `rounded-lg` en tarjetas. Sombra solo en paneles flotantes y menús.
- Logo: horizontal (`h-9`) en la barra lateral con etiqueta "Admin"; isotipo (`h-8`) en la barra superior móvil. Nunca editar ni recolorear.

---

## 3. Roles y permisos

| Rol | Ve | No ve |
|---|---|---|
| **Dueño** | Todo: cifras en pesos, catálogo, clientes, finanzas, promociones, configuración, importar inventario | — |
| **Operaciones** | Dashboard sin pesos, Pedidos (sin columna Total), Inventario (ajustes y kárdex), Envíos | Cifras en pesos, Catálogo, Clientes, Finanzas, Promociones, Configuración, Importar desde Excel |

- `config/roles.js` define `can(role, permission)` con permisos: `money.view`, `orders.manage`, `inventory.adjust`, `inventory.import`, `settings.manage`, `catalog.manage`, `customers.view`, `finance.view`, `promotions.manage`, `shipping.view`.
- La barra lateral solo muestra secciones permitidas. Una ruta no permitida muestra `Forbidden` ("Esta sección es solo para el Dueño." + botón "Ir al dashboard").
- Sin selector de rol en la app final: el rol viene de la sesión (§4).

---

## 4. Acceso al panel

- Ruta `/login`. Sin registro público, sin recuperación automática ("¿Olvidó su contraseña? Pídale al Dueño que la restablezca").
- Diseño: tarjeta centrada `max-w-sm` sobre `linen`, logo horizontal arriba, título serif "Panel SOKKO", campos Correo y Contraseña (mostrar/ocultar), botón laca "Entrar".
- Mensajes: correo vacío "Escriba su correo." · formato "Revise el formato del correo." · credenciales "El correo o la contraseña no coinciden." (sin revelar cuál).
- Cuentas demo (solo visibles en `import.meta.env.DEV`):

| Rol | Nombre | Correo | Contraseña |
|---|---|---|---|
| Dueño | Aiko Morales | `hola@sokko.mx` | `Kyoto2026` |
| Operaciones | Daniel Ruiz | `daniel@sokko.mx` | `Operaciones2026` |
| Operaciones | Kevin Armenta | `kevin@sokko.mx` | `Operaciones2026` |

- Sesión en `sessionStorage` `sokko.admin.session.v1` (se cierra al cerrar la pestaña), envuelta en `try/catch`. Contraseñas del mock hasheadas con SHA-256 (`// TODO(api): el hash vive solo en el servidor`).
- Todas las rutas salvo `/login` requieren sesión; sin sesión redirige a `/login?redirect=<ruta>` (solo rutas internas).
- Menú de usuario (iniciales, nombre, rol): "Cerrar sesión".

---

## 5. Reglas de dominio (funciones puras con pruebas en `src/domain/`)

### 5.1 Pedidos — `orders.js`

Estados: `por_preparar`, `preparando`, `enviado`, `en_ruta`, `entregado`, `cancelado`. Etiquetas y colores exactamente como el mockup (`STATUS`).

| Desde | Paquetería → | Local → | Botón | Requisito |
|---|---|---|---|---|
| `por_preparar` | `preparando` | `preparando` | Empezar a preparar | — |
| `preparando` | `enviado` | `en_ruta` | Marcar como enviado / Salir a ruta | Paquetería: paquetería (Estafeta, DHL Express) + guía `^\d{10,}$`. Local: repartidor |
| `enviado` / `en_ruta` | `entregado` | `entregado` | Confirmar entrega | — |
| `por_preparar` / `preparando` | `cancelado` | `cancelado` | Cancelar pedido | Confirmación en línea |

- `nextStatus(order)`, `nextLabel(order)`, `canCancel(order)`, `isLate(order, now)` (en `por_preparar` o `preparando` con más de 48 h desde la creación).
- Cada transición agrega `{ status, at, by }` al historial.
- **Efecto en inventario** (lo aplica `adminApi`, no el componente):
  - Pedido pagado → aparta pares (`reserved += qty`).
  - Paso a `enviado`/`en_ruta` → `stock -= qty`, `reserved -= qty`, movimiento de kárdex "Venta · Pedido {folio}".
  - `cancelado` → `reserved -= qty` (libera).
- Error de guía: "Escriba el número de guía (solo dígitos, mínimo 10)."

### 5.2 Envíos — `shipping.js`

```txt
computeShipping({ subtotal, postalCode }, settings) → { method: 'local' | 'paqueteria', cost }
isLocalPostalCode(cp, zones) → boolean   // zones: ["81200-81299", "81300-81399", "81250", ...]
```
- Local si el CP cae en algún rango o código de la zona; si no, paquetería.
- `subtotal >= freeShippingThreshold` → costo 0 (para local solo si `localFreeShipping` es `true`).
- Si no, `localShippingCost` (49) o `parcelShippingCost` (99).
- Validación de CP o rango: `^\d{5}(\s*[–-]\s*\d{5})?$`, rango con inicio ≤ fin. Error: "Escriba un código postal de 5 dígitos o un rango, por ejemplo 81280–81290."

### 5.3 Inventario — `inventory.js`
- `available = stock − reserved`. `stockState(available, fewThreshold)` → `agotado` (≤ 0) · `pocos` (≤ umbral) · `ok`.
- Movimientos: `Entrada` (+), `Merma` (−, motivo obligatorio, no mayor al stock), `Devolución` (+, motivo obligatorio), `Conteo físico` (fija el stock al número contado; registra la diferencia), `Venta` (automático), `Inventario inicial` (importación).
- Cada movimiento guarda `{ sku, type, qty (delta firmado), balance, date, user, note }`. El kárdex se muestra del más reciente al más antiguo y el saldo nunca es negativo.
- Mensajes: "Escriba una cantidad mayor a 0." · "Escriba cuántos pares contó (0 o más)." · "No puede sacar más de {n} pares." · "Escriba el motivo para la bitácora."

### 5.4 Importación — `importCsv.js`
- **v1 acepta CSV** (Excel → Guardar como CSV UTF-8). Columnas obligatorias en este orden: `SKU, Pieza, Tono, Talla, Stock`. Separador `,` o `;` autodetectado; encabezados sin distinción de mayúsculas ni acentos.
- Por fila: SKU debe existir en el catálogo ("El SKU no existe en el catálogo") · Stock entero ≥ 0 ("El stock no puede ser negativo" / "El stock debe ser un número entero") · SKU repetido en el archivo ("SKU repetido en el archivo; se usa la primera fila").
- Vista previa con conteo de válidas y con error; "Aplicar N filas" solo aplica válidas como movimiento `Inventario inicial · Importado desde CSV`.
- Botón "Descargar plantilla" genera un CSV con los SKU actuales y su stock (Blob + `<a download>`).
- `// TODO(design): .xlsx en P1 con SheetJS desde cdn.sheetjs.com (no el paquete de npm, desactualizado).`

### 5.5 Dashboard — `dashboard.js`
- Rango `hoy` (predeterminado) · `7d` · `30d`.
- KPIs: Ventas (hoy: "Ventas de hoy" contra el mismo día de la semana anterior; 7d/30d: "Ventas netas" contra el periodo previo), Pedidos, Ticket promedio, % con envío gratis. Variación con flecha y signo; positiva en `matcha`, negativa en `laca`.
- Cola: Por preparar · En preparación · Atrasados +48 h · En ruta local; cada una navega a Pedidos filtrado.
- Más vendidas (pares), Ventas por talla (%), Ediciones limitadas (restantes de tiraje; alerta < 20 %), Últimos 5 pedidos.
- Operaciones: sin tarjetas en pesos; la gráfica se reemplaza por el aviso "Las ventas en pesos solo las ve el Dueño".

### 5.6 Pruebas mínimas (`vitest`)
- `orders.test.js`: transiciones por método, guía inválida/válida, `isLate` a 47 h y 49 h, cancelación solo en estados permitidos.
- `shipping.test.js`: CP local en rango, fuera de rango, código suelto, umbral exacto 799 (gratis), 798 local (49) y paquetería (99), `localFreeShipping=false`.
- `inventory.test.js`: cada tipo de movimiento, merma mayor al stock, conteo físico con diferencia negativa, estados de stock.
- `importCsv.test.js`: separador `;`, encabezados con acentos, SKU inexistente, stock negativo, decimal, duplicado.

---

## 6. Datos simulados

### 6.1 `data/seed.js`
- Generador **determinista** (PRNG sembrado, p. ej. mulberry32 con semilla fija) con `NOW` fijo en desarrollo = 2026-10-18 09:30 (`// TODO(api): usar fecha del servidor`).
- Catálogo: las 6 piezas de `apps/web-store/src/data/catalog.mock.js` (importar sus datos copiados, no la ruta) con tonos × tallas S/M/L → SKU `SKK-{id 3 dígitos}-{3 letras del tono}-{talla}`. Ediciones: Tabi Origami Noche 120, Kintsugi Washi 80.
- ~34 pedidos de los últimos 15 días con mezcla de estados, métodos de entrega (local para Los Mochis/Ahome), pagos Tarjeta/OXXO Pay, furoshiki, historial coherente.
- 30 días de ventas diarias + periodo anterior para la gráfica.
- Kárdex coherente por SKU (empieza con Entrada; saldo nunca negativo; termina en el stock actual).
- Configuración inicial: umbral 799, paquetería 99, local 49, local gratis desde umbral = true, umbral de pocos pares 4, zona `81200-81299` (Los Mochis) y `81300-81399` (Ejidos de Ahome · por confirmar).

### 6.2 `services/adminApi.js`
API asíncrona (latencia 200–500 ms) con estado en memoria persistido en `localStorage` `sokko.admin.data.v1` (try/catch; si falla, solo memoria). Funciones:

```txt
getDashboard(range)                 getOrders({ filter, q })            getOrder(id)
advanceOrder(id, payload, user)     cancelOrder(id, user)               saveOrderNote(id, note)
getInventory({ filter, q })         getMovements(sku)                   adjustStock(sku, { type, qty, note }, user)
previewImport(csvText)              applyImport(rows, user)             getSettings()  saveSettings(settings)
getInternalUsers()                  resetDemoData()   // solo DEV, botón en el menú de usuario
```

Cada función lleva su `// TODO(api):` con el endpoint de §9. Los componentes solo hablan con `useAdminData()`, nunca con `seed.js`.

---

## 7. Pantallas (detalle de interacción en el mockup)

**AppShell:** barra lateral fija de 248 px (`sand`) en `lg+`; en móvil, barra superior con botón de menú que abre la lateral como panel. Barra superior: buscador global (Enter → Pedidos con la búsqueda), campana con número de atrasados (→ Pedidos filtro Atrasados), menú de usuario. Encabezado de página con `h1` serif y subtítulo. Secciones sin construir muestran `ComingSoon` con la lista del mockup.

**Dashboard (`/`):** §5.5. Gráfica SVG propia (`SalesChart`): dos series, cuadrícula tenue, etiquetas cada 7 días, punto final enfatizado, crosshair + tooltip al pasar el cursor, `role="img"` con `aria-label` y tabla equivalente oculta (`sr-only`) con los 30 valores.

**Pedidos (`/pedidos`, `/pedidos/:folio`):**
- Pestañas con contador: Todos, Por preparar, Preparando, Atrasados, OXXO pendiente, En ruta local, Enviados, Entregados, Cancelados. Filtro y búsqueda en la URL (`?f=late&q=…`).
- Tabla: Folio, Fecha, Cliente + ciudad, Pares, Entrega, Pago, Estado (+ chip Atrasado), Envío, Total (oculto para Operaciones).
- Detalle en panel lateral (`SidePanel`): en `2xl` se acomoda a la derecha de la tabla; abajo de `2xl` es un panel modal con fondo, foco atrapado, `Esc` cierra y devuelve el foco a la fila.
- Contenido del detalle exactamente como el mockup: siguiente paso (con aviso OXXO y "Lista de empaque" → `// TODO(api): PDF`), piezas con SKU, totales con IVA incluido (solo Dueño), furoshiki, cliente y envío (método y tarifa, guía o repartidor), nota interna con "Guardar nota", historial, cancelar con confirmación.

**Inventario (`/inventario`):**
- Tarjetas: Pares en almacén, Pares apartados, SKU agotados, SKU con pocos pares.
- Pestañas: Todos, Alertas, Agotados, Pocos, En stock + buscador.
- Tabla: Pieza (+ "ed. N"), Tono con muestra, Talla, SKU, Stock, Apartado, Disponible, Estado, botón "Ajustar · kárdex" (solo con `inventory.adjust`).
- `StockPanel`: resumen 3 cifras, formulario de movimiento (§5.3) y kárdex.
- Botón "Importar desde CSV" (solo Dueño) → `ImportCsvModal` (§5.4).

**Configuración (`/configuracion`, solo Dueño):** tarjetas Envíos, Zona de entrega local, Inventario y Usuarios internos (lista de solo lectura; "Invitar" deshabilitado con `TODO(api)`). "Guardar cambios" valida (montos enteros ≥ 0; umbral > 0; al menos un CP en la zona) y muestra "Cambios guardados. La tienda los toma de GET /api/config." Cambios sin guardar → aviso al salir de la página.

---

## 8. Plan por fases

### Fase 1 — Andamiaje y shell
- [x] Crear `apps/admin-panel` con Vite + React + Tailwind (mismas versiones que web-store), ESLint, puerto 5174, `vitest`.
- [x] `index.css` con tokens (§2), fuentes, favicon y logos copiados byte a byte.
- [x] Router con todas las rutas de §7 + `/login`, `NotFound`; `AppShell` con barra lateral, barra superior y `PageHeader`; páginas vacías.
- **Criterio:** `npm run dev` abre en `localhost:5174` con la barra lateral del mockup y navegación entre secciones.

### Fase 2 — Dominio, datos y servicio
- [ ] `domain/*` con sus pruebas (§5), `utils/format.js`, `data/seed.js`, `services/adminApi.js`, `AdminDataContext`.
- **Criterio:** `npm test` en verde con todos los casos de §5.6.

### Fase 3 — Acceso y roles
- [ ] `/login`, `AdminAuthContext`, guardas, `config/roles.js`, `Forbidden`, menú de usuario y `resetDemoData` en DEV.
- **Criterio:** Daniel no ve Configuración ni cifras en pesos; entrar a `/configuracion` como Daniel muestra `Forbidden`.

### Fase 4 — Dashboard
- [ ] Componentes de §5.5 y `SalesChart`/`HBars`.
- **Criterio:** "Hoy" por defecto; cambiar a 7d/30d recalcula; cada número de la cola abre Pedidos con su filtro.

### Fase 5 — Pedidos
- [ ] Tabla, pestañas, búsqueda, detalle, transiciones (§5.1), cancelación, nota, historial, URL.
- **Criterio:** un pedido local recorre Por preparar → Preparando → En ruta local → Entregado; uno de paquetería exige guía válida; al enviarlo baja el stock y aparece "Venta" en el kárdex.

### Fase 6 — Inventario y Configuración
- [ ] Tabla, filtros, `StockPanel`, kárdex, importación CSV y plantilla; página de Configuración.
- **Criterio:** importar un CSV con 2 filas erróneas aplica solo las válidas; cambiar la tarifa local a 59 se refleja en `computeShipping`.

### Fase 7 — Accesibilidad, responsive y cierre
- [ ] Áreas táctiles ≥ 44 px en móvil, foco visible, `prefers-reduced-motion`, sin scroll horizontal en 360–1440 px (las tablas se desplazan dentro de su contenedor).
- [ ] Lighthouse móvil Accesibilidad ≥ 95 en `/`, `/pedidos` e `/inventario` (meta 100).
- [ ] `apps/admin-panel/README.md`, actualización de `CONTEXTO_MAESTRO.md` y README raíz.
- [ ] Capturas en `docs/design/screenshots/`: `admin-dashboard-1440.png`, `admin-pedido-local-1440.png`, `admin-inventario-kardex-1440.png`, `admin-dashboard-390.png`, `admin-login-1440.png`.

---

## 9. Contrato esperado de la API (siguiente iteración, no implementar)

Todos bajo `/api/admin`, con `Authorization: Bearer` y `[Authorize(Roles = "...")]`.

| Recurso | Endpoints | Roles |
|---|---|---|
| Sesión | `POST /auth/login` · `GET /auth/me` | — |
| Dashboard | `GET /dashboard?range=hoy|7d|30d` | Dueño (con pesos), Operaciones (sin pesos) |
| Pedidos | `GET /orders?status=&q=` · `GET /orders/{folio}` · `POST /orders/{folio}/transitions` · `POST /orders/{folio}/cancel` · `PUT /orders/{folio}/note` | Dueño, Operaciones |
| Inventario | `GET /inventory?state=&q=` · `GET /inventory/{sku}/movements` · `POST /inventory/{sku}/movements` | Dueño, Operaciones |
| Importación | `POST /inventory/import/preview` · `POST /inventory/import` | Dueño |
| Configuración | `GET /settings` · `PUT /settings` | Dueño |
| Usuarios | `GET /users` · `POST /users/invitations` · `PUT /users/{id}/role` | Dueño |

Tablas que esto agrega al esquema: `Roles`, `UserRoles` (o `Users.Role`), `OrderStatusHistory`, `Shipments` (método, paquetería, guía, repartidor, costo cobrado), `InventoryMovements` (kárdex), `Settings`, `LocalDeliveryZones`, `AuditLogs` (P2).
Clasificación SOA: Pedidos, Inventario, Configuración = **servicios de entidad**; `FulfillOrder`, `AdjustInventory`, `ImportInventory` = **servicios de tarea**; Auth/RBAC, Auditoría, Exportación = **servicios de utilidad**.

---

## 10. Diferencias obligatorias frente al mockup

| En el mockup | En la implementación |
|---|---|
| Selector "Ver el panel como…" | Rol real desde la sesión; cuentas demo para probar cada rol |
| Contabilidad como rol | No existe en v1 (DECISIONES_ADMIN.md) |
| Importación .xlsx simulada | CSV real con validación; .xlsx en P1 |
| "Lista de empaque (PDF de ejemplo)" | Botón con `TODO(api)`; muestra aviso "Disponible al conectar la API" |
| Estado en memoria que se pierde al recargar | `adminApi` persiste en localStorage y tiene "Restablecer datos demo" en DEV |
| Movimientos de pedido sin efecto en inventario | Enviar/en ruta descuenta stock y escribe "Venta" en kárdex; cancelar libera apartados |
| Tailwind/Babel por CDN, logos en data URI | Build de Vite; SVG oficiales importados desde `src/assets/brand` |

---

## 11. Definición de terminado
- [ ] Fases 1–7 con casillas marcadas; build, lint y pruebas limpios.
- [ ] Los 5 criterios de las fases 3–6 verificados en el navegador.
- [ ] `apps/web-store` y `apps/api-service` sin cambios.
- [ ] PR `said/frontend-admin` → `main` abierto (sin merge) con capturas enlazadas desde `blob/said/frontend-admin/...` (se corrigen a `blob/main/` tras el merge).
