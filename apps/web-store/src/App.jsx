import ApiStatus from './components/ApiStatus'

// Pantalla temporal de verificación de tokens (Fase 1). Se reemplaza por el Router en la Fase 3.
function App() {
  return (
    <main className="linen-tex flex min-h-screen flex-col items-center justify-center bg-linen px-6 text-center text-ink">
      <p className="text-[11px] tracking-[.32em] text-matcha uppercase">El elogio del detalle</p>

      <h1 className="mt-6 font-serif text-[clamp(46px,7.4vw,104px)] leading-[.98] font-light">
        Confort que <em className="text-laca italic">Renace</em>
      </h1>

      <p className="mt-6 font-jp text-sm tracking-[.6em] text-laca" aria-hidden="true">
        足袋工房
      </p>

      <div className="mt-14">
        <ApiStatus />
      </div>
    </main>
  )
}

export default App
