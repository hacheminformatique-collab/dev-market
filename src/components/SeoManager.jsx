import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getCityBySlug } from '../data/idf-cities'
import { getSettings } from '../utils/storage'

function normalizeSiteUrl(rawUrl) {
  const fallback = window.location.origin
  const input = (rawUrl || '').trim()
  if (!input) return fallback
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
    return new URL(withProtocol).origin
  } catch {
    return fallback
  }
}

function upsertMeta(attr, key, content) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

function upsertJsonLd(value) {
  let tag = document.head.querySelector('#seo-json-ld')
  if (!tag) {
    tag = document.createElement('script')
    tag.id = 'seo-json-ld'
    tag.type = 'application/ld+json'
    document.head.appendChild(tag)
  }
  tag.textContent = JSON.stringify(value)
}

function buildSeoData(pathname, settings) {
  const businessName = settings?.nom?.trim() || 'Le Paradise 77'
  const baseUrl = normalizeSiteUrl(settings?.siteUrl)
  const canonical = new URL(pathname, baseUrl).toString()
  const imageUrl = new URL('/favicon.svg', baseUrl).toString()
  const noindex =
    pathname === '/admin' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/espace-client/') ||
    pathname.startsWith('/espace-staff/')

  const base = {
    title: `${businessName} — Salle de mariage et réception`,
    description: `Découvrez ${businessName}, salle de mariage et réception en Seine-et-Marne : devis rapide, prestations sur mesure et accompagnement événementiel.`,
    keywords: 'salle mariage, salle reception, devis mariage, location salle, Seine-et-Marne, Le Paradise',
    robots: noindex
      ? 'noindex, nofollow, noarchive'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    canonical,
    ogType: 'website',
    imageUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: businessName,
          url: baseUrl,
          inLanguage: 'fr-FR',
        },
        {
          '@type': 'LocalBusiness',
          name: businessName,
          url: baseUrl,
          image: imageUrl,
          telephone: settings?.whatsapp || undefined,
          addressCountry: 'FR',
        },
      ],
    },
  }

  if (pathname === '/') {
    return {
      ...base,
      title: `${businessName} — Salle de réception, mariage et événements`,
      description: `Réservez ${businessName} pour vos mariages, réceptions et événements privés en Seine-et-Marne. Devis gratuit et rapide en ligne.`,
      keywords: `${base.keywords}, événement privé, salle de fête`,
    }
  }

  if (pathname === '/devis') {
    return {
      ...base,
      title: `Demande de devis — ${businessName}`,
      description: `Obtenez votre devis personnalisé pour votre mariage ou réception chez ${businessName}. Réponse rapide et accompagnement complet.`,
      keywords: `${base.keywords}, demande devis, devis reception`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          ...base.jsonLd['@graph'],
          {
            '@type': 'Service',
            name: `Demande de devis ${businessName}`,
            serviceType: 'Organisation de réception et mariage',
            provider: {
              '@type': 'LocalBusiness',
              name: businessName,
              url: baseUrl,
            },
            areaServed: 'Seine-et-Marne',
          },
        ],
      },
    }
  }

  if (pathname.startsWith('/villes/')) {
    const citySlug = pathname.split('/')[2]
    const city = getCityBySlug(citySlug)
    if (city) {
      return {
        ...base,
        title: `Salle de mariage à ${city.name} — ${businessName}`,
        description: `${businessName} accompagne vos mariages et réceptions à ${city.name} (${city.deptName}). Découvrez nos prestations et demandez un devis gratuit.`,
        keywords: `${base.keywords}, ${city.name}, ${city.deptName}, salle mariage ${city.name}`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            ...base.jsonLd['@graph'],
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Accueil',
                  item: new URL('/', baseUrl).toString(),
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: city.name,
                  item: canonical,
                },
              ],
            },
          ],
        },
      }
    }
  }

  if (pathname === '/admin' || pathname === '/dashboard') {
    return {
      ...base,
      title: `Administration — ${businessName}`,
      description: `Espace d’administration interne de ${businessName}.`,
    }
  }

  if (pathname.startsWith('/espace-client/')) {
    return {
      ...base,
      title: `Espace client — ${businessName}`,
      description: `Accédez à votre espace client ${businessName}.`,
    }
  }

  if (pathname.startsWith('/espace-staff/')) {
    return {
      ...base,
      title: `Espace staff — ${businessName}`,
      description: `Accédez à votre espace staff ${businessName}.`,
    }
  }

  return base
}

export default function SeoManager() {
  const location = useLocation()

  useEffect(() => {
    const settings = getSettings()
    const seo = buildSeoData(location.pathname, settings)

    document.documentElement.lang = 'fr'
    document.title = seo.title
    upsertMeta('name', 'description', seo.description)
    upsertMeta('name', 'keywords', seo.keywords)
    upsertMeta('name', 'robots', seo.robots)
    upsertMeta('name', 'author', settings?.nom?.trim() || 'Le Paradise 77')
    upsertMeta('name', 'theme-color', '#1a1a2e')
    upsertMeta('property', 'og:title', seo.title)
    upsertMeta('property', 'og:description', seo.description)
    upsertMeta('property', 'og:type', seo.ogType)
    upsertMeta('property', 'og:url', seo.canonical)
    upsertMeta('property', 'og:site_name', settings?.nom?.trim() || 'Le Paradise 77')
    upsertMeta('property', 'og:locale', 'fr_FR')
    upsertMeta('property', 'og:image', seo.imageUrl)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', seo.title)
    upsertMeta('name', 'twitter:description', seo.description)
    upsertMeta('name', 'twitter:image', seo.imageUrl)
    upsertLink('canonical', seo.canonical)
    upsertJsonLd(seo.jsonLd)
  }, [location.pathname])

  return null
}
