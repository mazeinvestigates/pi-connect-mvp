import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { getOrCreateConversation } from '../messagingUtils'
import { INVESTIGATION_TYPES } from '../investigationTypes'
import { calculateBreakdown } from './PaymentModal'

export default function SubcontractModal({ job, user, piProfile, onClose, onSuccess, onNavigate }) {
  const [step, setStep] = useState('search')
  const [expandedPI, setExpandedPI] = useState(null)

  const handleMessagePI = async (piUserId) => {
    try {
      const conversation = await getOrCreateConversation(user.id, piUserId)
      if (conversation?.id) sessionStorage.setItem('open_conversation_id', conversation.id)
      onClose()
      if (onNavigate) onNavigate('messages')
    } catch (err) {
      alert('Could not start conversation. Please try again.')
    }
  } // search | configure | confirm
  const [searchCity, setSearchCity] = useState(job?.city || '')
  const [searchState, setSearchState] = useState(job?.state || '')
  const [searchSpecialty, setSearchSpecialty] = useState(job?.investigation_type || '')
  const [availablePIs, setAvailablePIs] = useState([])
  const [selectedPI, setSelectedPI] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Subcontract config
  const [rateType, setRateType] = useState('fixed')
  const [rateValue, setRateValue] = useState('')
  const [jobDetails, setJobDetails] = useState('')
  const [deadline, setDeadline] = useState('')

  // Calculator
  const [showCalc, setShowCalc] = useState(false)
  const [estimatedHours, setEstimatedHours] = useState('')
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

      if (searchCity) query = query.ilike('city', `%${searchCity}%`)
      if (searchState) query = query.ilike('state', `%${searchState}%`)
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
      const rateCents = rateType === 'fixed' || rateType === 'hourly'
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
          rate_type: rateType,
          rate_status: 'pending',
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
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
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
                  <label>City</label>
                  <input type="text"
                    value={searchCity}
                    onChange={e => setSearchCity(e.target.value)}
                    placeholder="City" />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text"
                    value={searchState}
                    onChange={e => setSearchState(e.target.value)}
                    placeholder="FL" />
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button className="btn-primary-small" onClick={() => handleSelectPI(pi)}>
                          Select
                        </button>
                        <button
                          onClick={() => setExpandedPI(expandedPI === pi.id ? null : pi.id)}
                          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: '#667eea' }}>
                          {expandedPI === pi.id ? 'Hide' : 'View Profile'}
                        </button>
                        <button
                          onClick={() => handleMessagePI(pi.user_id)}
                          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: '#374151' }}>
                          💬 Message
                        </button>
                      </div>

                    {expandedPI === pi.id && (
                      <div style={{ padding: '12px 14px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: '13px' }}>
                        {pi.bio && (
                          <div style={{ marginBottom: '10px' }}>
                            <p style={{ fontWeight: '600', marginBottom: '4px' }}>Bio</p>
                            <p style={{ color: '#374151', lineHeight: '1.5' }}>{pi.bio}</p>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                          {pi.license_number && (
                            <div>
                              <p style={{ fontWeight: '600', marginBottom: '2px' }}>License</p>
                              <p style={{ color: '#374151' }}>{pi.license_number} ({pi.license_state})</p>
                            </div>
                          )}
                          {pi.hourly_rate && (
                            <div>
                              <p style={{ fontWeight: '600', marginBottom: '2px' }}>Hourly Rate</p>
                              <p style={{ color: '#374151' }}>${pi.hourly_rate}/hr</p>
                            </div>
                          )}
                          {pi.response_time && (
                            <div>
                              <p style={{ fontWeight: '600', marginBottom: '2px' }}>Response Time</p>
                              <p style={{ color: '#374151' }}>{pi.response_time}</p>
                            </div>
                          )}
                          {pi.languages?.length > 0 && (
                            <div>
                              <p style={{ fontWeight: '600', marginBottom: '2px' }}>Languages</p>
                              <p style={{ color: '#374151' }}>{pi.languages.join(', ')}</p>
                            </div>
                          )}
                        </div>
                        {(pi.review_count > 0 || pi.professional_review_count > 0) && (
                          <div>
                            <p style={{ fontWeight: '600', marginBottom: '6px' }}>Reviews</p>
                            <div style={{ display: 'flex', gap: '16px' }}>
                              {pi.review_count > 0 && (
                                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                                  <p style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>⭐ {pi.average_rating?.toFixed(1)}</p>
                                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{pi.review_count} client review{pi.review_count !== 1 ? 's' : ''}</p>
                                </div>
                              )}
                              {pi.professional_review_count > 0 && (
                                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', textAlign: 'center' }}>
                                  <p style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>🤝 {pi.professional_rating?.toFixed(1)}</p>
                                  <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{pi.professional_review_count} PI review{pi.professional_review_count !== 1 ? 's' : ''}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {pi.review_count === 0 && pi.professional_review_count === 0 && (
                          <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No reviews yet</p>
                        )}
                      </div>
                    )}
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
                <label>Subcontractor Compensation</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {[
                    { value: 'fixed', label: 'Fixed Total' },
                    { value: 'hourly', label: 'Hourly Rate' },
                    { value: 'percentage', label: '% of Client Fee' },
                    { value: 'open', label: 'Let Sub Propose' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => { setRateType(opt.value); setRateValue('') }}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                        background: rateType === opt.value ? '#667eea' : 'white',
                        color: rateType === opt.value ? 'white' : '#374151' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {rateType !== 'open' && (
                  <div className="input-with-prefix">
                    <span className="input-prefix">{rateType === 'percentage' ? '%' : '$'}</span>
                    <input type="number" min="0"
                      step={rateType === 'percentage' ? '1' : '0.01'}
                      max={rateType === 'percentage' ? '100' : undefined}
                      value={rateValue}
                      onChange={e => setRateValue(e.target.value)}
                      placeholder={
                        rateType === 'percentage' ? 'e.g., 70' :
                        rateType === 'hourly' ? 'e.g., 75.00' : 'e.g., 500.00'
                      } />
                  </div>
                )}
                <small>
                  {rateType === 'open' ? 'Sub will propose their own rate. You can approve or counter-offer.' :
                   rateType === 'hourly' ? 'Sub paid per hour worked — protects against longer-than-expected jobs' :
                   rateType === 'percentage' ? 'Sub receives this % of total client payment' :
                   'Fixed total payment to subcontractor'}
                </small>
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

                  {rateType === 'hourly' && rateValue && (
                    <div className="form-group">
                      <label>Estimated hours for subcontractor</label>
                      <input type="number" min="0" step="0.5"
                        value={estimatedHours}
                        onChange={e => setEstimatedHours(e.target.value)}
                        placeholder="e.g., 8" />
                      <small>Used to estimate sub's total pay — actual hours may vary</small>
                    </div>
                  )}

                  {calcLabor && parseFloat(calcLabor) > 0 && (() => {
                    const subPayment = rateType === 'hourly' && rateValue && estimatedHours
                      ? parseFloat(rateValue) * parseFloat(estimatedHours)
                      : rateType === 'fixed' && rateValue
                      ? parseFloat(rateValue)
                      : rateType === 'percentage' && rateValue
                      ? (calcBreakdown.piLaborPayoutCents * parseFloat(rateValue) / 100) / 100
                      : 0
                    const takeHome = calcBreakdown.piLaborPayoutCents / 100 - subPayment
                    return (
                      <div className="fee-breakdown" style={{ marginTop: '8px' }}>
                        <div className="fee-row">
                          <span>Client pays (labor)</span>
                          <strong>${calcBreakdown.laborDollars}</strong>
                        </div>
                        <div className="fee-row platform-fee">
                          <span>Platform fee (10%)</span>
                          <span>−${calcBreakdown.platformFeeDollars}</span>
                        </div>
                        {subPayment > 0 && (
                          <div className="fee-row platform-fee">
                            <span>Subcontractor payment{rateType === 'hourly' && estimatedHours ? ` (${estimatedHours}hrs × $${rateValue}/hr)` : ''}</span>
                            <span>−${subPayment.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="fee-row payout">
                          <span>Your take-home</span>
                          <strong className="payout-amount" style={{ color: takeHome < 0 ? '#dc2626' : undefined }}>
                            ${takeHome.toFixed(2)}
                          </strong>
                        </div>
                        {rateType === 'hourly' && !estimatedHours && rateValue && (
                          <p style={{ fontSize: '12px', color: '#d97706', marginTop: '6px' }}>
                            ⚠️ Enter estimated hours above to calculate your take-home
                          </p>
                        )}
                      </div>
                    )
                  })()}
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
                  <strong>{rateType === 'fixed' || rateType === 'hourly' ? `$${parseFloat(rateValue).toFixed(2)}` : `${rateValue}% of job`}</strong>
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
