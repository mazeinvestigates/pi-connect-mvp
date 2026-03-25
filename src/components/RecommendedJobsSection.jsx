import React from 'react'
import { getMatchColor } from '../matchingAlgorithm'

export default function RecommendedJobsSection({ jobs, onViewJob, onApply, myApplications = {} }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="recommended-section">
        <h2>🤖 Recommended for You</h2>
        <div className="empty-state">
          <p>No recommended jobs at the moment. Check back soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="recommended-section">
      <div className="recommended-header">
        <h2>🤖 Recommended for You</h2>
        <p>AI-matched jobs based on your profile, location, and expertise</p>
      </div>

      <div className="recommended-jobs-list">
        {jobs.map(job => (
          <div key={job.id} className="recommended-job-card">
            {/* Match Score Banner */}
            <div 
              className="match-score-banner" 
              style={{ 
                backgroundColor: getMatchColor(job.matchData.score) + '20',
                borderLeft: `4px solid ${getMatchColor(job.matchData.score)}`
              }}
            >
              <div className="match-score-main">
                <span 
                  className="match-percentage" 
                  style={{ color: getMatchColor(job.matchData.score) }}
                >
                  {job.matchData.score}% Match
                </span>
                <span className="match-label">{job.matchData.recommendation}</span>
              </div>
            </div>

            {/* Job Details */}
            <div className="job-content">
              <h3>{job.title}</h3>
              
              <div className="job-meta">
                <span>📍 {job.location}</span>
                <span>💰 ${job.budget_min?.toLocaleString()} - ${job.budget_max?.toLocaleString()}</span>
                <span className={`urgency-badge urgency-${job.urgency}`}>
                  {job.urgency === 'urgent' && '🔥 '}
                  {job.urgency?.charAt(0).toUpperCase() + job.urgency?.slice(1)}
                </span>
              </div>

              <p className="job-description">
                {job.description.length > 150 
                  ? job.description.substring(0, 150) + '...' 
                  : job.description}
              </p>

              {/* Why It Matches */}
              <div className="match-reasons">
                <h4>Why this matches:</h4>
                <div className="match-factors-grid">
                  {job.matchData.factors.map((factor, idx) => (
                    <div key={idx} className="match-factor-item">
                      <div className="factor-header">
                        <span className="factor-name">{factor.name}</span>
                        <span 
                          className="factor-score" 
                          style={{ 
                            color: factor.score >= 75 ? '#10b981' : factor.score >= 50 ? '#f59e0b' : '#999' 
                          }}
                        >
                          {factor.score}%
                        </span>
                      </div>
                      <div className="factor-detail">{factor.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="job-actions">
                <button 
                  onClick={() => onViewJob(job)} 
                  className="btn-secondary"
                >
                  View Details
                </button>
                {myApplications[job.id] ? (
                  <span className="application-status-badge status-pending">
                    ✓ Applied
                  </span>
                ) : (
                  <button
                    onClick={() => onApply(job)}
                    className="btn-primary"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
