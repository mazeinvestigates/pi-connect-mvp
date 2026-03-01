import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { notifyNewConsultationRequest } from '../notificationUtils'

export default function ConsultationModal({ pi, user, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    requester_name: '',
    requester_email: user?.email || '',
    requester_phone: '',
    organization: '',
    title: '',
    description: '',
    location: '',
    budget_min: '',
    budget_max: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Pre-fill user data if available
    const loadUserData = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', user.id)
          .single()

        if (profile) {
          setFormData(prev => ({
            ...prev,
            requester_name: profile.full_name || '',
            requester_phone: profile.phone || ''
          }))
        }
      }
    }

    loadUserData()
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('consultation_requests')
        .insert({
          pi_profile_id: pi.id,
          requester_user_id: user?.id || null,
          requester_name: formData.requester_name,
          requester_email: formData.requester_email,
          requester_phone: formData.requester_phone || null,
          organization: formData.organization || null,
          title: formData.title,
          description: formData.description,
          location: formData.location,
          budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
          budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
          status: 'pending'
        })

      if (insertError) throw insertError

      // Send notification to PI
      await notifyNewConsultationRequest(
        pi.user_id,
        formData.requester_name,
        formData.title
      )

      onSuccess()
    } catch (err) {
      console.error('Error submitting consultation request:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal consultation-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <h2>Request Consultation</h2>
          <p>Send a consultation request to {pi.first_name} {pi.last_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>Your Name *</label>
              <input
                type="text"
                value={formData.requester_name}
                onChange={(e) => setFormData({...formData, requester_name: e.target.value})}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.requester_email}
                onChange={(e) => setFormData({...formData, requester_email: e.target.value})}
                required
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={formData.requester_phone}
                onChange={(e) => setFormData({...formData, requester_phone: e.target.value})}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="form-group">
              <label>Organization</label>
              <input
                type="text"
                value={formData.organization}
                onChange={(e) => setFormData({...formData, organization: e.target.value})}
                placeholder="Company or law firm (optional)"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Case Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
              placeholder="Brief summary of your case"
            />
          </div>

          <div className="form-group">
            <label>Case Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
              rows={5}
              placeholder="Please describe your case in detail. Include any relevant background information, timeline, and what you hope to achieve."
            />
          </div>

          <div className="form-group">
            <label>Location *</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              required
              placeholder="City, State where investigation is needed"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Budget Range (optional)</label>
              <div className="budget-inputs">
                <input
                  type="number"
                  value={formData.budget_min}
                  onChange={(e) => setFormData({...formData, budget_min: e.target.value})}
                  placeholder="Min"
                  min="0"
                  step="100"
                />
                <span>to</span>
                <input
                  type="number"
                  value={formData.budget_max}
                  onChange={(e) => setFormData({...formData, budget_max: e.target.value})}
                  placeholder="Max"
                  min="0"
                  step="100"
                />
              </div>
            </div>
          </div>

          <div className="info-box">
            <p>
              <strong>Next steps:</strong> {pi.first_name} will review your request and respond within their typical response time ({pi.response_time}). You'll be notified via email when they respond.
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
