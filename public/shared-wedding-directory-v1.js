(() => {
  const match = location.pathname.match(/^\/locationsalledemariage\/([a-z0-9-]+)\/?$/)
  if (!match) return

  async function updateDirectory() {
    try {
      const response = await fetch('/wedding-directory.html', { cache: 'no-store' })
      if (!response.ok) throw new Error(`Annuaire indisponible (HTTP ${response.status}).`)
      const parsed = new DOMParser().parseFromString(await response.text(), 'text/html')
      const directory = parsed.querySelector('section.wedding-directory')
      const cityLink = directory?.querySelector(`a[href="/locationsalledemariage/${match[1]}"]`)
      const heading = directory?.querySelector('#wedding-directory-heading')
      const cityName = cityLink?.textContent?.replace(/^Location salle de mariage\s+/, '').trim()
      if (!directory || !heading || !cityName) throw new Error('Annuaire publié invalide ou ville absente.')

      heading.textContent = `Location salle de mariage pr\u00e8s de ${cityName}`
      const container = document.createElement('div')
      container.id = 'shared-wedding-directory'
      container.appendChild(document.importNode(directory, true))
      const root = document.getElementById('root')
      if (!root) throw new Error('Page publiée invalide.')
      root.insertAdjacentElement('afterend', container)
      const style = document.createElement('style')
      style.textContent = '#root .wedding-directory { display: none !important; }'
      document.head.appendChild(style)
    } catch (error) {
      console.error('[WeddingDirectory]', error)
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateDirectory, { once: true })
  else void updateDirectory()
})()
