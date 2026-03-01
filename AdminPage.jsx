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

  const handleVerifyPI = async (piId, verified) => {
    try {
      const { error } = await supabase
        .from('pi_profiles')
        .update({ is_verified: verified })
        .eq('id', piId)

      if (error) throw error

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: verified ? 'verify_pi' : 'unverify_pi',
        p_target_type: 'pi_profile',
        p_target_id: piId
      })

      alert(verified ? 'PI verified successfully!' : 'PI verification removed')
      loadPendingPIs()
      loadStats()
    } catch (error) {
      console.error('Error verifying PI:', error)
      alert('Failed to update PI verification')
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

              {pendingPIs.length === 0 ? (
                <div className="empty-state">
                  <p>No pending verifications</p>
                </div>
              ) : (
                <div className="admin-list">
                  {pendingPIs.map(pi => (
                    <div key={pi.id} className="admin-card">
                      <div className="admin-card-header">
                        <div>
                          <h3>{pi.first_name} {pi.last_name}</h3>
                          {pi.company_name && <p>{pi.company_name}</p>}
                          <p className="admin-meta">
                            📍 {pi.location} • 📅 Applied {formatDate(pi.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="admin-card-body">
                        <div className="info-row">
                          <strong>License:</strong> {pi.license_number || 'Not provided'}
                        </div>
                        <div className="info-row">
                          <strong>Experience:</strong> {pi.years_experience || 0} years
                        </div>
                        <div className="info-row">
                          <strong>Email:</strong> {pi.email}
                        </div>
                        <div className="info-row">
                          <strong>Phone:</strong> {pi.phone}
                        </div>
                        {pi.specialties && (
                          <div className="info-row">
                            <strong>Specialties:</strong> {pi.specialties.join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="admin-actions">
                        <button
                          onClick={() => handleVerifyPI(pi.id, true)}
                          className="btn-success"
                        >
                          ✓ Verify PI
                        </button>
                        <button
                          onClick={() => handleVerifyPI(pi.id, false)}
                          className="btn-danger"
                        >
                          × Reject
                        </button>
                      </div>
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
