// Pasarela simulada, lado del navegador (DESIGN_CHECKOUT.md §3.4). Hace lo que hará el SDK de una pasarela real:
// cambia los datos de la tarjeta por un token. El número nunca sale del navegador.
import { digitsOnly } from '../domain/checkout'

export const TEST_CARDS = {
  approved: '4242424242424242',
  declined: '4000000000000002',
  insufficientFunds: '4000000000009995',
}

export function tokenizeCard(number) {
  const digits = digitsOnly(number)
  if (digits === TEST_CARDS.declined) return 'tok_fake_declined'
  if (digits === TEST_CARDS.insufficientFunds) return 'tok_fake_insufficient_funds'
  return 'tok_fake_approved'
}
