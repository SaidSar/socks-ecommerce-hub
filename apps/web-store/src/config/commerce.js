// Valores de negocio con la forma exacta de GET /api/config (DESIGN_DB.md §3.12).
// Son el respaldo mientras no responde la API; los componentes los leen con useConfig().
export const DEFAULT_CONFIG = Object.freeze({
  freeShippingThreshold: 799, // MXN, subtotal mínimo para envío de cortesía (local y paquetería)
  parcelShippingCost: 99, // MXN, paquetería nacional bajo el umbral
  localShippingCost: 49, // MXN, entrega local (Los Mochis y Ahome) bajo el umbral
  localFreeShipping: true, // el umbral también aplica a la entrega local
  fewUnitsThreshold: 4, // stock <= umbral → "Pocos ejemplares en almacén"
  ivaRate: 0.16, // IVA incluido en precio (solo informativo en el desglose)
})
