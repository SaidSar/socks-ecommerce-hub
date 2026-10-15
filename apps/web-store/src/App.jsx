import ApiStatus from './components/ApiStatus'

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {/* Sello hanko */}
      <div className="mb-10 flex size-14 items-center justify-center bg-aka text-xl font-bold text-washi">
        ソ
      </div>

      <h1 className="text-5xl font-light tracking-[0.3em] sm:text-6xl">
        SOKKO <span className="text-3xl tracking-normal text-sumi/60 sm:text-4xl">(ソッコ)</span>
      </h1>

      <div className="my-8 h-px w-16 bg-aka" />

      <p className="text-lg tracking-wide text-sumi/70">Confort que Renace cada paso</p>

      <div className="mt-14">
        <ApiStatus />
      </div>
    </main>
  )
}

export default App
