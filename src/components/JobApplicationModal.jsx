import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function JobApplicationModal({ job, user, piProfile, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    coverLetter: '',
    proposedRate: job.budget_max || '',
    estimatedTimeline: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Check if already applied
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal application-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Apply to Job</h2>
          <p>{job.title}</p>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="info-box">
            <p><strong>Job Details:</strong></p>
            <p>📍 {job.location}</p>
            <p>💰 Budget: ${job.budget_min?.toLocaleString() || '?'} - ${job.budget_max?.toLocaleString() || '?'}</p>
            <p>⏰ Urgency: {job.urgency}</p>
          </div>

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

          <div className="form-row">
            <div className="form-group">
              <label>Your Proposed Rate ($)</label>
              <input
                type="number"
                value={formData.proposedRate}
                onChange={(e) => setFormData({...formData, proposedRate: e.target.value})}
                placeholder={`Max: ${job.budget_max || 'Not specified'}`}
                min="0"
                step="50"
              />
              <small>Your rate for this job</small>
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
            <p>📍 Based in: {piProfile?.location}</p>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || !formData.coverLetter.trim()}
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
