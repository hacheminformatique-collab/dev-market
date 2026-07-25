import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Step1Client from './steps/Step1Client'
import Step2Event from './steps/Step2Event'
import Step3Formule from './steps/Step3Formule'
import Step4Menu from './steps/Step4Menu'
import Step5Gateau from './steps/Step5Gateau'
import Step6Options from './steps/Step6Options'
import Step7Summary from './steps/Step7Summary'
import CartFloat from './CartFloat'

const STEP_LABELS = ['Coordonnées', 'Événement', 'Formule', 'Menu', 'Gâteau', 'Options', 'Récapitulatif']

export default function WizardForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function isLocationSeche() {
    return formData.formule?.nomFormule?.toLowerCase().includes('sèche')
  }

  function nextStep() {
    if (step === 3 && isLocationSeche()) {
      setStep(6) // skip menu & gateau
    } else {
      setStep((s) => Math.min(s + 1, 7))
    }
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
  const displayStep = isLocationSeche()
    ? (step <= 3 ? step : step === 6 ? 4 : step === 7 ? 5 : step)
    : step

  const showCart = step >= 3

  return (
    <div style={{ minHeight: '100vh', background: '#f8f5f0', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px' }}
        >
          ←
        </button>
        <div>
          <div style={{ color: '#c9a84c', fontWeight: '800', fontSize: '18px' }}>LE PARADISE</div>
          <div style={{ color: '#aaa', fontSize: '12px' }}>Demande de devis</div>
        </div>
      </div>

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
          {step === 1 && <Step1Client data={formData} onChange={updateField} onNext={() => setStep(2)} />}
          {step === 2 && <Step2Event data={formData} onChange={updateField} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <Step3Formule data={formData} onChange={updateField} onNext={nextStep} onBack={() => setStep(2)} />}
          {step === 4 && <Step4Menu data={formData} onChange={updateField} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
          {step === 5 && <Step5Gateau data={formData} onChange={updateField} onNext={() => setStep(6)} onBack={() => setStep(4)} />}
          {step === 6 && <Step6Options data={formData} onChange={updateField} onNext={() => setStep(7)} onBack={prevStep} />}
          {step === 7 && <Step7Summary data={formData} onBack={() => setStep(6)} onSubmit={() => {}} />}
        </div>
      </div>

      {showCart && <CartFloat data={formData} />}
    </div>
  )
}
