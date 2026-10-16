function LogoMark() {
  return (
    <span className="flex items-center gap-3 select-none">
      <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden="true">
        <circle cx="19" cy="23" r="7" fill="var(--color-laca)" />
        <path
          d="M20 6 H32 V22 C32 28 34 31 37 34 C41 38 39 43 34 43 H14 C10 43 8 40 9 37 C10 35 12 34 14 34 L17 33 C20 31 20 27 20 24 Z"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M14 35 C16 37 16 41 14 43" fill="none" stroke="var(--color-ink)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="leading-none">
        <span className="block font-serif text-[22px] tracking-[.28em]">SOKKO</span>
        <span className="mt-1 block font-jp text-[10px] tracking-[.6em] text-laca" aria-hidden="true">
          足袋工房
        </span>
      </span>
    </span>
  )
}

/** Logotipo SOKKO. Por defecto es un enlace a #origen; `asLink={false}` lo deja como marca estática (footer). */
export default function Logo({ asLink = true }) {
  if (!asLink) return <LogoMark />
  return (
    <a href="#origen" className="inline-flex">
      <LogoMark />
      <span className="sr-only"> inicio</span>
    </a>
  )
}
