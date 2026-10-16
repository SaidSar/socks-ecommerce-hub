// Datos temporales del Home. Se sustituyen por GET /api/products?section=home (DESIGN.md §9).
export const TONES = {
  sumi: { name: 'Tinta Sumi', hex: '#2C2925', line: '#F4F0EB' },
  washi: { name: 'Blanco Washi', hex: '#EFE8DC', line: '#23211E' },
  laca: { name: 'Rojo Laca', hex: '#9E2F2C', line: '#F4F0EB' },
  matcha: { name: 'Oliva Matcha', hex: '#6E7A5E', line: '#F4F0EB' },
}

export const SIZES = [
  { code: 'S', label: '22–24 cm' },
  { code: 'M', label: '25–27 cm' },
  { code: 'L', label: '28–30 cm' },
]

export const PIECES = [
  { id: 7, name: 'Tabi Origami Noche', jp: '折紙・夜', material: 'Algodón peinado D-200 · pliegue en empeine', price: 420, tones: ['sumi', 'washi'], stock: { sumi: 3, washi: 12 }, edition: 'Elaboración limitada · 120 pares' },
  { id: 12, name: 'Lino Komorebi', jp: '木漏れ日', material: 'Lino y algodón · tinte de té verde', price: 380, tones: ['matcha', 'washi'], stock: { matcha: 9, washi: 4 } },
  { id: 3, name: 'Kintsugi Washi', jp: '金継ぎ', material: 'Algodón peinado · costura dorada visible', price: 460, tones: ['washi', 'sumi', 'laca'], stock: { washi: 2, sumi: 8, laca: 6 }, edition: 'Elaboración limitada · 80 pares' },
  { id: 21, name: 'Hanami Laca', jp: '花見', material: 'Algodón peinado · pigmento mineral rojo', price: 395, tones: ['laca', 'washi'], stock: { laca: 11, washi: 15 } },
  { id: 15, name: 'Tsuchi Raíz', jp: '土', material: 'Algodón y bambú · teñido con tierra ocre', price: 360, tones: ['matcha', 'sumi'], stock: { matcha: 14, sumi: 3 } },
  { id: 9, name: 'Mizu Calma', jp: '水', material: 'Algodón peinado · punto tubular sin costura', price: 340, tones: ['washi', 'matcha', 'sumi'], stock: { washi: 20, matcha: 7, sumi: 10 } },
]

export const FEATURED_PIECE_ID = 7 // pieza del hero
