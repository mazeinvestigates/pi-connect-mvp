import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

// Platform contract template
function generateContractHTML({ piName, clientName, jobTitle, jobLocation, rate, escrowAmount, invoiceAmount, paymentMode, today }) {
  return `
    <div style="font-family: Georgia, serif; max-width: 700px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.7;">
      <h1 style="text-align: center; font-size: 22px; margin-bottom: 4px;">PRIVATE INVESTIGATION ENGAGEMENT AGREEMENT</h1>
      <p style="text-align: center; color: #666; margin-bottom: 40px;">Generated via PI Connect</p>

      <p>This Private Investigation Engagement Agreement ("Agreement") is entered into as of <strong>${today}</strong> between:</p>

      <p><strong>Investigator:</strong> ${piName} ("PI")<br>
      <strong>Client:</strong> ${clientName} ("Client")</p>

      <h2 style="font-size: 16px; margin-top: 32px;">1. SCOPE OF ENGAGEMENT</h2>
      <p>The PI agrees to perform investigative services for the following matter:</p>
      <p><strong>Matter:</strong> ${jobTitle}<br>
      <strong>Location:</strong> ${jobLocation || 'As specified in job posting'}</p>

      <h2 style="font-size: 16px; margin-top: 32px;">2. COMPENSATION</h2>
      <p>${
        paymentMode === 'escrow' && escrowAmount
          ? `Client agrees to pay a total of <strong>$${escrowAmount}</strong> for this engagement, to be deposited into escrow prior to commencement of work. Funds will be released to the PI upon satisfactory completion of the engagement. A 10% platform fee applies to the labor portion of the total.`
          : invoiceAmount
          ? `Client agrees to compensate PI in the amount of <strong>$${invoiceAmount}</strong>, payable upon receipt of invoice following completion of the engagement. A 10% platform fee applies to the labor portion.`
          : rate
          ? `Client agrees to compensate PI at the rate of <strong>$${rate}/hour</strong>, plus documented expenses. A 10% platform fee applies to labor charges.`
          : `Client agrees to compensate PI at the agreed rate as specified in the job application. All payments are processed through the PI Connect platform. A 10% platform fee applies to labor charges.`
      } All payments are processed through the PI Connect platform and are subject to the PI Connect Terms of Service.</p>

      <h2 style="font-size: 16px; margin-top: 32px;">3. CONFIDENTIALITY</h2>
      <p>PI agrees to keep all information obtained during the investigation strictly confidential and to use it solely for the purposes of this engagement. PI shall not disclose any information to third parties without prior written consent of Client, except as required by law.</p>

      <h2 style="font-size: 16px; margin-top: 32px;">4. LEGAL COMPLIANCE</h2>
      <p>PI represents and warrants that all investigative activities will be conducted in full compliance with applicable federal, state, and local laws, including applicable private investigator licensing requirements. Client agrees not to use information obtained through this engagement for any unlawful purpose.</p>

      <h2 style="font-size: 16px; margin-top: 32px;">5. LIMITATION OF LIABILITY</h2>
      <p>PI Connect is a technology platform that facilitates connections between clients and independent private investigators. <strong>PI Connect is not a party to this Agreement and assumes no liability for the actions, omissions, or work product of any PI or client using the platform.</strong> PI Connect does not employ the PI and is not responsible for the conduct of any investigation. Any disputes arising from this engagement are solely between the PI and Client.</p>
      <p>The PI's liability to Client shall be limited to the fees paid for the specific engagement giving rise to the claim. Neither party shall be liable for indirect, incidental, or consequential damages.</p>

      <h2 style="font-size: 16px; margin-top: 32px;">6. CANCELLATION</h2>
      <p>Either party may cancel this Agreement before work commences, with written notice provided through the PI Connect platform. Once work has commenced, cancellation requires mutual agreement. In the event of cancellation after work has commenced, Client shall compensate PI for work performed to date at the agreed rate.</p>

      <h2 style="font-size: 16px; margin-top: 32px;">7. ENTIRE AGREEMENT</h2>
      <p>This Agreement, together with the PI Connect Terms of Service, constitutes the entire agreement between the parties with respect to this engagement and supersedes all prior negotiations and understandings.</p>

      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #ccc;">
        <p><strong>Electronic Acceptance:</strong> By clicking "Accept & Sign" in the PI Connect platform, Client acknowledges that they have read and agree to the terms of this Agreement. This electronic acceptance constitutes a legally binding signature.</p>
        <p style="color: #666; font-size: 13px; margin-top: 16px;">Generated by PI Connect — piconnect.co</p>
      </div>
    </div>
  `
}

