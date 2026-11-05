import { useCallback, useEffect, useRef, useState } from 'react'
import './VideoHero.css'

const VIDEO_URL = '/media/hero-paradise.mp4'
const POSTER_URL = '/media/hero-paradise.jpg'

export default function VideoHero({ as: Tag = 'section', children, style, className = '' }) {
  const videoRef = useRef(null)
  const heroRef = useRef(null)
  const manualPause = useRef(false)
  const failed = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [status, setStatus] = useState('')

  const playVideo = useCallback(async (manual = false) => {
    const video = videoRef.current
    if (!video || failed.current) return
    if (manual) manualPause.current = false
    if (!video.getAttribute('src')) {
      video.src = VIDEO_URL
      video.load()
    }
    try {
      await video.play()
      setStatus('')
    } catch (error) {
      if (error.name === 'AbortError') return
      if (error.name === 'NotAllowedError') {
        setStatus('Lecture automatique désactivée. Utilisez le bouton pour lire la vidéo.')
      } else {
        failed.current = true
        setPlaying(false)
        console.error('[VideoHero] Lecture impossible :', error)
        setStatus('Vidéo indisponible. L’image de la salle reste affichée.')
      }
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = navigator.connection
    let inView = true
    let ready = false
    const update = () => {
      const allowed = !motion.matches && !connection?.saveData && inView && !document.hidden
      if (!allowed) {
        video.pause()
      } else if (ready && !manualPause.current && !failed.current) {
        void playVideo()
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    })
    observer.observe(heroRef.current)
    const timer = window.setTimeout(() => {
      ready = true
      update()
    }, 800)
    motion.addEventListener('change', update)
    connection?.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      motion.removeEventListener('change', update)
      connection?.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
      video.pause()
    }
  }, [playVideo])

  function toggleVideo() {
    if (playing) {
      manualPause.current = true
      videoRef.current.pause()
    } else {
      void playVideo(true)
    }
  }

  function handleError() {
    failed.current = true
    setPlaying(false)
    setStatus('Vidéo indisponible. L’image de la salle reste affichée.')
    console.error('[VideoHero] Chargement impossible :', VIDEO_URL, videoRef.current.error?.code)
  }

  return (
    <Tag ref={heroRef} className={`video-hero ${className}`} style={style}>
      <img className="video-hero-media" src={POSTER_URL} alt="" aria-hidden="true" width="1280" height="720" fetchPriority="high" />
      <video
        ref={videoRef}
        className={`video-hero-media video-hero-video${playing ? ' is-playing' : ''}`}
        muted
        loop
        playsInline
        preload="none"
        poster={POSTER_URL}
        aria-hidden="true"
        tabIndex={-1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={handleError}
      />
      <div className="video-hero-shade" />
      <div className="video-hero-content">{children}</div>
      <button
        type="button"
        className="video-hero-toggle"
        onClick={toggleVideo}
        aria-pressed={playing}
        disabled={status.startsWith('Vidéo indisponible')}
      >
        {playing ? 'Mettre la vidéo en pause' : 'Lire la vidéo'}
      </button>
      <p className="video-hero-status" role="status">{status}</p>
    </Tag>
  )
}
