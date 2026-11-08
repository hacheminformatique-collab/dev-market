/* This worker deliberately has no fetch handler and never caches admin responses. */
self.addEventListener('push', (event) => {
  let message
  try { message = event.data?.json() } catch { message = null }
  const url = typeof message?.url === 'string' && /^\/(?!\/)[a-z0-9/-]+$/.test(message.url)
    ? message.url : '/dashboard'
  event.waitUntil(self.registration.showNotification(
    typeof message?.title === 'string' ? message.title : 'Le Paradise — Administration',
    {
      body: typeof message?.body === 'string' ? message.body : 'Une nouvelle activité est disponible.',
      icon: '/admin-push-icon-192.png',
      badge: '/admin-push-icon-192.png',
      tag: typeof message?.tag === 'string' ? message.tag : 'paradise-activity',
      data: { url },
    },
  ))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data?.url
  const target = new URL(typeof path === 'string' && /^\/(?!\/)[a-z0-9/-]+$/.test(path)
    ? path : '/dashboard', self.location.origin).href
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin && 'navigate' in client) {
        await client.navigate(target)
        return client.focus()
      }
    }
    return self.clients.openWindow(target)
  })())
})

self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
