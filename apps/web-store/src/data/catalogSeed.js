// Semilla del catálogo multilínea (DESIGN_CATALOG_UI.md §2, DESIGN_DB.md v0.4.2 §5).
// Son las filas que devolvería la BD; services/catalogService.js las convierte al contrato de la API.
// TODO(api): se sustituyen por GET /api/products y GET /api/catalog/nav.
import { TONES } from './catalog.mock'

// Pieza del hero (Settings.FeaturedProductId).
export const FEATURED_SLUG = 'tabi-origami-noche'

export const BRANDS = [
  { slug: 'sokko', name: 'SOKKO', isOwnBrand: true, showInFilters: true },
  { slug: 'nike', name: 'Nike', isOwnBrand: false, showInFilters: true },
  { slug: 'puma', name: 'Puma', isOwnBrand: false, showInFilters: true },
  { slug: 'under-armour', name: 'Under Armour', isOwnBrand: false, showInFilters: true },
  { slug: 'pokemon', name: 'Pokémon', isOwnBrand: false, showInFilters: true },
  { slug: 'marvel', name: 'Marvel', isOwnBrand: false, showInFilters: true },
  { slug: 'sin-marca', name: 'Sin marca', isOwnBrand: false, showInFilters: false },
]

export const PRODUCT_TYPES = [
  { code: 'calcetas', name: 'Calcetas', sizeSystem: 'calceta', unit: 'par' },
  { code: 'gorras', name: 'Gorras', sizeSystem: 'unitalla', unit: 'pieza' },
  { code: 'gorros', name: 'Gorros', sizeSystem: 'unitalla', unit: 'pieza' },
  { code: 'guantes', name: 'Guantes', sizeSystem: 'guante', unit: 'par' },
  { code: 'bufandas', name: 'Bufandas', sizeSystem: 'unitalla', unit: 'pieza' },
  { code: 'mangas', name: 'Mangas', sizeSystem: 'unitalla', unit: 'par' },
  { code: 'lentes', name: 'Lentes', sizeSystem: 'unitalla', unit: 'pieza' },
]

export const SIZES_BY_SYSTEM = {
  calceta: [
    { code: 'S', label: '22–24 cm' },
    { code: 'M', label: '25–27 cm' },
    { code: 'L', label: '28–30 cm' },
  ],
  guante: [
    { code: 'S', label: 'Palma 17–19 cm' },
    { code: 'M', label: 'Palma 19–21 cm' },
    { code: 'L', label: 'Palma 21–23 cm' },
  ],
  unitalla: [{ code: 'U', label: 'Talla única' }],
}

// Ventana anual inclusiva en hora de Los Mochis (DESIGN_DB.md §3.5c).
export const COLLECTIONS = [
  { slug: 'navidad', name: 'Navidad', kind: 'temporada', startMonth: 11, startDay: 1, endMonth: 1, endDay: 6, offSeasonDiscountPct: 0.3 },
  { slug: 'halloween', name: 'Halloween', kind: 'temporada', startMonth: 10, startDay: 1, endMonth: 11, endDay: 2, offSeasonDiscountPct: 0.3 },
  { slug: 'anime', name: 'Anime', kind: 'tematica', offSeasonDiscountPct: 0.3 },
  { slug: 'superheroes', name: 'Superhéroes', kind: 'tematica', offSeasonDiscountPct: 0.3 },
]

// `code` = Colors.Code (parte del SKU); `apiCode` = Colors.Slug; `line` = color del trazo sobre la muestra.
const kyoto = (code, apiCode) => ({ code, apiCode, name: TONES[apiCode].name, hex: TONES[apiCode].hex, line: TONES[apiCode].line, isSokkoTone: true })
export const COLORS = [
  kyoto('SUM', 'sumi'),
  kyoto('WAS', 'washi'),
  kyoto('LAC', 'laca'),
  kyoto('MAT', 'matcha'),
  { code: 'NEG', apiCode: 'negro', name: 'Negro', hex: '#1F1D1B', line: '#F4F0EB', isSokkoTone: false },
  { code: 'BLA', apiCode: 'blanco', name: 'Blanco', hex: '#F7F5F1', line: '#23211E', isSokkoTone: false },
  { code: 'GRI', apiCode: 'gris', name: 'Gris jaspe', hex: '#A7A39C', line: '#23211E', isSokkoTone: false },
  { code: 'ROJ', apiCode: 'rojo', name: 'Rojo', hex: '#B5302B', line: '#F4F0EB', isSokkoTone: false },
  { code: 'VER', apiCode: 'verde', name: 'Verde pino', hex: '#2F5A43', line: '#F4F0EB', isSokkoTone: false },
  { code: 'NAR', apiCode: 'calabaza', name: 'Calabaza', hex: '#D06A26', line: '#F4F0EB', isSokkoTone: false },
  { code: 'AZU', apiCode: 'azul', name: 'Azul noche', hex: '#26385C', line: '#F4F0EB', isSokkoTone: false },
  { code: 'AMA', apiCode: 'amarillo', name: 'Amarillo', hex: '#E3B53B', line: '#23211E', isSokkoTone: false },
  { code: 'CAM', apiCode: 'camello', name: 'Camello', hex: '#B08A63', line: '#23211E', isSokkoTone: false },
]

