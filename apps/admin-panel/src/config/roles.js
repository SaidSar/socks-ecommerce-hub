// Roles y permisos del panel (DESIGN_ADMIN.md §3, DECISIONES_ADMIN.md). Contabilidad no existe en v1.
// TODO(api): el servidor aplica los mismos permisos con [Authorize(Roles = "...")]; esto solo decide qué se muestra.

export const PERMISSIONS = [
  'money.view',
  'orders.manage',
  'inventory.adjust',
  'inventory.import',
  'settings.manage',
  'catalog.view',
  'catalog.edit',
  'brands.edit',
  'collections.edit',
  'types.edit',
  'costs.view',
  'customers.view',
  'finance.view',
  'promotions.manage',
  'shipping.view',
  'payments.confirm',
]

export const ROLES = {
  dueno: { label: 'Dueño', permissions: PERMISSIONS },
  // Catálogo (DESIGN_CATALOG_UI.md §4.1): Operaciones lo consulta; editar y ver costos es solo del Dueño.
  operaciones: { label: 'Operaciones', permissions: ['orders.manage', 'inventory.adjust', 'shipping.view', 'catalog.view'] },
}

/** ¿El rol tiene el permiso? `null` como permiso = libre para cualquier rol con sesión. */
export function can(role, permission) {
  if (permission == null) return Boolean(ROLES[role])
  return ROLES[role]?.permissions.includes(permission) ?? false
}

export const roleLabel = (role) => ROLES[role]?.label ?? ''
