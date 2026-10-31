document.documentElement.classList.add('js')
const menu = document.querySelector('.menu-toggle')
const navigation = document.querySelector('#navigation')
if (menu && navigation) {
  menu.hidden = false
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true'
    menu.setAttribute('aria-expanded', String(open))
    navigation.classList.toggle('is-open', open)
    menu.textContent = open ? 'Fermer' : 'Menu'
  })
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      navigation.classList.remove('is-open')
      menu.setAttribute('aria-expanded', 'false')
      menu.textContent = 'Menu'
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      menu.click()
      menu.focus()
    }
  })
}

const video = document.querySelector('video[data-src]')
if (video) {
  const toggle = document.querySelector('.video-toggle')
  const status = document.querySelector('.video-status')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const connection = navigator.connection
  let userPaused = false
  let userStarted = false
  const permitted = () => !reduced.matches && !connection?.saveData
  function load() {
    if (!video.getAttribute('src')) {
      video.src = video.dataset.src
      video.load()
    }
  }
  async function play() {
    load()
    try {
      await video.play()
      status.textContent = ''
    } catch {
      status.textContent = 'Lecture automatique indisponible. Cliquez sur « Lire la vidéo » ou consultez la galerie.'
    }
  }
  function update() {
    if (document.hidden || (!permitted() && !userStarted)) video.pause()
    else if (!userPaused) void play()
  }
  video.addEventListener('playing', () => {
    video.classList.add('is-playing')
    toggle.textContent = 'Mettre la vidéo en pause'
    toggle.setAttribute('aria-pressed', 'true')
  })
  video.addEventListener('pause', () => {
    toggle.textContent = 'Lire la vidéo'
    toggle.setAttribute('aria-pressed', 'false')
  })
  video.addEventListener('error', () => {
    video.classList.remove('is-playing')
    status.textContent = 'Vidéo indisponible. La photo de la salle reste affichée.'
    toggle.textContent = 'Réessayer la vidéo'
    toggle.setAttribute('aria-pressed', 'false')
  })
  toggle.addEventListener('click', () => {
    if (!video.paused) { userPaused = true; video.pause() }
    else { userStarted = true; userPaused = false; void play() }
  })
  reduced.addEventListener('change', () => { userStarted = false; update() })
  connection?.addEventListener('change', () => { userStarted = false; update() })
  document.addEventListener('visibilitychange', update)
  update()
}

document.querySelectorAll('[data-embed]').forEach((button) => {
  button.addEventListener('click', () => {
    const iframe = document.createElement('iframe')
    iframe.src = button.dataset.embed
    iframe.title = `Vidéo de la salle sur ${button.dataset.platform}`
    iframe.allow = 'fullscreen; encrypted-media'
    iframe.allowFullscreen = true
    button.replaceWith(iframe)
  }, { once: true })
})

const form = document.querySelector('.contact-form')
if (form) {
  const date = form.elements.date
  const now = new Date()
  date.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = form.querySelector('button[type=submit]')
    const status = form.querySelector('.form-status')
    button.disabled = true
    status.className = 'form-status'
    status.textContent = 'Envoi de votre demande…'
    try {
      const response = await fetch(form.action, {
        method: 'POST', body: new URLSearchParams(new FormData(form)),
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000),
      })
      const data = await response.json()
      if (!response.ok || data.ok !== true) throw new Error(data.message || 'Envoi refusé. Appelez-nous pour transmettre votre demande.')
      status.className = 'form-status success'
      status.textContent = data.message
      form.reset()
    } catch (error) {
      status.className = 'form-status error'
      status.textContent = error.name === 'TimeoutError'
        ? 'La confirmation tarde. Ne renvoyez pas immédiatement : appelez-nous pour vérifier la réception.'
        : error instanceof SyntaxError || error instanceof TypeError
          ? 'Envoi non confirmé. Vos informations sont conservées dans le formulaire ; contactez-nous par téléphone.'
          : error.message
    } finally {
      button.disabled = false
    }
  })
}
