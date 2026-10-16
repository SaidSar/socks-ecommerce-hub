// Láminas tipo herbolario de "Curaduría de la materia prima" (DESIGN.md §6.6). Decorativas.
const PAPER = '#FBF9F6'

function Cotton() {
  return (
    <>
      <path d="M60 140 C60 110 58 92 60 70" />
      <path d="M60 100 C48 96 40 88 36 78" />
      <path d="M36 78 c-6 -2 -8 -10 -2 -12 c6 -2 10 4 8 10" />
      <circle cx="60" cy="46" r="14" fill={PAPER} />
      <circle cx="46" cy="58" r="12" fill={PAPER} />
      <circle cx="74" cy="58" r="12" fill={PAPER} />
      <circle cx="60" cy="64" r="11" fill={PAPER} />
      <path d="M50 72 L60 66 L70 72 M60 66 V78" stroke="var(--color-matcha)" />
    </>
  )
}

function Tabi() {
  return (
    <>
      <path d="M46 14 H78 V66 C78 82 82 92 89 100 C98 110 94 126 80 126 H34 C22 126 16 118 18 110 C20 104 26 101 32 100 L38 98 C45 93 46 82 46 72 Z" />
      <path d="M32 103 C37 109 37 119 31 126" stroke="var(--color-laca)" strokeWidth="1.4" />
      <path d="M14 104 l-6 -4 M14 112 h-8" stroke="var(--color-laca)" />
      <text x="2" y="134" fontSize="7" fill="var(--color-ink-soft)" stroke="none" fontFamily="Work Sans">
        hallux libre
      </text>
    </>
  )
}

function Pigment() {
  return (
    <>
      <ellipse cx="60" cy="104" rx="38" ry="12" />
      <path d="M22 104 C24 124 96 124 98 104" />
      <ellipse cx="60" cy="104" rx="26" ry="7" fill="var(--color-laca)" fillOpacity=".75" stroke="none" />
      <path d="M60 20 C76 40 84 54 84 66 a24 24 0 0 1 -48 0 C36 54 44 40 60 20 Z" fill="var(--color-moss)" fillOpacity=".25" />
      <path d="M60 34 V80 M60 52 l-10 -8 M60 62 l12 -9" />
    </>
  )
}

const VARIANTS = { cotton: Cotton, tabi: Tabi, pigment: Pigment }

export default function BotanicalPlate({ variant }) {
  const Plate = VARIANTS[variant]
  return (
    <svg
      viewBox="0 0 120 140"
      className="h-full w-full"
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth="1"
      aria-hidden="true"
      focusable="false"
    >
      <Plate />
    </svg>
  )
}
