import { useCallback, useEffect, useMemo, useState } from 'react'
import { can } from '../config/roles'
import * as adminApi from '../services/adminApi'
import { USE_API } from '../services/api'
import { AdminDataContext } from './admin-data-context'

/**
 * Puente entre las páginas y services/adminApi.js. Inyecta el usuario de la sesión (rol para ocultar
 * importes, nombre para la bitácora) y sube `version` tras cada cambio para que las vistas recarguen.
 */
export function AdminDataProvider({ user, children }) {
  const [version, setVersion] = useState(0)
  const [summary, setSummary] = useState({ toPrepare: 0, late: 0 })
  const [unread, setUnread] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const canReadMessages = can(user?.role, 'messages.view')

  useEffect(() => {
    let alive = true
    // El resumen es secundario: si falla, la campana conserva su último número y la pantalla da su propio error.
    adminApi.getSummary().then((s) => alive && setSummary(s), () => {})
    return () => {
      alive = false
    }
  }, [version])

  // Contador de mensajes nuevos de la barra lateral: tras cada cambio y cada 60 s mientras la pestaña está a la vista.
  useEffect(() => {
    if (!canReadMessages) return
    let alive = true
    const load = () => adminApi.getUnreadCount(user).then((n) => alive && setUnread(n), () => {})
    load()
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 60_000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [version, canReadMessages, user])

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
      cancelOrder: mutate((id, rowVersion) => adminApi.cancelOrder(id, user, rowVersion)),
      markOrderPaid: mutate((id, rowVersion) => adminApi.markOrderPaid(id, user, rowVersion)),
      saveOrderNote: mutate((id, note, rowVersion) => adminApi.saveOrderNote(id, note, user, rowVersion)),
      getPackingList: (id) => adminApi.getPackingList(id),
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
      saveProduct: mutate((form) => adminApi.saveProduct(form, user)),
      uploadProductImage: mutate((productId, blob, altText) => adminApi.uploadProductImage(productId, blob, altText)),
      deleteProductImage: mutate((productId, imageId) => adminApi.deleteProductImage(productId, imageId)),
      reorderProductImages: mutate((productId, imageIds) => adminApi.reorderProductImages(productId, imageIds)),
      setProductImageAlt: mutate((productId, imageId, altText) => adminApi.setProductImageAlt(productId, imageId, altText)),
      addBrand: mutate((name) => adminApi.addBrand(name, user)),
      setBrandVisibility: mutate((slug, show, rowVersion) => adminApi.setBrandVisibility(slug, show, user, rowVersion)),
      saveCollection: mutate((form) => adminApi.saveCollection(form, user)),
      getInternalUsers: () => adminApi.getInternalUsers(),
      inviteUser: mutate((invitation) => adminApi.inviteUser(invitation, user)),
      getCouriers: () => adminApi.getCouriers(),
      getCustomers: (params) => adminApi.getCustomers(params, user),
      getCustomer: (key) => adminApi.getCustomer(key, user),
      exportCustomers: (params) => adminApi.exportCustomers(params, user),
      exportMarketing: () => adminApi.exportMarketing(user),
      getSalesReport: (period) => adminApi.getSalesReport(period, user),
      downloadSalesCsv: (period) => adminApi.downloadSalesCsv(period, user),
      getMessages: (params) => adminApi.getMessages(params, user),
      updateMessage: mutate((id, action) => adminApi.updateMessage(id, action, user)),
      now: adminApi.currentNow,
      today: adminApi.currentToday,
      resetDemoData: mutate(() => adminApi.resetDemoData()),
    }
  }, [user, refresh])

  const value = useMemo(() => ({ api, version, summary, unread, refresh, usesApi: USE_API }), [api, version, summary, unread, refresh])
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}
