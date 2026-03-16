import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { INVESTIGATION_TYPES } from '../investigationTypes'
import { calculateBreakdown } from './PaymentModal'

export default function SubcontractModal({ job, user, piProfile, onClose, onSuccess }) {
  const [step, setStep] = useState('search') // search | configure | confirm
  const [searchLocation, setSearchLocation] = useState(job?.location || '')
  const [searchSpecialty, setSearchSpecialty] = useState(job?.investigation_type || '')
  const [availablePIs, setAvailablePIs] = useState([])
  const [selectedPI, setSelectedPI] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Subcontract config
  const [rateType, setRateType] = useState('dollar')
  const [rateValue, setRateValue] = useState('')
  const [jobDetails, setJobDetails] = useState('')
  const [deadline, setDeadline] = useState('')

  // Calculator
  const [showCalc, setShowCalc] = useState(false)
  const [calcLabor, setCalcLabor] = useState('')

  const searchPIs = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('pi_profiles')
        .select('*')
        .eq('available_for_subcontract', true)
        .eq('is_verified', true)
        .neq('user_id', user.id)

      if (searchLocation) {
        query = query.or(`city.ilike.%${searchLocation}%,state.ilike.%${searchLocation}%`)
      }
      if (searchSpecialty) {
        query = query.contains('specialties', [searchSpecialty])
      }

      const { data, error } = await query
      if (error) throw error
      setAvailablePIs(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { searchPIs() }, [])

  const handleSelectPI = (pi) => {
    setSelectedPI(pi)
    setStep('configure')
  }

  const handleSubmit = async () => {
    if (!rateValue || parseFloat(rateValue) <= 0) {
      setError('Please enter a subcontractor rate')
      return
    }
    if (!jobDetails.trim()) {
      setError('Please provide job details for the subcontractor')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const rateCents = rateType === 'dollar'
        ? Math.round(parseFloat(rateValue) * 100)
        : null // percent handled at payment time

      const { error: subError } = await supabase
        .from('subcontracts')
        .insert({
          job_id: job.id,
          primary_pi_id: user.id,
          subcontractor_id: selectedPI.user_id,
          status: 'pending',
          subcontractor_rate_cents: rateCents,
          job_details: jobDetails,
          deadline: deadline || null
        })

      if (subError) throw subError

      // Notify subcontractor
      await supabase.from('notifications').insert({
        user_id: selectedPI.user_id,
        type: 'subcontract_offer',
        title: 'New Subcontract Offer',
        message: `You have a new subcontract offer for: ${job.title}`,
        related_id: job.id,
        related_type: 'job'
      })

      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const calcBreakdown = calculateBreakdown({ laborDollars: calcLabor })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>🤝 Subcontract Job</h2>
          <p>{job.title}</p>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Step 1: Search */}
          {step === 'search' && (
            <>
              <p className="modal-description">
                Find a verified PI available for subcontract work. They will report directly to you — the client will not know they're involved.
              </p>

              <div className="search-row">
                <div className="form-group">
                  <label>Location</label>
                  <input type="text"
                    value={searchLocation}
                    onChange={e => setSearchLocation(e.target.value)}
                    placeholder="City or state" />
                </div>
                <div className="form-group">
                  <label>Specialty</label>
                  <select value={searchSpecialty} onChange={e => setSearchSpecialty(e.target.value)}>
                    <option value="">All Specialties</option>
                    {INVESTIGATION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <button className="btn-secondary" onClick={searchPIs} disabled={loading}>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {loading ? (
                <div className="loading-container"><div className="spinner"></div></div>
              ) : availablePIs.length === 0 ? (
                <div className="empty-state">
                  <p>No PIs available for subcontract in this area.</p>
                  <small>PIs must enable "Available for Subcontract" on their profile to appear here.</small>
                </div>
              ) : (
                <div className="pi-results-list">
                  {availablePIs.map(pi => (
                    <div key={pi.id} className="pi-result-card">
                      <div className="pi-result-info">
                        <h3>{pi.first_name} {pi.last_name}</h3>
                        {pi.company_name && <p className="pi-company">{pi.company_name}</p>}
                        <p className="pi-location">📍 {pi.city}, {pi.state}</p>
                        <div className="pi-meta-row">
                          {pi.average_rating > 0 && (
                            <span className="pi-rating">⭐ {pi.average_rating?.toFixed(1)} client rating</span>
                          )}
                          {pi.peer_rating > 0 && (
                            <span className="pi-rating">🤝 {pi.peer_rating?.toFixed(1)} PI rating</span>
                          )}
                          {pi.years_experience > 0 && (
                            <span>{pi.years_experience} yrs exp</span>
                          )}
                        </div>
                        {pi.specialties?.length > 0 && (
                          <div className="pi-specialties">
                            {pi.specialties.map(s => (
                              <span key={s} className="specialty-tag">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="btn-primary-small" onClick={() => handleSelectPI(pi)}>
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && selectedPI && (
            <>
              <div className="selected-pi-banner">
                <div>
                  <strong>{selectedPI.first_name} {selectedPI.last_name}</strong>
                  <span> — {selectedPI.city}, {selectedPI.state}</span>
                </div>
                <button className="btn-text" onClick={() => setStep('search')}>Change</button>
              </div>

              <div className="form-group">
                <label>Subcontractor Rate *</label>
                <div className="radio-group horizontal" style={{ marginBottom: '8px' }}>
                  <label className="radio-option">
                    <input type="radio" value="dollar"
                      checked={rateType === 'dollar'}
                      onChange={() => setRateType('dollar')} />
                    <span>Fixed amount ($)</span>
                  </label>
                  <label className="radio-option">
                    <input type="radio" value="percent"
                      checked={rateType === 'percent'}
                      onChange={() => setRateType('percent')} />
                    <span>Percentage of job (%)</span>
                  </label>
                </div>
                <div className="input-with-prefix">
                  <span className="input-prefix">{rateType === 'dollar' ? '$' : '%'}</span>
                  <input type="number" min="0" step={rateType === 'dollar' ? '0.01' : '1'}
                    value={rateValue}
                    onChange={e => setRateValue(e.target.value)}
                    placeholder="0" />
                </div>
              </div>

              {/* Embedded calculator */}
              <div className="expense-toggle-row">
                <label className="toggle-label">
                  <input type="checkbox" checked={showCalc} onChange={e => setShowCalc(e.target.checked)} />
                  <span>Show rate calculator</span>
                </label>
              </div>

              {showCalc && (
                <div className="embedded-calc">
                  <div className="form-group">
                    <label>What you charge the client (labor, $)</label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">$</span>
                      <input type="number" min="0" step="0.01"
                        value={calcLabor}
                        onChange={e => setCalcLabor(e.target.value)}
                        placeholder="0.00" />
                    </div>
                  </div>
                  {calcLabor && parseFloat(calcLabor) > 0 && (
                    <div className="fee-breakdown" style={{ marginTop: '8px' }}>
                      <div className="fee-row">
                        <span>Client pays (labor)</span>
                        <strong>${calcBreakdown.laborDollars}</strong>
                      </div>
                      <div className="fee-row platform-fee">
                        <span>Platform fee (10%)</span>
                        <span>−${calcBreakdown.platformFeeDollars}</span>
                      </div>
                      {rateValue && parseFloat(rateValue) > 0 && (
                        <div className="fee-row platform-fee">
                          <span>Subcontractor payment</span>
                          <span>−${rateType === 'dollar'
                            ? parseFloat(rateValue).toFixed(2)
                            : ((calcBreakdown.piLaborPayoutCents * parseFloat(rateValue) / 100) / 100).toFixed(2)
                          }</span>
                        </div>
                      )}
                      <div className="fee-row payout">
                        <span>Your take-home</span>
                        <strong className="payout-amount">${(
                          (calcBreakdown.piLaborPayoutCents -
                            (rateType === 'dollar'
                              ? Math.round(parseFloat(rateValue || 0) * 100)
                              : Math.floor(calcBreakdown.piLaborPayoutCents * (parseFloat(rateValue || 0) / 100))
                            )) / 100
                        ).toFixed(2)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Job Details for Subcontractor *</label>
                <textarea
                  value={jobDetails}
                  onChange={e => setJobDetails(e.target.value)}
                  rows={5}
                  placeholder="Describe exactly what the subcontractor needs to do. Include location details, specific tasks, deliverables, and any relevant case background. Do not include client identifying information."
                />
                <small>⚠️ Do not include client name or contact info — this is a silent subcontract</small>
              </div>

              <div className="form-group">
                <label>Report Deadline</label>
                <input type="datetime-local"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)} />
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setStep('search')}>← Back</button>
                <button className="btn-primary" onClick={() => setStep('confirm')}
                  disabled={!rateValue || !jobDetails.trim()}>
                  Review & Send →
                </button>
              </div>
            </>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedPI && (
            <>
              <div className="confirm-summary">
                <h3>Confirm Subcontract</h3>
                <div className="summary-row">
                  <span>Subcontractor:</span>
                  <strong>{selectedPI.first_name} {selectedPI.last_name}</strong>
                </div>
                <div className="summary-row">
                  <span>Job:</span>
                  <strong>{job.title}</strong>
                </div>
                <div className="summary-row">
                  <span>Rate:</span>
                  <strong>{rateType === 'dollar' ? `$${parseFloat(rateValue).toFixed(2)}` : `${rateValue}% of job`}</strong>
                </div>
                {deadline && (
                  <div className="summary-row">
                    <span>Deadline:</span>
                    <strong>{new Date(deadline).toLocaleDateString()}</strong>
                  </div>
                )}
                <div className="summary-row">
                  <span>Client visibility:</span>
                  <strong>🔒 Hidden — silent subcontract</strong>
                </div>
              </div>

              <div className="info-box">
                <p>The subcontractor will receive a notification and must accept before work begins. They will only see the job details you provided — no client information.</p>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setStep('configure')}>← Back</button>
                <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Subcontract Offer'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
