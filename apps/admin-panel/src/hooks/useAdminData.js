import { useContext, useEffect, useRef, useState } from 'react'
import { AdminDataContext } from '../context/admin-data-context'

/** Acceso a la API del panel. Los componentes nunca importan seed.js ni adminApi.js directamente. */
export function useAdminData() {
  const ctx = useContext(AdminDataContext)
  if (!ctx) throw new Error('useAdminData debe usarse dentro de <AdminDataProvider>')
  return ctx
}

/**
 * Carga datos con `fetcher` y los vuelve a pedir cuando cambian `deps` o tras cualquier cambio en la API.
 * Mientras recarga conserva los datos anteriores (sin parpadeo); `loading` indica la petición en curso.
 */
export function useAdminQuery(fetcher, deps = []) {
  const { version } = useAdminData()
  const key = JSON.stringify([version, ...deps])
  const fetcherRef = useRef(fetcher)
  const [state, setState] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let alive = true
    fetcherRef.current().then(
      (data) => alive && setState({ key, data, error: null }),
      (error) => alive && setState((s) => ({ ...s, key, error })),
    )
    return () => {
      alive = false
    }
  }, [key])

  return { data: state.data, error: state.error, loading: state.key !== key }
}
