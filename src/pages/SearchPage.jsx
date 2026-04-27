import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { INVESTIGATION_TYPES } from '../investigationTypes'
import { US_STATES } from '../usStates'
import ConsultationModal from '../components/ConsultationModal'
import ReviewsList from '../components/ReviewsList'
import { getOrCreateConversation } from '../messagingUtils'
import { getMatchColor, scoreAndSortPIs } from '../matchingAlgorithm'

export default function SearchPage({ user, onNavigate }) {
  const [view, setView] = useState('search') // 'search' | 'results'
  const [searchData, setSearchData] = useState({
    city: '',
    state: '',
    zipCode: '',
    specialties: []
  })
  const [piMatches, setPiMatches] = useState([])
  const [premiumResults, setPremiumResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPI, setSelectedPI] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showConsultationModal, setShowConsultationModal] = useState(false)

  const specialtyOptions = INVESTIGATION_TYPES

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Fetch all verified PIs — let the algorithm handle location filtering/scoring
      // Only filter by state if provided (broad filter to reduce result set)
      let query = supabase
        .from('pi_profiles')
        .select('*')
        .eq('is_verified', true)

      // If state is provided, filter by state to keep results manageable
      // But don't filter by city — let proximity scoring handle that
      if (searchData.state) {
        query = query.ilike('state', `%${searchData.state}%`)
      }

      const { data, error } = await query
      if (error) throw error

      let results = data || []

      // Filter by specialty if selected — exact match first, then partial
      if (searchData.specialties.length > 0) {
        results = results.filter(pi => {
          if (!pi.specialties || pi.specialties.length === 0) return false
          return searchData.specialties.some(specialty =>
            pi.specialties.some(piSpec =>
              piSpec === specialty ||
              piSpec.toLowerCase().includes(specialty.toLowerCase()) ||
              specialty.toLowerCase().includes(piSpec.toLowerCase())
            )
          )
        })
      }

      // Score and sort using async geocoding
      const sortedResults = await scoreAndSortPIs(
        results,
        searchData.city,
        searchData.state,
        searchData.specialties
      )

      setPremiumResults(sortedResults.premium || [])
      setPiMatches(sortedResults.all || [])
      setView('results')
    } catch (error) {
      console.error('Search error:', error)
      alert('Error searching for PIs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSpecialtyToggle = (specialty) => {
    setSearchData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }))
  }

  const handleRequestConsultation = (pi) => {
    if (!user) {
      if (window.confirm('You need to sign in to request a consultation. Sign in now?')) {
        onNavigate('auth')
      }
      return
    }
    setSelectedPI(pi)
    setShowConsultationModal(true)
  }

  const handleViewProfile = (pi) => {
    setSelectedPI(pi)
    setShowProfileModal(true)
  }

  const handleMessagePI = async (pi) => {
    if (!user) {
      if (window.confirm('You need to sign in to message this PI. Sign in now?')) {
        onNavigate('auth')
      }
      return
    }

    try {
      await getOrCreateConversation(user.id, pi.user_id)
      setShowProfileModal(false)
      onNavigate('messages')
    } catch (error) {
      console.error('Error starting conversation:', error)
      alert('Failed to start conversation. Please try again.')
    }
  }

  if (view === 'search') {
    return (
      <div className="search-page">
        <div className="hero">
          <h1>Find Private Investigators</h1>
          <p>Connect with verified investigators across the United States</p>
        </div>

        <div className="search-container">
          <form onSubmit={handleSearch} className="search-form">
            <h2>Where do you need help?</h2>

            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                placeholder="e.g., Miami"
                value={searchData.city}
                onChange={(e) => setSearchData({...searchData, city: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>State</label>
              <select
                value={searchData.state}
                onChange={(e) => setSearchData({...searchData, state: e.target.value})}
              >
                <option value="">All States</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Type of Investigation (select all that apply)</label>
              <div className="specialty-grid">
                {specialtyOptions.map(specialty => (
                  <button
                    key={specialty}
                    type="button"
                    className={`specialty-btn ${searchData.specialties.includes(specialty) ? 'selected' : ''}`}
                    onClick={() => handleSpecialtyToggle(specialty)}
                  >
                    {specialty}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Searching...' : 'Find Investigators'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="results-page">
      <div className="results-header">
        <button onClick={() => setView('search')} className="btn-back">
          ← Back to Search
        </button>
        <h1>Found {piMatches.length} Investigators</h1>
      </div>

      {piMatches.length === 0 ? (
        <div className="no-results">
          <p>No investigators found matching your criteria.</p>
          <button onClick={() => setView('search')} className="btn-primary">
            Try Different Search
          </button>
        </div>
      ) : (
        <>
          {premiumResults.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 16px', background: 'linear-gradient(135deg, #667eea15, #764ba215)', border: '1px solid #667eea30', borderRadius: '10px' }}>
                <span style={{ fontSize: '20px' }}>💎</span>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#667eea' }}>Premium Investigators</h2>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Verified professionals — sorted by proximity and rating</p>
                </div>
              </div>
              <div className="results-grid">
                {premiumResults.map(pi => (
            <div key={pi.id} className="pi-card">
                  <div className="pi-header">
                    <div className="pi-avatar">
                      {pi.profile_photo_url ? (
                        <img src={pi.profile_photo_url} alt={`${pi.first_name} ${pi.last_name}`} />
                      ) : (
                        <div className="pi-initials">
                          {pi.first_name?.[0]}{pi.last_name?.[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3>{pi.first_name} {pi.last_name}</h3>
                        {pi.matchData?.membershipBadge && (
                          <span className="membership-badge" style={{
                            background: pi.matchData.membershipBadge.color + '20',
                            color: pi.matchData.membershipBadge.color,
                            border: `1px solid ${pi.matchData.membershipBadge.color}40`
                          }}>
                            {pi.matchData.membershipBadge.icon} {pi.matchData.membershipBadge.label}
                          </span>
                        )}
                      </div>
                      {pi.company_name && <p className="company">{pi.company_name}</p>}
                      <p className="location">📍 {pi.location || `${pi.city}, ${pi.state}`}</p>
                    </div>
                  </div>

                  {/* AI Match Score */}
                  {pi.matchData && (
                    <div className="match-score-banner" style={{ 
                      backgroundColor: getMatchColor(pi.matchData.score) + '20',
                      borderLeft: `4px solid ${getMatchColor(pi.matchData.score)}`
                    }}>
                      <div className="match-score-main">
                        <span className="match-percentage" style={{ color: getMatchColor(pi.matchData.score) }}>
                          {pi.matchData.score}% Match
                        </span>
                        <span className="match-label">{pi.matchData.recommendation}</span>
                      </div>
                      <div className="match-factors">
                        {pi.matchData.factors.slice(0, 3).map((factor, idx) => (
                          <span key={idx} className="match-factor">
                            {factor.name}: {factor.detail}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pi-stats">
                    <div className="stat">
                      <span className="stat-label">Experience</span>
                      <span className="stat-value">{pi.years_experience || 0} years</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Rating</span>
                      <span className="stat-value">⭐ {pi.rating?.toFixed(1) || 'New'}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Reviews</span>
                      <span className="stat-value">{pi.review_count || 0}</span>
                    </div>
                  </div>

                  {pi.specialties && pi.specialties.length > 0 && (
                    <div className="pi-specialties">
                      {pi.specialties.slice(0, 3).map((spec, idx) => (
                        <span key={idx} className="specialty-tag">{spec}</span>
                      ))}
                      {pi.specialties.length > 3 && (
                        <span className="specialty-tag">+{pi.specialties.length - 3} more</span>
                      )}
                    </div>
                  )}

                  {pi.bio && (
                    <p className="pi-bio">
                      {pi.bio.length > 120 ? `${pi.bio.substring(0, 120)}...` : pi.bio}
                    </p>
                  )}

                  <div className="pi-actions">
                    <button 
                      onClick={() => handleViewProfile(pi)} 
                      className="btn-secondary"
                    >
                      View Profile
                    </button>
                    <button 
                      onClick={() => handleRequestConsultation(pi)}
                      className="btn-primary"
                    >
                      Request Consultation
                    </button>
                  </div>
                </div>
                ))}
              </div>
            </div>
          )}
          {premiumResults.length > 0 && piMatches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', padding: '10px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
              <span style={{ fontSize: '18px' }}>🔍</span>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#374151' }}>All Investigators</h2>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>All verified investigators — sorted by proximity and rating</p>
              </div>
            </div>
          )}
          <div className="results-grid">
            {piMatches.map(pi => (
            <div key={pi.id} className="pi-card">
              <div className="pi-header">
                <div className="pi-avatar">
                  {pi.profile_photo_url ? (
                    <img src={pi.profile_photo_url} alt={`${pi.first_name} ${pi.last_name}`} />
                  ) : (
                    <div className="pi-initials">
                      {pi.first_name?.[0]}{pi.last_name?.[0]}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3>{pi.first_name} {pi.last_name}</h3>
                    {pi.matchData?.membershipBadge && (
                      <span className="membership-badge" style={{
                        background: pi.matchData.membershipBadge.color + '20',
                        color: pi.matchData.membershipBadge.color,
                        border: `1px solid ${pi.matchData.membershipBadge.color}40`
                      }}>
                        {pi.matchData.membershipBadge.icon} {pi.matchData.membershipBadge.label}
                      </span>
                    )}
                  </div>
                  {pi.company_name && <p className="company">{pi.company_name}</p>}
                  <p className="location">📍 {pi.location || `${pi.city}, ${pi.state}`}</p>
                </div>
              </div>

              {/* AI Match Score */}
              {pi.matchData && (
                <div className="match-score-banner" style={{ 
                  backgroundColor: getMatchColor(pi.matchData.score) + '20',
                  borderLeft: `4px solid ${getMatchColor(pi.matchData.score)}`
                }}>
                  <div className="match-score-main">
                    <span className="match-percentage" style={{ color: getMatchColor(pi.matchData.score) }}>
                      {pi.matchData.score}% Match
                    </span>
                    <span className="match-label">{pi.matchData.recommendation}</span>
                  </div>
                  <div className="match-factors">
                    {pi.matchData.factors.slice(0, 3).map((factor, idx) => (
                      <span key={idx} className="match-factor">
                        {factor.name}: {factor.detail}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pi-stats">
                <div className="stat">
                  <span className="stat-label">Experience</span>
                  <span className="stat-value">{pi.years_experience || 0} years</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Rating</span>
                  <span className="stat-value">⭐ {pi.rating?.toFixed(1) || 'New'}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Reviews</span>
                  <span className="stat-value">{pi.review_count || 0}</span>
                </div>
              </div>

              {pi.specialties && pi.specialties.length > 0 && (
                <div className="pi-specialties">
                  {pi.specialties.slice(0, 3).map((spec, idx) => (
                    <span key={idx} className="specialty-tag">{spec}</span>
                  ))}
                  {pi.specialties.length > 3 && (
                    <span className="specialty-tag">+{pi.specialties.length - 3} more</span>
                  )}
                </div>
              )}

              {pi.bio && (
                <p className="pi-bio">
                  {pi.bio.length > 120 ? `${pi.bio.substring(0, 120)}...` : pi.bio}
                </p>
              )}

              <div className="pi-actions">
                <button 
                  onClick={() => handleViewProfile(pi)} 
                  className="btn-secondary"
                >
                  View Profile
                </button>
                <button 
                  onClick={() => handleRequestConsultation(pi)}
                  className="btn-primary"
                >
                  Request Consultation
                </button>
              </div>
            </div>
          ))}
          </div>
        </>
      )}

      {/* Profile Modal */}
      {showProfileModal && selectedPI && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowProfileModal(false)}>×</button>
            
            <div className="modal-header">
              <div className="pi-avatar large">
                {selectedPI.profile_photo_url ? (
                  <img src={selectedPI.profile_photo_url} alt={`${selectedPI.first_name} ${selectedPI.last_name}`} />
                ) : (
                  <div className="pi-initials">
                    {selectedPI.first_name?.[0]}{selectedPI.last_name?.[0]}
                  </div>
                )}
              </div>
              <div>
                <h2>{selectedPI.first_name} {selectedPI.last_name}</h2>
                {selectedPI.company_name && <p className="company">{selectedPI.company_name}</p>}
                <p className="location">📍 {selectedPI.location || `${selectedPI.city}, ${selectedPI.state}`}</p>
              </div>
            </div>

            <div className="modal-body">
              <div className="info-section">
                <h3>About</h3>
                <p>{selectedPI.bio || 'No bio available.'}</p>
              </div>

              <div className="info-section">
                <h3>Professional Details</h3>
                <div className="info-grid">
                  <div>
                    <strong>License:</strong> {selectedPI.license_number || 'Not provided'}
                  </div>
                  <div>
                    <strong>Experience:</strong> {selectedPI.years_experience || 0} years
                  </div>
                  <div>
                    <strong>Response Time:</strong> {selectedPI.response_time}
                  </div>
                  <div>
                    <strong>Languages:</strong> {selectedPI.languages?.join(', ') || 'English'}
                  </div>
                </div>
              </div>

              {selectedPI.specialties && selectedPI.specialties.length > 0 && (
                <div className="info-section">
                  <h3>Specialties</h3>
                  <div className="specialty-list">
                    {selectedPI.specialties.map((spec, idx) => (
                      <span key={idx} className="specialty-tag">{spec}</span>
                    ))}
                  </div>
                </div>
              )}

              <ReviewsList piProfile={selectedPI} />

              <div className="modal-actions">
                <button 
                  className="btn-secondary btn-large"
                  onClick={() => handleMessagePI(selectedPI)}
                >
                  💬 Message This PI
                </button>
                <button 
                  className="btn-primary btn-large"
                  onClick={() => {
                    setShowProfileModal(false)
                    handleRequestConsultation(selectedPI)
                  }}
                >
                  Request Consultation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consultation Modal */}
      {showConsultationModal && selectedPI && (
        <ConsultationModal
          pi={selectedPI}
          user={user}
          onClose={() => {
            setShowConsultationModal(false)
            setSelectedPI(null)
          }}
          onSuccess={() => {
            setShowConsultationModal(false)
            alert('Consultation request sent successfully!')
            onNavigate('dashboard')
          }}
        />
      )}
    </div>
  )
}
