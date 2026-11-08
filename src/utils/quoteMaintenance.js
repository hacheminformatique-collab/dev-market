import { siteFetch } from './siteFetch'

export async function assertQuoteRequestsAvailable() {
  const response = await siteFetch('/api/quote-access.php', { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    const error = new Error(result.error || 'Vérification des demandes de devis impossible. Veuillez réessayer.')
    if (response.status === 503) error.quoteMaintenance = true
    throw error
  }
}
