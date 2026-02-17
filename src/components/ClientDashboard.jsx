import React from 'react'

export default function ClientDashboard({ data, onRefresh, onNavigate }) {
  const { consultationRequests } = data

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending', class: 'badge-pending' },
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
      year: 'numeric'
    })
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>My Dashboard</h1>
          <p>Track your consultation requests and case status</p>
        </div>
        <button onClick={() => onNavigate('search')} className="btn-primary">
          Find New PI
        </button>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{consultationRequests.length}</div>
          <div className="stat-label">Total Requests</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {consultationRequests.filter(r => r.status === 'pending').length}
          </div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {consultationRequests.filter(r => r.status === 'accepted').length}
          </div>
          <div className="stat-label">Accepted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {consultationRequests.filter(r => r.status === 'contacted').length}
          </div>
          <div className="stat-label">In Progress</div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Consultation Requests</h2>
        
        {consultationRequests.length === 0 ? (
          <div className="empty-state">
            <p>You haven't sent any consultation requests yet.</p>
            <button onClick={() => onNavigate('search')} className="btn-primary">
              Find a Private Investigator
            </button>
          </div>
        ) : (
          <div className="requests-list">
            {consultationRequests.map(request => {
              const pi = request.pi_profiles
              const badge = getStatusBadge(request.status)
              
              return (
                <div key={request.id} className="request-card">
                  <div className="request-header">
                    <div>
                      <h3>{request.title}</h3>
                      <p className="request-meta">
                        Sent to: <strong>
                          {pi ? `${pi.first_name} ${pi.last_name}` : 'Unknown PI'}
                          {pi?.company_name && ` (${pi.company_name})`}
                        </strong>
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
                      <strong>Budget:</strong> ${request.budget_min.toLocaleString()} - ${request.budget_max.toLocaleString()}
                    </div>
                  )}

                  <div className="request-actions">
                    {pi && (
                      <>
                        <div className="pi-contact">
                          {pi.phone && <span>📞 {pi.phone}</span>}
                          {pi.email && <span>✉️ {pi.email}</span>}
                        </div>
                        {request.status === 'accepted' && (
                          <button className="btn-primary-small">
                            Message {pi.first_name}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="dashboard-footer">
        <button onClick={onRefresh} className="btn-secondary">
          Refresh Data
        </button>
      </div>
    </div>
  )
}
