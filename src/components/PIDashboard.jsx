import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PIDashboard({ data, onRefresh, onNavigate }) {
  const { consultationRequests, profile } = data
  const [updatingStatus, setUpdatingStatus] = useState(null)

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'New', class: 'badge-pending' },
      contacted: { text: 'Contacted', class: 'badge-contacted' },
      accepted: { text: 'Accepted', class: 'badge-accepted' },
      declined: { text: 'Declined', class: 'badge-declined' },
      closed: { text: 'Closed', class: 'badge-closed' }
    }
    return badges[status] || badges.pending
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleStatusUpdate = async (requestId, newStatus) => {
    setUpdatingStatus(requestId)
    
    try {
      const { error } = await supabase
        .from('consultation_requests')
        .update({ status: newStatus })
        .eq('id', requestId)

      if (error) throw error

      onRefresh()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status. Please try again.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const pendingRequests = consultationRequests.filter(r => r.status === 'pending')
  const activeRequests = consultationRequests.filter(r => 
    ['contacted', 'accepted'].includes(r.status)
  )
  const closedRequests = consultationRequests.filter(r => 
    ['declined', 'closed'].includes(r.status)
  )

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>PI Dashboard</h1>
          <p>Welcome back, {profile.first_name || 'Investigator'}</p>
        </div>
        {!profile.is_verified && (
          <div className="alert alert-warning">
            ⚠️ Your profile is pending verification. You won't appear in search results until verified.
          </div>
        )}
      </div>

      <div className="dashboard-stats">
        <div className="stat-card highlight">
          <div className="stat-value">{pendingRequests.length}</div>
          <div className="stat-label">New Requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeRequests.length}</div>
          <div className="stat-label">Active Cases</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{consultationRequests.length}</div>
          <div className="stat-label">Total Inquiries</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {profile.rating ? profile.rating.toFixed(1) : 'N/A'}
          </div>
          <div className="stat-label">Rating</div>
        </div>
      </div>

      {/* New/Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="dashboard-section">
          <h2>🔔 New Consultation Requests ({pendingRequests.length})</h2>
          
          <div className="requests-list">
            {pendingRequests.map(request => {
              const badge = getStatusBadge(request.status)
              
              return (
                <div key={request.id} className="request-card priority">
                  <div className="request-header">
                    <div>
                      <h3>{request.title}</h3>
                      <p className="request-meta">
                        From: <strong>{request.requester_name}</strong>
                        {request.organization && ` (${request.organization})`}
                      </p>
                      <p className="request-meta">
                        📍 {request.location} • 📅 {formatDate(request.created_at)}
                      </p>
                    </div>
                    <span className={`status-badge ${badge.class}`}>
                      {badge.text}
                    </span>
                  </div>

                  <div className="request-body">
                    <p>{request.description}</p>
                  </div>

                  {request.budget_min && request.budget_max && (
                    <div className="request-budget">
                      <strong>Client Budget:</strong> ${request.budget_min.toLocaleString()} - ${request.budget_max.toLocaleString()}
                    </div>
                  )}

                  <div className="request-contact">
                    <div>
                      <strong>Contact:</strong>
                      <span>✉️ {request.requester_email}</span>
                      {request.requester_phone && <span>📞 {request.requester_phone}</span>}
                    </div>
                  </div>

                  <div className="request-actions">
                    <button 
                      className="btn-success"
                      onClick={() => handleStatusUpdate(request.id, 'accepted')}
                      disabled={updatingStatus === request.id}
                    >
                      ✓ Accept
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => handleStatusUpdate(request.id, 'contacted')}
                      disabled={updatingStatus === request.id}
                    >
                      Mark as Contacted
                    </button>
                    <button 
                      className="btn-danger"
                      onClick={() => handleStatusUpdate(request.id, 'declined')}
                      disabled={updatingStatus === request.id}
                    >
                      × Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Cases */}
      {activeRequests.length > 0 && (
        <div className="dashboard-section">
          <h2>Active Cases ({activeRequests.length})</h2>
          
          <div className="requests-list">
            {activeRequests.map(request => {
              const badge = getStatusBadge(request.status)
              
              return (
                <div key={request.id} className="request-card">
                  <div className="request-header">
                    <div>
                      <h3>{request.title}</h3>
                      <p className="request-meta">
                        Client: <strong>{request.requester_name}</strong>
                      </p>
                      <p className="request-meta">
                        📍 {request.location} • Started {formatDate(request.created_at)}
                      </p>
                    </div>
                    <span className={`status-badge ${badge.class}`}>
                      {badge.text}
                    </span>
                  </div>

                  <div className="request-actions">
                    <button className="btn-primary-small">
                      Message Client
                    </button>
                    {request.status === 'contacted' && (
                      <button 
                        className="btn-success-small"
                        onClick={() => handleStatusUpdate(request.id, 'accepted')}
                      >
                        Mark as Accepted
                      </button>
                    )}
                    <button 
                      className="btn-secondary-small"
                      onClick={() => handleStatusUpdate(request.id, 'closed')}
                    >
                      Close Case
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <button onClick={() => onNavigate('search')} className="action-card">
          <span className="action-icon">🔍</span>
          <div>
            <h3>Browse Jobs</h3>
            <p>Find new opportunities</p>
          </div>
        </button>
        
        <button className="action-card">
          <span className="action-icon">💼</span>
          <div>
            <h3>My Profile</h3>
            <p>Update your information</p>
          </div>
        </button>

        <button className="action-card">
          <span className="action-icon">⭐</span>
          <div>
            <h3>Reviews</h3>
            <p>{profile.review_count || 0} total reviews</p>
          </div>
        </button>
      </div>

      {/* Recent Activity */}
      {closedRequests.length > 0 && (
        <div className="dashboard-section collapsed">
          <h2>Closed Cases ({closedRequests.length})</h2>
          <button className="btn-text">View All →</button>
        </div>
      )}

      <div className="dashboard-footer">
        <button onClick={onRefresh} className="btn-secondary">
          Refresh Dashboard
        </button>
      </div>
    </div>
  )
}
