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
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachMode, setCoachMode] = useState(null) // null | 'write' | 'improve'
  const [coachResult, setCoachResult] = useState(null)
  const [coachError, setCoachError] = useState(null)
  const [error, setError] = useState(null)

  const handleCoach = async (mode) => {
    setCoachLoading(true)
    setCoachError(null)
    setCoachResult(null)
    try {
      const jobContext = [
        job?.title && `Job Title: ${job.title}`,
        job?.investigation_type && `Investigation Type: ${job.investigation_type}`,
        job?.description && `Job Description: ${job.description}`,
        job?.location && `Location: ${job.location}`,
        job?.urgency && `Urgency: ${job.urgency}`,
        formData.proposedRate && `PI's Proposed Rate: $${formData.proposedRate} (${formData.rateType === 'flat' ? 'flat fee' : 'per hour'})`,
        formData.estimatedTimeline && `PI's Estimated Timeline: ${formData.estimatedTimeline}`,
      ].filter(Boolean).join('\n')

      let prompt
      if (mode === 'write') {
        prompt = `You are helping a licensed private investigator write a cover letter for a job application on PI Connect.

Job Details:
${jobContext}

Write a professional, concise cover letter (3-4 sentences) that:
- Directly addresses the specific investigation type and client's needs
- Demonstrates relevant expertise without being generic
- Mentions a specific approach or methodology suited to this case type
- Ends with a confident, professional closing

Do not include any placeholder text. Write as if you are the PI. Do not mention specific dollar amounts.
Return only the cover letter text, nothing else.`
      } else {
        prompt = `You are helping a licensed private investigator improve their cover letter for a job application on PI Connect.

Job Details:
${jobContext}

Current Cover Letter:
"${formData.coverLetter}"

Improve this cover letter to be more targeted, professional, and compelling. Keep the PI's key points but:
- Make it more specific to the job type
- Strengthen the opening line
- Add specificity about approach or methodology if missing
- Keep it to 3-4 sentences

Return only the improved cover letter text, nothing else.`
      }

      const res = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCoachResult(data.text)
      setCoachMode(mode)
    } catch (err) {
      setCoachError('Could not generate suggestion. Please try again.')
    } finally {
      setCoachLoading(false)
    }
  }

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

                {/* Application Coach */}
                <div style={{ marginTop: '8px' }}>
                  {!coachResult && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button"
                        onClick={() => handleCoach('write')}
                        disabled={coachLoading}
                        style={{ background: 'none', border: '1px solid #667eea', color: '#667eea', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        {coachLoading && coachMode === 'write' ? '⏳ Writing...' : '✨ Write my cover letter'}
                      </button>
                      {formData.coverLetter.trim().length > 20 && (
                        <button type="button"
                          onClick={() => handleCoach('improve')}
                          disabled={coachLoading}
                          style={{ background: 'none', border: '1px solid #667eea', color: '#667eea', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                          {coachLoading && coachMode === 'improve' ? '⏳ Improving...' : '✨ Improve my cover letter'}
                        </button>
                      )}
                    </div>
                  )}

                  {coachError && (
                    <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{coachError}</p>
                  )}

                  {coachResult && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 14px', marginTop: '8px' }}>
                      <p style={{ fontWeight: '600', fontSize: '12px', color: '#166534', marginBottom: '6px' }}>
                        ✨ {coachMode === 'write' ? 'Suggested cover letter:' : 'Improved version:'}
                      </p>
                      <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', margin: '0 0 10px' }}>{coachResult}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button"
                          onClick={() => { setFormData({...formData, coverLetter: coachResult}); setCoachResult(null) }}
                          style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                          ✓ Use this
                        </button>
                        <button type="button"
                          onClick={() => setCoachResult(null)}
                          style={{ background: 'none', border: '1px solid #e5e7eb', color: '#374151', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                          Keep mine
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
