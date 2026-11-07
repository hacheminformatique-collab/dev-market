import { siteFetch as fetch } from '../utils/siteFetch'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isPublicPath } from '../utils/weddingPublication'
import './WeddingDirectory.css'

// The published directory lives outside React's root so its links are also
// present in the initial HTML, before the application loads.
export default function PublicWeddingDirectory() {
  const { pathname } = useLocation()
  const [error, setError] = useState('')

  useEffect(() => {
    const container = document.getElementById('public-wedding-directory')
    if (container) container.hidden = !isPublicPath(pathname)
  }, [pathname])

  useEffect(() => {
    const container = document.getElementById('public-wedding-directory')
    if (!isPublicPath(pathname) || !container) return
    let cancelled = false
    async function load() {
      try {
        const blog = pathname === '/blog' || pathname.startsWith('/blog/')
        const response = await fetch(blog ? '/wedding-directory-idf.html' : '/wedding-directory.html', { cache: 'no-store' })
        if (response.status === 404) return
        if (!response.ok) throw new Error(`Annuaire inaccessible (HTTP ${response.status}).`)
        const html = await response.text()
        if (html !== '' && !html.includes('class="wedding-directory"')) {
          throw new Error('Annuaire invalide. Publiez les pages mariage pour créer la zone de location.')
        }
        if (!cancelled) {
          if (container.innerHTML !== html) container.innerHTML = html
          setError('')
        }
      } catch (err) {
        console.error('[WeddingDirectory]', err)
        if (!cancelled) setError(err.message)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [pathname])

  return error && isPublicPath(pathname) ? <p role="alert">{error}</p> : null
}
