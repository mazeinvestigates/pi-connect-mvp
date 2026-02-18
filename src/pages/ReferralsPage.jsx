import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ReferJobModal from '../components/ReferJobModal'

export default function ReferralsPage({ user, profile, onNavigate }) {
  const [sentReferrals, setSentReferrals] = useState([])
  const [receivedReferrals, setReceivedReferrals] = useState([])
  const [myJobs, setMyJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('received') // 'received' | 'sent'
  const [selectedJob, setSelectedJob] = useState(null)
  const [showReferModal, setShowReferModal] = useState(false)

  useEffect(() => {
    if (user && profile?.type === 'pi') {
      loadReferrals()
      loadMyJobs()
    }
  }, [user, profile])

  const loadReferrals = async () => {
    try {
      setLoading(true)

      // Load referrals sent by this PI
      const { data: sent, error: sentError } = await supabase
        .from('job_referrals')
        .select(`
          *,
          jobs:job_id (*),
          referred_to_pi:referred_to (
            id,
            pi_profiles (first_name, last_name, company_name, location)
          )
        `)
        .eq('referred_by', user.id)
        .order('created_at', { ascending: false })

      if (sentError) throw sentError

      // Load referrals received by this PI
      const { data: received, error: receivedError } = await supabase
        .from('job_referrals')
        .select(`
          *,
          jobs:job_id (*),
          referred_by_pi:referred_by (
            id,
            pi_profiles (first_name, last_name, company_name, location)
          )
        `)
        .eq('referred_to', user.id)
        .order('created_at', { ascending: false })

      if (receivedError) throw receivedError

      setSentReferrals(sent || [])
      setReceivedReferrals(received || [])
    } catch (error) {
      console.error('Error loading referrals:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMyJobs = async () => {
    try {
      // Load jobs this PI has applied to (accepted applications)
      const { data: applications } = await supabase
        .from('job_applications')
        .select('job_id, jobs:job_id (*)')
        .eq('applicant_id', user.id)
        .eq('status', 'accepted')

      const jobs = applications?.map(app => app.jobs).filter(Boolean) || []
      setMyJobs(jobs)
    } catch (error) {
      console.error('Error loading my jobs:', error)
    }
  }

  const handleRespondToReferral = async (referralId, newStatus) => {
    try {
      const { error } = await supabase
        .from('job_referrals')
        .update({
          status: newStatus,
          responded_at: new Date().toISOString()
        })
        .eq('id', referralId)

      if (error) throw error

      loadReferrals()
      
      if (newStatus === 'accepted') {
        alert('Referral accepted! You can now view and apply to this job.')
      }
    } catch (error) {
      console.error('Error responding to referral:', error)
      alert('Failed to update referral. Please try again.')
    }
  }

  const handleReferJob = (job) => {
    setSelectedJob(job)
    setShowReferModal(true)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending', class: 'badge-pending' },
      accepted: { text: 'Accepted', class: 'badge-accepted' },
      declined: { text: 'Declined', class: 'badge-declined' }
    }
    return badges[status] || badges.pending
  }

  if (!user || profile?.type !== 'pi') {
    return (
      <div className="referrals-page">
        <div className="empty-state">
          <h2>PI Referrals</h2>
          <p>You need to be signed in as a PI to access referrals.</p>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            Sign In as PI
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="referrals-page">
      <div className="page-header">
        <div>
          <h1>PI Referrals</h1>
          <p>Collaborate with investigators nationwide</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          Received ({receivedReferrals.filter(r => r.status === 'pending').length})
        </button>
        <button
          className={`tab ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          Sent ({sentReferrals.length})
        </button>
        <button
          className={`tab ${activeTab === 'my-jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-jobs')}
        >
          My Jobs ({myJobs.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading referrals...</p>
        </div>
      ) : (
        <>
          {/* Received Referrals */}
          {activeTab === 'received' && (
            <div className="referrals-section">
              {receivedReferrals.length === 0 ? (
                <div className="empty-state">
                  <p>No referrals received yet.</p>
                  <p className="empty-hint">
                    When other PIs refer jobs to you, they'll appear here.
                  </p>
                </div>
              ) : (
                <div className="referrals-list">
                  {receivedReferrals.map(referral => {
                    const job = referral.jobs
                    const referrer = referral.referred_by_pi?.pi_profiles?.[0]
                    const badge = getStatusBadge(referral.status)

                    return (
                      <div key={referral.id} className="referral-card">
                        <div className="referral-header">
                          <div>
                            <h3>{job?.title}</h3>
                            <p className="referral-from">
                              Referred by {referrer ? `${referrer.first_name} ${referrer.last_name}` : 'Unknown PI'}
                              {referrer?.company_name && ` (${referrer.company_name})`}
                            </p>
                            <p className="referral-date">📅 {formatDate(referral.created_at)}</p>
                          </div>
                          <span className={`status-badge ${badge.class}`}>
                            {badge.text}
                          </span>
                        </div>

                        {referral.message && (
                          <div className="referral-message">
                            <strong>Message from {referrer?.first_name}:</strong>
                            <p>"{referral.message}"</p>
                          </div>
                        )}

                        <div className="job-info-box">
                          <div className="job-info-item">
                            <strong>Location:</strong> {job?.location}
                          </div>
                          <div className="job-info-item">
                            <strong>Budget:</strong> ${job?.budget_min?.toLocaleString()} - ${job?.budget_max?.toLocaleString()}
                          </div>
                          <div className="job-info-item">
                            <strong>Type:</strong> {job?.investigation_type}
                          </div>
                        </div>

                        {referral.status === 'pending' && (
                          <div className="referral-actions">
                            <button
                              onClick={() => handleRespondToReferral(referral.id, 'accepted')}
                              className="btn-success"
                            >
                              ✓ Accept Referral
                            </button>
                            <button
                              onClick={() => handleRespondToReferral(referral.id, 'declined')}
                              className="btn-danger"
                            >
                              × Decline
                            </button>
                          </div>
                        )}

                        {referral.status === 'accepted' && (
                          <div className="referral-info">
                            <p>✓ You accepted this referral on {formatDate(referral.responded_at)}</p>
                            <button
                              onClick={() => onNavigate('jobs')}
                              className="btn-primary-small"
                            >
                              View Job & Apply
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sent Referrals */}
          {activeTab === 'sent' && (
            <div className="referrals-section">
              {sentReferrals.length === 0 ? (
                <div className="empty-state">
                  <p>You haven't sent any referrals yet.</p>
                  <p className="empty-hint">
                    When you have jobs you can't take, refer them to other PIs in your network.
                  </p>
                </div>
              ) : (
                <div className="referrals-list">
                  {sentReferrals.map(referral => {
                    const job = referral.jobs
                    const referredPI = referral.referred_to_pi?.pi_profiles?.[0]
                    const badge = getStatusBadge(referral.status)

                    return (
                      <div key={referral.id} className="referral-card">
                        <div className="referral-header">
                          <div>
                            <h3>{job?.title}</h3>
                            <p className="referral-to">
                              Referred to {referredPI ? `${referredPI.first_name} ${referredPI.last_name}` : 'Unknown PI'}
                              {referredPI?.company_name && ` (${referredPI.company_name})`}
                            </p>
                            <p className="referral-date">📅 {formatDate(referral.created_at)}</p>
                          </div>
                          <span className={`status-badge ${badge.class}`}>
                            {badge.text}
                          </span>
                        </div>

                        <div className="job-info-box">
                          <div className="job-info-item">
                            <strong>Location:</strong> {job?.location}
                          </div>
                          <div className="job-info-item">
                            <strong>Budget:</strong> ${job?.budget_min?.toLocaleString()} - ${job?.budget_max?.toLocaleString()}
                          </div>
                        </div>

                        {referral.status === 'pending' && (
                          <p className="referral-status-info">Waiting for {referredPI?.first_name} to respond...</p>
                        )}

                        {referral.status === 'accepted' && (
                          <p className="referral-status-info success">
                            ✓ {referredPI?.first_name} accepted on {formatDate(referral.responded_at)}
                          </p>
                        )}

                        {referral.status === 'declined' && (
                          <p className="referral-status-info declined">
                            {referredPI?.first_name} declined this referral
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* My Jobs (to refer from) */}
          {activeTab === 'my-jobs' && (
            <div className="referrals-section">
              {myJobs.length === 0 ? (
                <div className="empty-state">
                  <p>You don't have any active jobs yet.</p>
                  <p className="empty-hint">
                    Once you're accepted for jobs, you can refer them to other PIs here.
                  </p>
                  <button onClick={() => onNavigate('jobs')} className="btn-primary">
                    Browse Jobs
                  </button>
                </div>
              ) : (
                <div className="jobs-list">
                  {myJobs.map(job => (
                    <div key={job.id} className="job-refer-card">
                      <h3>{job.title}</h3>
                      <p className="job-location">📍 {job.location}</p>
                      <p className="job-budget">
                        💰 ${job.budget_min?.toLocaleString()} - ${job.budget_max?.toLocaleString()}
                      </p>
                      <button
                        onClick={() => handleReferJob(job)}
                        className="btn-primary"
                      >
                        Refer to Another PI
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Refer Job Modal */}
      {showReferModal && selectedJob && (
        <ReferJobModal
          job={selectedJob}
          currentUser={user}
          onClose={() => {
            setShowReferModal(false)
            setSelectedJob(null)
          }}
          onSuccess={() => {
            setShowReferModal(false)
            setSelectedJob(null)
            loadReferrals()
            alert('Referral sent successfully!')
          }}
        />
      )}
    </div>
  )
}
