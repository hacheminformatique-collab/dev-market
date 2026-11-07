import { siteFetch } from './siteFetch'
import { getSettings } from './storage'

export function adminPaths() {
  const script = document.getElementById('admin-route')
  return script ? JSON.parse(script.textContent) : { login: '/admin', dashboard: '/dashboard' }
}

export async function siteAdminRequest(data) {
  const response = await siteFetch('/api/site-admin.php', {
    ...(data ? { method: 'POST', body: JSON.stringify(data) } : {}),
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': getSettings().pin },
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(result.error || `Service administratif indisponible (HTTP ${response.status}).`)
  return result
}
