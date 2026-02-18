import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ProfileEditPage({ user, profile, onNavigate, onProfileUpdate }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    licenseNumber: '',
    yearsExperience: '',
    city: '',
    state: '',
    fullAddress: '',
    specialties: [],
    hourlyRate: '',
    responseTime: '24-48 hours',
    languages: ['English'],
    bio: '',
    profilePhotoUrl: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const specialtyOptions = [
    'Surveillance',
    'Background Investigation',
    'Fraud Investigation',
    'Missing Person',
    'Infidelity Investigation',
    'Corporate Investigation',
    'Insurance Investigation',
    'Skip Tracing',
    'Cyber Investigation',
    'Asset Investigation',
    'Workers Compensation',
    'Domestic Investigation'
  ]

  const responseTimeOptions = [
    'Within 1 hour',
    'Within 2-4 hours',
    '24-48 hours',
    '2-3 days',
    '1 week'
  ]

  useEffect(() => {
    if (profile && profile.type === 'pi') {
      loadProfileData()
    }
  }, [profile])

  const loadProfileData = async () => {
    try {
      setLoading(true)

      // Get PI profile data
      const { data: piProfile, error: piError } = await supabase
        .from('pi_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (piError) throw piError

      // Get user profile data
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (userError) throw userError

      setFormData({
        firstName: piProfile.first_name || '',
        lastName: piProfile.last_name || '',
        email: piProfile.email || user.email || '',
        phone: piProfile.phone || userProfile.phone || '',
        companyName: piProfile.company_name || '',
        licenseNumber: piProfile.license_number || '',
        yearsExperience: piProfile.years_experience || '',
        city: piProfile.city || '',
        state: piProfile.state || '',
        fullAddress: piProfile.full_address || '',
        specialties: piProfile.specialties || [],
        hourlyRate: piProfile.hourly_rate || '',
        responseTime: piProfile.response_time || '24-48 hours',
        languages: piProfile.languages || ['English'],
        bio: piProfile.bio || '',
        profilePhotoUrl: piProfile.profile_photo_url || ''
      })

      if (piProfile.profile_photo_url) {
        setPhotoPreview(piProfile.profile_photo_url)
      }
    } catch (err) {
      console.error('Error loading profile:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSpecialtyToggle = (specialty) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }))
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadPhoto = async () => {
    if (!photoFile) return formData.profilePhotoUrl

    try {
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-photos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('pi-photos')
        .upload(filePath, photoFile)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('pi-photos')
        .getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (err) {
      console.error('Error uploading photo:', err)
      return formData.profilePhotoUrl
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Upload photo if new one selected
      const photoUrl = await uploadPhoto()

      // Update PI profile
      const { error: piError } = await supabase
        .from('pi_profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          company_name: formData.companyName,
          license_number: formData.licenseNumber,
          years_experience: formData.yearsExperience ? parseInt(formData.yearsExperience) : null,
          city: formData.city,
          state: formData.state,
          full_address: formData.fullAddress,
          location: `${formData.city}, ${formData.state}`,
          specialties: formData.specialties,
          hourly_rate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
          response_time: formData.responseTime,
          languages: formData.languages,
          bio: formData.bio,
          profile_photo_url: photoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (piError) throw piError

      // Update user profile
      const { error: userError } = await supabase
        .from('profiles')
        .update({
          full_name: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (userError) throw userError

      setSuccess(true)
      
      // Call parent to refresh profile
      if (onProfileUpdate) {
        onProfileUpdate()
      }

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Auto-hide success after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  if (!user || profile?.type !== 'pi') {
    return (
      <div className="profile-edit-page">
        <div className="empty-state">
          <h2>Profile Editing</h2>
          <p>You need to be signed in as a PI to edit your profile.</p>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            Sign In as PI
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="profile-edit-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-edit-page">
      <div className="page-header">
        <button onClick={() => onNavigate('dashboard')} className="btn-back">
          ← Back to Dashboard
        </button>
        <h1>Edit Profile</h1>
        <p>Update your professional information and settings</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          ✓ Profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-edit-form">
        {/* Profile Photo Section */}
        <div className="form-section">
          <h2>Profile Photo</h2>
          
          <div className="photo-upload-section">
            <div className="photo-preview">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" />
              ) : (
                <div className="photo-placeholder">
                  <span>No Photo</span>
                </div>
              )}
            </div>
            
            <div className="photo-upload-actions">
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="photo-upload" className="btn-secondary">
                Choose Photo
              </label>
              <small>Recommended: Square image, at least 400x400px</small>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="form-section">
          <h2>Personal Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Professional Details */}
        <div className="form-section">
          <h2>Professional Details</h2>

          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({...formData, companyName: e.target.value})}
              placeholder="e.g., Smith Investigations LLC"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>License Number</label>
              <input
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                placeholder="e.g., PI-12345"
              />
            </div>

            <div className="form-group">
              <label>Years of Experience</label>
              <input
                type="number"
                value={formData.yearsExperience}
                onChange={(e) => setFormData({...formData, yearsExperience: e.target.value})}
                min="0"
                max="50"
              />
            </div>
          </div>
        </div>

        {/* Location */}
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
              />
            </div>

            <div className="form-group">
              <label>State *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                required
                maxLength={2}
                placeholder="e.g., FL"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Full Address</label>
            <input
              type="text"
              value={formData.fullAddress}
              onChange={(e) => setFormData({...formData, fullAddress: e.target.value})}
              placeholder="123 Main St, Suite 100"
            />
          </div>
        </div>

        {/* Specialties */}
        <div className="form-section">
          <h2>Specialties</h2>
          <p className="form-hint">Select all investigation types you specialize in</p>

          <div className="specialty-grid">
            {specialtyOptions.map(specialty => (
              <button
                key={specialty}
                type="button"
                className={`specialty-btn ${formData.specialties.includes(specialty) ? 'selected' : ''}`}
                onClick={() => handleSpecialtyToggle(specialty)}
              >
                {specialty}
              </button>
            ))}
          </div>
        </div>

        {/* Rates & Availability */}
        <div className="form-section">
          <h2>Rates & Availability</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Hourly Rate ($)</label>
              <input
                type="number"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({...formData, hourlyRate: e.target.value})}
                min="0"
                step="5"
                placeholder="e.g., 150"
              />
            </div>

            <div className="form-group">
              <label>Typical Response Time</label>
              <select
                value={formData.responseTime}
                onChange={(e) => setFormData({...formData, responseTime: e.target.value})}
              >
                {responseTimeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="form-section">
          <h2>Professional Bio</h2>

          <div className="form-group">
            <label>About You</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              rows={6}
              placeholder="Share your background, expertise, notable cases, and what sets you apart from other investigators..."
            />
            <small>{formData.bio.length} / 1000 characters</small>
          </div>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => onNavigate('dashboard')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-large" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
