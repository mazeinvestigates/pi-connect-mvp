import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { ensureReferralCode, getReferralLink } from '../referralUtils'
import { INVESTIGATION_TYPES } from '../investigationTypes'
import { US_STATES } from '../usStates'

function ReferralSection({ userId, firstName, lastName }) {
  const [code, setCode] = React.useState(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (userId) {
      import('../referralUtils').then(({ ensureReferralCode, getReferralLink }) => {
        ensureReferralCode(userId, firstName, lastName).then(c => setCode(c))
      })
    }
  }, [userId])

  const link = code ? getReferralLink(code) : null

  const copyLink = () => {
    if (link) {
      navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!code) return <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading...</p>

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '14px 16px' }}>
      <p style={{ fontSize: '13px', margin: '0 0 10px', color: '#166534' }}>
        Refer other PIs to PI Connect and earn a free month when they subscribe.
      </p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
        <code style={{ background: 'white', border: '1px solid #86efac', borderRadius: '4px', padding: '4px 10px', fontSize: '16px', fontWeight: '700', letterSpacing: '2px', color: '#166534' }}>{code}</code>
        <button onClick={copyCode} style={{ fontSize: '12px', padding: '4px 10px', background: 'white', border: '1px solid #86efac', borderRadius: '4px', cursor: 'pointer', color: '#166534' }}>
          {copied ? '✓ Copied' : 'Copy Code'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-all' }}>{link}</span>
        <button onClick={copyLink} style={{ fontSize: '12px', padding: '4px 10px', background: '#667eea', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', flexShrink: 0 }}>
          {copied ? '✓ Copied' : 'Copy Link'}
        </button>
      </div>
    </div>
  )
}

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
    availableForSubcontract: false,
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

  // Verification document state
  const [licenseFile, setLicenseFile] = useState(null)
  const [licenseFileName, setLicenseFileName] = useState('')
  const [govIdFile, setGovIdFile] = useState(null)
  const [govIdFileName, setGovIdFileName] = useState('')
  const [selfieFile, setSelfieFile] = useState(null)
  const [selfieFileName, setSelfieFileName] = useState('')
  const [existingDocs, setExistingDocs] = useState({
    licenseDocPath: null,
    govIdPath: null,
    selfiePath: null,
    isVerified: false,
    verificationRequestedAt: null
  })
  const [uploadingDocs, setUploadingDocs] = useState(false)
  const [docSuccess, setDocSuccess] = useState(false)

  const specialtyOptions = INVESTIGATION_TYPES

  const responseTimeOptions = [
    'Within 1 hour',
    'Within 2-4 hours',
    '24-48 hours',
    '2-3 days',
    '1 week'
  ]

  // Only load form data on initial mount — not on every profile prop change
  // Profile prop changes (e.g. token refresh) should not reset the form
  const hasLoadedRef = React.useRef(false)
  useEffect(() => {
    if (profile && profile.type === 'pi' && !hasLoadedRef.current) {
      hasLoadedRef.current = true
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
        availableForSubcontract: piProfile.available_for_subcontract || false,
        responseTime: piProfile.response_time || '24-48 hours',
        languages: piProfile.languages || ['English'],
        bio: piProfile.bio || '',
        profilePhotoUrl: piProfile.profile_photo_url || '',
        notificationRadius: piProfile.notification_radius_miles || 100,
        serviceRadius: piProfile.service_radius_miles || piProfile.notification_radius_miles || 100
      })

      if (piProfile.profile_photo_url) {
        setPhotoPreview(piProfile.profile_photo_url)
      }

      // Load existing verification document paths
      setExistingDocs({
        licenseDocPath: piProfile.license_document_path || null,
        govIdPath: piProfile.gov_id_document_path || null,
        selfiePath: piProfile.selfie_document_path || null,
        isVerified: piProfile.is_verified || false,
        verificationRequestedAt: piProfile.verification_requested_at || null
      })
    } catch (err) {
      console.error('Error loading profile:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const uploadVerificationDoc = async (file, folder) => {
    if (!file) return null
    try {
      const ext = file.name.split('.').pop()
      const path = `${folder}/${user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('pi-documents').upload(path, file, { upsert: true })
      if (error) throw error
      return path
    } catch (err) {
      console.error('Doc upload error:', err)
      return null
    }
  }

  const handleDocumentSubmit = async (e) => {
    e.preventDefault()
    setUploadingDocs(true)
    setError(null)
    setDocSuccess(false)

    try {
      const updates = {}

      if (licenseFile) {
        const path = await uploadVerificationDoc(licenseFile, 'licenses')
        if (path) { updates.license_document_path = path; updates.license_submitted_at = new Date().toISOString() }
      }
      if (govIdFile) {
        const path = await uploadVerificationDoc(govIdFile, 'gov-id')
        if (path) { updates.gov_id_document_path = path; updates.gov_id_submitted_at = new Date().toISOString() }
      }
      if (selfieFile) {
        const path = await uploadVerificationDoc(selfieFile, 'selfies')
        if (path) { updates.selfie_document_path = path; updates.identity_confirmed = true }
      }

      if (Object.keys(updates).length > 0) {
        // Mark as requesting verification if not already verified
        if (!existingDocs.isVerified) {
          updates.verification_requested_at = new Date().toISOString()
        }
        updates.updated_at = new Date().toISOString()

        const { error } = await supabase
          .from('pi_profiles')
          .update(updates)
          .eq('user_id', user.id)

        if (error) throw error

        // Refresh existing docs display
        setExistingDocs(prev => ({
          ...prev,
          licenseDocPath: updates.license_document_path || prev.licenseDocPath,
          govIdPath: updates.gov_id_document_path || prev.govIdPath,
          selfiePath: updates.selfie_document_path || prev.selfiePath,
        }))

        setLicenseFile(null); setLicenseFileName('')
        setGovIdFile(null); setGovIdFileName('')
        setSelfieFile(null); setSelfieFileName('')
        setDocSuccess(true)
        setTimeout(() => setDocSuccess(false), 3000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingDocs(false)
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
          available_for_subcontract: formData.availableForSubcontract,
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

  if (!user) {
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

  // Wait for profile to load before checking type
  if (!profile) {
    return (
      <div className="profile-edit-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (profile.type !== 'pi') {
    return (
      <div className="profile-edit-page">
        <div className="empty-state">
          <h2>Profile Editing</h2>
          <p>Profile editing is only available for PI accounts.</p>
          <button onClick={() => onNavigate('dashboard')} className="btn-primary">
            Back to Dashboard
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

        {/* Subscription */}
        <div className="form-section">
          <h2>Subscription Plan</h2>
          {profile?.subscription_status === 'active' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px' }}>
                <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                  ✓ {profile.membership_tier?.charAt(0).toUpperCase() + profile.membership_tier?.slice(1)} Plan
                  {' '}({profile.subscription_interval === 'year' ? 'Annual' : 'Monthly'} billing)
                </p>
                {profile.current_period_end && (
                  <p style={{ fontSize: '13px', color: '#374151' }}>
                    {profile.cancel_at_period_end
                      ? `Cancelled — access until ${new Date(profile.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : `Renews ${new Date(profile.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn-secondary"
                  onClick={() => onNavigate('subscription')}
                  style={{ fontSize: '13px' }}>
                  Change Plan
                </button>
                {!profile.cancel_at_period_end && (
                  <button type="button"
                    style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: '#dc2626' }}
                    onClick={() => onNavigate('subscription')}>
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                {profile?.membership_tier && profile.membership_tier !== 'standard'
                  ? `You\'re on the ${profile.membership_tier} tier.`
                  : "You're on the free tier. Upgrade for better search placement."}
              </p>
              <button type="button" className="btn-primary"
                onClick={() => onNavigate('subscription')}
                style={{ width: 'fit-content', fontSize: '13px' }}>
                View Plans
              </button>
            </div>
          )}
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
              <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.availableForSubcontract}
                  onChange={(e) => setFormData({...formData, availableForSubcontract: e.target.checked})}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span>
                  <strong>Available for Subcontract Work</strong>
                  <br />
                  <small style={{ color: '#6b7280', fontWeight: 'normal' }}>
                    Other PIs can find you as a field operative for jobs in your area. Client info is never shared with you — you work through the primary PI.
                  </small>
                </span>
              </label>
            </div>

            <div className="form-group">
              <label>Service Radius</label>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                How far are you willing to travel for a job? This controls which client searches you appear in.
              </p>
              <input type="range" min="0" max="5" step="1"
                value={[25, 50, 100, 250, 500, -1].indexOf(formData.serviceRadius) !== -1
                  ? [25, 50, 100, 250, 500, -1].indexOf(formData.serviceRadius)
                  : 2}
                onChange={e => {
                  const values = [25, 50, 100, 250, 500, -1]
                  setFormData({...formData, serviceRadius: values[parseInt(e.target.value)]})
                }}
                style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                <span>25mi</span><span>50mi</span><span>100mi</span><span>250mi</span><span>500mi</span><span>Nationwide</span>
              </div>
              <p style={{ fontSize: '13px', color: '#374151', marginTop: '6px' }}>
                {formData.serviceRadius === -1
                  ? 'Nationwide — you will appear in searches across the US'
                  : `${formData.serviceRadius} miles from your location`}
              </p>
            </div>

            <div className="form-group">
              <label>Job Match Notification Radius</label>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                How far away do you want to be emailed about new jobs?
              </p>
              <div style={{ padding: '8px 0' }}>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={[25, 50, 100, 250, 500, -1].indexOf(formData.notificationRadius) !== -1
                    ? [25, 50, 100, 250, 500, -1].indexOf(formData.notificationRadius)
                    : 2}
                  onChange={(e) => {
                    const values = [25, 50, 100, 250, 500, -1]
                    setFormData({...formData, notificationRadius: values[parseInt(e.target.value)]})
                  }}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  <span>25mi</span><span>50mi</span><span>100mi</span><span>250mi</span><span>500mi</span><span>Nationwide</span>
                </div>
              </div>
              <p style={{ fontSize: '13px', color: '#374151', marginTop: '6px' }}>
                {formData.notificationRadius === -1
                  ? 'Nationwide — you will receive job match emails for all jobs in the US'
                  : `You will receive job match emails for jobs within ${formData.notificationRadius} miles of ${formData.city || 'your location'}`}
              </p>
            </div>

            <div className="form-group">
              <label>Your Referral Code</label>
              <ReferralSection userId={formData.userId || user?.id} firstName={formData.firstName} lastName={formData.lastName} />
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

        {/* Verification Documents */}
        {profile?.type === 'pi' && (
          <div className="form-section verification-docs-section">
            <h2>Verification Documents</h2>

            {existingDocs.isVerified ? (
              <div className="verification-status-badge verified">
                ✅ Your profile is verified. Documents have been reviewed and deleted per our privacy policy.
              </div>
            ) : existingDocs.verificationRequestedAt ? (
              <div className="verification-status-badge pending">
                ⏳ Verification pending — your documents are under review. You'll be notified within 24–48 hours.
              </div>
            ) : (
              <div className="verification-status-badge unverified">
                ⚠️ Not yet verified. Upload your documents below to submit for verification.
              </div>
            )}

            {!existingDocs.isVerified && (
              <form onSubmit={handleDocumentSubmit} className="doc-upload-form">

                {docSuccess && (
                  <div className="alert alert-success">✓ Documents uploaded and submitted for review.</div>
                )}

                {/* Existing doc status */}
                <div className="existing-docs-status">
                  <div className={`doc-status-item ${existingDocs.licenseDocPath ? 'doc-on-file' : 'doc-missing'}`}>
                    📋 PI License Document: {existingDocs.licenseDocPath ? 'On file' : 'Not submitted'}
                  </div>
                  <div className={`doc-status-item ${existingDocs.govIdPath ? 'doc-on-file' : 'doc-missing'}`}>
                    🪪 Government-Issued Photo ID: {existingDocs.govIdPath ? 'On file' : 'Not submitted'}
                  </div>
                  <div className={`doc-status-item ${existingDocs.selfiePath ? 'doc-on-file' : 'doc-optional'}`}>
                    🤳 Selfie with ID: {existingDocs.selfiePath ? 'On file' : 'Not submitted (optional)'}
                  </div>
                </div>

                <div className="doc-upload-group">
                  <div className="form-group">
                    <label>PI License Document {existingDocs.licenseDocPath ? '(replace)' : ''}</label>
                    <div className="file-upload-area">
                      <input type="file" id="profile-license-upload" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => { const f = e.target.files[0]; if(f){ setLicenseFile(f); setLicenseFileName(f.name) }}}
                        style={{ display: 'none' }} />
                      {licenseFileName ? (
                        <div className="file-upload-success">
                          <span className="file-icon">📄</span>
                          <span className="file-name">{licenseFileName}</span>
                          <label htmlFor="profile-license-upload" className="file-change-btn">Change</label>
                        </div>
                      ) : (
                        <label htmlFor="profile-license-upload" className="file-upload-label">
                          <span className="file-upload-icon">📎</span>
                          <span>Upload PI License</span>
                          <small>PDF, JPG, or PNG</small>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Government-Issued Photo ID * {existingDocs.govIdPath ? '(replace)' : ''}</label>
                    <div className="file-upload-area">
                      <input type="file" id="profile-govid-upload" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => { const f = e.target.files[0]; if(f){ setGovIdFile(f); setGovIdFileName(f.name) }}}
                        style={{ display: 'none' }} />
                      {govIdFileName ? (
                        <div className="file-upload-success">
                          <span className="file-icon">📄</span>
                          <span className="file-name">{govIdFileName}</span>
                          <label htmlFor="profile-govid-upload" className="file-change-btn">Change</label>
                        </div>
                      ) : (
                        <label htmlFor="profile-govid-upload" className="file-upload-label">
                          <span className="file-upload-icon">📎</span>
                          <span>Upload Gov ID</span>
                          <small>Driver's license, state ID, or passport</small>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Selfie Holding Your ID {existingDocs.selfiePath ? '(replace)' : '(optional)'}</label>
                    <div className="file-upload-area">
                      <input type="file" id="profile-selfie-upload" accept=".jpg,.jpeg,.png"
                        onChange={e => { const f = e.target.files[0]; if(f){ setSelfieFile(f); setSelfieFileName(f.name) }}}
                        style={{ display: 'none' }} />
                      {selfieFileName ? (
                        <div className="file-upload-success">
                          <span className="file-icon">📄</span>
                          <span className="file-name">{selfieFileName}</span>
                          <label htmlFor="profile-selfie-upload" className="file-change-btn">Change</label>
                        </div>
                      ) : (
                        <label htmlFor="profile-selfie-upload" className="file-upload-label">
                          <span className="file-upload-icon">📎</span>
                          <span>Upload Selfie with ID</span>
                          <small>Speeds up approval — standard on credentialing platforms</small>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="doc-privacy-note">
                  🔒 Your documents are stored securely and reviewed only by PI Connect administrators.
                  All verification documents are deleted from our systems upon approval and are not retained thereafter.
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={uploadingDocs || (!licenseFile && !govIdFile && !selfieFile)}
                >
                  {uploadingDocs ? 'Uploading...' : 'Submit Documents for Verification'}
                </button>
              </form>
            )}
          </div>
        )}

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
