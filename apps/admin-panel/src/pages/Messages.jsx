import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import SearchField from '../components/ui/SearchField'
import SidePanel, { SidePanelHeader } from '../components/ui/SidePanel'
import { SkeletonRows } from '../components/ui/Skeleton'
import Tabs from '../components/ui/Tabs'
import { findFolio, MESSAGE_STATUSES, MESSAGE_TABS, relativeTime, replyMailto, snippet, statusOf } from '../domain/messages'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'

const longDate = (d) =>
  new Date(d).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mazatlan' })

const EMPTY = {
  nuevos: ['No hay mensajes nuevos', 'Los mensajes del formulario de contacto de la tienda llegan aquí.'],
  leidos: ['No hay mensajes leídos', 'Al abrir un mensaje nuevo pasa a esta pestaña.'],
  archivados: ['No hay mensajes archivados', 'Archive los que ya atendió para que no estorben.'],
}

/** Detalle: texto completo, responder por correo (mailto, sin costo de servidor), enlace al pedido y acciones. */
function MessageDetail({ message, now, onClose, returnFocus, onAction, busy }) {
  const folio = findFolio(message.subject, message.message)
  const status = statusOf(message)
  return (
    <SidePanel label={`Mensaje de ${message.name}`} onClose={onClose} returnFocus={returnFocus}>
      <SidePanelHeader onClose={onClose} closeLabel="Cerrar mensaje">
        <p className="text-[12px] text-ink-soft">{message.subject}</p>
        <h2 className="text-[17px] font-semibold truncate mt-0.5">{message.name}</h2>
        <a href={`mailto:${message.email}`} className="text-[12.5px] text-ai hover:underline break-all">
          {message.email}
        </a>
      </SidePanelHeader>
      <div className="p-5 space-y-5 animate-fade">
        <p className="text-[12.5px] text-ink-soft">
          <time dateTime={message.createdAt}>{longDate(message.createdAt)}</time> · {relativeTime(message.createdAt, now)}
        </p>
        {folio && (
          <Link to={`/pedidos/${folio}`} className="flex items-center gap-2 rounded-md border border-line bg-linen px-3 py-3 text-[13px] hover:bg-sand min-h-11">
            <Icon name="orders" className="w-4 h-4" />
            Ver el pedido <span className="font-medium tnum">{folio}</span>
            <Icon name="right" className="w-4 h-4 ml-auto" />
          </Link>
        )}
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.message}</p>
        {message.handledBy && (
          <p className="text-[12px] text-ink-soft">
            Último cambio: {message.handledBy}
            {message.archivedAt ? ' (archivado)' : message.readAt ? ' (leído)' : ''}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={replyMailto(message, longDate(message.createdAt))}
            className="inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap bg-laca hover:bg-laca-hover text-white h-10 max-lg:h-11 px-4 text-[13.5px]"
          >
            <Icon name="reply" className="w-4 h-4" />
            Responder por correo
          </a>
          {status !== 'archivados' && message.readAt && (
            <Button variant="outline" disabled={busy} onClick={() => onAction(message, 'unread')}>
              Marcar como no leído
            </Button>
          )}
          {status === 'archivados' ? (
            <Button variant="outline" disabled={busy} onClick={() => onAction(message, 'unarchive')}>
              <Icon name="archive" className="w-4 h-4" />
              Sacar del archivo
            </Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => onAction(message, 'archive')}>
              <Icon name="archive" className="w-4 h-4" />
              Archivar
            </Button>
          )}
        </div>
        <p className="text-[12px] text-ink-soft">“Responder por correo” abre su programa de correo con el asunto y el mensaje citado.</p>
      </div>
    </SidePanel>
  )
}

const DONE = {
  read: ['Marcado como leído', 'unread'],
  unread: ['Marcado como no leído', null],
  archive: ['Mensaje archivado', 'unarchive'],
  unarchive: ['El mensaje volvió a la bandeja', null],
}

