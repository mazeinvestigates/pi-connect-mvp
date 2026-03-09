import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ReferJobModal({ job, currentUser, onClose, onSuccess }) {
  const [searchLocation, setSearchLocation] = useState(job.city || job.location || '')
  const [nearbyPIs, setNearbyPIs] = useState([])
  const [selectedPI, setSelectedPI] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (searchLocation) {
      searchPIs()
    }
  }, [])

  const searchPIs = async () => {
    try {
      setSearching(true)

      let query = supabase
        .from('pi_profiles')
        .select('*')
        .eq('is_verified', true)
        .neq('user_id', currentUser.id) // Exclude self

      if (searchLocation) {
        query = query.or(`city.ilike.%${searchLocation}%,state.ilike.%${searchLocation}%,location.ilike.%${searchLocation}%`)
      }

      const { data, error } = await query.limit(20)

      if (error) throw error

      // Filter by specialties if job has required specialties
      let results = data || []
      if (job.required_specialties && job.required_specialties.length > 0) {
        results = results.filter(pi => {
          if (!pi.specialties) return false
          return job.required_specialties.some(required =>
            pi.specialties.some(piSpec =>
              piSpec.toLowerCase().includes(required.toLowerCase())
            )
          )
        })
      }

      // Sort by rating
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0))

      setNearbyPIs(results)
    } catch (error) {
      console.error('Error searching PIs:', error)
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedPI) {
      alert('Please select a PI to refer this job to.')
      return
    }

    setLoading(true)

    try {
      // Check if already referred to this PI
      const { data: existing } = await supabase
        .from('job_referrals')
        .select('id')
        .eq('job_id', job.id)
        .eq('referred_to', selectedPI.user_id)
        .maybeSingle()

      if (existing) {
        alert('You have already referred this job to this PI.')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('job_referrals')
        .insert({
          job_id: job.id,
          referred_by: currentUser.id,
          referred_to: selectedPI.user_id,
          message: message.trim() || null,
          status: 'pending'
        })

      if (error) throw error

      onSuccess()
    } catch (error) {
      console.error('Error sending referral:', error)
      alert('Failed to send referral. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal refer-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Refer Job to Another PI</h2>
          <p>{job.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="info-box">
            <p><strong>Job Details:</strong></p>
            <p>📍 {job.location}</p>
            <p>💰 ${job.budget_min?.toLocaleString()} - ${job.budget_max?.toLocaleString()}</p>
            <p>🔍 {job.investigation_type}</p>
          </div>

          <div className="form-group">
            <label>Search PIs by Location</label>
            <div className="search-input-group">
              <input
                type="text"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                placeholder="City or state..."
              />
              <button
                type="button"
                onClick={searchPIs}
                className="btn-secondary-small"
                disabled={searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {searching ? (
            <div className="loading-container-small">
              <div className="spinner-small"></div>
              <p>Searching for PIs...</p>
            </div>
          ) : nearbyPIs.length === 0 ? (
            <div className="empty-hint">
              <p>No PIs found in this location. Try a different search.</p>
            </div>
          ) : (
            <div className="pi-selection-list">
              <label>Select a PI to refer to:</label>
              {nearbyPIs.map(pi => (
                <div
                  key={pi.id}
                  className={`pi-selection-card ${selectedPI?.id === pi.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPI(pi)}
                >
                  <div className="pi-selection-header">
                    <input
                      type="radio"
                      name="selected-pi"
                      checked={selectedPI?.id === pi.id}
                      onChange={() => setSelectedPI(pi)}
                    />
                    <div>
                      <h4>{pi.first_name} {pi.last_name}</h4>
                      {pi.company_name && <p className="company-name">{pi.company_name}</p>}
                      <p className="pi-location">📍 {pi.location}</p>
                    </div>
                  </div>

                  <div className="pi-selection-stats">
                    <span>⭐ {pi.rating?.toFixed(1) || 'New'}</span>
                    <span>📝 {pi.review_count || 0} reviews</span>
                    <span>⏱️ {pi.years_experience || 0} years</span>
                  </div>

                  {pi.specialties && pi.specialties.length > 0 && (
                    <div className="pi-selection-specialties">
                      {pi.specialties.slice(0, 3).map((spec, idx) => (
                        <span key={idx} className="specialty-tag-small">{spec}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedPI && (
            <div className="form-group">
              <label>Message (optional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder={`Hey ${selectedPI.first_name}, I think you'd be perfect for this ${job.investigation_type} case in ${job.location}...`}
              />
              <small>Add a personal note to your referral</small>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !selectedPI}
            >
              {loading ? 'Sending...' : 'Send Referral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
