import { batchFetch } from './siteFetch.js'

export async function verifyPublishedUrl({ path, expectedHash, label, hashText, transport = batchFetch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let detail = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = attempt ? `${path}?publication-check=${expectedHash.slice(0, 16)}-${attempt}` : path
    let response
    try {
      response = await transport(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
    } catch (error) {
      if (error.name === 'HostingLimitError' || error.name === 'AbortError') throw error
      detail = `erreur réseau : ${error.message}`
    }
    if (response) {
      let text
      try {
        text = await response.text()
      } catch (error) {
        if (error.name === 'AbortError') throw error
        detail = `HTTP ${response.status}, lecture interrompue : ${error.message}`
      }
      if (text !== undefined) {
        if (response.ok && await hashText(text) === expectedHash) return
        detail = `HTTP ${response.status}, ${text.length} caractères reçus${response.redirected ? `, redirection vers ${response.url}` : ''}${response.ok ? ', contenu différent du fichier enregistré' : ''}`
      }
      if ([401, 403, 404, 410].includes(response.status)) break
    }
    if (attempt < 2) await wait((attempt + 1) * 1000)
  }
  throw new Error(`Le fichier de ${label} reste enregistré, mais son URL ${path} n’a pas pu être vérifiée (${detail}). Les contrôles temporaires ont échoué ; vérifiez les journaux d’accès, le cache de l’hébergement et le routage .htaccess. Relancer vérifiera ce fichier sans le réécrire s’il est inchangé.`)
}
