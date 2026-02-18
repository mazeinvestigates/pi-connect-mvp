import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ReviewModal({ pi, user, consultation, onClose, onSuccess }) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [caseType, setCaseType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const caseTypes = [
    'Surveillance',
    'Background Investigation',
    'Fraud Investigation',
    'Missing Person',
    'Infidelity Investigation',
    'Corporate Investigation',
    'Insurance Investigation',
    'Other'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (rating === 0) {
      setError('Please select a star rating')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if already reviewed
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('pi_profile_id', pi.id)
        .eq('reviewer_id', user.id)
        .maybeSingle()

      if (existing) {
        setError('You have already reviewed this investigator')
        setLoading(false)
        return
      }

      // Insert review
      const { error: insertError } = await supabase
        .from('reviews')
        .insert({
          pi_profile_id: pi.id,
          reviewer_id: user.id,
          rating: rating,
          review_text: reviewText.trim(),
          case_type: caseType || null,
          consultation_id: consultation?.id || null
        })

      if (insertError) throw insertError

      onSuccess()
    } catch (err) {
      console.error('Error submitting review:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal review-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Review {pi.first_name} {pi.last_name}</h2>
          {pi.company_name && <p className="company-subtitle">{pi.company_name}</p>}
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Star Rating */}
          <div className="form-group">
            <label>Your Rating *</label>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`star ${star <= (hoverRating || rating) ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  ★
                </button>
              ))}
            </div>
            {rating > 0 && (
              <small className="rating-label">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </small>
            )}
          </div>

          {/* Case Type */}
          <div className="form-group">
            <label>Type of Case (optional)</label>
            <select
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
            >
              <option value="">Select case type...</option>
              {caseTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Review Text */}
          <div className="form-group">
            <label>Your Review</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={6}
              placeholder="Share your experience working with this investigator. What did they do well? How was communication? Would you recommend them?"
            />
            <small>{reviewText.length} / 1000 characters</small>
          </div>

          <div className="info-box">
            <p><strong>Review Guidelines:</strong></p>
            <ul>
              <li>Be honest and specific</li>
              <li>Focus on your professional experience</li>
              <li>Avoid personal attacks or offensive language</li>
              <li>Reviews are public and cannot be edited once submitted</li>
            </ul>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || rating === 0}
            >
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
