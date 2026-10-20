import { roleLabel } from '../../config/roles'
import Button from '../ui/Button'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import Icon from '../ui/Icon'

/** Usuarios internos (solo lectura en v1). */
export default function InternalUsers({ users }) {
  return (
    <Card aria-labelledby="users-title">
      <CardHead
        id="users-title"
        title="Usuarios internos"
        sub="Solo el Dueño da de alta y cambia roles"
        right={
          // TODO(api): POST /api/admin/users/invitations
          <Button variant="outline" size="sm" disabled title="Disponible al conectar la API">
            <Icon name="plus" className="w-4 h-4" />
            Invitar
          </Button>
        }
      />
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
    </Card>
  )
}
