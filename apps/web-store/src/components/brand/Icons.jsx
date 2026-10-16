// Íconos de trazo fino del mockup (stroke 1.1). Decorativos: el texto accesible va en el botón.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.1,
  'aria-hidden': true,
  focusable: false,
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  )
}

export function BagIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5.5 8.5h13l-1 11.5h-11z" />
      <path d="M9 8.5c0-2.5 1.3-4 3-4s3 1.5 3 4" />
    </svg>
  )
}

export function CloseIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function MenuIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9h16M7 15h13" />
    </svg>
  )
}
