export const QUOTE_STORAGE_NAMES = ['settings', 'formules', 'menus', 'gateaux', 'prestations', 'clients', 'calOverrides', 'calManualEvents']

export const ADMIN_STORAGE_NAMES = ['settings', 'clients', 'loginAttempts', 'staff', 'formules', 'menus', 'gateaux', 'prestations', 'stockSec', 'stockMatiere', 'stockBoisson', 'ingredients', 'matieresPremieresRecettes', 'calOverrides', 'calStaff', 'calManualEvents']

export function dashboardStorageNames(tab) {
  const dependencies = {
    clients: ['clients', 'menus', 'gateaux', 'prestations'],
    calendar: ['clients', 'staff', 'formules', 'calOverrides', 'calStaff', 'calManualEvents'],
    compta: ['clients', 'staff', 'ingredients', 'matieresPremieresRecettes'],
    staff: ['staff'],
    stock: ['clients', 'stockSec', 'stockMatiere', 'stockBoisson'],
    matieres: ['clients', 'menus', 'ingredients', 'matieresPremieresRecettes', 'stockSec', 'stockMatiere', 'stockBoisson'],
    formules: ['formules', 'menus', 'gateaux', 'prestations'], menus: ['menus'], gateaux: ['gateaux'], prestations: ['prestations'],
  }
  return ['settings', ...(dependencies[tab] || [])]
}

export function storageProfile(pathname, paths = { login: '/admin', dashboard: '/dashboard' }) {
  if (pathname === paths.login) return { names: ['settings'], paced: false, persistDefaults: true }
  if (pathname === paths.dashboard) return { names: ['settings'], paced: false, persistDefaults: false }
  if (pathname === '/devis') return { names: QUOTE_STORAGE_NAMES, paced: false, persistDefaults: false }
  if (pathname.startsWith('/espace-staff')) return { names: ['settings', 'staff', 'clients'], paced: false, persistDefaults: false }
  if (pathname.startsWith('/espace-client/')) return { names: ['settings', 'clients'], paced: false, persistDefaults: false }
  return { names: ['settings'], paced: false, persistDefaults: false }
}
