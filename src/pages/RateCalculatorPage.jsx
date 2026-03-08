import React, { useState } from 'react'
import { calculateBreakdown, InvoicePreview } from '../components/PaymentModal'

const PLATFORM_FEE_PERCENT = 15
const MILEAGE_RATE = 0.67
const REFERRAL_MIN = 5
const REFERRAL_MAX = 30
const REFERRAL_DEFAULT = 10

// ─── Expense inputs (reused across modes) ────────────────────────────────────
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

// ─── Mode 1: Standard Job ─────────────────────────────────────────────────────
function StandardMode() {
  const [inputMode, setInputMode] = useState('takehome') // 'takehome' | 'charge'
  const [amount, setAmount] = useState('')
  const [showExpenses, setShowExpenses] = useState(false)
  const [expenses, setExpenses] = useState({
    miles: '', surveillanceHours: '', surveillanceRate: '',
    equipment: '', travel: '', filingFees: '', misc: ''
  })
  const [invoiceStyle, setInvoiceStyle] = useState('itemized')
  const [showPlatformFee, setShowPlatformFee] = useState(false)

  const updateExpense = (key, val) => setExpenses(prev => ({ ...prev, [key]: val }))

  // Calculate based on input mode
  let laborDollars = ''
  let derivedLabel = ''
  let derivedValue = ''

  if (amount && parseFloat(amount) > 0) {
    if (inputMode === 'takehome') {
      // Work backwards: takehome = labor * 0.85, so labor = takehome / 0.85
      const laborCents = Math.ceil((parseFloat(amount) * 100) / (1 - PLATFORM_FEE_PERCENT / 100))
      laborDollars = (laborCents / 100).toFixed(2)
      derivedLabel = 'Charge client (labor):'
      derivedValue = `$${laborDollars}`
    } else {
      laborDollars = amount
      const feeCents = Math.floor(parseFloat(amount) * 100 * (PLATFORM_FEE_PERCENT / 100))
      derivedLabel = 'Your labor take-home:'
      derivedValue = `$${((parseFloat(amount) * 100 - feeCents) / 100).toFixed(2)}`
    }
  }

  const breakdown = calculateBreakdown({
    laborDollars,
    expenses: showExpenses ? expenses : {}
  })

  return (
    <div className="calc-mode">
      <p className="calc-mode-description">
        Calculate what to charge a client for a standard job, accounting for the {PLATFORM_FEE_PERCENT}% platform fee and any pass-through expenses.
      </p>

      <div className="form-group">
        <label>Calculate from</label>
        <div className="radio-group horizontal">
          <label className="radio-option">
            <input type="radio" value="takehome"
              checked={inputMode === 'takehome'}
              onChange={() => setInputMode('takehome')} />
            <span>My desired take-home</span>
          </label>
          <label className="radio-option">
            <input type="radio" value="charge"
              checked={inputMode === 'charge'}
              onChange={() => setInputMode('charge')} />
            <span>What I'll charge the client</span>
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>
          {inputMode === 'takehome' ? 'Desired Take-Home (labor, $)' : 'Client Charge for Labor ($)'}
        </label>
        <div className="input-with-prefix">
          <span className="input-prefix">$</span>
          <input type="number" min="0" step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00" autoFocus />
        </div>
      </div>

      {derivedValue && (
        <div className="derived-result">
          <span>{derivedLabel}</span>
          <strong>{derivedValue}</strong>
        </div>
      )}

      <div className="expense-toggle-row">
        <label className="toggle-label">
          <input type="checkbox"
            checked={showExpenses}
            onChange={e => setShowExpenses(e.target.checked)} />
          <span>Add Expenses <em>(no platform fee applied)</em></span>
        </label>
      </div>

      {showExpenses && <ExpenseInputs expenses={expenses} onChange={updateExpense} />}

      <div className="form-group" style={{ marginTop: '20px' }}>
        <label>Invoice Style</label>
        <div className="radio-group">
          <label className="radio-option">
            <input type="radio" value="itemized"
              checked={invoiceStyle === 'itemized'}
              onChange={() => setInvoiceStyle('itemized')} />
            <span>Itemized</span>
          </label>
          <label className="radio-option">
            <input type="radio" value="lumpsum"
              checked={invoiceStyle === 'lumpsum'}
              onChange={() => setInvoiceStyle('lumpsum')} />
            <span>Lump Sum</span>
          </label>
        </div>
      </div>

      {invoiceStyle === 'itemized' && (
        <div className="expense-toggle-row">
          <label className="toggle-label">
            <input type="checkbox"
              checked={showPlatformFee}
              onChange={e => setShowPlatformFee(e.target.checked)} />
            <span>Show platform fee on client invoice</span>
          </label>
        </div>
      )}

      {laborDollars && (
        <InvoicePreview
          breakdown={breakdown}
          invoiceStyle={invoiceStyle}
          showPlatformFee={showPlatformFee}
          jobTitle="Investigation Services"
        />
      )}
    </div>
  )
}

