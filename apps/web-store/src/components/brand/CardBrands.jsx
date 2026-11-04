// Marcas de tarjeta como SVG propios y simples (sin recursos externos: la CSP solo permite el origen de la API).
// `role="img"` con el nombre de la marca; quien los usa decide si son decorativos (aria-hidden) o informativos.

const FRAME = { viewBox: '0 0 38 24', role: 'img', focusable: false }

export function VisaLogo({ className = '', ...props }) {
  return (
    <svg {...FRAME} aria-label="Visa" className={className} {...props}>
      <rect x="0.5" y="0.5" width="37" height="23" rx="3" fill="#fff" stroke="#d9d3cb" />
      <text x="19" y="16.2" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="11" fontStyle="italic" fontWeight="700" fill="#1a1f71" letterSpacing=".4">
        VISA
      </text>
    </svg>
  )
}

export function MastercardLogo({ className = '', ...props }) {
  return (
    <svg {...FRAME} aria-label="Mastercard" className={className} {...props}>
      <rect x="0.5" y="0.5" width="37" height="23" rx="3" fill="#fff" stroke="#d9d3cb" />
      <circle cx="15" cy="12" r="6.5" fill="#eb001b" />
      <circle cx="23" cy="12" r="6.5" fill="#f79e1b" />
      <path d="M19 6.9a6.5 6.5 0 010 10.2 6.5 6.5 0 010-10.2z" fill="#ff5f00" />
    </svg>
  )
}

export function AmexLogo({ className = '', ...props }) {
  return (
    <svg {...FRAME} aria-label="American Express" className={className} {...props}>
      <rect width="38" height="24" rx="3" fill="#2e77bc" />
      <text x="19" y="15.6" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9" fontWeight="700" fill="#fff" letterSpacing=".6">
        AMEX
      </text>
    </svg>
  )
}
