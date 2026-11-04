import { label, LINE_LABELS, LINES } from './enums'

// Solo rutas que existen (lo prueba footer.test.jsx): nada de href="#…".
export const FOOTER_COLUMNS = [
  {
    title: 'Atelier',
    links: [{ to: '/nosotros', label: 'Nosotros' }, ...LINES.map((line) => ({ to: `/linea/${line}`, label: label(LINE_LABELS, line) }))],
  },
  {
    title: 'Ayuda',
    links: [
      { to: '/preguntas-frecuentes', label: 'Preguntas frecuentes' },
      { to: '/envios', label: 'Envíos' },
      { to: '/rastreo', label: 'Rastrear pedido' },
      { to: '/devoluciones', label: 'Cambios y devoluciones' },
      { to: '/contacto', label: 'Contacto' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacidad', label: 'Aviso de privacidad' },
      { to: '/terminos', label: 'Términos y condiciones' },
    ],
  },
]
