import React, { useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

export default function App() {
  const [view, setView] = useState('search') // 'search' | 'results'
  const [searchData, setSearchData] = useState({
    city: '',
    state: '',
    zipCode: '',
    specialties: []
  })
  const [piMatches, setPiMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPI, setSelectedPI] = useState(null)

  const specialtyOptions = [
    'Surveillance',
    'Background Investigation',
    'Fraud Investigation',
    'Missing Person',
    'Infidelity Investigation',
    'Corporate Investigation',
    'Insurance Investigation'
  ]

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Query pi_profiles for verified PIs
      let query = supabase
        .from('pi_profiles')
        .select('*')
        .eq('is_verified', true)

      // Filter by location if provided
      if (searchData.state) {
        query = query.ilike('state', `%${searchData.state}%`)
      }
      if (searchData.city) {
        query = query.ilike('city', `%${searchData.city}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // Filter by specialties if selected
      let results = data || []
      if (searchData.specialties.length > 0) {
        results = results.filter(pi => {
          if (!pi.specialties) return false
          return searchData.specialties.some(specialty =>
            pi.specialties.some(piSpec =>
              piSpec.toLowerCase().includes(specialty.toLowerCase())
            )
          )
        })
      }

      // Sort by rating
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0))

      setPiMatches(results)
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

  if (view === 'search') {
    return (
      <div className="app">
        <div className="hero">
          <h1>Find Private Investigators</h1>
          <p>Connect with verified investigators in your area</p>
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
              <input
                type="text"
                placeholder="e.g., FL"
                value={searchData.state}
                onChange={(e) => setSearchData({...searchData, state: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>ZIP Code (optional)</label>
              <input
                type="text"
                placeholder="e.g., 33101"
                value={searchData.zipCode}
                onChange={(e) => setSearchData({...searchData, zipCode: e.target.value})}
              />
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
    <div className="app">
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
                  <h3>{pi.first_name} {pi.last_name}</h3>
                  {pi.company_name && <p className="company">{pi.company_name}</p>}
                  <p className="location">📍 {pi.location || `${pi.city}, ${pi.state}`}</p>
                </div>
              </div>

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
                  onClick={() => setSelectedPI(pi)} 
                  className="btn-primary"
                >
                  View Profile
                </button>
                <button className="btn-secondary">
                  Request Consultation
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPI && (
        <div className="modal-overlay" onClick={() => setSelectedPI(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPI(null)}>×</button>
            
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

              <div className="modal-actions">
                <button className="btn-primary btn-large">
                  Request Consultation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
