// Acceso al panel (DESIGN_ADMIN.md §4). Única capa que habla con /api/admin/auth/*. Con USE_API usa la API;
// sin ella valida contra las cuentas demo de abajo.
import { API_URL, USE_API } from './api'

export const SESSION_KEY = 'sokko.admin.session.v1'

/** Se emite cuando la API responde 401: la sesión guardada ya no sirve. */
export const SESSION_EXPIRED_EVENT = 'sokko:admin-session-expired'

// Solo para el mock: con la API, el hash vive en el servidor. SHA-256 de las contraseñas demo.
const USERS = [
  { id: 'u-aiko', name: 'Aiko Morales', email: 'hola@sokko.mx', role: 'dueno', hash: '9733028d4e7e2b1601a0f0df6df8e0e944d6f7759528ea8da62ae0ae8da1a259' },
  { id: 'u-daniel', name: 'Daniel Ruiz', email: 'daniel@sokko.mx', role: 'operaciones', hash: '4f42ff63748ce568d6b18856d9818700494ac522945ec4236b798b4e1b3772fe' },
  { id: 'u-kevin', name: 'Kevin Armenta', email: 'kevin@sokko.mx', role: 'operaciones', hash: '4f42ff63748ce568d6b18856d9818700494ac522945ec4236b798b4e1b3772fe' },
]

// Solo se muestran en import.meta.env.DEV (pantalla de acceso y README).
export const DEMO_ACCOUNTS = [
  { role: 'Dueño', name: 'Aiko Morales', email: 'hola@sokko.mx', password: 'Kyoto2026' },
  { role: 'Operaciones', name: 'Daniel Ruiz', email: 'daniel@sokko.mx', password: 'Operaciones2026' },
  { role: 'Operaciones', name: 'Kevin Armenta', email: 'kevin@sokko.mx', password: 'Operaciones2026' },
]

export class AuthError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()
const latency = () => new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : 500 + Math.random() * 300))

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Usuario público: nunca incluye el hash. */
const toPublic = ({ id, name, email, role }) => ({ id, name, email, role })

/** Iniciales + apellido corto para bitácoras: "Aiko Morales" → "Aiko M." */
export const shortName = (name) => {
  const [first, last = ''] = String(name).split(' ')
  return last ? `${first} ${last[0]}.` : first
}

/** Lista de usuarios internos (solo lectura en Configuración). TODO(api): GET /api/admin/users */
export const listUsers = () => USERS.map(toPublic)

const readStored = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* sin almacenamiento: la sesión vive solo en memoria */
  }
}

/** Petición autenticada con el token de la sesión. Un 401 la cierra y avisa a la app. */
export async function authFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${readStored()?.accessToken}` },
  })
  if (response.status === 401) {
    logout()
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  return response
}

/** Con la API, confirma al cargar que el token sigue vigente y que el rol es del equipo. Un fallo de red no cierra la sesión. */
export async function verifySession() {
  const stored = readStored()
  if (!USE_API || !stored?.accessToken) return readSession()
  try {
    const response = await authFetch('/api/admin/auth/me')
    if (response.status === 403) logout()
    if (!response.ok) return null
    const { user } = await response.json()
    saveSession({ ...stored, user })
    return user
  } catch {
    return readSession()
  }
}

export async function login(email, password) {
  if (USE_API) {
    const response = await fetch(`${API_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (response.status === 401) throw new AuthError('INVALID_CREDENTIALS')
    if (response.status === 403) throw new AuthError('FORBIDDEN')
    if (!response.ok) throw new Error(`API respondió ${response.status}`)
    const { accessToken, user } = await response.json()
    saveSession({ user, accessToken, startedAt: new Date().toISOString() })
    return user
  }
  await latency()
  const user = USERS.find((u) => u.email === normalizeEmail(email))
  const hash = await sha256(String(password ?? ''))
  // Mismo mensaje para correo inexistente o contraseña incorrecta.
  if (!user || user.hash !== hash) throw new AuthError('INVALID_CREDENTIALS')
  const session = { user: toPublic(user), startedAt: new Date().toISOString() }
  saveSession(session)
  return session.user
}

export function readSession() {
  const stored = readStored()
  if (!stored) return null
  // Con la API, una sesión sin token (por ejemplo, la que dejó el mock) no vale; el rol lo confirma verifySession().
  if (USE_API) return stored.accessToken ? stored.user : null
  // Solo se aceptan usuarios que existen y con su rol vigente.
  const known = USERS.find((u) => u.id === stored.user?.id)
  return known ? toPublic(known) : null
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* nada que limpiar */
  }
}
