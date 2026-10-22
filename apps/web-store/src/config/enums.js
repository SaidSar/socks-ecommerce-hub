// Enums con su código de API (DESIGN_DB.md §1.6) y su etiqueta. Mismos códigos que apps/admin-panel/src/domain/enums.js.
// El checkout enviará el código (`paymentMethod: 'oxxo_pay'`); la UI muestra siempre la etiqueta con label().

export const PAYMENT_METHOD_LABELS = { tarjeta: 'Tarjeta', oxxo_pay: 'OXXO Pay' }

/** Etiqueta de un código; si el código no está en el mapa se muestra tal cual. */
export const label = (labels, code) => labels[code] ?? code ?? ''
