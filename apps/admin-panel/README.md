# SOKKO · Panel administrativo (`apps/admin-panel`)

Backoffice interno de SOKKO para el **Dueño** y el equipo de **Operaciones**: dashboard, pedidos (paquetería y entrega local), inventario con kárdex e importación desde CSV, y configuración de envíos.

Consumidor interno del mismo `api-service` que la tienda (SOA). Hoy funciona con datos simulados detrás de `src/services/adminApi.js`; cada función lleva un `// TODO(api):` con el endpoint de `/api/admin/*` que la sustituirá.

Especificación: [`docs/design/DESIGN_ADMIN.md`](../../docs/design/DESIGN_ADMIN.md) · Decisiones del cliente: [`docs/design/DECISIONES_ADMIN.md`](../../docs/design/DECISIONES_ADMIN.md) · Mockup: [`docs/design/mockups/admin-panel.html`](../../docs/design/mockups/admin-panel.html)

## Cómo correrlo

```bash
cd apps/admin-panel
npm install
npm run dev      # http://localhost:5174
```

Desde la raíz del monorepo: `npm --prefix apps/admin-panel run dev`.

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto **5174** (la tienda usa el 5173) |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build en el puerto 4174 |
| `npm run lint` | oxlint con la misma configuración que `web-store` |
| `npm test` | Pruebas de dominio y del servicio simulado con vitest |

## Cuentas demo (solo en desarrollo)

La pantalla de acceso las muestra únicamente con `import.meta.env.DEV`; un clic llena el formulario.

| Rol | Nombre | Correo | Contraseña |
|---|---|---|---|
| Dueño | Aiko Morales | `hola@sokko.mx` | `Kyoto2026` |
| Operaciones | Daniel Ruiz | `daniel@sokko.mx` | `Operaciones2026` |
| Operaciones | Kevin Armenta | `kevin@sokko.mx` | `Operaciones2026` |

- **Dueño:** todo, con cifras en pesos e importación de inventario.
- **Operaciones:** dashboard sin pesos, pedidos sin columna Total, inventario (ajustes y kárdex) y envíos. Configuración y las secciones del Dueño muestran "Esta sección es solo para el Dueño".

La sesión vive en `sessionStorage` (`sokko.admin.session.v1`) y se cierra al cerrar la pestaña. Los datos simulados se guardan en `localStorage` (`sokko.admin.data.v1`); en desarrollo, el menú de usuario tiene **Restablecer datos demo**.

## Estructura

```text
src/
├── config/        roles.js (permisos por rol) · navigation.js (secciones)
├── data/seed.js   datos deterministas (mulberry32, "ahora" = dom 18 oct 2026 09:30)
├── domain/        reglas puras con pruebas: orders, shipping, inventory, importCsv, dashboard
├── services/      adminApi.js (API simulada) · adminAuth.js (acceso simulado)
├── context/       AdminAuthContext · AdminDataContext
├── hooks/         useAdminAuth · useAdminData/useAdminQuery · useWidth · useFocusTrap · useLockBodyScroll · useMediaQuery
├── components/    layout · ui · charts · dashboard · orders · inventory · settings
└── pages/         Login · Dashboard · Orders · Inventory · Settings · ComingSoon · Forbidden · NotFound
```

Los componentes solo hablan con `useAdminData()`; nunca importan `seed.js` ni `adminApi.js` directamente.

## Reglas clave

- Un pedido pagado aparta pares. Al marcarlo **Enviado** o **En ruta local** baja el stock, libera lo apartado y escribe "Venta · Pedido {folio}" en el kárdex; cancelar libera lo apartado.
- Paquetería exige Estafeta o DHL Express y guía de 10 dígitos o más; entrega local exige repartidor.
- Atrasado = por preparar o preparando con más de 48 h desde la compra.
- Envío: local si el CP cae en la zona configurada; gratis desde el umbral (local solo si "entrega local también gratis" está activo).
- Importación v1 en CSV (Excel → Guardar como CSV UTF-8) con columnas `SKU, Pieza, Tono, Talla, Stock`; solo se aplican las filas válidas como "Inventario inicial".
