// Datos de ejemplo deterministas del panel (DESIGN_ADMIN.md §6.1). Solo los usa services/adminApi.js.
import { skuOf as catalogSku } from '../domain/catalog'
import { PAYMENT_METHOD_LABELS } from '../domain/enums'
import { ADMIN_FIELDS, exampleBarcode } from './catalogAdmin'
import { BRANDS, COLLECTIONS, COLORS, PRODUCT_TYPES, PRODUCTS, SIZES_BY_SYSTEM } from './catalogSeed'
import { computeShipping } from '../domain/shipping'

// Versión de la forma de los datos guardados; si cambia, adminApi descarta lo guardado y vuelve a sembrar.
export const SEED_VERSION = 5

// TODO(api): usar fecha del servidor. Domingo 18 de octubre de 2026, 09:30.
export const DEMO_NOW = new Date(2026, 9, 18, 9, 30)

/** PRNG mulberry32: misma semilla → mismos datos en cada carga. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- Catálogo: datos copiados de apps/web-store/src/data/catalog.mock.js (no se importa la ruta). ---
export { TONES } from './tones'

export const SIZES = [
  { code: 'S', label: '22–24 cm' },
  { code: 'M', label: '25–27 cm' },
  { code: 'L', label: '28–30 cm' },
]

export const PIECES = [
  { id: 7, name: 'Tabi Origami Noche', jp: '折紙・夜', price: 420, tones: ['sumi', 'washi'], edition: 120 },
  { id: 12, name: 'Lino Komorebi', jp: '木漏れ日', price: 380, tones: ['matcha', 'washi'] },
  { id: 3, name: 'Kintsugi Washi', jp: '金継ぎ', price: 460, tones: ['washi', 'sumi', 'laca'], edition: 80 },
  { id: 21, name: 'Hanami Laca', jp: '花見', price: 395, tones: ['laca', 'washi'] },
  { id: 15, name: 'Tsuchi Raíz', jp: '土', price: 360, tones: ['matcha', 'sumi'] },
  { id: 9, name: 'Mizu Calma', jp: '水', price: 340, tones: ['washi', 'matcha', 'sumi'] },
]

/** SKK-{id 3 dígitos}-{3 letras del tono}-{talla} → SKK-007-SUM-M */
export const skuOf = (pieceId, tone, size) => `SKK-${String(pieceId).padStart(3, '0')}-${tone.slice(0, 3).toUpperCase()}-${size}`

// Repartidores de entrega local (usuarios de Operaciones).
export const COURIERS = ['Kevin Armenta', 'Daniel Ruiz']

// Misma forma que Settings / GET /api/config (DESIGN_DB.md §3.12) más las zonas locales, que solo ve el panel.
export const INITIAL_SETTINGS = {
  freeShippingThreshold: 799,
  parcelShippingCost: 99,
  localShippingCost: 49,
  localFreeShipping: true,
  fewUnitsThreshold: 4,
  ivaRate: 0.16,
  localZones: [
    { value: '81200–81299', label: 'Los Mochis' },
    { value: '81300–81399', label: 'Ejidos de Ahome · por confirmar' },
  ],
}

const NAMES = ['Mariana López', 'Diego Ramírez', 'Fernanda Castro', 'Luis Ochoa', 'Sofía Valdez', 'Andrés Peña', 'Valeria Quintero', 'Jorge Félix', 'Camila Rubio', 'Ricardo Leyva', 'Paola Inzunza', 'Héctor Armenta', 'Natalia Gastélum', 'Iván Beltrán', 'Regina Sauceda']

// Ciudad y prefijo de CP. Los Mochis y Ahome caen en la zona local.
const CITIES = [
  { city: 'Los Mochis, Sin.', cp: '812' },
  { city: 'Los Mochis, Sin.', cp: '812' },
  { city: 'Ahome, Sin.', cp: '813' },
  { city: 'Culiacán, Sin.', cp: '800' },
  { city: 'Mazatlán, Sin.', cp: '820' },
  { city: 'CDMX', cp: '067' },
  { city: 'Guadalajara, Jal.', cp: '441' },
  { city: 'Monterrey, N.L.', cp: '640' },
  { city: 'Hermosillo, Son.', cp: '830' },
  { city: 'Puebla, Pue.', cp: '720' },
  { city: 'Querétaro, Qro.', cp: '760' },
]
const cityBy = (name) => CITIES.find((c) => c.city.startsWith(name))

