import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, initStorage } from '../../utils/storage'
import { QUOTE_STORAGE_NAMES } from '../../utils/storageProfiles'
import { siteFetch } from '../../utils/siteFetch'
import Step1Client from './steps/Step1Client'
import Step2Event from './steps/Step2Event'
import Step3Formule from './steps/Step3Formule'
import Step4Menu from './steps/Step4Menu'
import Step5Gateau from './steps/Step5Gateau'
import Step6Options from './steps/Step6Options'
import CartFloat from './CartFloat'
import VideoHero from '../VideoHero'
import PublicHeader from '../PublicHeader'

const STEP_LABELS = ['Coordonnées', 'Événement', 'Formule', 'Menu', 'Gâteau', 'Options', 'Récapitulatif']
const Step7Summary = lazy(() => import('./steps/Step7Summary'))
const FOLLOWUP_FLOW_KEY = 'paradise_quote_followup_flow'

function createFlowId() {
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function getFlowId() {
  try {
    let flowId = sessionStorage.getItem(FOLLOWUP_FLOW_KEY)
    if (!/^[a-f0-9]{32}$/.test(flowId || '')) {
      flowId = createFlowId()
      sessionStorage.setItem(FOLLOWUP_FLOW_KEY, flowId)
    }
    return flowId
  } catch {
    return createFlowId()
  }
}

export default function WizardForm({ inline = false }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [conditionsAccepted, setConditionsAccepted] = useState(false)
  const [followupError, setFollowupError] = useState('')
  const [pendingFollowup, setPendingFollowup] = useState(null)
  const [followupSkipped, setFollowupSkipped] = useState(false)
  const [flowId, setFlowId] = useState(getFlowId)
  const followupInFlight = useRef(false)

  useEffect(() => {
    void initStorage({
      names: QUOTE_STORAGE_NAMES,
      paced: false,
      persistDefaults: false,
    }).catch(() => {})
  }, [])

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function updateConditionsAcceptance(accepted) {
    setConditionsAccepted(accepted)
    updateField('conditionsAccepted', accepted)
    updateField('conditionsAcceptedAt', accepted ? new Date().toISOString() : null)
  }

  function handleQuoteSubmitted() {
    const nextFlowId = createFlowId()
    setFlowId(nextFlowId)
    try { sessionStorage.setItem(FOLLOWUP_FLOW_KEY, nextFlowId) } catch { /* session storage may be unavailable */ }
  }

  function getFollowupSummary(stage) {
    const summary = {
      prenom: formData.prenom || '',
      nom: formData.nom || '',
      email: formData.email || '',
      telephone: formData.telephone || '',
      adresse: formData.adresse || '',
      codePostal: formData.codePostal || '',
      ville: formData.ville || '',
    }
    if (stage >= 2) Object.assign(summary, {
      typeEvenement: formData.typeEvenement || '',
      dateEvenement: formData.dateEvenement || '',
      nbAdultes: Number(formData.nbAdultes) || 0,
      nbEnfants: Number(formData.nbEnfants) || 0,
      heureDebut: formData.heureDebut || '',
      heureFin: formData.heureFin || '',
      commentaire: formData.commentaire || '',
    })
    if (stage >= 3) summary.formule = formData.formule?.nomFormule || ''
    const dryFormula = formData.formule?.nomFormule?.toLowerCase().includes('sèche')
    if (stage >= 4 && !dryFormula) summary.menus = (formData.menus || []).map((menu) => ({ section: menu.section, name: menu.nomMenu }))
    if (stage >= 5 && !dryFormula) {
      summary.gateau = formData.gateau?.nomGateau || ''
      summary.gateauDetails = formData.gateauPersonnalisation || null
    }
    if (stage >= 6) summary.prestations = (formData.prestations || []).map((prestation) => prestation.nomPresta)
    return summary
  }

  function ensureStepStorage(targetStep) {
    const keysByStep = {
      3: ['formules'],
      4: ['menus'],
      5: ['gateaux'],
      6: ['prestations'],
      7: ['settings', 'clients'],
    }
    const names = keysByStep[targetStep]
    return names ? initStorage({ names, paced: false, persistDefaults: false }) : Promise.resolve()
  }

  async function advanceValidatedSection(targetStep, stage) {
    if (followupInFlight.current) return
    if (!conditionsAccepted) {
      setFollowupError('Veuillez accepter les conditions générales avant de poursuivre.')
      return
    }
    followupInFlight.current = true
    setFollowupError('')
    try {
      await ensureStepStorage(targetStep)
      const response = await siteFetch('/api/notify.php', {
        method: 'POST',
        paced: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationType: 'quote_followup',
          flowId,
          stage,
          acceptedConditions: true,
          summary: getFollowupSummary(stage),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok !== true) {
        throw new Error(result.error || 'Nous n’avons pas pu transmettre votre récapitulatif. Veuillez réessayer.')
      }
      setStep(targetStep)
      setPendingFollowup(null)
      setFollowupSkipped(false)
    } catch (error) {
      setFollowupError(error.message || 'Erreur de transmission. Veuillez réessayer.')
      setPendingFollowup({ targetStep, stage })
    } finally {
      followupInFlight.current = false
    }
  }

  function continueWithoutFollowup() {
    if (!pendingFollowup) return
    setStep(pendingFollowup.targetStep)
    setPendingFollowup(null)
    setFollowupError('')
    setFollowupSkipped(true)
  }

  function renderFollowupNotice() {
    return (
      <>
        {followupSkipped && (
          <p role="status" style={{ color: '#856404', marginBottom: '16px' }}>
            Le récapitulatif n’a pas été envoyé. Vous pouvez continuer votre demande.
          </p>
        )}
        {followupError && (
          <div role="alert" style={{ color: '#c0392b', marginBottom: '16px' }}>
            <p>{followupError}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={() => advanceValidatedSection(pendingFollowup.targetStep, pendingFollowup.stage)}>
                Réessayer l’envoi
              </button>
              <button type="button" className="btn btn-outline" onClick={continueWithoutFollowup}>
                Continuer sans envoyer le récapitulatif
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  function isLocationSeche() {
    return formData.formule?.nomFormule?.toLowerCase().includes('sèche')
  }

  function prevStep() {
    if (step === 6 && isLocationSeche()) {
      setStep(3) // go back to formule
    } else {
      setStep((s) => Math.max(s - 1, 1))
    }
  }

  // Visual step indicator: steps 4 & 5 highlighted when applicable
  function getDisplayStep() {
    if (isLocationSeche() && step === 6) return 4 // visually step 4/5 (skipped)
    if (step > 5) return step - (isLocationSeche() ? 2 : 0)
    return step
  }

  const totalVisibleSteps = isLocationSeche() ? 5 : 7
  const displayStep = getDisplayStep()

  const showCart = step >= 3

  if (inline) {
    return (
      <div className="quote-wizard" style={{ background: '#f8f5f0', color: '#2c2c2c', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Progress bar */}
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {Array.from({ length: totalVisibleSteps }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: i < displayStep ? '#c9a84c' : '#e0e0e0',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: '13px', color: '#888' }}>
            Étape {displayStep} / {totalVisibleSteps} — {STEP_LABELS[step - 1]}
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
          <div className="card">
            {renderFollowupNotice()}
            {step === 1 && <Step1Client data={formData} onChange={updateField} onNext={() => advanceValidatedSection(2, 1)} conditionsAccepted={conditionsAccepted} onConditionsChange={updateConditionsAcceptance} />}
            {step === 2 && <Step2Event data={formData} onChange={updateField} onNext={() => advanceValidatedSection(3, 2)} onBack={() => setStep(1)} />}
            {step === 3 && <Step3Formule data={formData} onChange={updateField} onNext={() => advanceValidatedSection(isLocationSeche() ? 6 : 4, 3)} onBack={() => setStep(2)} />}
            {step === 4 && <Step4Menu data={formData} onChange={updateField} onNext={() => advanceValidatedSection(5, 4)} onBack={() => setStep(3)} />}
            {step === 5 && <Step5Gateau data={formData} onChange={updateField} onNext={() => advanceValidatedSection(6, 5)} onBack={() => setStep(4)} />}
            {step === 6 && <Step6Options data={formData} onChange={updateField} onNext={() => advanceValidatedSection(7, 6)} onBack={prevStep} />}
            {step === 7 && <Suspense fallback={<p role="status">Chargement du récapitulatif…</p>}><Step7Summary data={{ ...formData, quoteFlowId: flowId }} onBack={() => setStep(6)} onSubmit={handleQuoteSubmitted} /></Suspense>}
          </div>
        </div>

        {showCart && <CartFloat data={formData} />}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f5f0', paddingBottom: '100px' }}>
      <PublicHeader businessName={getSettings()?.nom} />
      {/* Header */}
      <VideoHero>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '720px', margin: '0 auto' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px' }}
          >
            ←
          </button>
          <div>
            <div style={{ color: '#c9a84c', fontWeight: '800', fontSize: '18px' }}>LE PARADISE</div>
            <h1 style={{ color: 'white', fontSize: 'clamp(1.5rem,4vw,2rem)' }}>Demande de devis</h1>
          </div>
        </div>
      </VideoHero>

      {/* Progress bar */}
      <div style={{ background: 'white', padding: '20px 24px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {Array.from({ length: totalVisibleSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: i < displayStep ? '#c9a84c' : '#e0e0e0',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: '13px', color: '#888' }}>
          Étape {displayStep} / {totalVisibleSteps} — {STEP_LABELS[step - 1]}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        <div className="card">
          {renderFollowupNotice()}
          {step === 1 && <Step1Client data={formData} onChange={updateField} onNext={() => advanceValidatedSection(2, 1)} conditionsAccepted={conditionsAccepted} onConditionsChange={updateConditionsAcceptance} />}
          {step === 2 && <Step2Event data={formData} onChange={updateField} onNext={() => advanceValidatedSection(3, 2)} onBack={() => setStep(1)} />}
          {step === 3 && <Step3Formule data={formData} onChange={updateField} onNext={() => advanceValidatedSection(isLocationSeche() ? 6 : 4, 3)} onBack={() => setStep(2)} />}
          {step === 4 && <Step4Menu data={formData} onChange={updateField} onNext={() => advanceValidatedSection(5, 4)} onBack={() => setStep(3)} />}
          {step === 5 && <Step5Gateau data={formData} onChange={updateField} onNext={() => advanceValidatedSection(6, 5)} onBack={() => setStep(4)} />}
          {step === 6 && <Step6Options data={formData} onChange={updateField} onNext={() => advanceValidatedSection(7, 6)} onBack={prevStep} />}
          {step === 7 && <Suspense fallback={<p role="status">Chargement du récapitulatif…</p>}><Step7Summary data={{ ...formData, quoteFlowId: flowId }} onBack={() => setStep(6)} onSubmit={handleQuoteSubmitted} /></Suspense>}
        </div>
      </div>

      {showCart && <CartFloat data={formData} />}
    </div>
  )
}
