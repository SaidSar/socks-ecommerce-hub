import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, CircleX, LoaderCircle, RotateCw } from 'lucide-react'
import { API_URL, getHealth } from '../services/api'

const STATES = {
  loading: { Icon: LoaderCircle, label: 'Conectando con la API…', tone: 'text-ink-soft', spin: true },
  online: { Icon: CircleCheck, label: 'API conectada', tone: 'text-emerald-700' },
  offline: { Icon: CircleX, label: 'API sin conexión', tone: 'text-laca' },
}

export default function ApiStatus() {
  const [status, setStatus] = useState('loading')
  const [detail, setDetail] = useState('')

  const check = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await getHealth()
      setStatus('online')
      setDetail(`${data.service} · ${data.status}`)
    } catch {
      setStatus('offline')
      setDetail(API_URL)
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  const { Icon, label, tone, spin } = STATES[status]

  return (
    <div className="inline-flex items-center gap-3 border border-ink/15 bg-white/60 px-4 py-2.5 text-sm">
      <Icon className={`size-4 ${tone} ${spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className={`font-medium ${tone}`}>{label}</span>
      {detail && <span className="text-ink-soft">{detail}</span>}
      <button
        type="button"
        onClick={check}
        disabled={status === 'loading'}
        className="ml-1 text-ink-soft transition hover:text-laca disabled:opacity-40"
        aria-label="Reintentar conexión"
      >
        <RotateCw className="size-4" />
      </button>
    </div>
  )
}
