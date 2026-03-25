import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { INVESTIGATION_TYPES } from '../investigationTypes'

const REFERRAL_MIN = 5
const REFERRAL_MAX = 30
const REFERRAL_DEFAULT = 10
const PLATFORM_FEE = 10

export default function ReferralModal({ job, user, onClose, onSuccess }) {
  const [step, setStep] = useState('search')
  const [searchCity, setSearchCity] = useState(job?.city || '')
  const [searchState, setSearchState] = useState(job?.state || '')
  const [searchSpecialty, setSearchSpecialty] = useState(job?.investigation_type || '')
  const [availablePIs, setAvailablePIs] = useState([])
  const [selectedPI, setSelectedPI] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [referralPct, setReferralPct] = useState(REFERRAL_DEFAULT)
  const [handoffNote, setHandoffNote] = useState('')
  const [jobValue, setJobValue] = useState('')

  const searchPIs = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('pi_profiles')
        .select('*')
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

  // Fee calculations
  const laborCents = Math.round((parseFloat(jobValue) || 0) * 100)
  const platformFeeCents = Math.floor(laborCents * (PLATFORM_FEE / 100))
  const laborAfterFeeCents = laborCents - platformFeeCents
  const clampedPct = Math.min(Math.max(parseFloat(referralPct) || 0, REFERRAL_MIN), REFERRAL_MAX)
  const referralFeeCents = Math.floor(laborAfterFeeCents * (clampedPct / 100))
  const fmt = (cents) => (cents / 100).toFixed(2)

  const handleSubmit = async () => {
    if (!handoffNote.trim()) {
      setError('Please add a handoff note for the receiving PI')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const { error: refError } = await supabase
        .from('referrals')
        .insert({
          job_id: job.id,
          referring_pi_id: user.id,
          referred_pi_id: selectedPI.user_id,
          referral_fee_percent: clampedPct,
          referral_fee_cents: referralFeeCents,
          handoff_note: handoffNote,
          status: 'pending'
        })

      if (refError) throw refError

      // Notify referred PI
      await supabase.from('notifications').insert({
        user_id: selectedPI.user_id,
        type: 'referral_offer',
        title: 'New Job Referral',
        message: `You have a new job referral: ${job.title}`,
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>↗️ Refer Job</h2>
          <p>{job.title}</p>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {step === 'search' && (
            <>
              <p className="modal-description">
                Refer this job to another PI. They'll take full ownership — you collect a referral fee when the job completes.
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
                <div className="empty-state"><p>No verified PIs found in this area.</p></div>
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
                            <span className="pi-rating">⭐ {pi.average_rating?.toFixed(1)}</span>
                          )}
                          {pi.peer_rating > 0 && (
                            <span className="pi-rating">🤝 {pi.peer_rating?.toFixed(1)}</span>
                          )}
                        </div>
                      </div>
                      <button className="btn-primary-small"
                        onClick={() => { setSelectedPI(pi); setStep('configure') }}>
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

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
                <label>Expected Job Labor Value ($) <em style={{fontWeight:'normal',color:'#888'}}>(for fee calculation)</em></label>
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input type="number" min="0" step="0.01"
                    value={jobValue}
                    onChange={e => setJobValue(e.target.value)}
                    placeholder="0.00" />
                </div>
              </div>

              <div className="form-group">
                <label>Referral Fee — {clampedPct}% <em style={{fontWeight:'normal',color:'#888'}}>({REFERRAL_MIN}%–{REFERRAL_MAX}%)</em></label>
                <div className="referral-slider-group">
                  <input type="range"
                    min={REFERRAL_MIN} max={REFERRAL_MAX} step="1"
                    value={referralPct}
                    onChange={e => setReferralPct(e.target.value)}
                    className="referral-slider" />
                  <div className="input-with-prefix" style={{ width: '80px' }}>
                    <input type="number"
                      min={REFERRAL_MIN} max={REFERRAL_MAX}
                      value={referralPct}
                      onChange={e => setReferralPct(e.target.value)} />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
              </div>

              {jobValue && parseFloat(jobValue) > 0 && (
                <div className="fee-breakdown" style={{ marginBottom: '16px' }}>
                  <div className="fee-row">
                    <span>Job labor value</span>
                    <strong>${fmt(laborCents)}</strong>
                  </div>
                  <div className="fee-row platform-fee">
                    <span>Platform fee (10%)</span>
                    <span>−${fmt(platformFeeCents)}</span>
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
              )}

              <div className="form-group">
                <label>Handoff Note *</label>
                <textarea
                  value={handoffNote}
                  onChange={e => setHandoffNote(e.target.value)}
                  rows={4}
                  placeholder="Introduce the case to the receiving PI. Include any relevant context, client preferences, or special considerations. The receiving PI will get full client access once they accept."
                />
              </div>

              <div className="info-box">
                <p>✅ <strong>Full handoff:</strong> Once accepted, the receiving PI gets complete client info and manages the job directly. You'll receive your referral fee when the job completes.</p>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setStep('search')}>← Back</button>
                <button className="btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting || !handoffNote.trim()}>
                  {submitting ? 'Sending...' : 'Send Referral'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
