import { useCallback, useEffect, useMemo, useState } from 'react'
import * as adminApi from '../services/adminApi'
import { AdminDataContext } from './admin-data-context'

/**
 * Puente entre las páginas y services/adminApi.js. Inyecta el usuario de la sesión (rol para ocultar
 * importes, nombre para la bitácora) y sube `version` tras cada cambio para que las vistas recarguen.
 */
export function AdminDataProvider({ user, children }) {
  const [version, setVersion] = useState(0)
  const [summary, setSummary] = useState({ toPrepare: 0, late: 0 })
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let alive = true
    adminApi.getSummary().then((s) => alive && setSummary(s))
    return () => {
      alive = false
    }
  }, [version])

  const api = useMemo(() => {
    const role = user?.role
    const mutate =
      (fn) =>
      async (...args) => {
        const res = await fn(...args)
        refresh()
        return res
      }
    return {
      getDashboard: (range) => adminApi.getDashboard(range, role),
      getOrders: (params) => adminApi.getOrders(params, role),
      getOrder: (id) => adminApi.getOrder(id, role),
      advanceOrder: mutate((id, payload) => adminApi.advanceOrder(id, payload, user)),
      cancelOrder: mutate((id) => adminApi.cancelOrder(id, user)),
      markOrderPaid: mutate((id) => adminApi.markOrderPaid(id, user)),
      saveOrderNote: mutate((id, note) => adminApi.saveOrderNote(id, note, user)),
      getInventory: (params) => adminApi.getInventory(params),
      getStockRow: (sku) => adminApi.getStockRow(sku),
      getMovements: (sku) => adminApi.getMovements(sku),
      adjustStock: mutate((sku, movement) => adminApi.adjustStock(sku, movement, user)),
      previewImport: (text) => adminApi.previewImport(text, role),
      applyImport: mutate((rows) => adminApi.applyImport(rows, user)),
      getTemplateCsv: () => adminApi.getTemplateCsv(role),
      getSettings: () => adminApi.getSettings(),
      saveSettings: mutate((s) => adminApi.saveSettings(s)),
      validateSettings: adminApi.validateSettings,
      getCatalog: () => adminApi.getCatalog(role),
      getCatalogSummary: () => adminApi.getCatalogSummary(role),
      saveProduct: mutate((form) => adminApi.saveProduct(form, user)),
      addBrand: mutate((name) => adminApi.addBrand(name, user)),
      setBrandVisibility: mutate((slug, show) => adminApi.setBrandVisibility(slug, show, user)),
      saveCollection: mutate((form) => adminApi.saveCollection(form, user)),
      getInternalUsers: () => adminApi.getInternalUsers(),
      getCouriers: () => adminApi.getCouriers(),
      resetDemoData: mutate(() => adminApi.resetDemoData()),
    }
  }, [user, refresh])

  const value = useMemo(() => ({ api, version, summary, refresh }), [api, version, summary, refresh])
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}
