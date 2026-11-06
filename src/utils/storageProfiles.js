export const QUOTE_STORAGE_NAMES = ['settings', 'formules', 'menus', 'gateaux', 'prestations', 'clients', 'calOverrides', 'calManualEvents']

export function storageProfile(pathname) {
  if (pathname === '/dashboard' || pathname === '/admin') return undefined
  if (pathname === '/devis') return { names: QUOTE_STORAGE_NAMES, paced: false, persistDefaults: false }
  if (pathname.startsWith('/espace-staff')) return { names: ['settings', 'staff', 'clients'], paced: false, persistDefaults: false }
  if (pathname.startsWith('/espace-client/')) return { names: ['settings', 'clients'], paced: false, persistDefaults: false }
  return { names: ['settings'], paced: false, persistDefaults: false }
}
