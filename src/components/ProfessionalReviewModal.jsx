import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ProfessionalReviewModal({ pi, user, referral, onClose, onSuccess }) {
  const [overallRating, setOverallRating] = useState(0)
  const [professionalismRating, setProfessionalismRating] = useState(0)
  const [communicationRating, setCommunicationRating] = useState(0)
  const [expertiseRating, setExpertiseRating] = useState(0)
  const [hoverRating, setHoverRating] = useState({ field: null, value: 0 })
  const [reviewText, setReviewText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (overallRating === 0) {
      setError('Please select an overall star rating')
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
        .eq('review_type', 'professional')
        .maybeSingle()

      if (existing) {
        setError('You have already reviewed this colleague')
        setLoading(false)
        return
      }

      // Insert professional review
      const { error: insertError } = await supabase
        .from('reviews')
        .insert({
          pi_profile_id: pi.id,
          reviewer_id: user.id,
          rating: overallRating,
          professionalism_rating: professionalismRating || null,
          communication_rating: communicationRating || null,
          expertise_rating: expertiseRating || null,
          review_text: reviewText.trim(),
          review_type: 'professional',
          referral_id: referral?.id || null
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

  const renderStarInput = (field, value, setValue, label) => {
    return (
      <div className="form-group">
        <label>{label} {field === 'overall' && '*'}</label>
        <div className="star-rating">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={`star ${star <= (hoverRating.field === field ? hoverRating.value : value) ? 'active' : ''}`}
              onClick={() => setValue(star)}
              onMouseEnter={() => setHoverRating({ field, value: star })}
              onMouseLeave={() => setHoverRating({ field: null, value: 0 })}
            >
              ★
            </button>
          ))}
        </div>
        {value > 0 && field === 'overall' && (
          <small className="rating-label">
            {value === 1 && 'Poor'}
            {value === 2 && 'Fair'}
            {value === 3 && 'Good'}
            {value === 4 && 'Very Good'}
            {value === 5 && 'Excellent'}
          </small>
        )}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal professional-review-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Review Colleague</h2>
          <p>{pi.first_name} {pi.last_name}</p>
          {pi.company_name && <p className="company-subtitle">{pi.company_name}</p>}
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="info-box">
            <p><strong>Professional Review</strong></p>
            <p>Rate your experience working with this investigator. This helps other PIs make informed decisions about referrals and collaborations.</p>
          </div>

          {/* Overall Rating */}
          {renderStarInput('overall', overallRating, setOverallRating, 'Overall Rating')}

          {/* Detailed Ratings */}
          <div className="professional-ratings-grid">
            {renderStarInput('professionalism', professionalismRating, setProfessionalismRating, 'Professionalism (optional)')}
            {renderStarInput('communication', communicationRating, setCommunicationRating, 'Communication (optional)')}
            {renderStarInput('expertise', expertiseRating, setExpertiseRating, 'Expertise (optional)')}
          </div>

          {/* Review Text */}
          <div className="form-group">
            <label>Your Review (optional)</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={6}
              placeholder="Share your experience working with this investigator. What made them a good colleague? Would you refer jobs to them again?"
            />
            <small>{reviewText.length} / 1000 characters</small>
          </div>

          <div className="info-box">
            <p><strong>Professional Review Guidelines:</strong></p>
            <ul>
              <li>Be honest and constructive</li>
              <li>Focus on professional collaboration</li>
              <li>Highlight strengths and areas for improvement</li>
              <li>Reviews help build a trustworthy PI network</li>
              <li>Reviews cannot be edited once submitted</li>
            </ul>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || overallRating === 0}
            >
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
