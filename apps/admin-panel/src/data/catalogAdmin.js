// Campos del panel sobre la semilla del catálogo (catalogSeed.js): costo de compra por unidad vendible (R-30,
// solo Dueño), ventas de ejemplo de la semana y códigos de barras del proveedor (T-12).
// `unitCost: null` = sin costo registrado (Tsuchi Raíz, para probar el aviso "sin costo").
export const ADMIN_FIELDS = {
  'tabi-origami-noche': { unitCost: 168, sold: 9 },
  'lino-komorebi': { unitCost: 152, sold: 7 },
  'kintsugi-washi': { unitCost: 190, sold: 5 },
  'hanami-laca': { unitCost: 158, sold: 6 },
  'tsuchi-raiz': { unitCost: null, sold: 3 },
  'mizu-calma': { unitCost: 128, sold: 8 },
  'nike-everyday-cushion-3': { unitCost: 305, sold: 21 },
  'puma-quarter-3': { unitCost: 214, sold: 14 },
  'ua-heatgear-crew': { unitCost: 121, sold: 11 },
  'nike-elite-basketball': { unitCost: 196, sold: 8 },
  'copo-navideno': { unitCost: 82, sold: 0 },
  'reno-de-lana': { unitCost: 95, sold: 0 },
  'duendes-del-bosque': { unitCost: 80, sold: 0 },
  'calabaza-nocturna': { unitCost: 70, sold: 19 },
  'telarana-nocturna': { unitCost: 66, sold: 12 },
  'luna-de-calabazas': { unitCost: 74, sold: 7 },
  'pokemon-pikachu': { unitCost: 140, sold: 6 },
  'marvel-avengers': { unitCost: 135, sold: 4 },
  'gorro-de-punto': { unitCost: 98, sold: 5 },
  'guantes-tactiles': { unitCost: 84, sold: 3 },
  'bufanda-de-lana': { unitCost: 120, sold: 2 },
  'gorra-nike-club': { unitCost: 340, sold: 2 },
  'lentes-de-sol-polarizados': { unitCost: 110, sold: 1 },
  'mangas-uv': { unitCost: 52, sold: 2 },
}

/** Código de barras de ejemplo (UPC de 12 dígitos) para las variantes de Marcas; el resto no lo trae. */
export function exampleBarcode(product, colorIndex, sizeIndex) {
  if (product.line !== 'marcas') return null
  return `0195238${String(product.pieceNumber).padStart(3, '0')}${colorIndex}${sizeIndex}`
}
