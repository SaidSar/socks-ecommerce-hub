import { useCallback, useEffect, useRef, useState } from 'react'
import CartDrawer from '../components/cart/CartDrawer'
import AtelierCatalog from '../components/home/AtelierCatalog'
import Filosofia from '../components/home/Filosofia'
import HeroEditorial from '../components/home/HeroEditorial'
import MateriaCuration from '../components/home/MateriaCuration'
import Footer from '../components/layout/Footer'
import Navbar from '../components/layout/Navbar'
import TopBar from '../components/layout/TopBar'
import { useCart } from '../hooks/useCart'
import { getHomePieces } from '../services/productService'

const OPEN_CART_DELAY_MS = 500

export default function Home() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('loading') // 'loading' | 'error' | 'ready'
  const [data, setData] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const { add, open } = useCart()
  const openTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    getHomePieces()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  useEffect(() => () => clearTimeout(openTimer.current), [])

  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }, [])

  // "Adquirir Pieza": agrega y abre la bolsa 500 ms después (DESIGN.md §5, Fase 7).
  const acquire = useCallback(
    (piece, tone, size) => {
      add(piece, tone, size)
      clearTimeout(openTimer.current)
      openTimer.current = setTimeout(open, OPEN_CART_DELAY_MS)
    },
    [add, open],
  )

  const featured = data?.pieces.find((p) => p.id === data.featuredId) ?? null

  return (
    <>
      <TopBar />
      <Navbar query={query} onQueryChange={setQuery} />
      <main>
        <HeroEditorial piece={featured} />
        <MateriaCuration />
        <AtelierCatalog
          pieces={data?.pieces ?? []}
          status={status}
          query={query}
          onAcquire={acquire}
          onRetry={retry}
        />
        <Filosofia />
      </main>
      <Footer />
      <CartDrawer />
    </>
  )
}