// `pieceNumber` es el número dentro de la línea (base del SKU); los de SOKKO conservan el suyo.
// `art` elige la ilustración mientras no haya fotografía (`imageUrl`).
export const PRODUCTS = [
  // SOKKO Japón: las 6 piezas, SKU sin cambios.
  { slug: 'tabi-origami-noche', line: 'sokko', pieceNumber: 7, brand: 'sokko', type: 'calcetas', name: 'Tabi Origami Noche', nameJp: '折紙・夜', price: 420, colors: ['SUM', 'WAS'], stock: 15, art: 'tabi', note: 'Algodón peinado D-200 · pliegue en empeine' },
  { slug: 'lino-komorebi', line: 'sokko', pieceNumber: 12, brand: 'sokko', type: 'calcetas', name: 'Lino Komorebi', nameJp: '木漏れ日', price: 380, colors: ['MAT', 'WAS'], stock: 13, art: 'tabi', note: 'Lino y algodón · tinte de té verde' },
  { slug: 'kintsugi-washi', line: 'sokko', pieceNumber: 3, brand: 'sokko', type: 'calcetas', name: 'Kintsugi Washi', nameJp: '金継ぎ', price: 460, colors: ['WAS', 'SUM', 'LAC'], stock: 3, art: 'tabi', note: 'Algodón peinado · costura dorada visible' },
  { slug: 'hanami-laca', line: 'sokko', pieceNumber: 21, brand: 'sokko', type: 'calcetas', name: 'Hanami Laca', nameJp: '花見', price: 395, colors: ['LAC', 'WAS'], stock: 26, art: 'tabi', note: 'Algodón peinado · pigmento mineral rojo' },
  { slug: 'tsuchi-raiz', line: 'sokko', pieceNumber: 15, brand: 'sokko', type: 'calcetas', name: 'Tsuchi Raíz', nameJp: '土', price: 360, colors: ['MAT', 'SUM'], stock: 17, art: 'tabi', note: 'Algodón y bambú · teñido con tierra ocre' },
  { slug: 'mizu-calma', line: 'sokko', pieceNumber: 9, brand: 'sokko', type: 'calcetas', name: 'Mizu Calma', nameJp: '水', price: 340, colors: ['WAS', 'MAT', 'SUM'], stock: 37, art: 'tabi', note: 'Algodón peinado · punto tubular sin costura' },
  // Marcas: originales con factura del proveedor.
  { slug: 'nike-everyday-cushion-3', line: 'marcas', pieceNumber: 1, brand: 'nike', type: 'calcetas', unitsPerPack: 3, name: 'Everyday Cushion Crew', price: 449, colors: ['BLA', 'NEG'], stock: 22, art: 'pack', note: 'Algodón con amortiguación en planta' },
  { slug: 'puma-quarter-3', line: 'marcas', pieceNumber: 2, brand: 'puma', type: 'calcetas', unitsPerPack: 3, name: 'Quarter Sport', price: 329, colors: ['NEG', 'GRI'], stock: 18, art: 'pack', note: 'Tobillera deportiva' },
  { slug: 'ua-heatgear-crew', line: 'marcas', pieceNumber: 3, brand: 'under-armour', type: 'calcetas', name: 'HeatGear Crew', price: 189, colors: ['NEG', 'BLA'], stock: 4, art: 'crew', note: 'Tejido que evacúa la humedad' },
  { slug: 'nike-elite-basketball', line: 'marcas', pieceNumber: 4, brand: 'nike', type: 'calcetas', name: 'Elite Basketball Crew', price: 299, colors: ['BLA', 'ROJ'], stock: 9, art: 'crew', note: 'Soporte en arco y talón' },
  // Especiales: temporada (Navidad, Halloween) y temáticas con licencia oficial.
  { slug: 'copo-navideno', line: 'especiales', pieceNumber: 1, brand: 'sin-marca', type: 'calcetas', collection: 'navidad', name: 'Copo Navideño', price: 199, colors: ['ROJ', 'VER'], stock: 30, art: 'xmas', note: 'Tejido jacquard de invierno' },
  { slug: 'reno-de-lana', line: 'especiales', pieceNumber: 2, brand: 'sin-marca', type: 'calcetas', collection: 'navidad', name: 'Reno de Lana', price: 219, colors: ['ROJ'], stock: 12, art: 'xmas', note: 'Mezcla de lana suave' },
  { slug: 'duendes-del-bosque', line: 'especiales', pieceNumber: 3, brand: 'sin-marca', type: 'calcetas', collection: 'navidad', name: 'Duendes del Bosque', price: 189, colors: ['VER', 'ROJ'], stock: 17, art: 'xmas', note: 'Algodón con puño a rayas' },
  { slug: 'calabaza-nocturna', line: 'especiales', pieceNumber: 4, brand: 'sin-marca', type: 'calcetas', collection: 'halloween', name: 'Calabaza Nocturna', price: 179, colors: ['NAR', 'NEG'], stock: 21, art: 'pumpkin', note: 'Algodón con estampado nocturno' },
  { slug: 'telarana-nocturna', line: 'especiales', pieceNumber: 5, brand: 'sin-marca', type: 'calcetas', collection: 'halloween', name: 'Telaraña Nocturna', price: 169, colors: ['NEG', 'NAR'], stock: 9, art: 'pumpkin', note: 'Algodón con estampado nocturno' },
  { slug: 'luna-de-calabazas', line: 'especiales', pieceNumber: 6, brand: 'sin-marca', type: 'calcetas', collection: 'halloween', name: 'Luna de Calabazas', price: 189, colors: ['NAR'], stock: 4, art: 'pumpkin', note: 'Tobillera de algodón' },
  { slug: 'pokemon-pikachu', line: 'especiales', pieceNumber: 7, brand: 'pokemon', type: 'calcetas', collection: 'anime', name: 'Calceta Pokémon Pikachu', price: 239, colors: ['AMA'], stock: 14, art: 'licensed', note: 'Licencia oficial Pokémon' },
  { slug: 'marvel-avengers', line: 'especiales', pieceNumber: 8, brand: 'marvel', type: 'calcetas', collection: 'superheroes', name: 'Marvel Avengers', price: 229, colors: ['AZU', 'ROJ'], stock: 3, art: 'licensed', note: 'Licencia oficial Marvel' },
  // Accesorios: todo el año.
  { slug: 'gorro-de-punto', line: 'accesorios', pieceNumber: 1, brand: 'sin-marca', type: 'gorros', name: 'Gorro de punto', price: 249, colors: ['NEG', 'CAM'], stock: 16, art: 'beanie', note: 'Punto acanalado doble' },
  { slug: 'guantes-tactiles', line: 'accesorios', pieceNumber: 2, brand: 'sin-marca', type: 'guantes', name: 'Guantes táctiles', price: 199, colors: ['NEG', 'GRI'], stock: 11, art: 'gloves', note: 'Yemas para pantalla táctil' },
  { slug: 'bufanda-de-lana', line: 'accesorios', pieceNumber: 3, brand: 'sin-marca', type: 'bufandas', name: 'Bufanda de lana', price: 289, colors: ['CAM', 'GRI'], stock: 8, art: 'scarf', note: '180 × 30 cm' },
  { slug: 'gorra-nike-club', line: 'accesorios', pieceNumber: 4, brand: 'nike', type: 'gorras', name: 'Gorra Club', price: 499, colors: ['NEG', 'BLA'], stock: 6, art: 'cap', note: 'Ajustable' },
  { slug: 'lentes-de-sol-polarizados', line: 'accesorios', pieceNumber: 5, brand: 'sin-marca', type: 'lentes', name: 'Lentes de sol polarizados', price: 299, colors: ['NEG'], stock: 2, art: 'glasses', note: 'UV400 con estuche' },
  { slug: 'mangas-uv', line: 'accesorios', pieceNumber: 6, brand: 'sin-marca', type: 'mangas', name: 'Mangas UV', price: 149, colors: ['NEG', 'BLA'], stock: 19, art: 'sleeves', note: 'Protección solar' },
]
