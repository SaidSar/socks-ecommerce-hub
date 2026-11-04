// Rastreo del envío: nombre de la paquetería y página donde se consulta la guía. Los códigos son los de la API
// (`Shipment.carrier`), los mismos que usa el panel.

export const CARRIER_LABELS = { estafeta: 'Estafeta', dhl_express: 'DHL Express' }

/** Estafeta no acepta la guía en la URL: se abre su buscador y el cliente la pega (por eso el botón de copiar). */
const ESTAFETA_URL = 'https://www.estafeta.com/Herramientas/Rastreo'
const DHL_URL = 'https://www.dhl.com/mx-es/home/rastreo.html'

export const carrierLabel = (carrier) => CARRIER_LABELS[carrier] ?? carrier

/** Página de rastreo de la paquetería, o null si no hay paquetería o guía (entrega local). */
export function trackingUrl(carrier, trackingNumber) {
  if (!trackingNumber) return null
  if (carrier === 'estafeta') return ESTAFETA_URL
  if (carrier === 'dhl_express') return `${DHL_URL}?tracking-id=${encodeURIComponent(trackingNumber)}`
  return null
}

/** "1050", "skk1050" o "SKK-1050" → "SKK-1050"; null si no parece un folio. */
export function normalizeFolio(value) {
  const match = String(value ?? '').trim().toUpperCase().match(/^(?:SKK-?)?(\d{1,9})$/)
  return match ? `SKK-${match[1]}` : null
}