// Casos fijos para que la demo siempre tenga cada situación de la cola de trabajo.
const OVERRIDES = {
  0: { status: 'por_preparar', city: 'Los Mochis', pay: 'tarjeta' },
  1: { status: 'por_preparar', city: 'CDMX', pay: 'oxxo_pay' },
  2: { status: 'por_preparar', city: 'Guadalajara', pay: 'tarjeta' },
  3: { status: 'preparando', city: 'Los Mochis' },
  5: { status: 'preparando', city: 'Monterrey', hour: 8 },
  6: { status: 'enviado', city: 'Ahome' },
  9: { status: 'por_preparar', city: 'Culiacán' },
}

const STAFF = ['Aiko M.', 'Daniel R.']

export function createSeed() {
  const rnd = mulberry32(20261018)
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1))
  const at = (daysAgo, hour, minute = int(0, 59)) => {
    const d = new Date(DEMO_NOW)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(hour, minute, 0, 0)
    return d
  }
  const iso = (d) => d.toISOString()
  const settings = structuredClone(INITIAL_SETTINGS)

  // --- Pedidos ---
  const orders = []
  for (let i = 0; i < 34; i++) {
    const ov = OVERRIDES[i] ?? {}
    const ageDays = Math.floor(i / 2.2)
    const created = ageDays === 0 ? at(0, int(6, 8)) : at(ageDays, ov.hour ?? int(8, 20))
    let status =
      ov.status ??
      (ageDays === 0
        ? 'por_preparar'
        : ageDays <= 1
          ? pick(['por_preparar', 'preparando', 'preparando'])
          : ageDays <= 3
            ? pick(['preparando', 'enviado', 'enviado'])
            : ageDays <= 5
              ? pick(['enviado', 'entregado'])
              : pick(['entregado', 'entregado', 'entregado', 'cancelado']))

    const items = []
    const nItems = int(1, 3)
    for (let k = 0; k < nItems; k++) {
      const p = pick(PIECES)
      const tone = pick(p.tones)
      const size = pick(['S', 'M', 'M', 'L'])
      const sku = skuOf(p.id, tone, size)
      const qty = rnd() < 0.2 ? 2 : 1
      const same = items.find((it) => it.sku === sku)
      if (same) same.qty += qty
      else items.push({ pieceId: p.id, name: p.name, tone, size, sku, qty, price: p.price })
    }
    const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0)
    const place = ov.city ? cityBy(ov.city) : pick(CITIES)
    const postalCode = place.cp + String(int(0, 99)).padStart(2, '0')
    const { method, cost } = computeShipping({ subtotal, postalCode }, settings)
    const delivery = method
    if (delivery === 'local' && status === 'enviado') status = 'en_ruta'
    if (delivery === 'paqueteria' && status === 'en_ruta') status = 'enviado'
    const pay = ov.pay ?? (rnd() < 0.78 ? 'tarjeta' : 'oxxo_pay')
    // Pago (DESIGN_DB.md §3.8): Tarjeta nace pagada. OXXO Pay sin pagar solo puede estar por preparar o
    // cancelado (CK_Orders_PaymentBeforeFulfillment); si ya avanzó, se pagó unas horas después de crearse.
    // Se decide con `i` y no con rnd() para no mover el resto de la semilla.
    let paymentStatus = 'pagado'
    let paidAt = created
    if (pay === 'oxxo_pay') {
      if (status === 'cancelado' || (status === 'por_preparar' && (i === 1 || i % 3 !== 0))) {
        paymentStatus = 'pendiente'
        paidAt = null
      } else {
        const wait = Math.min((2 + (i % 5) * 3) * 3600e3, (DEMO_NOW.getTime() - created.getTime()) * 0.5)
        paidAt = new Date(created.getTime() + wait)
      }
    }
    if (status === 'cancelado' && paymentStatus === 'pagado') paymentStatus = 'reembolsado'
    const name = pick(NAMES)
    const shipped = status === 'enviado' || status === 'en_ruta' || status === 'entregado'
    let tracking = ''
    if (delivery === 'paqueteria' && shipped) for (let d = 0; d < 12; d++) tracking += d === 0 ? int(1, 9) : int(0, 9)

    const order = {
      id: `SKK-${1060 - i}`,
      created: iso(created),
      status,
      items,
      subtotal,
      shipping: cost,
      total: subtotal + cost,
      pay,
      paymentStatus,
      paidAt: paidAt ? iso(paidAt) : null,
      customer: {
        name,
        email:
          name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(' ', '.') + '@correo.mx',
        city: place.city,
        postalCode,
        orders: int(1, 4),
      },
      delivery,
      giftWrap: rnd() < 0.55,
      carrier: delivery === 'paqueteria' && shipped ? pick(['estafeta', 'dhl_express']) : null,
      tracking,
      courier: delivery === 'local' && (status === 'en_ruta' || status === 'entregado') ? pick(COURIERS) : '',
      note: i === 4 ? 'Cliente pidió envolver por separado: es regalo.' : '',
      // OXXO nace "por preparar" y el hito "Pagado" llega con la fecha de pago; con Tarjeta coinciden.
      history: [
        ...(pay === 'oxxo_pay' ? [{ status: 'por_preparar', at: iso(created), by: 'Tienda en línea' }] : []),
        ...(paidAt ? [{ status: 'pagado', at: iso(paidAt), by: pay === 'oxxo_pay' ? PAYMENT_METHOD_LABELS.oxxo_pay : 'Tienda en línea' }] : []),
      ],
    }

    // Historial coherente: pasos en orden, sin pasar de DEMO_NOW.
    if (status === 'cancelado') {
      order.history.push({ status: 'cancelado', at: iso(new Date(created.getTime() + 5 * 3600e3)), by: 'Aiko M.' })
    } else {
      const steps = ['por_preparar', 'preparando', delivery === 'local' ? 'en_ruta' : 'enviado', 'entregado']
      const idx = steps.indexOf(status)
      // Los pasos de bodega empiezan cuando hay pago.
      let t = (paidAt ?? created).getTime()
      const room = DEMO_NOW.getTime() - t
      for (let k = 1; k <= idx; k++) {
        t += Math.min((6 + rnd() * 30) * 3600e3, room * (0.12 + rnd() * 0.12))
        order.history.push({ status: steps[k], at: iso(new Date(t)), by: pick(STAFF) })
      }
    }
    orders.push(order)
  }

  // --- Inventario: stock por SKU; lo apartado sale de los pedidos sin enviar ---
  const reservedBy = {}
  orders
    .filter((o) => o.status === 'por_preparar' || o.status === 'preparando')
    .forEach((o) => o.items.forEach((it) => (reservedBy[it.sku] = (reservedBy[it.sku] ?? 0) + it.qty)))

  const inventory = []
  PIECES.forEach((p) =>
    p.tones.forEach((tone) =>
      SIZES.forEach(({ code }) => {
        // Las ediciones limitadas van cortas para que el tiraje restante sea creíble.
        const max = p.id === 7 ? 5 : p.id === 3 ? 8 : 21
        const sku = skuOf(p.id, tone, code)
        const reserved = reservedBy[sku] ?? 0
        const base = rnd() < 0.12 ? 0 : int(0, max)
        inventory.push({ sku, pieceId: p.id, piece: p.name, tone, size: code, stock: Math.max(base, reserved), reserved, line: 'sokko', unit: 'par' })
      }),
    ),
  )

  // --- Kárdex: empieza con Entrada, incluye las ventas reales de los pedidos enviados, termina en el stock actual ---
  const movements = []
  inventory.forEach((r) => {
    const events = []
    orders.forEach((o) => {
      const shipStep = o.history.find((h) => h.status === 'enviado' || h.status === 'en_ruta')
      if (!shipStep) return
      o.items.filter((it) => it.sku === r.sku).forEach((it) => events.push({ type: 'venta', delta: -it.qty, date: new Date(shipStep.at), user: shipStep.by, note: `Pedido ${o.id}`, order: o.id }))
    })
    if (rnd() < 0.3) events.push({ type: 'merma', delta: -1, date: at(int(6, 20), int(10, 17)), user: 'Daniel R.', note: 'Hilo jalado en control de calidad' })
    if (rnd() < 0.2) {
      // La devolución sale de un pedido entregado que llevaba este SKU (CK_InventoryMovements_OrderRequired).
      // Se siguen consumiendo los mismos números aleatorios para no mover el resto de la semilla.
      // (día, hora y minuto que antes daban la fecha).
      int(6, 20)
      int(10, 17)
      int(0, 59)
      const src = orders.find((o) => o.status === 'entregado' && o.items.some((it) => it.sku === r.sku))
      const deliveredAt = src ? new Date(src.history.at(-1).at).getTime() : 0
      const date = new Date(Math.min(deliveredAt + 24 * 3600e3, DEMO_NOW.getTime() - 2 * 3600e3))
      if (src && date.getTime() > deliveredAt) events.push({ type: 'devolucion', delta: 1, date, user: 'Aiko M.', note: 'Cambio de talla', order: src.id })
    }
    events.sort((a, b) => a.date - b.date)

    const net = events.reduce((a, e) => a + e.delta, 0)
    let entry = r.stock - net
    if (entry < 6) entry = 6 + int(0, 12)
    // El saldo nunca es negativo: si alguna salida lo rebasa, la entrada inicial crece.
    let run = entry
    let low = entry
    events.forEach((e) => {
      run += e.delta
      low = Math.min(low, run)
    })
    if (low < 0) entry -= low

    const list = [{ type: 'entrada', delta: entry, date: at(int(25, 28), int(9, 12)), user: 'Daniel R.', note: 'Lote maquila septiembre' }, ...events]
    let bal = 0
    list.forEach((e) => {
      bal += e.delta
      movements.push({ sku: r.sku, type: e.type, qty: e.delta, balance: bal, date: iso(e.date), user: e.user, note: e.note, order: e.order ?? null })
    })
    if (bal !== r.stock) {
      const last = list[list.length - 1].date
      const date = new Date(Math.min(DEMO_NOW.getTime() - 3600e3, last.getTime() + 20 * 3600e3))
      movements.push({ sku: r.sku, type: 'conteo_fisico', qty: r.stock - bal, balance: r.stock, date: iso(date), user: 'Aiko M.', note: 'Ajuste tras conteo', order: null })
    }
  })

  // --- Ventas diarias: 30 días + mismo día del periodo anterior (para la gráfica y los KPI) ---
  const daily = []
  for (let d = 29; d >= 0; d--) {
    const date = at(d, 12, 0)
    const wk = date.getDay()
    const base = 2600 + (wk === 5 || wk === 6 ? 1500 : wk === 0 ? 900 : 0) + (29 - d) * 38
    const v = Math.round((base * (0.7 + rnd() * 0.6)) / 10) * 10
    const prev = Math.round(((base - 600) * (0.65 + rnd() * 0.6)) / 10) * 10
    const ordersN = Math.max(1, Math.round(v / (560 + rnd() * 160)))
    const prevOrders = Math.max(1, Math.round(prev / (560 + rnd() * 160)))
    daily.push({
      date: iso(date),
      v,
      orders: ordersN,
      free: Math.round(ordersN * (0.25 + rnd() * 0.3)),
      prev,
      prevOrders,
      prevFree: Math.round(prevOrders * (0.25 + rnd() * 0.3)),
    })
  }

  // --- Catálogo multilínea: las demás líneas se agregan al inventario al final, sin consumir el PRNG,
  // para que los datos de SOKKO (pedidos, kárdex, ventas) no cambien. Su stock sale de la semilla de la tienda.
  const catalog = createCatalog()
  catalog.products
    .filter((p) => p.line !== 'sokko')
    .forEach((p) => {
      const type = catalog.types.find((t) => t.code === p.type)
      const sizes = catalog.sizes[type.sizeSystem]
      const skus = p.colors.flatMap((c) => sizes.map((s) => ({ sku: catalogSku(p.line, p.pieceNumber, c, s.code), color: c, size: s.code })))
      const unit = type.unit === 'par' && p.unitsPerPack === 1 ? 'par' : 'unidad'
      skus.forEach((v, i) => {
        // Reparto parejo del stock del producto; el sobrante va a las primeras variantes.
        const stock = Math.floor(p.stock / skus.length) + (i < p.stock % skus.length ? 1 : 0)
        const tone = catalog.colors.find((c) => c.code === v.color).apiCode
        inventory.push({ sku: v.sku, pieceId: p.slug, piece: p.name, tone, size: v.size, stock, reserved: 0, line: p.line, unit })
        movements.push({ sku: v.sku, type: 'entrada', qty: stock, balance: stock, date: iso(at(26, 10, 0)), user: 'Daniel R.', note: 'Lote del proveedor', order: null })
      })
    })

  return { version: SEED_VERSION, orders, inventory, movements, daily, settings, pieces: structuredClone(PIECES), catalog }
}

/**
 * Catálogo del panel: la semilla de la tienda (catalogSeed.js) más costo, ventas de ejemplo y códigos de barras.
 * TODO(api): GET /api/admin/catalog.
 */
export function createCatalog() {
  return structuredClone({
    brands: BRANDS,
    types: PRODUCT_TYPES,
    sizes: SIZES_BY_SYSTEM,
    collections: COLLECTIONS,
    colors: COLORS,
    products: PRODUCTS.map(({ stock, ...p }) => {
      const sizes = SIZES_BY_SYSTEM[PRODUCT_TYPES.find((t) => t.code === p.type).sizeSystem]
      const barcodes = {}
      p.colors.forEach((c, ci) =>
        sizes.forEach((s, si) => {
          const code = exampleBarcode(p, ci, si)
          if (code) barcodes[catalogSku(p.line, p.pieceNumber, c, s.code)] = code
        }),
      )
      return { ...p, unitsPerPack: p.unitsPerPack ?? 1, collection: p.collection ?? null, stock, ...ADMIN_FIELDS[p.slug], barcodes }
    }),
  })
}
