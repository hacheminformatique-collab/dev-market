import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { makePageTypeStorage } from '../utils/cityPageStorage'
import { getSettings } from '../utils/storage'
import { PAGE_TYPES } from '../data/pageTypes'
import { getBlogArticles, getBlogConfig } from '../utils/blogStorage'
import { buildSeoData } from '../utils/seoData'

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

export default function SeoManager({ settingsVersion }) {
  const location = useLocation()
  const [cityPages, setCityPages] = useState({})
  const [blogArticle, setBlogArticle] = useState(null)
  const [blogConfig, setBlogConfig] = useState(null)

  // Detect the current page type from the URL path
  const detectedPageType = PAGE_TYPES.find((pt) =>
    location.pathname.startsWith(pt.basePath + '/')
  ) || null

  useEffect(() => {
    let cancelled = false
    if (detectedPageType) {
      makePageTypeStorage(detectedPageType.id).getPages().then((pages) => {
        if (!cancelled) setCityPages(pages || {})
      })
    } else {
      setCityPages({})
    }
    return () => { cancelled = true }
  }, [location.pathname, detectedPageType?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    if (location.pathname.startsWith('/blog/')) {
      const slug = location.pathname.replace('/blog/', '').replace(/\/$/, '')
      Promise.all([getBlogArticles(), getBlogConfig()]).then(([articles, cfg]) => {
        if (!cancelled) {
          setBlogArticle(articles[slug] || null)
          setBlogConfig(cfg)
        }
      })
    } else if (location.pathname === '/blog') {
      getBlogConfig().then((cfg) => { if (!cancelled) setBlogConfig(cfg) })
      setBlogArticle(null)
    } else {
      setBlogArticle(null)
      setBlogConfig(null)
    }
    return () => { cancelled = true }
  }, [location.pathname])

  useEffect(() => {
    const settings = getSettings()
    const seo = buildSeoData(location.pathname, settings, cityPages, detectedPageType, blogArticle, blogConfig)

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
    if (seo.jsonLd) upsertJsonLd(seo.jsonLd)
  }, [cityPages, location.pathname, detectedPageType, blogArticle, blogConfig, settingsVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
