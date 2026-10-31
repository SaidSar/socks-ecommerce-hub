// Autenticación (DESIGN_AUTH.md §5.3 y §8). Única capa que habla con /api/auth/*. Con USE_API usa la API;
// sin ella guarda usuarios en localStorage para que el flujo completo se pueda revisar sin backend.
import { API_URL, USE_API } from './api'

const USERS_KEY = 'sokko.users.v1'
export const SESSION_KEY = 'sokko.session.v1'
const TOKEN_KEY = 'sokko.token.v1'

/** Se emite cuando la API responde 401: la sesión guardada ya no sirve. */
export const SESSION_EXPIRED_EVENT = 'sokko:session-expired'

export const DEMO_ACCOUNT = { email: 'hola@sokko.mx', password: 'Kyoto2026' }

const SEED = [
  {
    id: 'u-demo',
    firstName: 'Aiko',
    lastName: 'Morales',
    email: DEMO_ACCOUNT.email,
    password: DEMO_ACCOUNT.password,
    preferredSize: 'M',
    marketingOptIn: true,
    memberSince: '2026-03-21T00:00:00.000Z',
  },
  {
    id: 'u-nexus',
    firstName: 'Nexus',
    lastName: 'Code',
    email: 'nexus@sokko.mx',
    password: 'NexusCode2026',
    preferredSize: null,
    marketingOptIn: false,
    memberSince: '2026-01-15T00:00:00.000Z',
  },
]

export class AuthError extends Error {
  /** @param {'INVALID_CREDENTIALS' | 'EMAIL_TAKEN' | 'INVALID_RESET_TOKEN'} code */
  constructor(code) {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

// Latencia simulada de red: 900–1300 ms.
const latency = () => new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 400))

// TODO(api): mock local; en producción el hash vive solo en el servidor (POST /api/auth/*)
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Usuario público: nunca incluye la contraseña ni su hash. */
function toPublicUser({ id, firstName, lastName, email, preferredSize, marketingOptIn, memberSince }) {
  return { id, firstName, lastName, email, preferredSize: preferredSize ?? null, marketingOptIn, memberSince }
}

// --- Almacenamiento (todo acceso dentro de try/catch; si falla, se trabaja en memoria) ---

let memoryUsers = null

