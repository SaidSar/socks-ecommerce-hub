import { Link } from 'react-router-dom'
import { relativeTime, snippet } from '../../domain/messages'
import { useAdminData, useAdminQuery } from '../../hooks/useAdminData'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import EmptyState, { ErrorState } from '../ui/EmptyState'
import { SkeletonRows } from '../ui/Skeleton'

/** Tarjeta del Dashboard (los dos roles): los 3 mensajes de contacto nuevos más recientes. */
export default function NewMessages() {
  const { api, unread } = useAdminData()
  const { data, error, retry } = useAdminQuery(() => api.getMessages({ status: 'nuevos' }), [])
  const latest = data?.messages.slice(0, 3) ?? []
  const now = api.now()

  return (
    <Card className="min-w-0" aria-labelledby="new-messages-title">
      <CardHead
        id="new-messages-title"
        title="Mensajes nuevos"
        sub={data ? (unread ? `${unread} sin leer` : 'Todo leído') : 'Formulario de contacto'}
        right={
          <Link to="/mensajes" className="text-[12.5px] text-ai hover:underline min-h-11 lg:min-h-0 inline-flex items-center">
            Ver bandeja
          </Link>
        }
      />
      {error && <ErrorState title="No pudimos cargar los mensajes." onRetry={retry} className="py-6" />}
      {!data && !error && <SkeletonRows rows={3} label="Cargando mensajes…" />}
      {data && !latest.length && (
        <EmptyState icon="mail" title="Sin mensajes nuevos" className="py-8">
          Cuando alguien escriba desde la tienda aparecerá aquí.
        </EmptyState>
      )}
      {latest.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {latest.map((m) => (
            <li key={m.id}>
              <Link to="/mensajes" className="flex gap-3 px-5 py-3 hover:bg-linen">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-ai shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-medium truncate text-[13px]">{m.name}</span>
                    <span className="ml-auto shrink-0 text-[11.5px] text-ink-soft">{relativeTime(m.createdAt, now)}</span>
                  </span>
                  <span className="block text-[12.5px] text-ink-soft truncate">
                    {m.subject} · {snippet(m.message, 70)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