/** Bandeja de mensajes de contacto (Dueño y Operaciones): Nuevos · Leídos · Archivados. */
export default function Messages() {
  const { api } = useAdminData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)
  const status = MESSAGE_STATUSES.includes(params.get('estado')) ? params.get('estado') : 'nuevos'
  const { data, error, loading, retry } = useAdminQuery(() => api.getMessages({ status, q }), [status, q])
  const now = api.now()

  const setStatus = (key) => {
    const next = new URLSearchParams(params)
    if (key === 'nuevos') next.delete('estado')
    else next.set('estado', key)
    setParams(next, { replace: true })
  }

  /** Cambia el estado y avisa; "Deshacer" regresa al estado anterior. */
  const act = useCallback(
    async function apply(message, action) {
      setBusy(true)
      try {
        const updated = await api.updateMessage(message.id, action)
        setOpen((current) => (current?.id === updated.id ? (action === 'archive' ? null : updated) : current))
        const [text, undo] = DONE[action]
        toast.success(text, {
          key: `message-${message.id}`,
          action: undo ? { label: 'Deshacer', onClick: () => apply(updated, undo) } : undefined,
        })
        return updated
      } catch (err) {
        toast.error(err.message || 'No pudimos guardar el cambio. Intente de nuevo.', { key: `message-${message.id}` })
        return null
      } finally {
        setBusy(false)
      }
    },
    [api, toast],
  )

  // Abrir un mensaje nuevo lo marca como leído (con aviso y opción de deshacer).
  const onOpen = (message) => {
    setOpen(message)
    if (statusOf(message) === 'nuevos') act(message, 'read')
  }

  const onClose = useCallback(() => setOpen(null), [])
  const returnFocus = useCallback(
    () => (open && document.querySelector(`[data-message="${open.id}"]`)) || document.querySelector('[role="tab"][aria-selected="true"]'),
    [open],
  )

  const tabs = MESSAGE_TABS.map((t) => ({ ...t, count: data?.counts[t.key], alert: false }))
  const [emptyTitle, emptyText] = EMPTY[status]

  return (
    <>
      <PageHeader title="Mensajes" sub="Lo que escriben desde el formulario de contacto de la tienda" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative overflow-x-auto -mx-1 px-1 py-1 flex-1 min-w-0">
          <Tabs options={tabs} value={status} onChange={setStatus} label="Bandeja de mensajes" />
        </div>
        <SearchField id="messages-q" value={q} onChange={setQ} placeholder="Nombre, correo, asunto o texto" label="Buscar mensajes por nombre, correo, asunto o texto" />
      </div>

      {error && (
        <Card>
          <ErrorState title="No pudimos cargar los mensajes." error={error} onRetry={retry} />
        </Card>
      )}
      {!data && !error && (
        <Card>
          <SkeletonRows label="Cargando mensajes…" rows={5} />
        </Card>
      )}

      {data && (
        <div className={`grid gap-5 animate-fade ${open ? '2xl:grid-cols-[minmax(0,1fr)_440px]' : ''}`}>
          <Card className={`min-w-0 overflow-hidden ${loading ? 'opacity-70' : ''}`} aria-busy={loading}>
            {!data.messages.length ? (
              <EmptyState icon="mail" title={q ? `Ningún mensaje coincide con “${q}”` : emptyTitle}>
                {q ? 'Pruebe con el correo o una palabra del asunto.' : emptyText}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.messages.map((m) => {
                  const isNew = statusOf(m) === 'nuevos'
                  const active = open?.id === m.id
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        data-message={m.id}
                        onClick={() => onOpen(m)}
                        aria-current={active ? 'true' : undefined}
                        className={`w-full text-left px-4 sm:px-5 py-3.5 flex gap-3 ${active ? 'bg-linen' : 'hover:bg-linen'}`}
                      >
                        <span className="pt-1.5 w-2.5 shrink-0" aria-hidden="true">
                          {isNew && <span className="block w-2.5 h-2.5 rounded-full bg-ai" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={`truncate ${isNew ? 'font-semibold' : 'font-medium'}`}>{m.name}</span>
                            {isNew && <span className="sr-only">(no leído)</span>}
                            <time dateTime={m.createdAt} className="ml-auto shrink-0 text-[12px] text-ink-soft">
                              {relativeTime(m.createdAt, now)}
                            </time>
                          </span>
                          <span className={`block text-[13px] truncate ${isNew ? 'text-ink' : 'text-ink-soft'}`}>{m.subject}</span>
                          <span className="block text-[12.5px] text-ink-soft truncate">{snippet(m.message)}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {data.total > data.messages.length && (
              <p className="px-5 py-3 border-t border-line text-[12.5px] text-ink-soft">
                Se muestran los {data.messages.length} más recientes de {data.total}. Use la búsqueda para encontrar uno anterior.
              </p>
            )}
          </Card>
          {open && <MessageDetail key={open.id} message={open} now={now} onClose={onClose} returnFocus={returnFocus} onAction={act} busy={busy} />}
        </div>
      )}
    </>
  )
}
