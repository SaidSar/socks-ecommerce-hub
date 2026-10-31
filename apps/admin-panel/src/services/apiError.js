/** Error de la API del panel: `status`, mensaje para el usuario y, si aplica, `errors` por campo. */
export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
