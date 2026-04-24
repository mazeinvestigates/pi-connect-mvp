import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function JobApplicationModal({ job, user, piProfile, onClose, onSuccess, hasApplied }) {
  const [formData, setFormData] = useState({
    coverLetter: '',
    proposedRate: job.budget_max || '',
    rateType: 'hourly',
    estimatedTimeline: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: existing } = await supabase
        .from('job_applications')
        .select('id')
        .eq('job_id', job.id)
        .eq('applicant_id', user.id)
        .maybeSingle()

      if (existing) {
        setError('You have already applied to this job.')
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase
        .from('job_applications')
        .insert({
          job_id: job.id,
          applicant_id: user.id,
          cover_letter: formData.coverLetter,
          proposed_rate: formData.proposedRate ? parseFloat(formData.proposedRate) : null,
          rate_type: formData.rateType || 'hourly',
          estimated_timeline: formData.estimatedTimeline,
          status: 'pending'
        })

      if (insertError) throw insertError
      onSuccess()
    } catch (err) {
      console.error('Error submitting application:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal application-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>{hasApplied ? 'Job Details' : 'Apply to Job'}</h2>
          <p>{job.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {hasApplied && (
            <div className="alert alert-success" style={{ marginBottom: '16px' }}>
              ✓ You have already applied to this job.
            </div>
          )}

          <div className="info-box">
            <p><strong>Job Details:</strong></p>
            <p>📍 {job.location}</p>
            <p>💰 Budget: ${job.budget_min?.toLocaleString() || '?'} - ${job.budget_max?.toLocaleString() || '?'}</p>
            <p>⏰ Urgency: {job.urgency}</p>
            {job.description && (
              <div style={{ marginTop: '12px' }}>
                <p><strong>Description:</strong></p>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginTop: '6px' }}>{job.description}</p>
              </div>
            )}
          </div>

          {!hasApplied && (
            <>
              <div className="form-group">
                <label>Cover Letter *</label>
                <textarea
                  value={formData.coverLetter}
                  onChange={(e) => setFormData({...formData, coverLetter: e.target.value})}
                  required
                  rows={6}
                  placeholder="Explain why you're the best fit for this job. Highlight relevant experience, skills, and how you would approach this case..."
                />
                <small>{formData.coverLetter.length} / 1000 characters</small>
              </div>

              <div className="form-group">
                <label>Rate Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button"
                    onClick={() => setFormData({...formData, rateType: 'hourly'})}
                    style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '13px', background: formData.rateType !== 'flat' ? '#667eea' : 'white', color: formData.rateType !== 'flat' ? 'white' : '#374151', fontWeight: '500' }}>
                    Hourly
                  </button>
                  <button type="button"
                    onClick={() => setFormData({...formData, rateType: 'flat'})}
                    style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '13px', background: formData.rateType === 'flat' ? '#667eea' : 'white', color: formData.rateType === 'flat' ? 'white' : '#374151', fontWeight: '500' }}>
                    Flat Fee
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{formData.rateType === 'flat' ? 'Flat Fee ($)' : 'Hourly Rate ($)'}</label>
                  <input
                    type="number"
                    value={formData.proposedRate}
                    onChange={(e) => setFormData({...formData, proposedRate: e.target.value})}
                    placeholder={formData.rateType === 'flat' ? 'Total flat fee' : `Hourly rate (max: $${job.budget_max || 'N/A'})`}
                    min="0"
                    step="50"
                  />
                  <small>{formData.rateType === 'flat' ? 'Total flat fee for the engagement' : 'Per hour rate'}</small>
                </div>

                <div className="form-group">
                  <label>Estimated Timeline</label>
                  <input
                    type="text"
                    value={formData.estimatedTimeline}
                    onChange={(e) => setFormData({...formData, estimatedTimeline: e.target.value})}
                    placeholder="e.g., 2-3 weeks, 5 business days"
                  />
                  <small>How long will this take?</small>
                </div>
              </div>

              <div className="info-box">
                <p><strong>Your Profile Info (visible to client):</strong></p>
                <p>👤 {piProfile?.first_name} {piProfile?.last_name}</p>
                {piProfile?.company_name && <p>🏢 {piProfile?.company_name}</p>}
                <p>⭐ Rating: {piProfile?.rating?.toFixed(1) || 'New'} ({piProfile?.review_count || 0} reviews)</p>
                <p>📍 Based in: {piProfile?.city}, {piProfile?.state}</p>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {hasApplied ? 'Close' : 'Cancel'}
            </button>
            {!hasApplied && (
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !formData.coverLetter.trim()}
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
