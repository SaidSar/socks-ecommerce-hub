// Secciones del panel (DESIGN_ADMIN.md §3 y §7). `perm` es el permiso de config/roles.js que la habilita
// (null = todos los roles). `ready: false` = sección sin construir: muestra ComingSoon con `soon`.
// `group` agrupa secciones bajo un título en la barra lateral.
export const NAV = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'dash', perm: null, ready: true },
  { key: 'pedidos', label: 'Pedidos', to: '/pedidos', icon: 'orders', perm: 'orders.manage', ready: true },
  { key: 'inventario', label: 'Inventario', to: '/inventario', icon: 'inv', perm: 'inventory.adjust', ready: true },
  // Catálogo multilínea (DESIGN_CATALOG_UI.md §4.1): visible para los dos roles; editar es solo del Dueño.
  { key: 'productos', label: 'Productos', to: '/catalogo/productos', icon: 'cat', perm: 'catalog.view', ready: true, group: 'Catálogo' },
  { key: 'marcas', label: 'Marcas', to: '/catalogo/marcas', icon: 'brand', perm: 'catalog.view', ready: true, group: 'Catálogo' },
  { key: 'colecciones', label: 'Colecciones', to: '/catalogo/colecciones', icon: 'cal', perm: 'catalog.view', ready: true, group: 'Catálogo' },
  { key: 'tipos', label: 'Tipos y tallas', to: '/catalogo/tipos', icon: 'ruler', perm: 'catalog.view', ready: true, group: 'Catálogo' },
  {
    key: 'clientes',
    label: 'Clientes',
    to: '/clientes',
    icon: 'users',
    perm: 'customers.view',
    ready: true,
  },
  // Sección `finanzas` (permiso finance.view): /finanzas redirige aquí.
  { key: 'finanzas', label: 'Reportes', to: '/reportes', icon: 'money', perm: 'finance.view', ready: true },
  {
    key: 'envios',
    label: 'Envíos',
    to: '/envios',
    icon: 'truck',
    perm: 'shipping.view',
    ready: true,
  },
  { key: 'mensajes', label: 'Mensajes', to: '/mensajes', icon: 'mail', perm: 'messages.view', ready: true },
  {
    key: 'promociones',
    label: 'Promociones',
    to: '/promociones',
    icon: 'tag',
    perm: 'promotions.manage',
    ready: true,
  },
  { key: 'configuracion', label: 'Configuración', to: '/configuracion', icon: 'gear', perm: 'settings.manage', ready: true },
]

export const navByKey = (key) => NAV.find((n) => n.key === key)

/** Sección de una ruta, para el título de la pestaña: la más específica que coincide. */
export function navForPath(pathname) {
  return [...NAV].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(`${n.to}/`)))
}

/** "Clientes · SOKKO Panel". */
export const pageTitle = (label) => (label ? `${label} · SOKKO Panel` : 'SOKKO · Panel')

// TODO(api): URL pública de la tienda por entorno.
export const STORE_URL = import.meta.env.VITE_STORE_URL || 'http://localhost:5173'
