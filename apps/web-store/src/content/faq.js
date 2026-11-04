import { SIZES_BY_SYSTEM } from '../data/catalogSeed'
import { formatMXN } from '../utils/currency'

export const FAQ_TOPICS = [
  { code: 'tallas', label: 'Tallas' },
  { code: 'envios', label: 'Envíos' },
  { code: 'pagos', label: 'Pagos' },
  { code: 'cambios', label: 'Cambios' },
  { code: 'cuidado', label: 'Cuidado' },
]

const sizes = SIZES_BY_SYSTEM.calceta.map((s) => `${s.code} ${s.label}`).join(', ')

/**
 * Preguntas frecuentes. `answer` recibe la configuración de GET /api/config: los montos de envío no se escriben a mano.
 * @type {{ id: string, topic: string, question: string, answer: (config: object) => string }[]}
 */
export const FAQ = [
  {
    id: 'talla',
    topic: 'tallas',
    question: '¿Qué talla debo elegir?',
    answer: () => `Mida su pie del talón a la punta del dedo más largo. Las calcetas vienen en ${sizes}. Si queda entre dos tallas, elija la mayor.`,
  },
  {
    id: 'tabi',
    topic: 'tallas',
    question: '¿Cómo se siente la punta dividida del tabi?',
    answer: () =>
      'La separación del dedo gordo deja que el pie se apoye con más equilibrio. Los primeros días se nota; después se vuelve natural. Puede usarlas con sandalias de dedo o con calzado cerrado.',
  },
  {
    id: 'materiales',
    topic: 'cuidado',
    question: '¿De qué están hechas?',
    answer: () =>
      'La colección SOKKO Japón usa algodón peinado, lino y bambú con tintes de bajo impacto. El material exacto de cada pieza aparece en su ficha.',
  },
  {
    id: 'lavado',
    topic: 'cuidado',
    question: '¿Cómo las lavo?',
    answer: () => 'En agua fría, del revés y sin cloro. Séquelas a la sombra, sin secadora, para que los tintes naturales y el tejido duren más.',
  },
  {
    id: 'plazos',
    topic: 'envios',
    question: '¿Cuánto tarda en llegar mi pedido?',
    answer: () => 'Preparamos su pedido en 1 a 2 días hábiles. Por paquetería tarda de 3 a 5 días hábiles más; la entrega local suele ser al día siguiente.',
  },
  {
    id: 'costo-envio',
    topic: 'envios',
    question: '¿Cuánto cuesta el envío?',
    answer: ({ freeShippingThreshold, parcelShippingCost, localShippingCost }) =>
      `Paquetería nacional: ${formatMXN(parcelShippingCost)}. Entrega local en Los Mochis y alrededores: ${formatMXN(localShippingCost)}. Desde ${formatMXN(freeShippingThreshold)} el envío es de cortesía.`,
  },
  {
    id: 'pedido',
    topic: 'envios',
    question: '¿Cómo consulto el estado de mi pedido?',
    answer: () =>
      'Si compró con cuenta, entre a Mis pedidos. En todos los casos le enviamos por correo el folio (SKK-####) y, al salir el paquete, su número de guía.',
  },
  {
    id: 'oxxo',
    topic: 'pagos',
    question: '¿Cómo pago en OXXO?',
    answer: () =>
      'Elija OXXO Pay al pagar y recibirá una referencia. Tiene 72 horas para pagar en cualquier OXXO; mientras tanto apartamos sus piezas. Si no se paga a tiempo, el pedido se cancela solo.',
  },
  {
    id: 'pagos-aceptados',
    topic: 'pagos',
    question: '¿Qué formas de pago aceptan?',
    answer: () => 'Tarjeta de crédito o débito (Visa, Mastercard y American Express) y OXXO Pay. Todos los precios incluyen IVA.',
  },
  {
    id: 'cuenta',
    topic: 'pagos',
    question: '¿Necesito una cuenta para comprar?',
    answer: () => 'No. Puede comprar como invitado. Con cuenta guarda sus datos de entrega, su talla habitual y el historial de pedidos.',
  },
  {
    id: 'cambio',
    topic: 'cambios',
    question: '¿Puedo cambiar o devolver una pieza?',
    answer: () =>
      'Sí, dentro de los 30 días posteriores a recibirla, siempre que esté sin uso y con etiqueta. Las ediciones limitadas solo admiten cambio de talla.',
  },
  {
    id: 'defecto',
    topic: 'cambios',
    question: '¿Qué hago si mi pieza llegó dañada?',
    answer: () => 'Escríbanos dentro de las 48 horas siguientes a la entrega con una foto de la pieza y del empaque. Cubrimos el envío de reposición.',
  },
]
