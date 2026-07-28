export class RentalApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'RentalApiError'
    this.status = status
    this.code = code
  }
}
