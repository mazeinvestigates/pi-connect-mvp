import React from 'react'

export default function JobCard({ job, urgency, hasApplied, applicationStatus, onApply, isPIUser }) {
  const formatBudget = (min, max) => {
    if (min && max) {
      return `$${min.toLocaleString()} - $${max.toLocaleString()}`
    } else if (min) {
      return `$${min.toLocaleString()}+`
    } else if (max) {
      return `Up to $${max.toLocaleString()}`
    }
    return 'Budget negotiable'
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Posted today'
    if (diffDays === 1) return 'Posted yesterday'
    if (diffDays < 7) return `Posted ${diffDays} days ago`
    return `Posted ${date.toLocaleDateString()}`
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Applied', class: 'status-pending' },
      accepted: { text: 'Accepted', class: 'status-accepted' },
      rejected: { text: 'Rejected', class: 'status-rejected' }
    }
    return badges[status] || null
  }

  const statusBadge = applicationStatus ? getStatusBadge(applicationStatus) : null

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div>
          <h3>{job.title}</h3>
          <p className="job-meta">
            📍 {job.location} • 🕐 {formatDate(job.created_at)}
          </p>
        </div>
        <span className={`urgency-badge ${urgency.class}`}>
          {urgency.text}
        </span>
      </div>

      <div className="job-card-body">
        <p className="job-description">
          {job.description.length > 200 
            ? `${job.description.substring(0, 200)}...` 
            : job.description}
        </p>

        <div className="job-details">
          <div className="job-detail-item">
            <strong>Type:</strong> {job.investigation_type}
          </div>
          <div className="job-detail-item">
            <strong>Budget:</strong> {formatBudget(job.budget_min, job.budget_max)}
          </div>
          {job.deadline && (
            <div className="job-detail-item">
              <strong>Deadline:</strong> {new Date(job.deadline).toLocaleDateString()}
            </div>
          )}
        </div>

        {job.required_specialties && job.required_specialties.length > 0 && (
          <div className="job-specialties">
            <strong>Required Skills:</strong>
            <div className="specialty-tags">
              {job.required_specialties.map((spec, idx) => (
                <span key={idx} className="specialty-tag">{spec}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="job-card-footer">
        {job.profiles && (
          <div className="job-poster">
            Posted by {job.profiles.full_name || 'Anonymous Client'}
          </div>
        )}

        {isPIUser && (
          <div className="job-actions">
            {statusBadge ? (
              <span className={`application-status-badge ${statusBadge.class}`}>
                ✓ {statusBadge.text}
              </span>
            ) : (
              <button onClick={onApply} className="btn-primary">
                Apply Now
              </button>
            )}
          </div>
        )}

        {!isPIUser && (
          <div className="job-info">
            <small>Sign in as a PI to apply</small>
          </div>
        )}
      </div>
    </div>
  )
}
