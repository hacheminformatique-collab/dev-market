import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../utils/siteAnalytics'

export default function PageAnalytics({ enabled = true }) {
  const location = useLocation()
  useEffect(() => {
    if (enabled) trackPageView(location.pathname, location.key)
  }, [enabled, location.key, location.pathname])
  return null
}
