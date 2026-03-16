import React, { useState } from 'react'

// Wrap any action button with this to block unverified PIs
// Usage: <VerificationGate profile={profile}><button>Apply</button></VerificationGate>
export function VerificationGate({ profile, children, onNavigate }) {
  const [showModal, setShowModal] = useState(false)

  if (profile?.is_verified) return children

  return (
    <>
      <div onClick={() => setShowModal(true)} style={{ display: 'contents', cursor: 'pointer' }}>
        <div style={{ opacity: 0.5, pointerEvents: 'none', display: 'contents' }}>
          {children}
        </div>
      </div>

      {showModal && (
        <div className="vgate-overlay" onClick={() => setShowModal(false)}>
          <div className="vgate-modal" onClick={e => e.stopPropagation()}>
            <div className="vgate-icon">🔒</div>
            <h3>Verification Required</h3>
            <p>
              You need to be a verified PI to use this feature. Your application
              is under review — our team typically verifies credentials within
              <strong> 24–48 hours</strong>.
            </p>
            <div className="vgate-actions">
              {onNavigate && (
                <button
                  className="btn-primary"
                  onClick={() => { setShowModal(false); onNavigate('profile-edit') }}
                >
                  Complete My Profile
                </button>
              )}
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Simple hook to check if a PI can perform gated actions
export function useVerificationCheck(profile) {
  const isVerified = profile?.is_verified === true
  const isPI = profile?.type === 'pi'
  const needsVerification = isPI && !isVerified

  return { isVerified, isPI, needsVerification }
}

// Inline banner shown on pages where unverified PIs land
export function UnverifiedBanner({ profile, onNavigate }) {
  if (!profile || profile.type !== 'pi' || profile.is_verified) return null

  const hasSubmitted = profile.verification_requested_at
  const hasLicense = profile.license_number
  const hasGovId = profile.gov_id_document_path

  const isComplete = hasLicense && hasGovId

  return (
    <div className="unverified-banner">
      <div className="unverified-banner-content">
        <span className="unverified-banner-icon">⏳</span>
        <div className="unverified-banner-text">
          {isComplete ? (
            <>
              <strong>Verification pending</strong> — your credentials are under review.
              You'll be notified within 24–48 hours. Applying to jobs and messaging clients
              will be available once you're verified.
            </>
          ) : (
            <>
              <strong>Complete your verification</strong> — submit your license and ID
              to start applying to jobs and messaging clients.
            </>
          )}
        </div>
        {!isComplete && onNavigate && (
          <button
            className="btn-secondary btn-small"
            onClick={() => onNavigate('profile-edit')}
          >
            Complete Profile
          </button>
        )}
      </div>
    </div>
  )
}
