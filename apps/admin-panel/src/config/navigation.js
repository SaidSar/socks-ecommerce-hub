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
    ready: false,
    soon: ['Historial de compras por cliente', 'Talla preferida y consentimiento de correos', 'Clientes recurrentes y valor de vida'],
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    to: '/finanzas',
    icon: 'money',
    perm: 'finance.view',
    ready: false,
    soon: ['Ventas, IVA y envíos cobrados por periodo', 'Exportación mensual a Excel para el contador externo', 'Margen y utilidad cuando se capture el costo por par'],
  },
  {
    key: 'envios',
    label: 'Envíos',
    to: '/envios',
    icon: 'truck',
    perm: 'shipping.view',
    ready: false,
    soon: ['Guías Estafeta / DHL y rutas de entrega local', 'Costo real contra costo cobrado', 'Pedidos atrasados por paquetería o repartidor'],
  },
  {
    key: 'promociones',
    label: 'Promociones',
    to: '/promociones',
    icon: 'tag',
    perm: 'promotions.manage',
    ready: false,
    soon: ['Cupones con vigencia', 'Packs y precios especiales'],
  },
  { key: 'configuracion', label: 'Configuración', to: '/configuracion', icon: 'gear', perm: 'settings.manage', ready: true },
]

export const navByKey = (key) => NAV.find((n) => n.key === key)

// TODO(api): URL pública de la tienda por entorno.
export const STORE_URL = import.meta.env.VITE_STORE_URL || 'http://localhost:5173'
