import { useId, useState } from 'react'
import { roleLabel } from '../../config/roles'
import Button from '../ui/Button'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

const FIELD = 'h-11 w-full rounded-md border bg-paper px-3 text-[14px] outline-none focus:border-ai'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(form) {
  const errors = {}
  if (!form.firstName.trim()) errors.firstName = 'Escriba su nombre.'
  if (!form.lastName.trim()) errors.lastName = 'Escriba su apellido.'
  if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Revise el formato del correo.'
  return errors
}

/** Invitación al equipo (DESIGN_ADMIN.md §9): el invitado crea su contraseña con el enlace del correo. */
function InviteModal({ onInvite, onClose }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: 'operaciones' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const uid = useId()

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
    setFormError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await onInvite({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim() })
    } catch (ex) {
      setErrors(ex.errors ?? {})
      setFormError(ex.errors ? '' : ex.message)
      setBusy(false)
    }
  }

  const field = (key, label, props = {}) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${uid}-${key}`} className="text-[12px] font-medium text-ink-soft">
        {label}
      </label>
      <input
        id={`${uid}-${key}`}
        value={form[key]}
        onChange={set(key)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${uid}-${key}-err` : undefined}
        className={`${FIELD} ${errors[key] ? 'border-laca' : 'border-line'}`}
        {...props}
      />
      {errors[key] && (
        <p id={`${uid}-${key}-err`} className="text-[12.5px] text-laca">
          {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <Modal title="Invitar al equipo" onClose={onClose} size="max-w-md">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-soft">Recibirá un enlace para crear su contraseña. Vence en 72 horas.</p>
        {field('firstName', 'Nombre', { autoFocus: true, autoComplete: 'off' })}
        {field('lastName', 'Apellido', { autoComplete: 'off' })}
        {field('email', 'Correo', { type: 'email', autoComplete: 'off' })}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-role`} className="text-[12px] font-medium text-ink-soft">
            Rol
          </label>
          <select id={`${uid}-role`} value={form.role} onChange={set('role')} className={`${FIELD} border-line`}>
            <option value="operaciones">{roleLabel('operaciones')}</option>
            <option value="dueno">{roleLabel('dueno')}</option>
          </select>
        </div>
        {formError && (
          <p role="alert" className="text-[13px] text-laca">
            {formError}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar invitación'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Usuarios internos: solo el Dueño invita. */
export default function InternalUsers({ users, onInvite }) {
  const [inviting, setInviting] = useState(false)
  const [status, setStatus] = useState('')

  const invite = async (form) => {
    const user = await onInvite(form)
    setInviting(false)
    setStatus(`Invitación enviada a ${user.email}.`)
  }

  return (
    <Card aria-labelledby="users-title">
      <CardHead
        id="users-title"
        title="Usuarios internos"
        sub="Solo el Dueño da de alta y cambia roles"
        right={
          <Button variant="outline" size="sm" onClick={() => setInviting(true)}>
            <Icon name="plus" className="w-4 h-4" />
            Invitar
          </Button>
        }
      />
      <p role="status" className="px-5 pb-3 text-[13px] text-matcha empty:hidden">
        {status}
      </p>
      <ul className="border-t border-line divide-y divide-line">
        {users.map((u) => (
          <li key={u.email} className="px-5 py-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-sand text-[12px] font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
              {u.name
                .split(' ')
                .map((x) => x[0])
                .join('')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px]">{u.name}</span>
              <span className="block text-[12px] text-ink-soft truncate">{u.email}</span>
            </span>
            <span className={`text-[12px] rounded-full px-2.5 py-0.5 ${u.role === 'dueno' ? 'bg-ink text-linen' : 'bg-info-bg text-info-ink'}`}>{roleLabel(u.role)}</span>
          </li>
        ))}
      </ul>
      {inviting && <InviteModal onInvite={invite} onClose={() => setInviting(false)} />}
    </Card>
  )
}
