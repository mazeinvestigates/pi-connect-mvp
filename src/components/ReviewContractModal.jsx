import React, { useState } from 'react'
import { generateContractHTML } from './SendContractModal'
import { supabase } from '../supabaseClient'

export default function ReviewContractModal({ app, job, user, onClose, onSuccess, onDecline }) {
  const [step, setStep] = useState('review') // 'review' | 'decline'
  const [declineReason, setDeclineReason] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [contractUrl, setContractUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  const loadContractUrl = async () => {
    if (!app.contract_file_path || contractUrl) return
    setLoadingUrl(true)
    const { data } = await supabase.storage
      .from('contracts')
      .createSignedUrl(app.contract_file_path, 3600)
    setContractUrl(data?.signedUrl || null)
    setLoadingUrl(false)
  }

  // Load URL on mount if uploaded contract
  React.useEffect(() => {
    if (app?.contract_type === 'uploaded') loadContractUrl()
  }, [])

  const handleAccept = async () => {
    if (!agreed) { setError('Please check the box to confirm you have read and agree to the contract.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const signedAt = new Date().toISOString()
      const { error } = await supabase
        .from('job_applications')
        .update({
          contract_status: 'signed',
          contract_signed_at: signedAt
        })
        .eq('id', app.id)
      if (error) throw error

      // Get PI email to send confirmation
      const { data: piProfile } = await supabase
        .from('pi_profiles')
        .select('first_name, last_name, email, user_id')
        .eq('user_id', app.applicant_id)
        .single()

      if (piProfile?.email) {
        fetch('https://kpgcnqvlfbxhhtyhfxop.supabase.co/functions/v1/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: piProfile.email,
            type: 'contract_signed',
            data: {
              recipientName: piProfile.first_name,
              clientName: job?.profiles?.full_name || user?.email,
              clientEmail: user?.email,
              jobTitle: job?.title,
              signedAt: new Date(signedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
              contractType: app.contract_type
            }
          })
        }).catch(() => {})
      }

      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = async () => {
    if (!declineReason.trim()) { setError('Please provide a reason for declining.'); return }
    setSubmitting(true)
    setError(null)
    try {
      // Decline contract and reopen job
      await supabase.from('job_applications').update({
        contract_status: 'declined',
        contract_declined_at: new Date().toISOString(),
        contract_decline_reason: declineReason,
        status: 'cancelled'
      }).eq('id', app.id)

      await supabase.from('jobs').update({ status: 'open' }).eq('id', job.id)

      // Notify PI of decline
      const { data: piProfile } = await supabase
        .from('pi_profiles')
        .select('first_name, email')
        .eq('user_id', app.applicant_id)
        .single()

      if (piProfile?.email) {
        fetch('https://kpgcnqvlfbxhhtyhfxop.supabase.co/functions/v1/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: piProfile.email,
            type: 'contract_declined',
            data: {
              recipientName: piProfile.first_name,
              clientName: job?.profiles?.full_name || user?.email,
              jobTitle: job?.title,
              reason: declineReason
            }
          })
        }).catch(() => {})
      }

      onDecline()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'decline') {
    return (
      <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
          <button className="modal-close" onClick={onClose}>×</button>
          <div className="modal-header">
            <h2>Decline Contract</h2>
            <p>{job?.title}</p>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="info-box" style={{ background: '#fef2f2', border: '1px solid #fecaca', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: '#991b1b' }}>
                ⚠️ Declining the contract will cancel this job and return it to open status. The PI will be notified.
              </p>
            </div>
            <div className="form-group">
              <label>Reason for Declining *</label>
              <textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                rows={4}
                placeholder="Please explain why you are declining the contract terms..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setStep('review')}>← Back</button>
              <button className="btn-primary" style={{ background: '#dc2626' }}
                onClick={handleDecline} disabled={submitting}>
                {submitting ? 'Declining...' : 'Decline & Cancel Job'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Review & Sign Contract</h2>
          <p>{job?.title}</p>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="info-box" style={{ marginBottom: '20px' }}>
            <p style={{ fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>
              {app.contract_type === 'uploaded' ? '📎 PI has uploaded a contract for your review' : '📄 PI is using the PI Connect standard engagement agreement'}
            </p>
            <p style={{ fontSize: '13px', color: '#374151' }}>
              Please review the contract carefully before accepting. If you cannot agree to the terms, you may decline — the job will be cancelled and returned to open status.
            </p>
          </div>

          {app.contract_type === 'uploaded' && (
            <div style={{ marginBottom: '20px' }}>
              {loadingUrl ? (
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading contract...</p>
              ) : contractUrl ? (
                <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary"
                  style={{ display: 'inline-block', marginBottom: '8px' }}>
                  📄 Download & Review Contract
                </a>
              ) : (
                <p style={{ fontSize: '13px', color: '#dc2626' }}>Could not load contract file. Please contact the PI.</p>
              )}
              <p style={{ fontSize: '12px', color: '#6b7280' }}>
                Download and read the contract before accepting below.
              </p>
            </div>
          )}

          {app.contract_type === 'platform' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: '8px',
                padding: '20px', maxHeight: '300px', overflowY: 'auto',
                background: '#fafafa', fontSize: '13px'
              }}
                dangerouslySetInnerHTML={{ __html: generateContractHTML({
                  piName: 'PI',
                  clientName: job?.profiles?.full_name || 'Client',
                  jobTitle: job?.title || '',
                  jobLocation: job?.location || '',
                  rate: app?.proposed_rate || null,
                  escrowAmount: app?.escrow_amount_cents ? (app.escrow_amount_cents / 100).toFixed(2) : null,
                  invoiceAmount: app?.invoice_amount_cents ? (app.invoice_amount_cents / 100).toFixed(2) : null,
                  paymentMode: app?.payment_mode || null,
                  today: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                })}}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                Scroll to read the full contract before accepting.
              </p>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '20px' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0, cursor: 'pointer', accentColor: '#667eea' }}
            />
            <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
              I confirm that I have read and understand the contract terms and agree to be bound by them. I understand this electronic acceptance constitutes a legally binding signature recorded with a timestamp.
            </span>
          </label>

          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
            Your acceptance will be recorded as: {user?.email} · {new Date().toLocaleString()} — A confirmation will be emailed to the PI.
          </div>

          <div className="modal-actions">
            <button className="btn-danger-small" style={{ padding: '10px 16px' }}
              onClick={() => setStep('decline')}>
              Decline Contract
            </button>
            <button className="btn-primary" onClick={handleAccept}
              disabled={submitting || !agreed}>
              {submitting ? 'Signing...' : '✓ Accept & Sign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
