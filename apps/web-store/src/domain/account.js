// Textos de las vistas de cuenta (Mi perfil, favoritos, rastreo) y nombres de los hitos del pedido.
// Viven aquí y no junto a los componentes para que Fast Refresh funcione (react/only-export-components).

export const PROFILE_MESSAGES = {
  saved: 'Sus datos se guardaron.',
  passwordChanged: 'Su contraseña se cambió.',
  currentEmpty: 'Escriba su contraseña actual.',
  currentWrong: 'La contraseña actual no coincide.',
}

export const WISHLIST_MESSAGES = {
  added: 'Se agregó a favoritos',
  removed: 'Se quitó de favoritos',
  view: 'Ver favoritos',
  undo: 'Deshacer',
  limit: 'Su lista de favoritos está llena. Quite alguna pieza para agregar otra.',
  network: 'No pudimos actualizar sus favoritos. Intente de nuevo en un momento.',
}

export const CART_MESSAGES = {
  added: 'Se agregó a su bolsa',
  view: 'Ver bolsa',
}

export const AUTH_TOASTS = {
  login: (name) => `Hola de nuevo, ${name}.`,
  register: (name) => `Bienvenida a SOKKO, ${name}. Su cuenta está lista.`,
}

export const TRACK_MESSAGES = {
  folio: 'Escriba el folio de su pedido, por ejemplo SKK-1050.',
  notFound: 'No encontramos un pedido con esos datos. Revise el folio y el correo con el que compró.',
  rateLimited: 'Demasiados intentos. Espere un momento e inténtelo de nuevo.',
  network: 'No pudimos conectar con el atelier. Intente de nuevo en un momento.',
  found: (folio) => `Encontramos su pedido ${folio}.`,
}

const STEP_LABELS = {
  por_preparar: 'Pedido recibido',
  pagado: 'Pago registrado',
  preparando: 'Preparando en el atelier',
  enviado: 'Salió con la paquetería',
  en_ruta: 'En ruta local',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

/** Hito de `order.timeline` en palabras del cliente. */
export const stepLabel = (status) => STEP_LABELS[status] ?? status
