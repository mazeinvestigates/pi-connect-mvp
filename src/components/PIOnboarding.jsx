import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { US_STATES } from '../usStates'
import { INVESTIGATION_TYPES } from '../investigationTypes'

// Steps: 1=welcome, 2=basic info, 3=credentials, 4=identity verification, 5=specialties+rates, 6=done
export default function PIOnboarding({ user, profile, onComplete, onSkip, onNavigate }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [licenseFile, setLicenseFile] = useState(null)
  const [licenseFileName, setLicenseFileName] = useState('')
  const [govIdFile, setGovIdFile] = useState(null)
  const [govIdFileName, setGovIdFileName] = useState('')
  const [selfieFile, setSelfieFile] = useState(null)
  const [selfieFileName, setSelfieFileName] = useState('')

  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    phone: '',
    companyName: '',
    city: '',
    state: '',
    licenseNumber: '',
    licenseState: '',
    yearsExperience: '',
    specialties: [],
    hourlyRate: '',
    availableForSubcontract: false,
    bio: '',
  })

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const toggleSpecialty = (s) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter(x => x !== s)
        : [...prev.specialties, s]
    }))
  }

  const handleFile = (setter, nameSetter) => (e) => {
    const file = e.target.files[0]
    if (file) { setter(file); nameSetter(file.name) }
  }

  const uploadFile = async (file, folder) => {
    if (!file) return null
    try {
      const ext = file.name.split('.').pop()
      const path = `${folder}/${user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('pi-documents').upload(path, file)
      if (error) throw error
      return path
    } catch (err) {
      console.error('Upload error:', err)
      return null
    }
  }

  const saveStep2 = async () => {
    setSaving(true); setError(null)
    try {
      const { error } = await supabase.from('pi_profiles').update({
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        company_name: formData.companyName,
        city: formData.city,
        state: formData.state,
        location: `${formData.city}, ${formData.state}`,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id)
      if (error) throw error
      await supabase.from('profiles').update({
        full_name: `${formData.firstName} ${formData.lastName}`,
        phone: formData.phone,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id)
      setStep(3)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const saveStep3 = async () => {
    setSaving(true); setError(null)
    try {
      const licensePath = await uploadFile(licenseFile, 'licenses')
      const { error } = await supabase.from('pi_profiles').update({
        license_number: formData.licenseNumber,
        license_state: formData.licenseState,
        years_experience: formData.yearsExperience ? parseInt(formData.yearsExperience) : null,
        license_document_path: licensePath,
        license_submitted_at: licensePath ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id)
      if (error) throw error
      setStep(4)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const saveStep4 = async () => {
    setSaving(true); setError(null)
    try {
      const govIdPath = await uploadFile(govIdFile, 'gov-id')
      const selfiePath = await uploadFile(selfieFile, 'selfies')
      const { error } = await supabase.from('pi_profiles').update({
        gov_id_document_path: govIdPath,
        selfie_document_path: selfiePath,
        gov_id_submitted_at: govIdPath ? new Date().toISOString() : null,
        identity_confirmed: !!selfiePath,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id)
      if (error) throw error
      setStep(5)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const saveStep5 = async () => {
    setSaving(true); setError(null)
    try {
      const { error } = await supabase.from('pi_profiles').update({
        specialties: formData.specialties,
        hourly_rate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
        available_for_subcontract: formData.availableForSubcontract,
        bio: formData.bio,
        onboarding_complete: true,
        verification_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('user_id', user.id)
      if (error) throw error
      setStep(6)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const totalSteps = 5
  const progressPct = step > 1 && step < 6 ? ((step - 1) / totalSteps) * 100 : 0

  const FileUploadField = ({ id, fileName, onChange, label, hint, required = false }) => (
    <div className="form-group">
      <label>{label}{required ? ' *' : ''}</label>
      <div className="file-upload-area">
        <input
          type="file"
          id={id}
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={onChange}
          style={{ display: 'none' }}
        />
        {fileName ? (
          <div className="file-upload-success">
            <span className="file-icon">📄</span>
            <span className="file-name">{fileName}</span>
            <label htmlFor={id} className="file-change-btn">Change</label>
          </div>
        ) : (
          <label htmlFor={id} className="file-upload-label">
            <span className="file-upload-icon">📎</span>
            <span>Click to upload</span>
            <small>PDF, JPG, or PNG — max 10MB</small>
          </label>
        )}
      </div>
      {hint && <small className="form-hint">{hint}</small>}
    </div>
  )

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">

        <div className="onboarding-header">
          <div className="onboarding-logo">PI Connect</div>
          {step > 1 && step < 6 && (
            <div className="onboarding-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="progress-label">Step {step - 1} of {totalSteps}</span>
            </div>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ margin: '0 40px' }}>{error}</div>}

        {/* ── STEP 1: Welcome ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="onboarding-step">
            <div className="onboarding-welcome-icon">🕵️</div>
            <h1>Welcome to PI Connect</h1>
            <p className="onboarding-intro">
              Let's get your profile set up. It takes about 5 minutes — and you can
              explore the platform at any point while your verification is pending.
            </p>

            <div className="onboarding-checklist">
              {[
                ['👤', 'Your Information', 'Name, contact details, and location'],
                ['📋', 'License & Credentials', 'PI license number, issuing state, and license document'],
                ['🔐', 'Identity Verification', 'Government-issued photo ID to confirm you are the license holder'],
                ['🎯', 'Specialties & Rates', 'What you do and what you charge'],
              ].map(([icon, title, desc]) => (
                <div key={title} className="checklist-item">
                  <span className="checklist-icon">{icon}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="onboarding-access-note">
              <strong>While pending verification</strong> you can browse the platform, explore jobs,
              and complete your profile. Applying to jobs, messaging clients, and accepting work
              requires verified status.
            </div>

            <div className="onboarding-actions" style={{ justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: '12px', borderTop: 'none', paddingTop: 0 }}>
              <button className="btn-onboarding-primary" onClick={() => setStep(2)}>
                Get Started →
              </button>
              <button
                className="btn-onboarding-ghost"
                onClick={onSkip}
                onTouchEnd={(e) => { e.preventDefault(); onSkip() }}
                style={{ touchAction: 'manipulation' }}
              >
                Skip for now — explore the platform
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Basic Info ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="onboarding-step">
            <h2>Your Information</h2>
            <p className="onboarding-step-sub">This is what clients and the platform will use to reach you.</p>

            <div className="onboarding-form">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input type="text" value={formData.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Jane" />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input type="text" value={formData.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Smith" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="tel" value={formData.phone} onChange={e => update('phone', e.target.value)} placeholder="(555) 123-4567" />
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input type="text" value={formData.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Smith Investigations LLC" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" value={formData.city} onChange={e => update('city', e.target.value)} placeholder="Miami" />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <select value={formData.state} onChange={e => update('state', e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="onboarding-actions">
              <button className="btn-onboarding-back" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn-onboarding-primary"
                onClick={saveStep2}
                disabled={saving || !formData.firstName || !formData.lastName || !formData.phone || !formData.city || !formData.state}
              >
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: License ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="onboarding-step">
            <h2>License & Credentials</h2>
            <p className="onboarding-step-sub">
              Your license information is reviewed by our admin team only and never
              shared publicly. Uploading your license document speeds up the verification process.
            </p>

            <div className="onboarding-form">
              <div className="form-row">
                <div className="form-group">
                  <label>PI License Number *</label>
                  <input type="text" value={formData.licenseNumber} onChange={e => update('licenseNumber', e.target.value)} placeholder="e.g., PI-12345" />
                </div>
                <div className="form-group">
                  <label>License Issuing State *</label>
                  <select value={formData.licenseState} onChange={e => update('licenseState', e.target.value)}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Years of Experience</label>
                <input type="number" value={formData.yearsExperience} onChange={e => update('yearsExperience', e.target.value)} min="0" max="50" placeholder="e.g., 10" />
              </div>

              <FileUploadField
                id="license-upload"
                fileName={licenseFileName}
                onChange={handleFile(setLicenseFile, setLicenseFileName)}
                label="PI License Document"
                hint="Recommended — upload a photo or scan of your PI license. Speeds up approval."
              />
            </div>

            <div className="onboarding-actions">
              <button className="btn-onboarding-back" onClick={() => setStep(2)}>← Back</button>
              <button
                className="btn-onboarding-primary"
                onClick={saveStep3}
                disabled={saving || !formData.licenseNumber || !formData.licenseState}
              >
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Identity Verification ───────────────────────────── */}
        {step === 4 && (
          <div className="onboarding-step">
            <h2>Identity Verification</h2>
            <p className="onboarding-step-sub">
              To confirm you are the person named on the license, we require a government-issued
              photo ID. This is reviewed only by PI Connect administrators and is never
              shared with clients or other PIs.
            </p>

            <div className="onboarding-form">
              <FileUploadField
                id="gov-id-upload"
                fileName={govIdFileName}
                onChange={handleFile(setGovIdFile, setGovIdFileName)}
                label="Government-Issued Photo ID"
                hint="Driver's license, state ID, or passport. Must show your name and photo. Required."
                required
              />

              <FileUploadField
                id="selfie-upload"
                fileName={selfieFileName}
                onChange={handleFile(setSelfieFile, setSelfieFileName)}
                label="Selfie Holding Your ID"
                hint="Optional but recommended — a photo of you holding your ID next to your face. Standard on most credentialing platforms. Flags your application as identity-confirmed and typically results in faster approval."
              />

              <div className="onboarding-access-note">
                Your documents are encrypted and stored securely. They are reviewed only by
                PI Connect administrators for the purpose of license verification.
              </div>
            </div>

            <div className="onboarding-actions">
              <button className="btn-onboarding-back" onClick={() => setStep(3)}>← Back</button>
              <button
                className="btn-onboarding-primary"
                onClick={saveStep4}
                disabled={saving || !govIdFile}
              >
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Specialties & Rates ─────────────────────────────── */}
        {step === 5 && (
          <div className="onboarding-step">
            <h2>Specialties & Rates</h2>
            <p className="onboarding-step-sub">
              Tell clients what you do and what you charge. You can update this anytime from your profile.
            </p>

            <div className="onboarding-form">
              <div className="form-group">
                <label>Investigation Specialties *</label>
                <p className="form-hint">Select all that apply</p>
                <div className="specialty-grid">
                  {INVESTIGATION_TYPES.map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`specialty-btn ${formData.specialties.includes(s) ? 'selected' : ''}`}
                      onClick={() => toggleSpecialty(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={e => update('hourlyRate', e.target.value)}
                    min="0"
                    step="5"
                    placeholder="e.g., 125"
                  />
                  <small className="form-hint">Leave blank if you prefer to quote per case</small>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginTop: '24px' }}>
                    <input
                      type="checkbox"
                      checked={formData.availableForSubcontract}
                      onChange={e => update('availableForSubcontract', e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px', flexShrink: 0 }}
                    />
                    <span>
                      <strong>Available for Subcontract Work</strong>
                      <br />
                      <small style={{ color: '#6b7280', fontWeight: 'normal' }}>
                        Other PIs can hire you as a field operative. Client info is never shared with you.
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Professional Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={e => update('bio', e.target.value)}
                  rows={5}
                  placeholder="Share your background, expertise, and what sets you apart. Clients read this before deciding who to contact."
                  maxLength={1000}
                />
                <small className="form-hint">{formData.bio.length} / 1000 characters</small>
              </div>
            </div>

            <div className="onboarding-actions">
              <button className="btn-onboarding-back" onClick={() => setStep(4)}>← Back</button>
              <button
                className="btn-onboarding-primary"
                onClick={saveStep5}
                disabled={saving || formData.specialties.length === 0}
              >
                {saving ? 'Saving...' : 'Submit for Verification →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 6: Done ────────────────────────────────────────────── */}
        {step === 6 && (
          <div className="onboarding-step onboarding-done">
            <div className="done-icon">✅</div>
            <h1>Profile Submitted!</h1>
            <p className="onboarding-intro">
              Your profile has been submitted for verification. Our team reviews credentials
              within <strong>24–48 hours</strong>. You'll be notified by email when you're live.
            </p>

            <div className="done-next-steps">
              <h3>While You Wait</h3>
              {[
                ['💼', 'Browse open jobs', 'Get a feel for what cases are being posted in your area'],
                ['✏️', 'Polish your profile', 'Add a photo and refine your bio to stand out once verified'],
                ['🔔', 'Check your email', "We'll notify you the moment your profile goes live"],
              ].map(([icon, title, desc]) => (
                <div key={title} className="checklist-item">
                  <span className="checklist-icon">{icon}</span>
                  <div><strong>{title}</strong><p>{desc}</p></div>
                </div>
              ))}
            </div>

            <div className="done-actions">
              <button className="btn-onboarding-primary" onClick={onComplete}>
                Go to My Dashboard
              </button>
              <button className="btn-onboarding-ghost" onClick={() => onNavigate('jobs')}>
                Browse Open Jobs
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
