import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function SendInvoiceModal({ app, job, user, onClose, onSuccess }) {
  const [mode, setMode] = useState(null) // 'upload' | 'manual'
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [invoiceFileName, setInvoiceFileName] = useState('')
  const [laborAmount, setLaborAmount] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const PLATFORM_FEE = 0.10
  const labor = parseFloat(laborAmount) || 0
  const expenses = parseFloat(expenseAmount) || 0
  const platformFee = labor * PLATFORM_FEE
  const piReceives = labor - platformFee + expenses
  const clientPays = labor + expenses

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!laborAmount && mode === 'manual') { setError('Please enter a labor amount.'); return }
    setSubmitting(true)
    setError(null)

    try {
      const updates = {
        invoice_sent_at: new Date().toISOString(),
        invoice_notes: notes || null
      }

      if (mode === 'upload' && invoiceFile) {
        const ext = invoiceFile.name.split('.').pop()
        const path = `invoices/${app.id}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(path, invoiceFile, { upsert: true })
        if (uploadError) throw uploadError
        updates.invoice_file_path = path
      }

      if (mode === 'manual') {
        updates.invoice_amount_cents = Math.round(clientPays * 100)
      }

      if (mode === 'upload' && !laborAmount) {
        // Uploaded invoice — prompt for total amount
        if (!invoiceFile) { setError('Please upload an invoice file.'); setSubmitting(false); return }
      } else {
        updates.invoice_amount_cents = Math.round(clientPays * 100)
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
      <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Send Invoice to Client</h2>
          <p>{job?.title}</p>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {!mode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                How would you like to invoice the client?
              </p>
              <button
                className="invoice-mode-btn"
                onClick={() => setMode('upload')}
                style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s' }}
              >
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>📎 Upload My Own Invoice</p>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Upload a PDF or image of your invoice. You can still enter the total amount for platform processing.</p>
              </button>
              <button
                className="invoice-mode-btn"
                onClick={() => setMode('manual')}
                style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '16px', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s' }}
              >
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>🧮 Use Platform Invoice Calculator</p>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>Enter labor and expense amounts. The platform calculates fees and sends a breakdown to the client.</p>
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

              {mode === 'upload' && (
                <div className="form-group">
                  <label>Invoice File *</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="invoice-file-upload"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => { const f = e.target.files[0]; if(f){ setInvoiceFile(f); setInvoiceFileName(f.name) }}}
                      style={{ display: 'none' }}
                    />
                    {invoiceFileName ? (
                      <div className="file-upload-success">
                        <span className="file-icon">📄</span>
                        <span className="file-name">{invoiceFileName}</span>
                        <label htmlFor="invoice-file-upload" className="file-change-btn">Change</label>
                      </div>
                    ) : (
                      <label htmlFor="invoice-file-upload" className="file-upload-label">
                        <span className="file-upload-icon">📎</span>
                        <span>Upload Invoice</span>
                        <small>PDF, JPG, or PNG</small>
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Labor Amount ($) *</label>
                  <input type="number" min="0" step="0.01" value={laborAmount}
                    onChange={e => setLaborAmount(e.target.value)}
                    placeholder="e.g., 750.00" required={mode === 'manual'} />
                  <small>Platform fee of 10% applies to labor</small>
                </div>
                <div className="form-group">
                  <label>Expenses ($)</label>
                  <input type="number" min="0" step="0.01" value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="0.00" />
                  <small>Passed through at cost — no fee</small>
                </div>
              </div>

              {(labor > 0 || expenses > 0) && (
                <div className="info-box" style={{ marginBottom: '16px' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Invoice Summary</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Labor</span><span>${labor.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                      <span>Platform fee (10%)</span><span>-${platformFee.toFixed(2)}</span>
                    </div>
                    {expenses > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Expenses</span><span>${expenses.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '6px', fontWeight: '600' }}>
                      <span>Client pays</span><span>${clientPays.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: '600' }}>
                      <span>You receive</span><span>${piReceives.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Notes to Client (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional context about the charges, case summary, or instructions..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Sending...' : '📨 Send Invoice to Client'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
