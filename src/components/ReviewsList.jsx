import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ReviewsList({ piProfile }) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('client') // 'client' or 'professional'
  const [ratingBreakdown, setRatingBreakdown] = useState({
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0
  })

  useEffect(() => {
    loadReviews()
  }, [piProfile, activeTab])

  const loadReviews = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:reviewer_id (
            profiles (full_name),
            pi_profiles (first_name, last_name, company_name)
          )
        `)
        .eq('pi_profile_id', piProfile.id)
        .eq('review_type', activeTab)
        .order('created_at', { ascending: false })

      if (error) throw error

      setReviews(data || [])

      // Calculate rating breakdown
      const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      data?.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
          breakdown[review.rating]++
        }
      })
      setRatingBreakdown(breakdown)
    } catch (error) {
      console.error('Error loading reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    })
  }

  const renderStars = (rating) => {
    return [...Array(5)].map((_, index) => (
      <span key={index} className={`star ${index < rating ? 'filled' : ''}`}>
        ★
      </span>
    ))
  }

  const totalReviews = reviews.length
  const averageRating = activeTab === 'client' 
    ? (piProfile.rating || 0) 
    : (piProfile.professional_rating || 0)
  const reviewCount = activeTab === 'client'
    ? (piProfile.review_count || 0)
    : (piProfile.professional_review_count || 0)

  if (loading) {
    return (
      <div className="reviews-section">
        <div className="loading-container-small">
          <div className="spinner-small"></div>
          <p>Loading reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="reviews-section">
      <h2>Reviews & Ratings</h2>

      {/* Review Type Tabs */}
      <div className="review-tabs">
        <button
          className={`review-tab ${activeTab === 'client' ? 'active' : ''}`}
          onClick={() => setActiveTab('client')}
        >
          Client Reviews ({piProfile.review_count || 0})
        </button>
        <button
          className={`review-tab ${activeTab === 'professional' ? 'active' : ''}`}
          onClick={() => setActiveTab('professional')}
        >
          Professional Reviews ({piProfile.professional_review_count || 0})
        </button>
      </div>

      {totalReviews === 0 ? (
        <div className="no-reviews">
          <p>No {activeTab} reviews yet</p>
          <small>
            {activeTab === 'client' 
              ? 'Be the first client to review this investigator' 
              : 'Be the first PI to review this colleague'}
          </small>
        </div>
      ) : (
        <>
          {/* Rating Summary */}
          <div className="rating-summary">
            <div className="rating-overview">
              <div className="rating-number">{averageRating.toFixed(1)}</div>
              <div className="rating-stars-large">
                {renderStars(Math.round(averageRating))}
              </div>
              <div className="rating-count">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</div>
            </div>

            <div className="rating-breakdown">
              {[5, 4, 3, 2, 1].map(star => {
                const count = ratingBreakdown[star]
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0

                return (
                  <div key={star} className="rating-bar-row">
                    <span className="rating-label">{star} ★</span>
                    <div className="rating-bar">
                      <div 
                        className="rating-bar-fill" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="rating-count-small">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Review List */}
          <div className="reviews-list">
            {reviews.map(review => {
              const reviewerName = activeTab === 'client'
                ? (review.reviewer?.profiles?.[0]?.full_name || 'Anonymous')
                : (review.reviewer?.pi_profiles?.[0]
                    ? `${review.reviewer.pi_profiles[0].first_name} ${review.reviewer.pi_profiles[0].last_name}${review.reviewer.pi_profiles[0].company_name ? ` (${review.reviewer.pi_profiles[0].company_name})` : ''}`
                    : 'Anonymous PI')

              return (
                <div key={review.id} className="review-card">
                  <div className="review-header">
                    <div>
                      <div className="review-author">{reviewerName}</div>
                      <div className="review-meta">
                        {formatDate(review.created_at)}
                        {review.case_type && (
                          <span className="case-type-badge">{review.case_type}</span>
                        )}
                      </div>
                    </div>
                    <div className="review-rating">
                      {renderStars(review.rating)}
                    </div>
                  </div>

                  {/* Show professional ratings if applicable */}
                  {activeTab === 'professional' && (
                    review.professionalism_rating || review.communication_rating || review.expertise_rating
                  ) && (
                    <div className="professional-ratings-display">
                      {review.professionalism_rating && (
                        <div className="rating-detail">
                          <span>Professionalism:</span> {renderStars(review.professionalism_rating)}
                        </div>
                      )}
                      {review.communication_rating && (
                        <div className="rating-detail">
                          <span>Communication:</span> {renderStars(review.communication_rating)}
                        </div>
                      )}
                      {review.expertise_rating && (
                        <div className="rating-detail">
                          <span>Expertise:</span> {renderStars(review.expertise_rating)}
                        </div>
                      )}
                    </div>
                  )}

                  {review.review_text && (
                    <div className="review-text">
                      {review.review_text}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
