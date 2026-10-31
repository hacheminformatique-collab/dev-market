import { readFile, mkdir, writeFile, cp } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { renderCityContent } from './city-content.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(root, 'dist')
const config = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'))
const { departments } = JSON.parse(await readFile(path.join(root, 'communes.json'), 'utf8'))
const origin = new URL(config.siteUrl)
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('siteUrl doit être une origine HTTPS sans chemin.')
if (!/^\+\d{8,15}$/.test(config.phone)) throw new Error('Téléphone international invalide.')
if (!Number.isInteger(config.contactRetentionMonths) || config.contactRetentionMonths < 1) throw new Error('Durée de conservation invalide.')
const safeUrl = (value) => {
  if (/^assets\/[a-zA-Z0-9/_.-]+$/.test(value) && !value.split('/').includes('..')) return true
  try { return new URL(value).protocol === 'https:' } catch { return false }
}
if (!safeUrl(config.heroPoster)) throw new Error('Photo de bannière invalide.')
if (config.heroVideo && (!safeUrl(config.heroVideo) || !/\.(mp4|webm)(?:[?#]|$)/i.test(config.heroVideo))) throw new Error('La bannière nécessite un fichier MP4/WebM local ou HTTPS.')
if (config.managementUrl && !safeUrl(config.managementUrl)) throw new Error('URL de gestion HTTPS requise.')
for (const url of [config.heroPoster, config.heroVideo].filter((url) => url?.startsWith('assets/'))) {
  await readFile(path.join(root, url))
}
export function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
const e = escape
const absolute = (file) => new URL(file, origin).href
const phone = `<a href="tel:${e(config.phone)}">${e(config.phoneDisplay)}</a>`
const button = (label = 'Demander un devis') => `<a class="button" href="contact.html">${label}</a>`
const breadcrumb = (department, city) => `<nav class="breadcrumbs" aria-label="Fil d’Ariane"><a href="index.html">Accueil</a> / <a href="zone-de-reception.html">Départements</a>${department ? ` / <a href="${department.code}.html">${e(department.name)}</a>` : ''}${city ? ` / <span>${e(city.name)}</span>` : ''}</nav>`
const departmentLinks = () => `<div class="department-grid">${departments.map((d) => `<a href="${d.code}.html"><span>${d.code}</span>${e(d.name)} →</a>`).join('')}</div>`
const cityLinks = (department) => `<ul class="city-links">${department.cities.map((city) => `<li><a href="${e(city.file)}">${e(city.name)} (${city.postalCode})</a></li>`).join('')}</ul>`
const network = () => `<section class="section network"><p class="eyebrow">Nos pages locales</p><h2>Retrouvez votre ville.</h2><p>Un seul lieu de réception : ${e(config.name)}, à ${e(config.city)}. Explorez nos pages par département et commune.</p>${departments.map((d) => `<details><summary>${e(d.name)} (${d.code}) · ${d.cities.length} pages</summary><p><a class="text-link" href="${d.code}.html">Voir la page du département →</a></p>${cityLinks(d)}</details>`).join('')}</section>`
const hero = (title, subtitle, compact = false) => `<section class="hero${compact ? ' compact' : ''}">
  <img class="hero-media" src="${e(config.heroPoster)}" width="1600" height="1200" fetchpriority="high" alt="La salle Le Paradise dressée pour une réception de mariage">
  ${config.heroVideo ? `<video class="hero-media" muted loop playsinline preload="none" poster="${e(config.heroPoster)}" data-src="${e(config.heroVideo)}" aria-hidden="true"></video>` : ''}
  <div class="hero-shade"></div><div class="hero-content"><p class="eyebrow">Mariages & réceptions · Seine-et-Marne</p><h1>${title}</h1><p class="hero-subtitle">${subtitle}</p><div class="actions">${button('Parlons de votre date')}<a class="button outline" href="galerie.html">Découvrir la salle</a></div><p class="location">${e(config.city)} · 77</p></div>
  ${config.heroVideo ? '<button class="video-toggle" type="button" aria-pressed="false">Lire la vidéo</button><p class="video-status" role="status"></p>' : ''}
</section>`
const gallery = () => `<div class="gallery">${[
  ['salle-reception.jpg', 'Vue générale de la salle de réception'],
  ['tables-reception.jpg', 'Tables dressées et chaises blanches'],
  ['decoration-table.jpg', 'Chandeliers et décoration de table'],
  ['art-de-la-table.jpg', 'Vaisselle et décoration pour un mariage'],
].map(([file, alt]) => `<a href="assets/${file}" target="_blank" rel="noopener" aria-label="${e(alt)} — agrandir"><img src="assets/${file}" width="1600" height="1200" alt="${e(alt)}" loading="lazy" decoding="async"></a>`).join('')}</div>`
function social(url) {
  const parsed = new URL(url)
  let src
  let label
  if (parsed.protocol !== 'https:') throw new Error('Lien social HTTPS requis.')
  const instagram = parsed.pathname.match(/^\/(p|reel)\/([\w-]+)\/?$/)
  const tiktok = parsed.pathname.match(/^\/@[\w.-]+\/video\/(\d+)\/?$/)
  if (['www.instagram.com', 'instagram.com'].includes(parsed.hostname) && instagram) {
    src = `https://www.instagram.com/${instagram[1]}/${instagram[2]}/embed/`
    label = 'Instagram'
  } else if (['www.tiktok.com', 'tiktok.com'].includes(parsed.hostname) && tiktok) {
    src = `https://www.tiktok.com/player/v1/${tiktok[1]}`
    label = 'TikTok'
  } else throw new Error(`Publication Instagram/TikTok non reconnue : ${url}`)
  return `<article class="social-card"><p class="eyebrow">${label}</p><h3>Une réception à vivre</h3><p>Le lecteur de ${label} ne sera chargé qu’après votre clic. La plateforme pourra alors recevoir votre adresse IP et utiliser ses cookies.</p><button type="button" class="button" data-embed="${e(src)}" data-platform="${label}">Charger la vidéo ${label}</button><a class="text-link" href="${e(url)}" target="_blank" rel="noopener noreferrer">Voir sur ${label} ↗</a></article>`
}
const offers = () => `<section class="section offers"><p class="eyebrow">Une réception à votre image</p><h2>Votre façon de célébrer.</h2><div class="cards">
  <article><span>01</span><h3>Location de la salle</h3><p>Découvrez le lieu et échangeons sur les prestations incluses, la disposition des tables et le décor souhaité.</p></article>
  <article><span>02</span><h3>Prestations sur mesure</h3><p>Précisez vos besoins en restauration, décoration et animation. Notre équipe confirmera les options disponibles et leurs tarifs.</p></article>
  <article><span>03</span><h3>Une visite, un projet</h3><p>Votre date et le nombre d’invités permettent d’étudier une configuration adaptée. Prenez rendez-vous avant de réserver.</p></article>
  </div>${button('Étudier ma réception')}</section>`
const faq = (city) => {
  const entries = [
    [`Où se déroule la réception${city ? ` pour un projet depuis ${city.name}` : ''} ?`, `La salle est située au ${config.address}, ${config.postalCode} ${config.city}. Les pages ville présentent ce même établissement, pas une salle dans chaque commune.`],
    ['Comment connaître les tarifs et disponibilités ?', 'Transmettez votre date, le nombre de vos invités et vos besoins via notre formulaire. La disponibilité et le prix seront confirmés par notre équipe ; une demande ne constitue pas une réservation.'],
    ['Puis-je visiter la salle ?', 'Oui, contactez-nous par téléphone ou WhatsApp pour convenir d’un rendez-vous et découvrir la salle avant de décider.'],
    ['Quelle est la capacité de la salle ?', 'La capacité dépend de la configuration de votre réception. Indiquez votre nombre d’invités pour obtenir une confirmation, sans supposer un nombre de places non vérifié.'],
  ]
  return `<section class="section faq"><p class="eyebrow">Vos premières questions</p><h2>Préparer votre réception.</h2>${entries.map(([q, a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join('')}</section>`
}
const finalCta = () => `<section class="section final"><p class="eyebrow">Et si tout commençait par une visite ?</p><h2>Faisons place à votre histoire.</h2><p>Votre date, vos proches, vos envies. Parlons de votre réception.</p><div class="actions">${button()}<a class="button outline" href="tel:${e(config.phone)}">${e(config.phoneDisplay)}</a></div></section>`
const files = new Map()
function page(file, title, description, content, crumbs = []) {
  if (files.has(file)) throw new Error(`Page dupliquée : ${file}`)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${origin.href}#website`, name: config.name, url: origin.href, inLanguage: 'fr-FR' },
      {
        '@type': ['LocalBusiness', 'EventVenue'], '@id': `${origin.href}#venue`,
        name: config.name, url: origin.href, telephone: config.phone, email: config.email,
        image: absolute(config.heroPoster),
        address: { '@type': 'PostalAddress', streetAddress: config.address, postalCode: config.postalCode, addressLocality: config.city, addressCountry: 'FR' },
      },
      ...(crumbs.length ? [{ '@type': 'BreadcrumbList', itemListElement: crumbs.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absolute(url) })) }] : []),
    ],
  }
  const canonical = file === 'index.html' ? origin.href : absolute(file)
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${e(canonical)}"><meta name="theme-color" content="#242720">
<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:image" content="${e(absolute(config.heroPoster))}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/site.css"><script src="assets/site.js" defer></script>
<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script></head><body>
<a class="skip-link" href="#contenu">Aller au contenu</a><header class="site-header"><a class="brand" href="index.html">${e(config.name)}<span>Mariages & réceptions · Seine-et-Marne</span></a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="navigation" hidden>Menu</button>
<nav id="navigation" aria-label="Navigation principale"><a href="la-salle.html">La salle</a><a href="prestations.html">Prestations</a><a href="galerie.html">Photos & vidéos</a><a href="zone-de-reception.html">Villes & départements</a>${button()}</nav></header>
<main id="contenu">${content}</main>
<footer class="site-footer"><div><a class="brand" href="index.html">${e(config.name)}</a><p>${e(config.address)}<br>${config.postalCode} ${e(config.city)}</p></div><div><h2>Parlons de votre réception</h2>${phone}<br><a href="mailto:${e(config.email)}">${e(config.email)}</a></div><nav aria-label="Liens de pied de page"><a href="contact.html">Contact & visite</a><a href="zone-de-reception.html">Départements & villes</a>${config.managementUrl ? `<a href="${e(config.managementUrl)}">Espaces client & équipe</a>` : ''}<a href="mentions-legales.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a></nav><p class="copyright">© ${new Date().getFullYear()} ${e(config.company)} · Le Paradise</p></footer>
<div class="contact-bar">${phone}<a href="https://wa.me/${config.phone.slice(1)}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a href="contact.html">Votre devis</a></div>
</body></html>`
  files.set(file, html)
}
page('index.html', `${config.name} — Salle de mariage à ${config.city} (77)`,
  `Découvrez ${config.name}, salle de mariage et de réception à ${config.city} en Seine-et-Marne. Photos, vidéos, prestations et demande de devis.`,
  hero('Le lieu de vos<br><em>plus beaux moments.</em>', `Votre salle de mariage et de réception à ${e(config.city)}, en Seine-et-Marne.`) +
  `<div class="intro-strip"><span>Mariages & fiançailles</span><span>Fêtes de famille</span><span>Une visite pour tout imaginer</span></div>
  <section class="section split"><div><p class="eyebrow">Bienvenue au Paradise</p><h2>Une salle.<br><em>Mille façons de célébrer.</em></h2><p>Un décor lumineux, des tables élégantes et vos proches réunis. ${e(config.name)} vous accueille à ${e(config.city)} pour donner vie à votre mariage ou votre réception.</p><p>Venez découvrir le lieu. Ensemble, nous étudierons votre date, le nombre d’invités et les prestations adaptées à votre événement.</p><a class="text-link" href="la-salle.html">Découvrir notre salle →</a></div><img src="assets/tables-reception.jpg" width="1200" height="1600" alt="Tables et chandeliers au Paradise" loading="lazy"></section>` +
  offers() + `<section class="section"><p class="eyebrow">À l’intérieur du Paradise</p><h2>Projetez-vous dans votre grand jour.</h2>${gallery()}<a class="text-link" href="galerie.html">Toutes nos photos & vidéos →</a></section>` +
  faq() + `<section class="section offers"><p class="eyebrow">Vos invités viennent de toute la région</p><h2>Une salle en Seine-et-Marne,<br>des liens avec vos villes.</h2>${departmentLinks()}</section>` + finalCta() + network())
page('la-salle.html', `La salle de réception — ${config.name}`, `Visitez la salle ${config.name} à ${config.city} : découvrez les tables, le décor et préparez votre réception.`,
  hero('Un cadre pour vous réunir.', `Découvrez notre salle au ${e(config.address)}, ${config.postalCode} ${e(config.city)}.`, true) +
  `<section class="section split"><div><h2>Imaginez votre réception.</h2><p>Les photos montrent la salle décorée, ses tables dressées et ses chaises blanches. La disposition et les éléments retenus pour votre événement seront précisés lors de votre visite et dans votre devis.</p><p>La capacité, les horaires, l’accès, les conditions d’utilisation et les équipements doivent être confirmés avec notre équipe avant la réservation.</p>${button('Organiser une visite')}</div><img src="assets/salle-reception.jpg" width="1600" height="1200" alt="Vue de la salle préparée pour un mariage" loading="lazy"></section>` + faq() + finalCta())
page('prestations.html', `Formules et prestations de réception — ${config.name}`, `Préparez votre mariage avec ${config.name}. Échangez sur la location de salle et les prestations adaptées à votre réception.`,
  hero('Votre réception, à votre image.', 'Un projet à construire ensemble, selon vos invités, vos envies et votre budget.', true) + offers() + faq() + finalCta())
page('galerie.html', `Photos et vidéos de la salle — ${config.name}`, `Découvrez les photos de la salle de mariage ${config.name}, ses tables et sa décoration à ${config.city}.`,
  hero('Entrez dans votre prochaine histoire.', 'Découvrez la salle, les tables et les détails de notre espace de réception.', true) +
  `<section class="section"><p class="eyebrow">La salle en images</p><h2>Les détails font les souvenirs.</h2>${gallery()}${config.socialVideos.length ? `<h2 class="social-title">Nos réceptions en vidéo.</h2><div class="social-grid">${config.socialVideos.map(social).join('')}</div>` : ''}</section>` + finalCta())
page('zone-de-reception.html', `Salle de mariage — villes et départements — ${config.name}`,
  `Explorez les pages de ${config.name} par département et ville en Île-de-France. Notre salle de réception est située à ${config.city}.`,
  hero('Vos villes, notre salle.', `Un lieu pour vous réunir à ${e(config.city)}. Préparez votre projet depuis votre commune.`, true) +
  `<section class="section"><h2>Choisissez votre département.</h2><p>Toutes ces pages présentent la même salle à ${e(config.city)}. Retrouvez votre commune pour préparer votre réception et le déplacement de vos invités.</p>${departmentLinks()}</section>` + network())
for (const department of departments) {
  page(`${department.code}.html`, `Salle de mariage depuis ${department.name} (${department.code}) — ${config.name}`,
    `Découvrez ${config.name}, salle de mariage à ${config.city}, pour votre réception depuis ${department.name}. Retrouvez les pages de vos villes.`,
    breadcrumb(department) + hero(`Votre mariage depuis ${e(department.name)} (${department.code}).`, `Réunissez vos proches au Paradise, à ${e(config.city)}, en Seine-et-Marne.`, true) +
    `<section class="section"><p class="eyebrow">Votre département, vos invités</p><h2>Préparer une réception depuis ${e(department.name)}.</h2><p>Votre cérémonie, vos invités et votre réception peuvent se dérouler dans des lieux différents. Avant de choisir une date, étudiez les déplacements vers ${e(config.address)}, ${config.postalCode} ${e(config.city)}, ainsi que l’organisation du retour.</p><p>Une visite permet de découvrir la salle et de préciser votre configuration. Notre équipe confirmera les disponibilités et les prestations possibles pour votre projet depuis ${e(department.name)}.</p>${button()}<h2 class="social-title">Les villes du département (${department.code})</h2>${cityLinks(department)}</section>` + finalCta() + network(),
    [['Accueil', 'index.html'], [department.name, `${department.code}.html`]])
  for (const city of department.cities) {
    if (!/^[a-z0-9-]+-\d{5}\.html$/.test(city.file)) throw new Error(`Nom de fichier ville invalide : ${city.file}`)
    const itinerary = new URL('https://www.google.com/maps/dir/')
    itinerary.search = new URLSearchParams({
      api: '1',
      origin: `${city.name} ${city.postalCode} France`,
      destination: `${config.address} ${config.postalCode} ${config.city} France`,
    }).toString()
    page(city.file, `Location de salle de mariage depuis ${city.name} (${city.postalCode}) — ${config.name}`,
      `Location de salle de mariage et de réception depuis ${city.name} (${city.postalCode}) : découvrez ${config.name} à ${config.city}, prestations, photos et devis.`,
      breadcrumb(department, city) + hero(`Location de salle de mariage et réception depuis ${e(city.name)} (${city.postalCode}).`, `${e(config.name)}, votre salle de mariage à ${e(config.city)} : préparez votre réception depuis ${e(city.name)} (${e(department.name)}).`, true) +
      renderCityContent({ city, department, config, escape: e, itinerary: itinerary.href, gallery }) + finalCta() + network(),
      [['Accueil', 'index.html'], [department.name, `${department.code}.html`], [city.name, city.file]])
  }
}
const mapQuery = encodeURIComponent(`${config.address} ${config.postalCode} ${config.city} France`)
page('contact.html', `Contact, devis et visite — ${config.name}`, `Contactez ${config.name} pour votre mariage : date, nombre d’invités, prestations et visite de la salle à ${config.city}.`,
  `<section class="section"><p class="eyebrow">Parlons de votre réception</p><h1>Votre projet commence ici.</h1><p>Une demande ne confirme ni une disponibilité ni une réservation. Vous pouvez aussi nous appeler au ${phone} ou écrire à <a href="mailto:${e(config.email)}">${e(config.email)}</a>.</p>
  <form class="contact-form" action="contact.php" method="post">
  <div class="form-grid"><label>Votre nom<input name="name" autocomplete="name" maxlength="120" required></label><label>Votre e-mail<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
  <label>Téléphone<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label><label>Type d’événement<select name="event" required><option value="">Choisir</option><option>Mariage</option><option>Fiançailles</option><option>Anniversaire</option><option>Baptême</option><option>Réception</option><option>Séminaire</option></select></label>
  <label>Date souhaitée<input name="date" type="date" required></label><label>Nombre d’invités<input name="guests" type="number" min="1" max="9999" required></label></div>
  <label>Votre message<textarea name="message" rows="5" maxlength="5000" required></textarea></label>
  <div class="honeypot" aria-hidden="true"><label>Ne pas remplir<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <label class="consent"><input name="consent" type="checkbox" value="yes" required> J’accepte que mes coordonnées soient utilisées pour répondre à ma demande. <a href="confidentialite.html">Confidentialité</a>.</label>
  <button class="button" type="submit">Envoyer ma demande</button><p class="form-status" role="status" aria-live="polite"></p></form></section>` +
  `<section class="section offers"><h2>Venez découvrir la salle.</h2><p>${e(config.address)}<br>${config.postalCode} ${e(config.city)}</p><a class="text-link" href="https://www.google.com/maps/search/?api=1&amp;query=${e(mapQuery)}" target="_blank" rel="noopener noreferrer">Voir l’adresse sur Google Maps ↗</a><p>Visites sur rendez-vous : ${phone}.</p></section>`)
const missingLegal = [config.siret, config.hostingProvider, config.publicationDirector].some((value) => !value)
page('mentions-legales.html', `Mentions légales — ${config.name}`, `Informations légales et coordonnées de ${config.name}.`,
  `<section class="section"><h1>Mentions légales</h1><h2>Éditeur</h2><p>${e(config.company)} — ${e(config.name)}<br>${e(config.address)}, ${config.postalCode} ${e(config.city)}<br>${phone}<br>${e(config.email)}</p><p>SIREN : ${e(config.siret || 'à renseigner avant publication')}<br>Responsable de publication : ${e(config.publicationDirector || 'à renseigner avant publication')}<br>Hébergement : ${e(config.hostingProvider || 'nom, adresse et téléphone à renseigner avant publication')}</p><h2>Informations sur les prestations</h2><p>Les photos présentent le lieu de réception. Les prestations, tarifs, disponibilités et conditions contractuelles sont confirmés dans votre devis. Une demande de contact ne constitue pas une réservation.</p></section>`)
page('confidentialite.html', `Confidentialité — ${config.name}`, `Utilisation des données du formulaire de contact et des lecteurs Instagram/TikTok par ${config.name}.`,
  `<section class="section"><h1>Confidentialité</h1><h2>Votre demande de réception</h2><p>${e(config.company)}, ${e(config.address)}, ${config.postalCode} ${e(config.city)}, traite les informations saisies dans le formulaire pour répondre à votre demande et préparer une proposition, sur la base des mesures précontractuelles prises à votre demande. Les champs obligatoires sont nécessaires pour vous répondre.</p><p>Les messages sont transmis par e-mail à notre équipe, ainsi qu’aux prestataires techniques d’hébergement et de messagerie nécessaires à cet envoi. Ils ne sont pas utilisés pour des campagnes commerciales par ce formulaire. La durée de conservation prévue est de ${config.contactRetentionMonths} mois après le dernier échange, hors obligations de conservation liées à un contrat. L’équipe doit appliquer cette durée dans sa messagerie.</p><h2>Vos droits</h2><p>Vous pouvez demander l’accès, la rectification, l’effacement ou la limitation de vos données en écrivant à <a href="mailto:${e(config.email)}">${e(config.email)}</a>. Vous pouvez adresser une réclamation à la CNIL.</p><h2>Vidéos et services externes</h2><p>Le site n’intègre aucun outil de suivi publicitaire. Les lecteurs Instagram et TikTok ne sont chargés qu’à votre demande. Après activation, ces plateformes reçoivent notamment votre adresse IP et appliquent leurs propres politiques de confidentialité et de cookies. Les liens WhatsApp et Google Maps vous dirigent vers leurs services ; aucune carte externe n’est chargée automatiquement.</p><h2>Protection contre les abus</h2><p>Un compteur temporaire fondé sur une empreinte de votre adresse IP limite les envois répétés. Il est supprimé après expiration. L’hébergeur et le fournisseur de messagerie peuvent conserver leurs journaux techniques selon leur propre politique.</p></section>`)
await mkdir(out, { recursive: true })
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true })
await cp(path.join(root, 'contact.php'), path.join(out, 'contact.php'))
await cp(path.join(root, '.htaccess'), path.join(out, '.htaccess'))
await writeFile(path.join(out, 'contact-config.json'), JSON.stringify({
  email: config.email, phone: config.phoneDisplay, name: config.name,
}))
await Promise.all([...files].map(([file, html]) => writeFile(path.join(out, file), html)))
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...files.keys()].map((file) => `  <url><loc>${e(file === 'index.html' ? origin.href : absolute(file))}</loc></url>`).join('\n')}\n</urlset>\n`
await writeFile(path.join(out, 'sitemap.xml'), sitemap)
await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /contact.php\nDisallow: /contact-config.json\nSitemap: ${absolute('sitemap.xml')}\n`)
await writeFile(path.join(out, '404.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Page introuvable</title><meta name="robots" content="noindex"><h1>Page introuvable</h1><a href="/index.html">Retour à l’accueil</a></html>`)
console.log(`${files.size} pages HTML générées, dont ${departments.reduce((n, d) => n + d.cities.length, 0)} pages ville. Sortie : ${out}`)
if (!config.heroVideo) console.warn('Bannière photo active : aucune vidéo réelle fournie.')
if (missingLegal) console.warn('Publication bloquée sur le plan éditorial : compléter SIRET, responsable de publication et hébergeur dans config.json.')
