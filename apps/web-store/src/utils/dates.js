const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "11-02" o (11, 2) → "2 nov"; con `long`, "2 de noviembre". */
export function formatMonthDay(monthOrText, day, { long = false } = {}) {
  const [m, d] = typeof monthOrText === 'string' ? monthOrText.split('-').map(Number) : [monthOrText, day]
  return long ? `${d} de ${MONTHS_LONG[m - 1]}` : `${d} ${MONTHS_SHORT[m - 1]}`
}

/** Ventana anual de una colección: "1 nov – 6 ene". */
export const formatWindow = (w) => `${formatMonthDay(w.startMonth, w.startDay)} – ${formatMonthDay(w.endMonth, w.endDay)}`

/** Kanji de la estación para un mes: 冬 dic–feb, 春 mar–may, 夏 jun–sep, 秋 oct–nov. */
export function seasonKanji(month) {
  if (month === 12 || month <= 2) return '冬'
  if (month <= 5) return '春'
  if (month <= 9) return '夏'
  return '秋'
}