export default function SendContractModal({ app, job, user, piProfile, onClose, onSuccess }) {
  const [mode, setMode] = useState(null) // 'upload' | 'platform'
  const [contractFile, setContractFile] = useState(null)
  const [contractFileName, setContractFileName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [previewMode, setPreviewMode] = useState(false)

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const contractHTML = generateContractHTML({
    piName: `${piProfile?.first_name || ''} ${piProfile?.last_name || ''}`.trim() || 'PI',
    clientName: job?.profiles?.full_name || 'Client',
    jobTitle: job?.title || '',
    jobLocation: job?.location || '',
    rate: app?.proposed_rate || null,
    escrowAmount: app?.escrow_amount_cents ? (app.escrow_amount_cents / 100).toFixed(2) : null,
    invoiceAmount: app?.invoice_amount_cents ? (app.invoice_amount_cents / 100).toFixed(2) : null,
    paymentMode: app?.payment_mode || null,
    today
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const updates = {
        contract_status: 'pending_signature',
        contract_type: mode,
        contract_sent_at: new Date().toISOString()
      }

      if (mode === 'upload') {
        if (!contractFile) { setError('Please upload a contract file.'); setSubmitting(false); return }
        const ext = contractFile.name.split('.').pop()
        const path = `contracts/${app.id}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('contracts')
          .upload(path, contractFile, { upsert: true })
        if (uploadError) throw uploadError
        updates.contract_file_path = path
      }

      const { error } = await supabase
        .from('job_applications')
        .update(updates)
        .eq('id', app.id)

      if (error) throw error
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (previewMode) {
    return (
      <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPreviewMode(false) }}>
        <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: '760px', maxHeight: '80vh', overflow: 'auto' }}>
          <button className="modal-close" onClick={() => setPreviewMode(false)}>×</button>
          <div dangerouslySetInnerHTML={{ __html: contractHTML }} />
          <div className="modal-actions" style={{ padding: '16px 40px', borderTop: '1px solid #e5e7eb' }}>
            <button className="btn-secondary" onClick={() => setPreviewMode(false)}>← Back</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Sending...' : 'Send This Contract to Client'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Send Contract to Client</h2>
          <p>{job?.title}</p>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {!mode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                Choose a contract option to send to the client for signature.
              </p>
              <button
                onClick={() => setMode('upload')}
                style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px', textAlign: 'left', cursor: 'pointer' }}
              >
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>📎 Upload My Own Contract</p>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Upload your own engagement letter or contract PDF. Client will review and accept in the platform.</p>
              </button>
              <button
                onClick={() => setMode('platform')}
                style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px', textAlign: 'left', cursor: 'pointer' }}
              >
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>📄 Use Platform Contract Template</p>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Use PI Connect's standard engagement agreement, pre-filled with job details.</p>
              </button>
            </div>
          )}

          {mode === 'upload' && (
            <form onSubmit={handleSubmit}>
              <button type="button" onClick={() => { setMode(null); setError(null) }}
                style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>
                ← Choose differently
              </button>

              <div className="form-group">
                <label>Contract File *</label>
                <div className="file-upload-area">
                  <input type="file" id="contract-upload" accept=".pdf,.doc,.docx"
                    onChange={e => { const f = e.target.files[0]; if(f){ setContractFile(f); setContractFileName(f.name) }}}
                    style={{ display: 'none' }} />
                  {contractFileName ? (
                    <div className="file-upload-success">
                      <span className="file-icon">📄</span>
                      <span className="file-name">{contractFileName}</span>
                      <label htmlFor="contract-upload" className="file-change-btn">Change</label>
                    </div>
                  ) : (
                    <label htmlFor="contract-upload" className="file-upload-label">
                      <span className="file-upload-icon">📎</span>
                      <span>Upload Contract</span>
                      <small>PDF, DOC, or DOCX</small>
                    </label>
                  )}
                </div>
              </div>

              <div className="info-box" style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', margin: 0 }}>
                  The client will be able to download and review your contract. They will click "Accept & Sign" in the platform to provide a timestamped electronic acceptance. If they decline, the job will return to open status.
                </p>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting || !contractFile}>
                  {submitting ? 'Sending...' : 'Send Contract to Client'}
                </button>
              </div>
            </form>
          )}

          {mode === 'platform' && (
            <div>
              <button type="button" onClick={() => { setMode(null); setError(null) }}
                style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>
                ← Choose differently
              </button>

              <div className="info-box" style={{ marginBottom: '16px' }}>
                <p style={{ fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Contract Preview</p>
                <p style={{ fontSize: '13px', color: '#374151' }}>
                  The platform will generate a standard engagement agreement pre-filled with:<br/>
                  • Your name and the client's name<br/>
                  • Job title and location<br/>
                  • Agreed rate from your application<br/>
                  • Confidentiality and legal compliance terms<br/>
                </p>
              </div>

              <button className="btn-secondary" style={{ marginBottom: '16px', width: '100%' }}
                onClick={() => setPreviewMode(true)}>
                👁 Preview Contract
              </button>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Contract to Client'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
