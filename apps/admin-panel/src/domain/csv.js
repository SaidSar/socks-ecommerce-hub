// CSV de los exportes del panel, igual que Services/CsvWriter.cs en la API: UTF-8 con BOM, separador `,`, decimales con punto,
// CRLF y ninguna celda de texto que Excel pueda tomar como fórmula. El modo mock lo usa para que la descarga sea la misma.

const FORMULA_START = /^[=+\-@\t\r]/

/** Neutraliza texto que Excel ejecutaría como fórmula: le antepone `'`. */
export const guardCell = (text) => (FORMULA_START.test(text) ? `'${text}` : text)

/** Números con punto (importes con 2 decimales si `money`); texto protegido y entre comillas si hace falta. */
export function csvCell(value, { money = false } = {}) {
  let text
  if (value == null) text = ''
  else if (typeof value === 'number') text = money ? value.toFixed(2) : String(value)
  else if (typeof value === 'boolean') text = value ? 'Sí' : 'No'
  else text = guardCell(String(value))
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** `rows`: listas de celdas; `moneyColumns`: índices que van con 2 decimales. */
export function toCsv(header, rows, moneyColumns = []) {
  const line = (cells) => cells.map((c, i) => csvCell(c, { money: moneyColumns.includes(i) })).join(',')
  return '﻿' + [header, ...rows].map(line).join('\r\n') + '\r\n'
}

/** Guarda un `Blob` con su nombre: enlace temporal, sin abrir otra pestaña. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
