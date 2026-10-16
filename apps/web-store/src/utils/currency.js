/** Formatea un importe en pesos mexicanos: formatMXN(420) → "$420", formatMXN(57.93, 2) → "$57.93". */
export function formatMXN(n, decimals = 0) {
  return (
    '$' +
    n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  )
}
