import { getCityBySlug } from '../data/idf-cities'

function plainLocationName(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '')
    .replaceAll('œ', 'oe').replaceAll('Œ', 'OE')
    .replaceAll('æ', 'ae').replaceAll('Æ', 'AE')
    .replace(/[^a-zA-Z0-9]+/g, ' ').trim()
}

function normalizeSiteUrl(rawUrl, fallback = window.location.origin) {
  const input = (rawUrl || '').trim()
  if (!input) return fallback
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
    return new URL(withProtocol).origin
  } catch {
    return fallback
  }
}

export function buildSeoData(pathname, settings, cityPages, detectedPageType, blogArticle, blogConfig, origin) {
  const businessName = settings?.nom?.trim() || 'Le Paradise 77'
  const baseUrl = normalizeSiteUrl(settings?.siteUrl, origin)
  const canonical = new URL(pathname, baseUrl).toString()
  const imageUrl = new URL('/media/hero-paradise.jpg', baseUrl).toString()

  // Detect city slug from any known page-type base path
  let citySlug = ''
  if (detectedPageType) {
    const parts = pathname.split('/')
    citySlug = parts[parts.length - 1] || ''
  }
  const hasGeneratedCityPage = Boolean(citySlug && cityPages?.[citySlug]?.content)
  const isIndexable = pathname === '/' || hasGeneratedCityPage

  const base = {
    title: `${businessName} — Salle de mariage et réception`,
    description: `Découvrez ${businessName}, salle de mariage et réception en Seine-et-Marne : devis rapide, prestations sur mesure et accompagnement événementiel.`,
    keywords: 'salle mariage, salle reception, devis mariage, location salle, Seine-et-Marne, Le Paradise',
    robots: isIndexable
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, nofollow, noarchive',
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
          '@type': ['LocalBusiness', 'EventVenue'],
          '@id': new URL('/#venue', baseUrl).toString(),
          name: businessName,
          url: baseUrl,
          image: imageUrl,
          telephone: settings?.legalInfo?.telephone?.trim() || '+33782821582',
          email: settings?.legalInfo?.email?.trim() || undefined,
          address: {
            '@type': 'PostalAddress',
            streetAddress: '5 avenue Fridingen',
            postalCode: '77100',
            addressLocality: 'Nanteuil-lès-Meaux',
            addressRegion: 'Seine-et-Marne',
            addressCountry: 'FR',
          },
          geo: { '@type': 'GeoCoordinates', latitude: 48.9617, longitude: 2.8985 },
        },
      ],
    },
  }

  if (pathname === '/') {
    return {
      ...base,
      title: `Location salle de mariage à Nanteuil-lès-Meaux (77) — ${businessName}`,
      description: `Découvrez ${businessName}, salle de mariage à Nanteuil-lès-Meaux en Seine-et-Marne, accessible depuis l’Île-de-France. Photos, prestations et devis personnalisé.`,
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

  if (detectedPageType && citySlug) {
    const city = getCityBySlug(citySlug)
    if (city && hasGeneratedCityPage) {
      const isWedding = detectedPageType.id === 'mariage'
      if (isWedding && !/^\d{5}$/.test(city.postalCode || '')) {
        throw new Error(`Code postal manquant pour ${city.name} (${city.deptCode}).`)
      }
      const values = {
        city: isWedding ? plainLocationName(city.name) : city.name,
        dept: isWedding ? plainLocationName(city.deptName).toLowerCase() : city.deptName,
        deptCode: city.deptCode,
        postalCode: city.postalCode,
        business: businessName,
      }
      const fillTemplate = (template) => template.replace(/\{\{(city|dept|deptCode|postalCode|business)\}\}/g, (_match, key) => values[key])
      const title = fillTemplate(detectedPageType.seoCityTitle || 'Page ville — {{business}}')
      const description = fillTemplate(detectedPageType.seoCityDesc || '')
      return {
        ...base,
        title,
        description,
        keywords: `${base.keywords}, ${city.name}, ${city.deptName}, ${detectedPageType.mainKeyword} ${city.name}`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            ...base.jsonLd['@graph'],
            {
              '@type': 'Service',
              name: `${detectedPageType.mainKeyword} pour les habitants de ${city.name}`,
              serviceType: detectedPageType.mainKeyword,
              areaServed: { '@type': 'City', name: city.name },
              provider: { '@id': new URL('/#venue', baseUrl).toString() },
              url: canonical,
            },
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
                  name: `${detectedPageType.mainKeyword} ${city.name}`,
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

  if (pathname === '/blog') {
    return {
      ...base,
      title: `Blog mariage — conseils et inspirations — ${businessName}`,
      description: `Découvrez nos articles de conseils pour futurs mariés : organisation, décoration, budget, traiteur et bien plus encore. Blog de ${businessName}.`,
      keywords: `${base.keywords}, blog mariage, conseils mariage, organisation mariage, idées mariage`,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      ogType: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          ...base.jsonLd['@graph'],
          {
            '@type': 'Blog',
            name: `Blog mariage — ${businessName}`,
            url: new URL('/blog', baseUrl).toString(),
            description: `Articles de conseils pour futurs mariés par ${businessName}`,
            inLanguage: 'fr-FR',
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Accueil', item: new URL('/', baseUrl).toString() },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: new URL('/blog', baseUrl).toString() },
            ],
          },
        ],
      },
    }
  }

  if (pathname.startsWith('/blog/')) {
    const slug = pathname.replace('/blog/', '').replace(/\/$/, '')
    const article = blogArticle
    if (article && article.status === 'published') {
      const _authorName = blogConfig?.authorName || businessName
      return {
        ...base,
        title: article.seoTitle || `${article.title} — ${businessName}`,
        description: article.seoDescription || article.excerpt || base.description,
        keywords: `${base.keywords}, ${(article.keywords || []).join(', ')}`,
        robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        ogType: 'article',
      }
    }
    if (slug) {
      return {
        ...base,
        title: `Article — ${businessName}`,
        robots: 'noindex, nofollow, noarchive',
      }
    }
  }

  return base
}
