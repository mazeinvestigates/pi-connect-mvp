import React, { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { supabase } from '../supabaseClient'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

const PLATFORM_FEE_PERCENT = 15
const MILEAGE_RATE = 0.67 // IRS standard — updatable via admin

// ─── Breakdown calculator ────────────────────────────────────────────────────
export function calculateBreakdown({ laborDollars, expenses = {} }) {
  const laborCents = Math.round((parseFloat(laborDollars) || 0) * 100)
  const platformFeeCents = Math.floor(laborCents * (PLATFORM_FEE_PERCENT / 100))
  const piLaborPayoutCents = laborCents - platformFeeCents

  const expenseCents = {
    mileage: Math.round(((expenses.miles || 0) * MILEAGE_RATE) * 100),
    surveillance: Math.round(((expenses.surveillanceHours || 0) * (expenses.surveillanceRate || 0)) * 100),
    equipment: Math.round((parseFloat(expenses.equipment) || 0) * 100),
    travel: Math.round((parseFloat(expenses.travel) || 0) * 100),
    filingFees: Math.round((parseFloat(expenses.filingFees) || 0) * 100),
    misc: Math.round((parseFloat(expenses.misc) || 0) * 100),
  }
  const totalExpenseCents = Object.values(expenseCents).reduce((a, b) => a + b, 0)
  const totalCents = laborCents + totalExpenseCents
  const piTotalPayoutCents = piLaborPayoutCents + totalExpenseCents

  const fmt = (cents) => (cents / 100).toFixed(2)

  return {
    laborCents, platformFeeCents, piLaborPayoutCents,
    expenseCents, totalExpenseCents, totalCents, piTotalPayoutCents,
    laborDollars: fmt(laborCents),
    platformFeeDollars: fmt(platformFeeCents),
    piLaborPayoutDollars: fmt(piLaborPayoutCents),
    totalExpenseDollars: fmt(totalExpenseCents),
    totalDollars: fmt(totalCents),
    piTotalPayoutDollars: fmt(piTotalPayoutCents),
    expenseDollars: Object.fromEntries(
      Object.entries(expenseCents).map(([k, v]) => [k, fmt(v)])
    )
  }
}

// ─── Expense inputs ──────────────────────────────────────────────────────────
function ExpenseInputs({ expenses, onChange }) {
  return (
    <div className="expense-inputs">
      <div className="expense-row">
        <label>Mileage</label>
        <div className="expense-input-group">
          <input type="number" min="0" step="1"
            value={expenses.miles || ''}
            onChange={e => onChange('miles', e.target.value)}
            placeholder="0" />
          <span className="input-suffix">
            miles @ ${MILEAGE_RATE}/mi = <strong>${((expenses.miles || 0) * MILEAGE_RATE).toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <div className="expense-row">
        <label>Surveillance</label>
        <div className="expense-input-group">
          <input type="number" min="0" step="0.5"
            value={expenses.surveillanceHours || ''}
            onChange={e => onChange('surveillanceHours', e.target.value)}
            placeholder="hrs" style={{ width: '70px' }} />
          <span className="input-suffix">hrs @</span>
          <span className="input-prefix">$</span>
          <input type="number" min="0" step="0.01"
            value={expenses.surveillanceRate || ''}
            onChange={e => onChange('surveillanceRate', e.target.value)}
            placeholder="rate" style={{ width: '70px' }} />
          <span className="input-suffix">
            = <strong>${(((expenses.surveillanceHours || 0) * (expenses.surveillanceRate || 0))).toFixed(2)}</strong>
          </span>
        </div>
      </div>

      {[
        ['Equipment Rental', 'equipment'],
        ['Travel (flights, hotels)', 'travel'],
        ['Filing / Database Fees', 'filingFees'],
        ['Miscellaneous', 'misc'],
      ].map(([label, key]) => (
        <div className="expense-row" key={key}>
          <label>{label}</label>
          <div className="expense-input-group">
            <span className="input-prefix">$</span>
            <input type="number" min="0" step="0.01"
              value={expenses[key] || ''}
              onChange={e => onChange(key, e.target.value)}
              placeholder="0.00" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Invoice preview ─────────────────────────────────────────────────────────
export function InvoicePreview({ breakdown, invoiceStyle, showPlatformFee, jobTitle }) {
  if (!breakdown.laborCents && !breakdown.totalExpenseCents) return null

  return (
    <div className="invoice-preview">
      <div className="invoice-header-row">
        <h3>Invoice Preview</h3>
        <span className="invoice-style-badge">
          {invoiceStyle === 'itemized' ? '📋 Itemized' : '📄 Lump Sum'}
        </span>
      </div>

      <div className="fee-breakdown">
        {invoiceStyle === 'itemized' ? (
          <>
            <div className="fee-row">
              <span>Labor</span>
              <strong>${breakdown.laborDollars}</strong>
            </div>

            {breakdown.totalExpenseCents > 0 && (
              <>
                {breakdown.expenseCents.mileage > 0 && (
                  <div className="fee-row expense-line">
                    <span>↳ Mileage</span>
                    <span>${breakdown.expenseDollars.mileage}</span>
                  </div>
                )}
                {breakdown.expenseCents.surveillance > 0 && (
                  <div className="fee-row expense-line">
                    <span>↳ Surveillance</span>
                    <span>${breakdown.expenseDollars.surveillance}</span>
                  </div>
                )}
                {breakdown.expenseCents.equipment > 0 && (
                  <div className="fee-row expense-line">
                    <span>↳ Equipment</span>
                    <span>${breakdown.expenseDollars.equipment}</span>
                  </div>
                )}
                {breakdown.expenseCents.travel > 0 && (
                  <div className="fee-row expense-line">
                    <span>↳ Travel</span>
                    <span>${breakdown.expenseDollars.travel}</span>
                  </div>
                )}
                {breakdown.expenseCents.filingFees > 0 && (
                  <div className="fee-row expense-line">
                    <span>↳ Filing / Database Fees</span>
                    <span>${breakdown.expenseDollars.filingFees}</span>
                  </div>
                )}
                {breakdown.expenseCents.misc > 0 && (
                  <div className="fee-row expense-line">
                    <span>↳ Miscellaneous</span>
                    <span>${breakdown.expenseDollars.misc}</span>
                  </div>
                )}
                <div className="fee-row">
                  <span>Total Expenses</span>
                  <span>${breakdown.totalExpenseDollars}</span>
                </div>
              </>
            )}

            {showPlatformFee && (
              <div className="fee-row platform-fee">
                <span>Platform Fee ({PLATFORM_FEE_PERCENT}% of labor)</span>
                <span>−${breakdown.platformFeeDollars}</span>
              </div>
            )}
          </>
        ) : (
          <div className="fee-row">
            <span>Investigation Services — {jobTitle}</span>
            <strong>${breakdown.totalDollars}</strong>
          </div>
        )}

        <div className="fee-row total">
          <span>Total Charged to Client</span>
          <strong>${breakdown.totalDollars}</strong>
        </div>
        <div className="fee-row payout">
          <span>Your Take-Home</span>
          <strong className="payout-amount">${breakdown.piTotalPayoutDollars}</strong>
        </div>
      </div>
    </div>
  )
}

// ─── Stripe card form (inner component needs Elements context) ───────────────
function StripeCardForm({ breakdown, job, application, user, invoiceStyle, showPlatformFee, expenses, onSuccess, onError, onBack }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [cardError, setCardError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    setCardError(null)

    try {
      const cardElement = elements.getElement(CardElement)

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { email: user.email }
      })

      if (pmError) {
        setCardError(pmError.message)
        setProcessing(false)
        return
      }

      // MVP: create PaymentIntent via Stripe test API
      // Production: replace with call to your backend which uses the secret key
      const piResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}`
        },
        body: new URLSearchParams({
          amount: breakdown.totalCents,
          currency: 'usd',
          'payment_method_types[]': 'card'
        })
      })

      const piData = await piResponse.json()
      if (piData.error) throw new Error(piData.error.message)

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        piData.client_secret,
        { payment_method: paymentMethod.id }
      )

      if (confirmError) {
        setCardError(confirmError.message)
        setProcessing(false)
        return
      }

      if (paymentIntent.status === 'succeeded') {
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            client_id: user.id,
            pi_id: application.pi_id,
            job_id: job.id,
            application_id: application.id,
            amount_cents: breakdown.totalCents,
            platform_fee_cents: breakdown.platformFeeCents,
            pi_payout_cents: breakdown.piTotalPayoutCents,
            currency: 'USD',
            status: 'succeeded',
            payment_method: 'card',
            stripe_payment_intent_id: paymentIntent.id,
            description: `Payment for job: ${job.title}`,
            paid_at: new Date().toISOString()
          })
          .select()
          .single()

        if (txError) throw txError

        await supabase
          .from('job_applications')
          .update({ payment_status: 'paid', agreed_amount_cents: breakdown.totalCents })
          .eq('id', application.id)

        onSuccess(transaction)
      }
    } catch (err) {
      console.error('Payment error:', err)
      onError(err.message || 'Payment failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Card Details</label>
        <div className="stripe-card-element">
          <CardElement options={{
            style: {
              base: { fontSize: '16px', color: '#1a1a2e', '::placeholder': { color: '#aab7c4' } },
              invalid: { color: '#dc2626' }
            }
          }} />
        </div>
        {cardError && <div className="field-error">{cardError}</div>}
      </div>

      <div className="secure-badge">
        🔒 Secured by Stripe — PI Connect never stores your card details
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          type="submit"
          className="btn-primary btn-large"
          disabled={processing || !stripe || !breakdown.totalCents}
        >
          {processing ? 'Processing...' : `Pay $${breakdown.totalDollars}`}
        </button>
      </div>
    </form>
  )
}

// ─── Main modal ──────────────────────────────────────────────────────────────
export default function PaymentModal({ job, application, user, onClose, onSuccess }) {
  const [step, setStep] = useState('setup')
  const [laborAmount, setLaborAmount] = useState(
    application?.proposed_rate ? String(application.proposed_rate) : ''
  )
  const [showExpenses, setShowExpenses] = useState(false)
  const [expenses, setExpenses] = useState({
    miles: '', surveillanceHours: '', surveillanceRate: '',
    equipment: '', travel: '', filingFees: '', misc: ''
  })
  const [invoiceStyle, setInvoiceStyle] = useState('itemized')
  const [showPlatformFee, setShowPlatformFee] = useState(false)
  const [error, setError] = useState(null)

  const updateExpense = (key, val) => setExpenses(prev => ({ ...prev, [key]: val }))

  const breakdown = calculateBreakdown({
    laborDollars: laborAmount,
    expenses: showExpenses ? expenses : {}
  })

  const handleSetupContinue = (e) => {
    e.preventDefault()
    if (!laborAmount || parseFloat(laborAmount) <= 0) {
      setError('Please enter a labor amount')
      return
    }
    setError(null)
    setStep('pay')
  }

  const handlePaymentSuccess = (transaction) => {
    setStep('success')
    setTimeout(() => onSuccess(transaction), 3000)
  }

  // Success
  if (step === 'success') {
    return (
      <div className="modal-overlay">
        <div className="modal payment-modal" onClick={e => e.stopPropagation()}>
          <div className="payment-success">
            <div className="success-icon">✓</div>
            <h2>Payment Successful!</h2>
            <p>Your payment has been processed and recorded.</p>
            <div className="payment-details">
              <div>Labor: <strong>${breakdown.laborDollars}</strong></div>
              {breakdown.totalExpenseCents > 0 && (
                <div>Expenses: <strong>${breakdown.totalExpenseDollars}</strong></div>
              )}
              <div>Total Charged: <strong>${breakdown.totalDollars}</strong></div>
              <div>PI Receives: <strong>${breakdown.piTotalPayoutDollars}</strong></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Card entry
  if (step === 'pay') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal payment-modal" onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>×</button>
          <div className="modal-header">
            <h2>💳 Complete Payment</h2>
            <p>{job.title}</p>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <InvoicePreview
              breakdown={breakdown}
              invoiceStyle={invoiceStyle}
              showPlatformFee={showPlatformFee}
              jobTitle={job.title}
            />
            <Elements stripe={stripePromise}>
              <StripeCardForm
                breakdown={breakdown}
                job={job}
                application={application}
                user={user}
                invoiceStyle={invoiceStyle}
                showPlatformFee={showPlatformFee}
                expenses={expenses}
                onSuccess={handlePaymentSuccess}
                onError={setError}
                onBack={() => setStep('setup')}
              />
            </Elements>
          </div>
        </div>
      </div>
    )
  }

  // Setup
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal payment-modal payment-modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="modal-header">
          <h2>💳 Pay for Job</h2>
          <p>{job.title} — {application.pi_name}</p>
        </div>

        <form onSubmit={handleSetupContinue} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>Labor Amount ($) *</label>
            <div className="input-with-prefix">
              <span className="input-prefix">$</span>
              <input
                type="number"
                value={laborAmount}
                onChange={e => setLaborAmount(e.target.value)}
                min="1" step="0.01"
                placeholder="0.00"
                required autoFocus
              />
            </div>
            <small>Platform fee of {PLATFORM_FEE_PERCENT}% applies to labor only</small>
          </div>

          <div className="expense-toggle-row">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showExpenses}
                onChange={e => setShowExpenses(e.target.checked)}
              />
              <span>Add Expenses <em>(passed through at cost — no platform fee)</em></span>
            </label>
          </div>

          {showExpenses && (
            <ExpenseInputs expenses={expenses} onChange={updateExpense} />
          )}

          <div className="form-group" style={{ marginTop: '20px' }}>
            <label>Invoice Style</label>
            <div className="radio-group">
              <label className="radio-option">
                <input type="radio" value="itemized"
                  checked={invoiceStyle === 'itemized'}
                  onChange={() => setInvoiceStyle('itemized')} />
                <span>Itemized — client sees labor and expense breakdown</span>
              </label>
              <label className="radio-option">
                <input type="radio" value="lumpsum"
                  checked={invoiceStyle === 'lumpsum'}
                  onChange={() => setInvoiceStyle('lumpsum')} />
                <span>Lump Sum — client sees a single total only</span>
              </label>
            </div>
          </div>

          {invoiceStyle === 'itemized' && (
            <div className="expense-toggle-row">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showPlatformFee}
                  onChange={e => setShowPlatformFee(e.target.checked)}
                />
                <span>Show platform fee as line item on client invoice</span>
              </label>
            </div>
          )}

          <InvoicePreview
            breakdown={breakdown}
            invoiceStyle={invoiceStyle}
            showPlatformFee={showPlatformFee}
            jobTitle={job.title}
          />

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn-primary btn-large"
              disabled={!laborAmount || parseFloat(laborAmount) <= 0}
            >
              Continue to Payment →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