function readJSON(storage, key) {
  try {
    const raw = window[storage].getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJSON(storage, key, value) {
  try {
    window[storage].setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible */
  }
}

function removeKey(storage, key) {
  try {
    window[storage].removeItem(key)
  } catch {
    /* almacenamiento no disponible */
  }
}

async function loadUsers() {
  const stored = readJSON('localStorage', USERS_KEY)
  if (Array.isArray(stored)) return stored
  if (memoryUsers) return memoryUsers
  const seeded = await Promise.all(
    SEED.map(async ({ password, ...user }) => ({ ...user, passwordHash: await hashPassword(password) })),
  )
  saveUsers(seeded)
  return seeded
}

function saveUsers(users) {
  memoryUsers = users
  writeJSON('localStorage', USERS_KEY, users)
}

function saveSession(user, remember, accessToken) {
  // remember → sobrevive al cierre del navegador; si no, solo dura la pestaña.
  const [target, other] = remember ? ['localStorage', 'sessionStorage'] : ['sessionStorage', 'localStorage']
  removeKey(other, SESSION_KEY)
  removeKey(other, TOKEN_KEY)
  writeJSON(target, SESSION_KEY, user)
  if (accessToken) writeJSON(target, TOKEN_KEY, accessToken)
}

function clearSession() {
  for (const storage of ['localStorage', 'sessionStorage']) {
    removeKey(storage, SESSION_KEY)
    removeKey(storage, TOKEN_KEY)
  }
}

const getToken = () => readJSON('localStorage', TOKEN_KEY) ?? readJSON('sessionStorage', TOKEN_KEY)

const postJson = (path, body) =>
  fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/** Petición autenticada con el token de la sesión. Un 401 la cierra y avisa a la app. */
export async function authFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${getToken()}` },
  })
  if (response.status === 401) {
    clearSession()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  return response
}

/** Con la API, confirma al cargar que el token sigue vigente y refresca el usuario. Un fallo de red no cierra la sesión. */
export async function verifySession() {
  if (!USE_API || !getToken()) return getSession()
  try {
    const response = await authFetch('/api/auth/me')
    if (!response.ok) return null
    const { user } = await response.json()
    saveSession(user, readJSON('localStorage', TOKEN_KEY) !== null)
    return user
  } catch {
    return getSession()
  }
}

// --- API pública ---

/** @returns {Promise<{ user: object }>} */
export async function login({ email, password, remember = true }) {
  if (USE_API) {
    const response = await postJson('/api/auth/login', { email, password })
    if (response.status === 401) throw new AuthError('INVALID_CREDENTIALS')
    if (!response.ok) throw new Error(`API respondió ${response.status}`)
    const { accessToken, user } = await response.json()
    saveSession(user, remember, accessToken)
    return { user }
  }
  await latency()
  const users = await loadUsers()
  const found = users.find((u) => u.email === normalizeEmail(email))
  const hash = await hashPassword(String(password ?? ''))
  if (!found || found.passwordHash !== hash) throw new AuthError('INVALID_CREDENTIALS')
  const user = toPublicUser(found)
  saveSession(user, remember)
  return { user }
}

/** @returns {Promise<{ user: object }>} */
export async function register({ firstName, lastName, email, password, preferredSize = null, marketingOptIn = false, acceptedTerms = false }) {
  if (USE_API) {
    const response = await postJson('/api/auth/register', { firstName, lastName, email, password, preferredSize, marketingOptIn, acceptedTerms })
    if (response.status === 409) throw new AuthError('EMAIL_TAKEN')
    if (!response.ok) throw new Error(`API respondió ${response.status}`)
    const { accessToken, user } = await response.json()
    saveSession(user, true, accessToken)
    return { user }
  }
  await latency()
  const users = await loadUsers()
  const normalized = normalizeEmail(email)
  if (users.some((u) => u.email === normalized)) throw new AuthError('EMAIL_TAKEN')
  const record = {
    id: `u-${crypto.randomUUID()}`,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: normalized,
    passwordHash: await hashPassword(password),
    preferredSize: preferredSize || null,
    marketingOptIn: Boolean(marketingOptIn),
    memberSince: new Date().toISOString(),
  }
  saveUsers([...users, record])
  const user = toPublicUser(record)
  saveSession(user, true)
  return { user }
}

/** Siempre resuelve igual, exista o no la cuenta, para no revelar qué correos están registrados. */
export async function requestPasswordReset(email) {
  if (USE_API) {
    const response = await postJson('/api/auth/forgot-password', { email })
    if (!response.ok) throw new Error(`API respondió ${response.status}`)
    return
  }
  await latency()
}

/** Contraseña nueva con el token del enlace. Sin API no hay tokens: el mock solo exige que venga uno. */
export async function resetPassword({ token, newPassword }) {
  if (USE_API) {
    const response = await postJson('/api/auth/reset-password', { token, newPassword })
    if (response.status === 400) throw new AuthError('INVALID_RESET_TOKEN')
    if (!response.ok) throw new Error(`API respondió ${response.status}`)
    return
  }
  await latency()
  if (!token) throw new AuthError('INVALID_RESET_TOKEN')
}

export async function logout() {
  clearSession()
}

/** Sesión guardada (síncrono para hidratar sin parpadeo). @returns {object | null} */
export function getSession() {
  // Con la API, una sesión sin token (por ejemplo, la que dejó el mock) no vale.
  if (USE_API && !getToken()) return null
  const user = readJSON('localStorage', SESSION_KEY) ?? readJSON('sessionStorage', SESSION_KEY)
  return user && typeof user.email === 'string' ? user : null
}
