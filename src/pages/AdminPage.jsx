import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminPage({ user, profile, onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [pendingPIs, setPendingPIs] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [flaggedReviews, setFlaggedReviews] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [rejectionNotes, setRejectionNotes] = useState({}) // { [piId]: string }
  const [verifying, setVerifying] = useState(null)
  const [expandedPI, setExpandedPI] = useState(null)

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAdminData()
    }
  }, [profile, activeTab])

  const loadAdminData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadStats(),
        activeTab === 'pi-verification' && loadPendingPIs(),
        activeTab === 'users' && loadAllUsers(),
        activeTab === 'reviews' && loadFlaggedReviews(),
        activeTab === 'activity' && loadRecentActivity()
      ])
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Get total PIs
      const { count: totalPIs } = await supabase
        .from('pi_profiles')
        .select('*', { count: 'exact', head: true })

      // Get verified PIs
      const { count: verifiedPIs } = await supabase
        .from('pi_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', true)

      // Get pending PIs
      const { count: pendingPIs } = await supabase
        .from('pi_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', false)

      // Get total jobs
      const { count: totalJobs } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })

      // Get total consultations
      const { count: totalConsultations } = await supabase
        .from('consultation_requests')
        .select('*', { count: 'exact', head: true })

      // Get total reviews
      const { count: totalReviews } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalUsers,
        totalPIs,
        verifiedPIs,
        pendingPIs,
        totalJobs,
        totalConsultations,
        totalReviews
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadPendingPIs = async () => {
    try {
      const { data, error } = await supabase
        .from('pi_profiles')
        .select('*')
        .eq('is_verified', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingPIs(data || [])
    } catch (error) {
      console.error('Error loading pending PIs:', error)
    }
  }

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          pi_profiles (*)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setAllUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadFlaggedReviews = async () => {
    // For now, just show all reviews. In production, you'd have a "flagged" column
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          pi_profile:pi_profile_id (first_name, last_name),
          reviewer:reviewer_id (
            profiles (full_name),
            pi_profiles (first_name, last_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setFlaggedReviews(data || [])
    } catch (error) {
      console.error('Error loading reviews:', error)
    }
  }

  const loadRecentActivity = async () => {
    try {
      // Get recent signups
      const { data: signups } = await supabase
        .from('profiles')
        .select('user_id, full_name, created_at, role')
        .order('created_at', { ascending: false })
        .limit(10)

      // Get recent jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      // Combine and sort
      const combined = [
        ...(signups || []).map(s => ({ type: 'signup', ...s })),
        ...(jobs || []).map(j => ({ type: 'job', ...j }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      setRecentActivity(combined.slice(0, 20))
    } catch (error) {
      console.error('Error loading activity:', error)
    }
  }

  const getDocumentUrl = (path) => {
    if (!path) return null
    const { data } = supabase.storage.from('pi-documents').getPublicUrl(path)
    return data?.publicUrl || null
  }

  const getSignedDocumentUrl = async (path) => {
    if (!path) return null
    const { data, error } = await supabase.storage
      .from('pi-documents')
      .createSignedUrl(path, 3600) // 1 hour expiry
    return error ? null : data?.signedUrl
  }

  const handleViewDocument = async (path) => {
    const url = await getSignedDocumentUrl(path)
    if (url) window.open(url, '_blank')
    else alert('Could not load document. Please try again.')
  }

  const handleVerifyPI = async (piId, verified) => {
    setVerifying(piId)
    try {
      const notes = rejectionNotes[piId] || ''

      const updateData = {
        is_verified: verified,
        verified_at: verified ? new Date().toISOString() : null,
        rejection_notes: verified ? null : notes,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('pi_profiles')
        .update(updateData)
        .eq('id', piId)

      if (error) throw error

      await supabase.rpc('log_admin_action', {
        p_action_type: verified ? 'verify_pi' : 'reject_pi',
        p_target_type: 'pi_profile',
        p_target_id: piId,
        p_notes: verified ? 'Approved' : notes
      })

      // Get PI email for notification
      const pi = pendingPIs.find(p => p.id === piId)
      if (pi?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: pi.email,
            type: verified ? 'pi_verified' : 'pi_rejected',
            data: {
              recipientName: pi.first_name,
              notes: notes || null
            }
          }
        })
      }

      // Clear rejection notes for this PI
      setRejectionNotes(prev => { const n = {...prev}; delete n[piId]; return n })
      setExpandedPI(null)
      loadPendingPIs()
      loadStats()
    } catch (error) {
      console.error('Error verifying PI:', error)
      alert('Failed to update PI verification')
    } finally {
      setVerifying(null)
    }
  }

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review? This cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)

      if (error) throw error

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'delete_review',
        p_target_type: 'review',
        p_target_id: reviewId
      })

      alert('Review deleted successfully')
      loadFlaggedReviews()
    } catch (error) {
      console.error('Error deleting review:', error)
      alert('Failed to delete review')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Check if user is admin
  if (!user || profile?.role !== 'admin') {
    return (
      <div className="admin-page">
        <div className="empty-state">
          <h2>⛔ Access Denied</h2>
          <p>You need administrator privileges to access this page.</p>
          <button onClick={() => onNavigate('dashboard')} className="btn-primary">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🛡️ Admin Console</h1>
        <p>Platform Management & Analytics</p>
      </div>

      {/* Admin Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`admin-tab ${activeTab === 'pi-verification' ? 'active' : ''}`}
          onClick={() => setActiveTab('pi-verification')}
        >
          PI Verification ({stats.pendingPIs || 0})
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`admin-tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
        </button>
        <button
          className={`admin-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading admin data...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="admin-content">
              <h2>Platform Statistics</h2>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{stats.totalUsers || 0}</div>
                  <div className="stat-label">Total Users</div>
                </div>

                <div className="stat-card">
                  <div className="stat-number">{stats.totalPIs || 0}</div>
                  <div className="stat-label">Total PIs</div>
                </div>

                <div className="stat-card">
                  <div className="stat-number">{stats.verifiedPIs || 0}</div>
                  <div className="stat-label">Verified PIs</div>
                </div>

                <div className="stat-card alert-card">
                  <div className="stat-number">{stats.pendingPIs || 0}</div>
                  <div className="stat-label">Pending Verification</div>
                </div>

                <div className="stat-card">
                  <div className="stat-number">{stats.totalJobs || 0}</div>
                  <div className="stat-label">Jobs Posted</div>
                </div>

                <div className="stat-card">
                  <div className="stat-number">{stats.totalConsultations || 0}</div>
                  <div className="stat-label">Consultations</div>
                </div>

                <div className="stat-card">
                  <div className="stat-number">{stats.totalReviews || 0}</div>
                  <div className="stat-label">Total Reviews</div>
                </div>

                <div className="stat-card">
                  <div className="stat-number">
                    {((stats.verifiedPIs / stats.totalPIs) * 100).toFixed(0)}%
                  </div>
                  <div className="stat-label">Verification Rate</div>
                </div>
              </div>
            </div>
          )}

          {/* PI Verification Tab */}
          {activeTab === 'pi-verification' && (
            <div className="admin-content">
              <h2>Pending PI Verifications</h2>
              <p className="admin-section-sub">
                Review each PI's credentials before approving. Check license number against your state's public PI database, review submitted documents, and confirm identity matches.
              </p>

              {pendingPIs.length === 0 ? (
                <div className="empty-state">
                  <p>No pending verifications — you're all caught up.</p>
                </div>
              ) : (
                <div className="admin-list">
                  {pendingPIs.map(pi => (
                    <div key={pi.id} className={`admin-card ${expandedPI === pi.id ? 'admin-card-expanded' : ''}`}>

                      {/* Card Header */}
                      <div className="admin-card-header" onClick={() => setExpandedPI(expandedPI === pi.id ? null : pi.id)} style={{ cursor: 'pointer' }}>
                        <div className="admin-card-title">
                          <div>
                            <h3>{pi.first_name} {pi.last_name}</h3>
                            {pi.company_name && <p className="admin-company">{pi.company_name}</p>}
                            <p className="admin-meta">
                              📍 {pi.city}, {pi.state} &nbsp;•&nbsp;
                              📅 Submitted {formatDate(pi.verification_requested_at || pi.created_at)}
                            </p>
                          </div>
                          <div className="admin-card-badges">
                            {pi.license_number && <span className="doc-badge doc-badge-green">🪪 License</span>}
                            {pi.license_document_path && <span className="doc-badge doc-badge-green">📄 PI License Doc</span>}
                            {pi.gov_id_document_path && <span className="doc-badge doc-badge-green">🪪 Gov ID</span>}
                            {pi.selfie_document_path && <span className="doc-badge doc-badge-blue">🤳 Selfie</span>}
                            {!pi.gov_id_document_path && <span className="doc-badge doc-badge-red">⚠️ No Gov ID</span>}
                            {pi.identity_confirmed && <span className="doc-badge doc-badge-blue">✅ Identity Confirmed</span>}
                          </div>
                        </div>
                        <span className="admin-expand-icon">{expandedPI === pi.id ? '▲' : '▼'}</span>
                      </div>

                      {/* Expanded Detail */}
                      {expandedPI === pi.id && (
                        <div className="admin-card-body">

                          {/* Credentials */}
                          <div className="admin-detail-section">
                            <h4>License & Credentials</h4>
                            <div className="admin-detail-grid">
                              <div className="info-row"><strong>License Number:</strong> {pi.license_number || <span className="missing">Not provided</span>}</div>
                              <div className="info-row"><strong>License State:</strong> {pi.license_state || pi.state || <span className="missing">Not provided</span>}</div>
                              <div className="info-row"><strong>Years Experience:</strong> {pi.years_experience || 0}</div>
                              <div className="info-row"><strong>Specialties:</strong> {pi.specialties?.join(', ') || <span className="missing">None selected</span>}</div>
                            </div>
                            {pi.license_number && pi.license_state && (
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(`${pi.license_state} PI license lookup ${pi.license_number}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-admin-link"
                              >
                                🔍 Look up license in {pi.license_state} database
                              </a>
                            )}
                          </div>

                          {/* Contact */}
                          <div className="admin-detail-section">
                            <h4>Contact Information</h4>
                            <div className="admin-detail-grid">
                              <div className="info-row"><strong>Email:</strong> {pi.email}</div>
                              <div className="info-row"><strong>Phone:</strong> {pi.phone || <span className="missing">Not provided</span>}</div>
                              <div className="info-row"><strong>Location:</strong> {pi.city}, {pi.state}</div>
                              <div className="info-row"><strong>Hourly Rate:</strong> {pi.hourly_rate ? `$${pi.hourly_rate}/hr` : <span className="missing">Not set</span>}</div>
                            </div>
                          </div>

                          {/* Documents */}
                          <div className="admin-detail-section">
                            <h4>Submitted Documents</h4>
                            <div className="admin-docs-grid">
                              <div className={`admin-doc-item ${pi.license_document_path ? 'doc-present' : 'doc-missing'}`}>
                                <div className="doc-item-label">PI License Document</div>
                                {pi.license_document_path ? (
                                  <button className="btn-view-doc" onClick={() => handleViewDocument(pi.license_document_path)}>
                                    View Document →
                                  </button>
                                ) : (
                                  <span className="doc-not-submitted">Not submitted</span>
                                )}
                              </div>

                              <div className={`admin-doc-item ${pi.gov_id_document_path ? 'doc-present' : 'doc-missing'}`}>
                                <div className="doc-item-label">Government-Issued Photo ID</div>
                                {pi.gov_id_document_path ? (
                                  <button className="btn-view-doc" onClick={() => handleViewDocument(pi.gov_id_document_path)}>
                                    View Document →
                                  </button>
                                ) : (
                                  <span className="doc-not-submitted">Not submitted ⚠️</span>
                                )}
                              </div>

                              <div className={`admin-doc-item ${pi.selfie_document_path ? 'doc-present' : 'doc-optional'}`}>
                                <div className="doc-item-label">Selfie with ID</div>
                                {pi.selfie_document_path ? (
                                  <button className="btn-view-doc" onClick={() => handleViewDocument(pi.selfie_document_path)}>
                                    View Photo →
                                  </button>
                                ) : (
                                  <span className="doc-not-submitted">Not submitted (optional)</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bio */}
                          {pi.bio && (
                            <div className="admin-detail-section">
                              <h4>Professional Bio</h4>
                              <p className="admin-bio">{pi.bio}</p>
                            </div>
                          )}

                          {/* Rejection Notes */}
                          <div className="admin-detail-section">
                            <h4>Rejection Notes <span style={{ fontWeight: 400, color: '#9ca3af' }}>(required if rejecting)</span></h4>
                            <textarea
                              className="admin-rejection-notes"
                              placeholder="Explain why this application is being rejected. This will be sent to the PI by email."
                              value={rejectionNotes[pi.id] || ''}
                              onChange={e => setRejectionNotes(prev => ({ ...prev, [pi.id]: e.target.value }))}
                              rows={3}
                            />
                          </div>

                          {/* Actions */}
                          <div className="admin-actions">
                            <button
                              onClick={() => handleVerifyPI(pi.id, true)}
                              className="btn-success"
                              disabled={verifying === pi.id}
                            >
                              {verifying === pi.id ? 'Processing...' : '✓ Approve & Verify'}
                            </button>
                            <button
                              onClick={() => {
                                if (!rejectionNotes[pi.id]?.trim()) {
                                  alert('Please add rejection notes before rejecting. The PI will receive these by email.')
                                  return
                                }
                                handleVerifyPI(pi.id, false)
                              }}
                              className="btn-danger"
                              disabled={verifying === pi.id}
                            >
                              × Reject Application
                            </button>
                          </div>

                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="admin-content">
              <h2>All Users</h2>

              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Type</th>
                      <th>Verified</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(u => (
                      <tr key={u.user_id}>
                        <td>{u.full_name || 'N/A'}</td>
                        <td>{u.email || 'N/A'}</td>
                        <td>
                          {u.pi_profiles && u.pi_profiles.length > 0 
                            ? <span className="badge-pi">PI</span> 
                            : <span className="badge-client">Client</span>}
                        </td>
                        <td>
                          {u.pi_profiles && u.pi_profiles.length > 0 
                            ? (u.pi_profiles[0].is_verified 
                                ? <span className="badge-verified">✓ Verified</span>
                                : <span className="badge-pending">Pending</span>)
                            : '-'}
                        </td>
                        <td>{formatDate(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="admin-content">
              <h2>Review Moderation</h2>

              <div className="admin-list">
                {flaggedReviews.map(review => {
                  const piName = `${review.pi_profile?.first_name} ${review.pi_profile?.last_name}`
                  const reviewerName = review.review_type === 'client'
                    ? review.reviewer?.profiles?.[0]?.full_name
                    : `${review.reviewer?.pi_profiles?.[0]?.first_name} ${review.reviewer?.pi_profiles?.[0]?.last_name}`

                  return (
                    <div key={review.id} className="admin-card">
                      <div className="admin-card-header">
                        <div>
                          <h3>{reviewerName} → {piName}</h3>
                          <p className="admin-meta">
                            {review.review_type} review • {review.rating}★ • {formatDate(review.created_at)}
                          </p>
                        </div>
                      </div>

                      {review.review_text && (
                        <div className="admin-card-body">
                          <p>{review.review_text}</p>
                        </div>
                      )}

                      <div className="admin-actions">
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          className="btn-danger-small"
                        >
                          Delete Review
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="admin-content">
              <h2>Recent Activity</h2>

              <div className="activity-list">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="activity-item">
                    {activity.type === 'signup' ? (
                      <>
                        <span className="activity-icon">👤</span>
                        <div className="activity-content">
                          <strong>{activity.full_name}</strong> signed up
                          <div className="activity-time">{formatDate(activity.created_at)}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="activity-icon">💼</span>
                        <div className="activity-content">
                          New job posted: <strong>{activity.title}</strong>
                          <div className="activity-time">{formatDate(activity.created_at)}</div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
