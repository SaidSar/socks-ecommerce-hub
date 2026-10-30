// Disponibilidad de una combinación de color y talla (DESIGN_DB.md §3.12). Módulo puro, sin React ni dependencias.

export const AVAILABILITY_TEXT = { agotado: 'Agotado', pocas: 'Pocas unidades', disponible: 'Disponible' }

/** `stock` = disponible (Stock − Reserved). "pocas" llega hasta el umbral, inclusive. */
export function availabilityOf(stock, fewUnitsThreshold) {
  if (!(stock > 0)) return 'agotado'
  return stock <= fewUnitsThreshold ? 'pocas' : 'disponible'
}

/** Reparte el stock del producto entre `count` variantes: parejo, con el sobrante en las primeras. */
export const variantStock = (total, count, index) => Math.floor(total / count) + (index < total % count ? 1 : 0)
