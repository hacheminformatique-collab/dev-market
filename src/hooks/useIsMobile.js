import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)

  useEffect(() => {
    let timer
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIsMobile(window.innerWidth <= breakpoint), 100)
    }
    window.addEventListener('resize', handler)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handler)
    }
  }, [breakpoint])

  return isMobile
}