// ─── Mode 2: Subcontract Job ──────────────────────────────────────────────────
function SubcontractMode() {
  const [clientCharge, setClientCharge] = useState('')
  const [subRate, setSubRate] = useState('')
  const [subRateType, setSubRateType] = useState('dollar') // 'dollar' | 'percent'
  const [showExpenses, setShowExpenses] = useState(false)
  const [expenses, setExpenses] = useState({
    miles: '', surveillanceHours: '', surveillanceRate: '',
    equipment: '', travel: '', filingFees: '', misc: ''
  })

  const updateExpense = (key, val) => setExpenses(prev => ({ ...prev, [key]: val }))

  const laborCents = Math.round((parseFloat(clientCharge) || 0) * 100)
  const platformFeeCents = Math.floor(laborCents * (PLATFORM_FEE_PERCENT / 100))
  const laborAfterFeeCents = laborCents - platformFeeCents

  let subCents = 0
  if (subRate && parseFloat(subRate) > 0) {
    subCents = subRateType === 'dollar'
      ? Math.round(parseFloat(subRate) * 100)
      : Math.floor(laborAfterFeeCents * (parseFloat(subRate) / 100))
  }

  const expenseBreakdown = calculateBreakdown({
    laborDollars: clientCharge,
    expenses: showExpenses ? expenses : {}
  })

  const myNetCents = laborAfterFeeCents - subCents + expenseBreakdown.totalExpenseCents
  const totalToClientCents = laborCents + expenseBreakdown.totalExpenseCents

  const fmt = (cents) => (cents / 100).toFixed(2)

  return (
    <div className="calc-mode">
      <p className="calc-mode-description">
        You're the primary PI retaining the client relationship. Calculate your net after the platform fee and your subcontractor's payment.
      </p>

      <div className="form-group">
        <label>What you charge the client for labor ($)</label>
        <div className="input-with-prefix">
          <span className="input-prefix">$</span>
          <input type="number" min="0" step="0.01"
            value={clientCharge}
            onChange={e => setClientCharge(e.target.value)}
            placeholder="0.00" autoFocus />
        </div>
      </div>

      <div className="form-group">
        <label>Subcontractor payment</label>
        <div className="radio-group horizontal" style={{ marginBottom: '8px' }}>
          <label className="radio-option">
            <input type="radio" value="dollar"
              checked={subRateType === 'dollar'}
              onChange={() => setSubRateType('dollar')} />
            <span>Fixed amount ($)</span>
          </label>
          <label className="radio-option">
            <input type="radio" value="percent"
              checked={subRateType === 'percent'}
              onChange={() => setSubRateType('percent')} />
            <span>Percentage of labor after fee (%)</span>
          </label>
        </div>
        <div className="input-with-prefix">
          <span className="input-prefix">{subRateType === 'dollar' ? '$' : '%'}</span>
          <input type="number" min="0" step={subRateType === 'dollar' ? '0.01' : '1'}
            value={subRate}
            onChange={e => setSubRate(e.target.value)}
            placeholder="0" />
        </div>
      </div>

      <div className="expense-toggle-row">
        <label className="toggle-label">
          <input type="checkbox"
            checked={showExpenses}
            onChange={e => setShowExpenses(e.target.checked)} />
          <span>Add Expenses <em>(no platform fee applied)</em></span>
        </label>
      </div>

      {showExpenses && <ExpenseInputs expenses={expenses} onChange={updateExpense} />}

      {clientCharge && parseFloat(clientCharge) > 0 && (
        <div className="invoice-preview">
          <div className="invoice-header-row">
            <h3>Subcontract Breakdown</h3>
          </div>
          <div className="fee-breakdown">
            <div className="fee-row">
              <span>Client pays (labor)</span>
              <strong>${fmt(laborCents)}</strong>
            </div>
            <div className="fee-row platform-fee">
              <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
              <span>−${fmt(platformFeeCents)}</span>
            </div>
            {subCents > 0 && (
              <div className="fee-row platform-fee">
                <span>Subcontractor payment</span>
                <span>−${fmt(subCents)}</span>
              </div>
            )}
            {expenseBreakdown.totalExpenseCents > 0 && (
              <div className="fee-row">
                <span>Expenses (pass-through)</span>
                <span>+${expenseBreakdown.totalExpenseDollars}</span>
              </div>
            )}
            <div className="fee-row total">
              <span>Total charged to client</span>
              <strong>${fmt(totalToClientCents)}</strong>
            </div>
            <div className="fee-row payout">
              <span>Your take-home</span>
              <strong className="payout-amount">${fmt(myNetCents)}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Mode 3: Referral ─────────────────────────────────────────────────────────
function ReferralMode() {
  const [jobLaborValue, setJobLaborValue] = useState('')
  const [referralPct, setReferralPct] = useState(REFERRAL_DEFAULT)

  const laborCents = Math.round((parseFloat(jobLaborValue) || 0) * 100)
  const platformFeeCents = Math.floor(laborCents * (PLATFORM_FEE_PERCENT / 100))
  const laborAfterFeeCents = laborCents - platformFeeCents
  const clampedPct = Math.min(Math.max(parseFloat(referralPct) || 0, REFERRAL_MIN), REFERRAL_MAX)
  const referralFeeCents = Math.floor(laborAfterFeeCents * (clampedPct / 100))

  const fmt = (cents) => (cents / 100).toFixed(2)

  return (
    <div className="calc-mode">
      <p className="calc-mode-description">
        You're handing a job off to another PI. Calculate your referral fee after the platform takes its cut. Default is {REFERRAL_DEFAULT}%, negotiable between {REFERRAL_MIN}%–{REFERRAL_MAX}%.
      </p>

      <div className="form-group">
        <label>Expected job labor value ($)</label>
        <div className="input-with-prefix">
          <span className="input-prefix">$</span>
          <input type="number" min="0" step="0.01"
            value={jobLaborValue}
            onChange={e => setJobLaborValue(e.target.value)}
            placeholder="0.00" autoFocus />
        </div>
        <small>Expenses are not included — referral fee is based on labor only</small>
      </div>

      <div className="form-group">
        <label>Referral fee percentage (%)</label>
        <div className="referral-slider-group">
          <input type="range"
            min={REFERRAL_MIN} max={REFERRAL_MAX} step="1"
            value={referralPct}
            onChange={e => setReferralPct(e.target.value)}
            className="referral-slider" />
          <div className="input-with-prefix" style={{ width: '100px' }}>
            <input type="number"
              min={REFERRAL_MIN} max={REFERRAL_MAX} step="1"
              value={referralPct}
              onChange={e => setReferralPct(e.target.value)} />
            <span className="input-suffix">%</span>
          </div>
        </div>
        <small>Range: {REFERRAL_MIN}%–{REFERRAL_MAX}% · Default: {REFERRAL_DEFAULT}%</small>
      </div>

      {jobLaborValue && parseFloat(jobLaborValue) > 0 && (
        <div className="invoice-preview">
          <div className="invoice-header-row">
            <h3>Referral Fee Breakdown</h3>
          </div>
          <div className="fee-breakdown">
            <div className="fee-row">
              <span>Job labor value</span>
              <strong>${fmt(laborCents)}</strong>
            </div>
            <div className="fee-row platform-fee">
              <span>Platform fee ({PLATFORM_FEE_PERCENT}%)</span>
              <span>−${fmt(platformFeeCents)}</span>
            </div>
            <div className="fee-row">
              <span>Labor after platform fee</span>
              <span>${fmt(laborAfterFeeCents)}</span>
            </div>
            <div className="fee-row total">
              <span>Your referral fee ({clampedPct}%)</span>
              <strong className="payout-amount">${fmt(referralFeeCents)}</strong>
            </div>
            <div className="fee-row">
              <span>Referred PI receives</span>
              <span>${fmt(laborAfterFeeCents - referralFeeCents)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function RateCalculatorPage({ onNavigate }) {
  const [mode, setMode] = useState('standard')

  const tabs = [
    { key: 'standard', label: '📋 Standard Job' },
    { key: 'subcontract', label: '🤝 Subcontract Job' },
    { key: 'referral', label: '↗️ Referral' },
  ]

  return (
    <div className="rate-calculator-page">
      <div className="page-header">
        <h1>💰 Rate Calculator</h1>
        <p>Set your rates accurately by calculating in the platform fee, subcontractor payments, and expenses before quoting a client.</p>
      </div>

      <div className="calc-container">
        <div className="calc-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`calc-tab ${mode === tab.key ? 'active' : ''}`}
              onClick={() => setMode(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="calc-body">
          {mode === 'standard' && <StandardMode />}
          {mode === 'subcontract' && <SubcontractMode />}
          {mode === 'referral' && <ReferralMode />}
        </div>

        <div className="calc-footer">
          <p>
            <strong>Platform fee:</strong> {PLATFORM_FEE_PERCENT}% on labor only · 
            <strong> Mileage rate:</strong> ${MILEAGE_RATE}/mile (IRS standard) · 
            <strong> Referral range:</strong> {REFERRAL_MIN}%–{REFERRAL_MAX}%
          </p>
        </div>
      </div>
    </div>
  )
}
