import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PaymentModal({ job, application, user, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [paymentStep, setPaymentStep] = useState('amount') // 'amount' or 'processing' or 'success'

  const PLATFORM_FEE_PERCENT = 15

  const calculateFees = (amountDollars) => {
    const amountCents = Math.round(amountDollars * 100)
    const platformFeeCents = Math.floor(amountCents * (PLATFORM_FEE_PERCENT / 100))
    const piPayoutCents = amountCents - platformFeeCents
    
    return {
      amountCents,
      platformFeeCents,
      piPayoutCents,
      amountDollars: (amountCents / 100).toFixed(2),
      platformFeeDollars: (platformFeeCents / 100).toFixed(2),
      piPayoutDollars: (piPayoutCents / 100).toFixed(2)
    }
  }

  const fees = amount ? calculateFees(parseFloat(amount)) : null

  const handlePayment = async (e) => {
    e.preventDefault()
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setProcessing(true)
    setError(null)
    setPaymentStep('processing')

    try {
      const { amountCents, platformFeeCents, piPayoutCents } = calculateFees(parseFloat(amount))

      // In production, you'd call your backend API which would:
      // 1. Create Stripe Payment Intent
      // 2. Process payment
      // 3. Create transaction record
      
      // For demo purposes, we'll simulate a successful payment
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call

      // Create transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          client_id: user.id,
          pi_id: application.pi_id,
          job_id: job.id,
          application_id: application.id,
          amount_cents: amountCents,
          platform_fee_cents: platformFeeCents,
          pi_payout_cents: piPayoutCents,
          currency: 'USD',
          status: 'succeeded',
          payment_method: 'card',
          description: `Payment for job: ${job.title}`,
          paid_at: new Date().toISOString()
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      // Update application payment status
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({
          payment_status: 'paid',
          agreed_amount_cents: amountCents
        })
        .eq('id', application.id)

      if (updateError) throw updateError

      setPaymentStep('success')
      
      // Auto-close and refresh after 2 seconds
      setTimeout(() => {
        onSuccess()
      }, 2000)

    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
      setPaymentStep('amount')
    } finally {
      setProcessing(false)
    }
  }

  if (paymentStep === 'processing') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal payment-modal" onClick={(e) => e.stopPropagation()}>
          <div className="payment-processing">
            <div className="spinner-large"></div>
            <h2>Processing Payment...</h2>
            <p>Please wait while we process your payment securely.</p>
            <small>Do not close this window</small>
          </div>
        </div>
      </div>
    )
  }

  if (paymentStep === 'success') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal payment-modal" onClick={(e) => e.stopPropagation()}>
          <div className="payment-success">
            <div className="success-icon">✓</div>
            <h2>Payment Successful!</h2>
            <p>Your payment has been processed successfully.</p>
            <div className="payment-details">
              <div>Amount Paid: <strong>${fees.amountDollars}</strong></div>
              <div>Platform Fee: <strong>${fees.platformFeeDollars}</strong></div>
              <div>PI Receives: <strong>${fees.piPayoutDollars}</strong></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal payment-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>💳 Pay for Job</h2>
          <p>{job.title}</p>
        </div>

        <form onSubmit={handlePayment} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Job Summary */}
          <div className="payment-summary">
            <h3>Job Summary</h3>
            <div className="summary-row">
              <span>PI:</span>
              <strong>{application.pi_name}</strong>
            </div>
            <div className="summary-row">
              <span>Proposed Rate:</span>
              <strong>${application.proposed_rate || 'TBD'}</strong>
            </div>
            <div className="summary-row">
              <span>Timeline:</span>
              <strong>{application.estimated_timeline || 'TBD'}</strong>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="form-group">
            <label>Payment Amount ($) *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="0.01"
              placeholder="Enter amount in dollars"
              required
              autoFocus
            />
            <small>Enter the agreed amount for this job</small>
          </div>

          {/* Fee Breakdown */}
          {fees && (
            <div className="fee-breakdown">
              <h3>Payment Breakdown</h3>
              <div className="fee-row">
                <span>Job Amount:</span>
                <strong>${fees.amountDollars}</strong>
              </div>
              <div className="fee-row platform-fee">
                <span>Platform Fee ({PLATFORM_FEE_PERCENT}%):</span>
                <strong>-${fees.platformFeeDollars}</strong>
              </div>
              <div className="fee-row total">
                <span>PI Receives:</span>
                <strong>${fees.piPayoutDollars}</strong>
              </div>
            </div>
          )}

          <div className="info-box">
            <p><strong>🔒 Secure Payment</strong></p>
            <p>This is a demonstration of the payment flow. In production, this would integrate with Stripe for secure payment processing.</p>
            <ul>
              <li>Funds held in escrow</li>
              <li>Released when job is complete</li>
              <li>Platform fee: {PLATFORM_FEE_PERCENT}%</li>
              <li>Refund available if needed</li>
            </ul>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={processing}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary btn-large" 
              disabled={processing || !amount || parseFloat(amount) <= 0}
            >
              {processing ? 'Processing...' : `Pay $${fees?.amountDollars || '0.00'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
