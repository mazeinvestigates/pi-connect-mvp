import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { INVESTIGATION_TYPES } from '../investigationTypes'
import { sendJobMatchEmails } from '../emailUtils'
import CaseDescriptionAssistant from '../components/CaseDescriptionAssistant'
import { US_STATES } from '../usStates'

export default function PostJobPage({ user, profile, onNavigate }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    city: '',
    state: '',
    investigationType: 'Surveillance',
    budgetMin: '',
    budgetMax: '',
    urgency: 'medium',
    requiredSpecialties: [],
    deadline: '',
    isPrivate: false,
    postedByPI: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const investigationTypes = INVESTIGATION_TYPES

  const specialtyOptions = INVESTIGATION_TYPES

  const handleSpecialtyToggle = (specialty) => {
    setFormData(prev => ({
      ...prev,
      requiredSpecialties: prev.requiredSpecialties.includes(specialty)
        ? prev.requiredSpecialties.filter(s => s !== specialty)
        : [...prev.requiredSpecialties, specialty]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('jobs')
        .insert({
          posted_by: user.id,
          title: formData.title,
          description: formData.description,
          location: formData.location || `${formData.city}, ${formData.state}`,
          city: formData.city,
          state: formData.state,
          investigation_type: formData.investigationType,
          budget_min: formData.budgetMin ? parseFloat(formData.budgetMin) : null,
          budget_max: formData.budgetMax ? parseFloat(formData.budgetMax) : null,
          urgency: formData.urgency,
          required_specialties: formData.requiredSpecialties.length > 0 ? formData.requiredSpecialties : null,
          deadline: formData.deadline || null,
          status: 'open',
          is_private: formData.isPrivate,
          posted_by_pi: formData.postedByPI
        })

      if (insertError) throw insertError

      // Send job match emails to qualifying PIs (non-blocking, only for public jobs)
      if (!formData.isPrivate) {
        sendJobMatchEmails({
          job: {
            title: formData.title,
            location: `${formData.city}, ${formData.state}`,
            investigation_type: formData.investigationType,
            budget_min: formData.budgetMin || null,
            budget_max: formData.budgetMax || null
          }
        }).catch(err => console.warn('Job match emails failed (non-fatal):', err))
      }

      alert('Job posted successfully! PIs can now see and apply to your listing.')
      onNavigate('jobs')
    } catch (err) {
      console.error('Error posting job:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="post-job-page">
        <div className="empty-state">
          <h2>Sign in to post a job</h2>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="post-job-page">
      <div className="page-header">
        <button onClick={() => onNavigate('jobs')} className="btn-back">
          ← Back to Jobs
        </button>
        <h1>Post a Job</h1>
        <p>Hire qualified private investigators for your case</p>
      </div>

      <form onSubmit={handleSubmit} className="post-job-form">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-section">
          <h2>Job Details</h2>

          <div className="form-group">
            <label>Job Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
              placeholder="e.g., Need Surveillance Expert in Miami"
            />
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
              rows={6}
              placeholder="Describe the investigation needed, any specific requirements, timeline expectations, and what results you're looking for..."
            />
            <small>{formData.description.length} characters</small>
            <CaseDescriptionAssistant
              investigationType={formData.investigationType}
              description={formData.description}
              onDescriptionChange={(text) => setFormData({...formData, description: text})}
            />
          </div>

          <div className="form-group">
            <label>Investigation Type *</label>
            <select
              value={formData.investigationType}
              onChange={(e) => setFormData({...formData, investigationType: e.target.value})}
              required
            >
              {investigationTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-section">
          <h2>Location</h2>

          <div className="form-row">
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                required
                placeholder="Miami"
              />
            </div>

            <div className="form-group">
              <label>State *</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                required
              >
                <option value="">Select state</option>
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Budget & Timeline</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Minimum Budget ($)</label>
              <input
                type="number"
                value={formData.budgetMin}
                onChange={(e) => setFormData({...formData, budgetMin: e.target.value})}
                placeholder="1000"
                min="0"
                step="100"
              />
            </div>

            <div className="form-group">
              <label>Maximum Budget ($)</label>
              <input
                type="number"
                value={formData.budgetMax}
                onChange={(e) => setFormData({...formData, budgetMax: e.target.value})}
                placeholder="5000"
                min="0"
                step="100"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Urgency *</label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                required
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium</option>
                <option value="high">High Priority</option>
                <option value="urgent">URGENT</option>
              </select>
            </div>

            <div className="form-group">
              <label>Deadline (optional)</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Required Skills (optional)</h2>
          <p className="form-hint">Select any specific specialties the PI must have</p>

          <div className="specialty-grid">
            {specialtyOptions.map(specialty => (
              <button
                key={specialty}
                type="button"
                className={`specialty-btn ${formData.requiredSpecialties.includes(specialty) ? 'selected' : ''}`}
                onClick={() => handleSpecialtyToggle(specialty)}
              >
                {specialty}
              </button>
            ))}
          </div>
        </div>

        {/* Job Visibility Options — PI only */}
        {profile?.type === 'pi' && (
        <div className="form-section">
          <h2>Job Visibility</h2>

          <div className="visibility-options">
            <label className="visibility-option">
              <input
                type="checkbox"
                checked={formData.isPrivate}
                onChange={e => setFormData({...formData, isPrivate: e.target.checked})}
              />
              <div>
                <strong>Private Job</strong>
                <p>Not visible in the public marketplace. Use this to bring an existing case onto the platform for subcontracting. You can convert it to public later if needed.</p>
              </div>
            </label>

            <label className="visibility-option">
              <input
                type="checkbox"
                checked={formData.postedByPI}
                onChange={e => setFormData({...formData, postedByPI: e.target.checked})}
              />
              <div>
                <strong>Posted by PI — Seeking Subcontractor</strong>
                <p>Indicates that you are a PI posting this job to find a field operative. The job will be tagged accordingly so other PIs understand the arrangement.</p>
              </div>
            </label>
          </div>
        </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => onNavigate('jobs')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-large" disabled={loading}>
            {loading ? 'Posting...' : formData.isPrivate ? 'Post Private Job' : 'Post Job'}
          </button>
        </div>
      </form>
    </div>
  )
}
