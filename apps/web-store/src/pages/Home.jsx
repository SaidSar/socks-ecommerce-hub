import { useState } from 'react'
import Footer from '../components/layout/Footer'
import Navbar from '../components/layout/Navbar'
import TopBar from '../components/layout/TopBar'

// Composición del Home (las secciones se completan en la Fase 6).
export default function Home() {
  const [query, setQuery] = useState('')

  return (
    <>
      <TopBar />
      <Navbar query={query} onQueryChange={setQuery} />
      <main>
        {['origen', 'materia', 'atelier', 'filosofia'].map((id) => (
          <section key={id} id={id} className="gutter flex min-h-[80vh] items-start py-20">
            <h2 className="font-serif text-[clamp(32px,4.6vw,64px)] font-light">#{id}</h2>
          </section>
        ))}
      </main>
      <Footer />
    </>
  )
}
