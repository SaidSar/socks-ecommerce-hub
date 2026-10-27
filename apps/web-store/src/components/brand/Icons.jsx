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

export function UserIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6" />
    </svg>
  )
}

export function EyeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.9 9.9 0 0112 6c5 0 8.5 4 9.5 6-.5 1-1.6 2.6-3.2 3.9M6.4 7.6C4.6 8.9 3.2 10.7 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </svg>
  )
}

export function ArrowIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
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
