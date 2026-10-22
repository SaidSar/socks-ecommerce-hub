// Enums con su código de API (DESIGN_DB.md §1.6) y su etiqueta para la UI.
// Los datos guardan siempre el código; los componentes muestran la etiqueta con label(), nunca un texto a mano.

export const CARRIER_LABELS = { estafeta: 'Estafeta', dhl_express: 'DHL Express' }

export const PAYMENT_METHOD_LABELS = { tarjeta: 'Tarjeta', oxxo_pay: 'OXXO Pay' }

export const PAYMENT_STATUS_LABELS = { pendiente: 'Pendiente de pago', pagado: 'Pagado', reembolsado: 'Reembolsado' }

export const MOVEMENT_LABELS = {
  entrada: 'Entrada',
  merma: 'Merma',
  devolucion: 'Devolución',
  conteo_fisico: 'Conteo físico',
  venta: 'Venta',
  inventario_inicial: 'Inventario inicial',
}

/** Etiqueta de un código; si el código no está en el mapa se muestra tal cual. */
export const label = (labels, code) => labels[code] ?? code ?? ''
