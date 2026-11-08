import { createElement } from 'react'
import { injectWeddingSource, sourceStyle } from '../../utils/weddingSourceLayout'
import './WeddingSourceSections.css'
import { testimonialBlockIndexes } from '../../utils/weddingDisplayText'

const safeTags = new Set(['section', 'div', 'span', 'p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'br'])

function plainBlock(block) {
  return block.replace(/^#{2,3} /, '')
}

function questionKey(question, businessName) {
  return question.replaceAll('${businessName}', 'venue')
    .replace(/Le Paradise(?: 77)?/g, 'venue').replaceAll(businessName, 'venue')
}

function SourceAccordion({ node, city, knownFaqs, businessName, index }) {
  const question = injectWeddingSource(node.faq.question, city)
  const known = knownFaqs.find((faq) =>
    questionKey(faq.q, businessName) === questionKey(question, businessName))
  const answer = node.faq.answer ? injectWeddingSource(node.faq.answer, city) : known?.a
  if (!answer) throw new Error(`Réponse source ou connue introuvable : ${question}`)
  const id = `source-faq-${index}`
  return (
    <details className="wedding-source-accordion">
      <summary aria-controls={id} style={sourceStyle(node.attrs.style)}>
        <span style={sourceStyle(node.children[0].attrs.style)}>{question}</span>
        <span className="wedding-source-toggle" aria-hidden="true" style={sourceStyle(node.children[1].attrs.style)} />
      </summary>
      <div id={id} style={{ padding: '16px 20px', fontSize: '14px', lineHeight: 1.8, color: 'var(--text)', borderTop: '1px solid var(--border)' }}>
        {answer}
      </div>
    </details>
  )
}

export default function WeddingSourceSections({ layout, city, knownFaqs, businessName, afterIntro }) {
  let faqIndex = 0
  function renderNode(node, section, key) {
    if (typeof node === 'string') return injectWeddingSource(node, city)
    if (node.block !== undefined && testimonialBlockIndexes(section.originals).has(node.block)) return null
    if (node.faq) {
      return <SourceAccordion key={key} node={node} city={city} knownFaqs={knownFaqs} businessName={businessName} index={faqIndex++} />
    }
    if (!safeTags.has(node.tag)) throw new Error(`Élément source non autorisé : ${node.tag}`)
    const props = { key }
    for (const name of ['id', 'title', 'target', 'rel']) {
      if (node.attrs[name] !== undefined) props[name] = node.attrs[name]
    }
    props.style = sourceStyle(node.attrs.style)
    if (node.attrs.href) {
      if (!/^(https?:\/\/|\/|#|tel:|mailto:)/i.test(node.attrs.href)) throw new Error('Lien source non autorisé.')
      // Keep captured URLs unchanged; only their visible city labels are injected.
      props.href = node.attrs.href
      if (props.target === '_blank') props.rel = 'noopener noreferrer'
    }
    let children = node.children.map((child, index) => renderNode(child, section, `${key}-${index}`)).filter((child) => child !== null)
    if (node.children.length && !children.length) return null
    if (node.block !== undefined) {
      const saved = section.blocks[node.block]
      const generated = injectWeddingSource(section.originals[node.block], city)
      if (!children.length || saved !== generated) {
        children = node.keepIcon ? [children[0], plainBlock(saved)]
          : [`${node.prefix || ''}${plainBlock(saved)}${node.suffix || ''}`]
      }
    }
    if (node.tag === 'section' && section.id === 'intro') children.push(afterIntro)
    return createElement(node.tag, props, ...children)
  }
  return layout.sections.map((section) => (
    <div key={section.id} className="wedding-source-section">
      {renderNode(section.tree, section, section.id)}
    </div>
  ))
}
