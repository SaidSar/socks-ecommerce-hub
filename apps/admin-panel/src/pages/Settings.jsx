import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import InternalUsers from '../components/settings/InternalUsers'
import InventorySettings from '../components/settings/InventorySettings'
import LocalZoneSettings from '../components/settings/LocalZoneSettings'
import ShippingSettings from '../components/settings/ShippingSettings'
import Button from '../components/ui/Button'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'

const toDraft = (s) => ({
  freeShippingThreshold: String(s.freeShippingThreshold),
  parcelShippingCost: String(s.parcelShippingCost),
  localShippingCost: String(s.localShippingCost),
  localFreeShipping: s.localFreeShipping,
  fewUnitsThreshold: String(s.fewUnitsThreshold),
  localZones: s.localZones,
})

const toSettings = (d) => ({
  freeShippingThreshold: d.freeShippingThreshold === '' ? NaN : Number(d.freeShippingThreshold),
  parcelShippingCost: d.parcelShippingCost === '' ? NaN : Number(d.parcelShippingCost),
  localShippingCost: d.localShippingCost === '' ? NaN : Number(d.localShippingCost),
  localFreeShipping: d.localFreeShipping,
  fewUnitsThreshold: d.fewUnitsThreshold === '' ? NaN : Number(d.fewUnitsThreshold),
  localZones: d.localZones,
})

function SettingsForm({ initial, users }) {
  const { api } = useAdminData()
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(() => toDraft(initial))
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const dirty = JSON.stringify(toSettings(draft)) !== JSON.stringify(toSettings(toDraft(saved)))

  // Aviso al salir con cambios sin guardar: dentro del panel (router) y al cerrar o recargar la pestaña.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const set = (k) => (v) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
    setStatus('')
  }

  const save = async () => {
    setFormMessage('')
    const next = toSettings(draft)
    const errs = api.validateSettings(next)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setStatus('')
      return
    }
    setBusy(true)
    try {
      const res = await api.saveSettings({ ...next, rowVersion: saved.rowVersion })
      setSaved(res)
      setDraft(toDraft(res))
      setStatus('Cambios guardados. La tienda los toma de GET /api/config.')
    } catch (e) {
      setErrors(e.errors ?? {})
      // Un conflicto (otra persona guardó antes) no trae errores por campo: el mensaje se muestra tal cual.
      setFormMessage(e.errors ? '' : e.message)
    } finally {
      setBusy(false)
    }
  }

  const hasErrors = Object.values(errors).some(Boolean)

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 animate-fade">
      <ShippingSettings draft={draft} set={set} errors={errors} />
      <LocalZoneSettings zones={draft.localZones} onChange={set('localZones')} error={errors.localZones} />
      <InventorySettings value={draft.fewUnitsThreshold} onChange={set('fewUnitsThreshold')} error={errors.fewUnitsThreshold} />
      <InternalUsers users={users} onInvite={api.inviteUser} />
      <div className="xl:col-span-2 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>
          <Icon name="check" className="w-4 h-4" />
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <span role="status" className={`text-[13px] ${hasErrors || formMessage ? 'text-laca' : 'text-matcha'}`}>
          {formMessage || (hasErrors ? 'Revise los campos marcados.' : status)}
        </span>
        {dirty && !status && !hasErrors && <span className="text-[12.5px] text-ink-soft">Hay cambios sin guardar.</span>}
      </div>

      {blocker.state === 'blocked' && (
        <Modal title="¿Salir sin guardar?" onClose={() => blocker.reset()} size="max-w-md" role="alertdialog">
          <p className="text-[13.5px]">Los cambios de configuración se perderán si sale de esta página.</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Button variant="outline" onClick={() => blocker.reset()}>
              Seguir editando
            </Button>
            <Button onClick={() => blocker.proceed()}>Salir sin guardar</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Configuración (solo Dueño): envíos, zona local, inventario y usuarios internos. */
export default function Settings() {
  const { api } = useAdminData()
  const { data: settings, error } = useAdminQuery(() => api.getSettings(), [])
  const { data: users } = useAdminQuery(() => api.getInternalUsers(), [])
  const [initial, setInitial] = useState(null)
  // El formulario se inicia una sola vez; los guardados posteriores no lo reinician.
  if (settings && !initial) setInitial(settings)

  return (
    <>
      <PageHeader title="Configuración" sub="Reglas de envío, zona local, inventario y usuarios" />
      {error && <EmptyState icon="alert" title="No pudimos cargar la configuración." />}
      {!(initial && users) && !error && <Loading label="Cargando configuración…" />}
      {initial && users && <SettingsForm initial={initial} users={users} />}
    </>
  )
}
