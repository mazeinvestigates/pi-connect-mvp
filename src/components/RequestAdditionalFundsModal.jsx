import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function RequestAdditionalFundsModal({ app, job, user, onClose, onSuccess }) {
  const [mode, setMode] = useState(null) // 'amount' | 'invoice'
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [invoiceFileName, setInvoiceFileName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) { setError('Please enter a valid amount.'); return }
    if (!reason) { setError('Please provide a reason for the additional funds request.'); return }
    setSubmitting(true)
    setError(null)

    try {
      const updates = {
        additional_escrow_requested_cents: Math.round(parseFloat(amount) * 100),
        additional_escrow_reason: reason,
        additional_escrow_status: 'pending',
        additional_escrow_requested_at: new Date().toISOString()
      }

      if (mode === 'invoice' && invoiceFile) {
        const ext = invoiceFile.name.split('.').pop()
        const path = `invoices/${app.id}-supplemental-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(path, invoiceFile, { upsert: true })
        if (uploadError) throw uploadError
        updates.additional_escrow_invoice_path = path
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

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Request Additional Funds</h2>
          <p>{job?.title}</p>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {!mode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                How would you like to request additional escrow funds?
              </p>
              <button
                onClick={() => setMode('amount')}
                style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px', textAlign: 'left', cursor: 'pointer' }}
              >
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>💬 Request with Explanation</p>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Enter the amount needed and explain why additional funds are required.</p>
              </button>
              <button
                onClick={() => setMode('invoice')}
                style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px', textAlign: 'left', cursor: 'pointer' }}
              >
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>📎 Upload Supplemental Invoice</p>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Upload a supplemental invoice with the additional amount itemized.</p>
              </button>
            </div>
          )}

          {mode && (
            <form onSubmit={handleSubmit}>
              <button
                type="button"
                onClick={() => { setMode(null); setError(null) }}
                style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}
              >
                ← Choose differently
              </button>

              {mode === 'invoice' && (
                <div className="form-group">
                  <label>Supplemental Invoice File</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="supp-invoice-upload"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => { const f = e.target.files[0]; if(f){ setInvoiceFile(f); setInvoiceFileName(f.name) }}}
                      style={{ display: 'none' }}
                    />
                    {invoiceFileName ? (
                      <div className="file-upload-success">
                        <span className="file-icon">📄</span>
                        <span className="file-name">{invoiceFileName}</span>
                        <label htmlFor="supp-invoice-upload" className="file-change-btn">Change</label>
                      </div>
                    ) : (
                      <label htmlFor="supp-invoice-upload" className="file-upload-label">
                        <span className="file-upload-icon">📎</span>
                        <span>Upload Supplemental Invoice</span>
                        <small>PDF, JPG, or PNG</small>
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Additional Amount Requested ($) *</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g., 250.00"
                  required
                />
                <small>This amount will be added to the existing escrow if approved</small>
              </div>

              <div className="form-group">
                <label>Reason for Additional Funds *</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={4}
                  required
                  placeholder="Explain why additional funds are needed — e.g., surveillance extended due to subject's irregular schedule, additional mileage incurred, unexpected filing fees, etc."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Request to Client'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
