import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const INVESTIGATION_TYPES = [
  'Surveillance', 'Infidelity Investigation', 'Insurance Investigation',
  'Background Check', 'Missing Person', 'Corporate Investigation',
  'Asset Search', 'Process Serving', 'Child Custody Investigation',
  'Tenant Screening', 'Skip Trace', 'Digital Investigation',
  'Nanny/Caregiver Investigation'
]

export default function AISummaryModal({ job, user, profile, onClose }) {
  const [step, setStep] = useState('form') // form | generating | result | purchase
  const [formData, setFormData] = useState({
    investigationType: job?.investigation_type || '',
    subjectDescription: '',
    methodology: '',
    keyFindings: '',
    evidenceCollected: '',
    additionalContext: ''
  })
  const [summary, setSummary] = useState('')
  const [editedSummary, setEditedSummary] = useState('')
  const [credits, setCredits] = useState(null)
  const [premiumUsesRemaining, setPremiumUsesRemaining] = useState(null)
  const [pricePerCredit, setPricePerCredit] = useState(199)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const isPremium = profile?.membership_tier === 'premium' || profile?.membership_tier === 'featured'

  useEffect(() => {
    loadCredits()
  }, [])

  const loadCredits = async () => {
    const { data: pi } = await supabase
      .from('pi_profiles')
      .select('ai_credits_balance, ai_premium_uses_this_month, ai_premium_uses_reset_at')
      .eq('user_id', user.id)
      .single()

    const { data: configs } = await supabase
      .from('platform_config')
      .select('key, value')
      .in('key', ['ai_credit_price_cents', 'ai_premium_monthly_allowance'])

    const configMap = {}
    configs?.forEach(c => { configMap[c.key] = c.value })

    const monthlyAllowance = parseInt(configMap.ai_premium_monthly_allowance || '3')
    const price = parseInt(configMap.ai_credit_price_cents || '199')
    setPricePerCredit(price)

    if (pi) {
      setCredits(pi.ai_credits_balance || 0)
      if (isPremium) {
        // Check if reset needed
        const resetAt = pi.ai_premium_uses_reset_at ? new Date(pi.ai_premium_uses_reset_at) : null
        const now = new Date()
        const usedThisMonth = (!resetAt || now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear())
          ? 0
          : (pi.ai_premium_uses_this_month || 0)
        setPremiumUsesRemaining(Math.max(0, monthlyAllowance - usedThisMonth))
      }
    }
  }

  const canGenerate = isPremium
    ? (premiumUsesRemaining > 0 || credits > 0)
    : (credits > 0)

  const handleGenerate = async () => {
    if (!formData.keyFindings.trim()) {
      setError('Key findings are required to generate a summary.')
      return
    }
    setStep('generating')
    setError(null)

    try {
      const res = await fetch('/api/generate-case-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          jobId: job?.id || null,
          formData
        })
      })

      const data = await res.json()

      if (res.status === 402) {
        setError(data.message)
        setStep('purchase')
        return
      }

      if (!res.ok) throw new Error(data.error)

      setSummary(data.summary)
      setEditedSummary(data.summary)
      setCredits(data.creditsBalance)
      if (isPremium) setPremiumUsesRemaining(data.premiumUsesRemaining)
      setStep('result')

    } catch (err) {
      setError(err.message)
      setStep('form')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(editedSummary)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const jobTitle = job?.title || 'Case'
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const content = `CASE SUMMARY REPORT\n${jobTitle}\n${date}\n\n${editedSummary}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Case-Summary-${jobTitle.replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePurchaseCredit = async () => {
    try {
      const res = await fetch('/api/purchase-ai-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, quantity: 1 })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Use Stripe.js to complete payment
      if (window.Stripe) {
        const stripe = window.Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
        const { error } = await stripe.confirmPayment({
          clientSecret: data.clientSecret,
          confirmParams: { return_url: window.location.href }
        })
        if (error) throw new Error(error.message)
      } else {
        alert('Stripe not loaded. Please refresh and try again.')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const fieldStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box',
    fontFamily: 'inherit'
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-container" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>✨ AI Case Summary Generator</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">

          {/* Credit status bar */}
          <div style={{ background: isPremium ? '#f0f4ff' : '#f9fafb', border: `1px solid ${isPremium ? '#c7d2fe' : '#e5e7eb'}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              {isPremium ? (
                <p style={{ fontSize: '13px', margin: 0, color: '#4338ca' }}>
                  💎 Premium: <strong>{premiumUsesRemaining ?? '...'} free use{premiumUsesRemaining !== 1 ? 's' : ''}</strong> remaining this month
                </p>
              ) : (
                <p style={{ fontSize: '13px', margin: 0, color: '#374151' }}>
                  Credits: <strong>{credits ?? '...'}</strong>
                </p>
              )}
              {(!isPremium || (premiumUsesRemaining === 0)) && credits > 0 && (
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                  {credits} paid credit{credits !== 1 ? 's' : ''} available
                </p>
              )}
            </div>
            {!canGenerate && step !== 'purchase' && (
              <button onClick={() => setStep('purchase')}
                style={{ background: '#667eea', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                Buy Credits
              </button>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '14px' }}>{error}</div>
          )}

          {/* FORM STEP */}
          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Investigation Type</label>
                <select value={formData.investigationType} onChange={e => update('investigationType', e.target.value)} style={fieldStyle}>
                  <option value="">Select type...</option>
                  {INVESTIGATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Subject Description <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>(no names)</span></label>
                <textarea value={formData.subjectDescription} onChange={e => update('subjectDescription', e.target.value)}
                  rows={2} placeholder="e.g., Male subject, approximately 40 years old, employed as a warehouse worker claiming total disability..."
                  style={fieldStyle} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Methodology</label>
                <textarea value={formData.methodology} onChange={e => update('methodology', e.target.value)}
                  rows={2} placeholder="e.g., Stationary and mobile surveillance conducted over 4 days. Video documentation using high-definition equipment..."
                  style={fieldStyle} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Key Findings <span style={{ color: '#dc2626', fontWeight: 'normal' }}>*</span></label>
                <textarea value={formData.keyFindings} onChange={e => update('keyFindings', e.target.value)}
                  rows={3} placeholder="e.g., Subject was observed performing physical labor inconsistent with claimed disability on Days 1, 2, and 4. Subject was observed lifting boxes exceeding 30 lbs..."
                  style={fieldStyle} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Evidence Collected</label>
                <textarea value={formData.evidenceCollected} onChange={e => update('evidenceCollected', e.target.value)}
                  rows={2} placeholder="e.g., 4.5 hours of HD video footage, 87 still photographs, activity log with timestamps..."
                  style={fieldStyle} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '13px', fontWeight: '600' }}>Additional Context <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>(optional)</span></label>
                <textarea value={formData.additionalContext} onChange={e => update('additionalContext', e.target.value)}
                  rows={2} placeholder="Any other relevant context for the summary..."
                  style={fieldStyle} />
              </div>

              <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px' }}>
                <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
                  {isPremium && premiumUsesRemaining > 0
                    ? `✓ This will use 1 of your ${premiumUsesRemaining} free Premium use${premiumUsesRemaining !== 1 ? 's' : ''} this month.`
                    : `This will use 1 credit ($${(pricePerCredit / 100).toFixed(2)}) from your balance.`}
                  {' '}Do not include real names — refer to "the subject" throughout.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose}
                  style={{ background: 'none', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleGenerate}
                  disabled={!canGenerate}
                  style={{ background: canGenerate ? '#667eea' : '#e5e7eb', color: canGenerate ? 'white' : '#9ca3af', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: canGenerate ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600' }}>
                  ✨ Generate Summary
                </button>
              </div>
            </div>
          )}

          {/* GENERATING STEP */}
          {step === 'generating' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontWeight: '600', fontSize: '15px', marginBottom: '6px' }}>Generating your case summary...</p>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>This takes about 10 seconds</p>
            </div>
          )}

          {/* RESULT STEP */}
          {step === 'result' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>✓ Summary generated — review and edit as needed</p>
                <button type="button" onClick={() => setStep('form')}
                  style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px' }}>
                  ← Edit inputs
                </button>
              </div>

              <textarea
                value={editedSummary}
                onChange={e => setEditedSummary(e.target.value)}
                rows={18}
                style={{ ...fieldStyle, lineHeight: '1.6', fontFamily: 'monospace', fontSize: '12px', background: '#fafafa' }}
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleCopy}
                  style={{ background: '#059669', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                </button>
                <button type="button" onClick={handleDownload}
                  style={{ background: 'white', border: '1px solid #d1d5db', color: '#374151', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  ⬇ Download .txt
                </button>
                <button type="button" onClick={() => setStep('form')}
                  style={{ background: 'white', border: '1px solid #d1d5db', color: '#374151', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  ✨ Generate New
                </button>
              </div>

              {isPremium && premiumUsesRemaining !== null && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '10px' }}>
                  {premiumUsesRemaining} free use{premiumUsesRemaining !== 1 ? 's' : ''} remaining this month
                  {credits > 0 ? ` · ${credits} paid credit${credits !== 1 ? 's' : ''} available` : ''}
                </p>
              )}
            </div>
          )}

          {/* PURCHASE STEP */}
          {step === 'purchase' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>✨</div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Purchase AI Credits</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                ${(pricePerCredit / 100).toFixed(2)} per use
                {isPremium && ` · Premium members get ${credits} paid credit${credits !== 1 ? 's' : ''} remaining`}
              </p>

              {!isPremium && (
                <div style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '14px', marginBottom: '20px', textAlign: 'left' }}>
                  <p style={{ fontWeight: '600', fontSize: '13px', margin: '0 0 4px', color: '#4338ca' }}>💎 Upgrade to Premium</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px' }}>
                    Get {premiumUsesRemaining ?? 3} free summaries every month for $15.99/mo
                  </p>
                  <button type="button" onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'subscription' })) }}
                    style={{ background: '#667eea', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    View Membership Options
                  </button>
                </div>
              )}

              <button type="button" onClick={handlePurchaseCredit}
                style={{ background: '#059669', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', width: '100%', marginBottom: '10px' }}>
                Buy 1 Credit — ${(pricePerCredit / 100).toFixed(2)}
              </button>
              <button type="button" onClick={() => setStep('form')}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px' }}>
                ← Back
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
