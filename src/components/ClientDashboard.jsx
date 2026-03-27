function CoverLetterPreview({ text }) {
  const [expanded, setExpanded] = React.useState(false)
  const truncated = text.length > 200
  return (
    <p style={{ fontSize: '13px', color: '#374151', marginBottom: '10px', fontStyle: 'italic', lineHeight: '1.6' }}>
      "{expanded || !truncated ? text : text.substring(0, 200) + '...'}"
      {truncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', padding: '0 4px', fontSize: '13px', fontWeight: '600', fontStyle: 'normal' }}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </p>
  )
}

import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { getOrCreateConversation } from '../messagingUtils'
import PaymentModal from './PaymentModal'

export default function ClientDashboard({ data, onRefresh, onNavigate }) {
  const { consultationRequests, postedJobs = [], user } = data
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [selectedApp, setSelectedApp] = useState(null)
  const [expandedJob, setExpandedJob] = useState(null)
  const [accepting, setAccepting] = useState(null)

  const totalApplications = postedJobs.reduce((sum, job) => sum + (job.job_applications?.length || 0), 0)
  const pendingApplications = postedJobs.reduce((sum, job) =>
    sum + (job.job_applications?.filter(a => a.status === 'pending').length || 0), 0)

  const handleAcceptApplication = async (job, app) => {
    setAccepting(app.id)
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'accepted' })
        .eq('id', app.id)
      if (error) throw error

      // Reject all other applications for this job
      await supabase
        .from('job_applications')
        .update({ status: 'rejected' })
        .eq('job_id', job.id)
        .neq('id', app.id)

      // Update job status
      await supabase
        .from('jobs')
        .update({ status: 'in_progress' })
        .eq('id', job.id)

      onRefresh()
    } catch (err) {
      alert('Failed to accept application. Please try again.')
    } finally {
      setAccepting(null)
    }
  }

  const handleMessagePI = async (piUserId) => {
    try {
      await getOrCreateConversation(user.id, piUserId)
      onNavigate('messages')
    } catch (err) {
      alert('Failed to start conversation. Please try again.')
    }
  }

  const handlePayment = (job, app, isAdditional = false) => {
    setSelectedJob(job)
    setSelectedApp({ ...app, _isAdditionalPayment: isAdditional })
    setShowPaymentModal(true)
  }

  const handleCancelJob = async (appId, jobId) => {
    const reason = window.prompt('Please provide a reason for cancellation:')
    if (!reason) return
    if (!window.confirm('Are you sure you want to cancel this job?')) return
    try {
      await supabase.from('job_applications').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancel_reason: reason
      }).eq('id', appId)
      await supabase.from('jobs').update({ status: 'open' }).eq('id', jobId)
      onRefresh()
    } catch (err) {
      alert('Failed to cancel job.')
    }
  }

  const handleApproveCancellation = async (appId, jobId) => {
    if (!window.confirm("Approve the PI's cancellation request? The job will return to open status.")) return
    try {
      await supabase.from('job_applications').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancel_reason: 'Cancellation request approved by client'
      }).eq('id', appId)
      await supabase.from('jobs').update({ status: 'open' }).eq('id', jobId)
      onRefresh()
    } catch (err) {
      alert('Failed to approve cancellation.')
    }
  }

  const getInvoiceUrl = async (path) => {
    const { data } = await supabase.storage.from('invoices').createSignedUrl(path, 3600)
    return data?.signedUrl || null
  }

  const handleViewInvoice = async (path) => {
    const url = await getInvoiceUrl(path)
    if (url) window.open(url, '_blank')
    else alert('Could not load invoice. Please try again.')
  }

  const handleApproveAdditionalFunds = async (appId, approved) => {
    try {
      await supabase.from('job_applications').update({
        additional_escrow_status: approved ? 'approved' : 'declined'
      }).eq('id', appId)
      onRefresh()
    } catch (err) {
      alert('Failed to update request.')
    }
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const getStatusBadge = (status) => ({
    pending: { text: 'Pending', class: 'badge-pending' },
    accepted: { text: 'Accepted', class: 'badge-accepted' },
    rejected: { text: 'Declined', class: 'badge-declined' },
    open: { text: 'Open', class: 'badge-pending' },
    in_progress: { text: 'In Progress', class: 'badge-processing' },
    completed: { text: 'Completed', class: 'badge-success' },
  }[status] || { text: status, class: 'badge-pending' })

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>My Dashboard</h1>
          <p>Track your posted jobs and investigation requests</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => onNavigate('post-job')} className="btn-primary">+ Post a Job</button>
          <button onClick={() => onNavigate('search')} className="btn-secondary">Find a PI</button>
        </div>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{postedJobs.length}</div>
          <div className="stat-label">Jobs Posted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalApplications}</div>
          <div className="stat-label">Total Applications</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pendingApplications}</div>
          <div className="stat-label">Awaiting Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{consultationRequests.filter(r => r.status === 'pending').length}</div>
          <div className="stat-label">Pending Consultations</div>
        </div>
      </div>

      {/* Posted Jobs */}
      <div className="dashboard-section">
        <h2>My Posted Jobs</h2>
        {postedJobs.length === 0 ? (
          <div className="empty-state">
            <p>You haven't posted any jobs yet.</p>
            <button onClick={() => onNavigate('post-job')} className="btn-primary">Post Your First Job</button>
          </div>
        ) : (
          <div className="jobs-list">
            {postedJobs.map(job => {
              const apps = job.job_applications || []
              const acceptedApp = apps.find(a => a.status === 'accepted')
              const jobBadge = getStatusBadge(job.status)
              const isExpanded = expandedJob === job.id

              return (
                <div key={job.id} className="job-management-card">
                  <div className="job-card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3>{job.title}</h3>
                        {job.is_private && <span className="private-job-badge">🔒 Private</span>}
                      </div>
                      <p className="job-meta">📍 {job.location} · {job.investigation_type}</p>
                      <p className="job-meta">💰 ${job.budget_min?.toLocaleString()} – ${job.budget_max?.toLocaleString()} · Posted {formatDate(job.created_at)}</p>
                    </div>
                    <span className={`status-badge ${jobBadge.class}`}>{jobBadge.text}</span>
                  </div>

                  {/* Job description toggle */}
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
                      {isExpanded || job.description.length <= 150
                        ? job.description
                        : `${job.description.substring(0, 150)}...`}
                      {job.description.length > 150 && (
                        <button
                          onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                          style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', padding: '0 4px', fontSize: '13px', fontWeight: '600' }}
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </p>
                  </div>

                  {/* Applications */}
                  {apps.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>No applications yet.</p>
                  ) : (
                    <div className="applications-section">
                      <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                        Applications ({apps.length})
                      </h4>
                      {apps.map(app => {
                        const pi = app.pi_profiles
                        const appBadge = getStatusBadge(app.status)
                        return (
                          <div key={app.id} className="application-item" style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '14px',
                            marginBottom: '8px',
                            background: app.status === 'accepted' ? '#f0fdf4' : 'white'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div>
                                <p style={{ fontWeight: '600', fontSize: '14px' }}>
                                  {pi ? `${pi.first_name} ${pi.last_name}` : 'Unknown PI'}
                                  {pi?.company_name && ` · ${pi.company_name}`}
                                </p>
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>
                                  📍 {pi?.city}, {pi?.state}
                                  {app.proposed_rate && ` · $${app.proposed_rate}/hr`}
                                  {app.estimated_timeline && ` · ${app.estimated_timeline}`}
                                </p>
                                <p style={{ fontSize: '13px', color: '#6b7280' }}>Applied {formatDate(app.applied_at)}</p>
                              </div>
                              <span className={`status-badge ${appBadge.class}`}>{appBadge.text}</span>
                            </div>

                            {app.cover_letter && (
                              <CoverLetterPreview text={app.cover_letter} />
                            )}

                            {/* Cancellation request from PI */}
                            {app.cancel_requested_by && app.cancel_requested_by !== user.id && app.status !== 'cancelled' && (
                              <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontSize: '13px' }}>
                                <p style={{ fontWeight: '600', marginBottom: '6px' }}>⚠️ PI has requested cancellation</p>
                                <p style={{ marginBottom: '8px' }}>Reason: "{app.cancel_request_reason}"</p>
                                <button className="btn-primary" onClick={() => handleApproveCancellation(app.id, job.id)}>
                                  Approve Cancellation
                                </button>
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {app.status === 'pending' && (
                                <button
                                  className="btn-primary"
                                  disabled={accepting === app.id}
                                  onClick={() => handleAcceptApplication(job, app)}
                                >
                                  {accepting === app.id ? 'Accepting...' : '✓ Accept'}
                                </button>
                              )}

                              {/* Escrow: prompt client to pay upfront */}
                              {app.status === 'accepted' && app.payment_mode === 'escrow' && !app.work_started_at && (
                                <>
                                  {app.escrow_amount_cents ? (
                                    <button className="btn-primary" onClick={() => handlePayment(job, app)}>
                                      🔒 Pay Upfront — ${(app.escrow_amount_cents / 100).toFixed(2)}
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '13px', color: '#d97706' }}>⏳ PI is setting the escrow amount</span>
                                  )}
                                  <p style={{ fontSize: '12px', color: '#6b7280', width: '100%', marginTop: '2px' }}>
                                    PI requires upfront payment before starting work.
                                  </p>
                                </>
                              )}

                              {/* Invoice: pay when PI sends invoice */}
                              {app.status === 'accepted' && (app.payment_mode === 'invoice' || !app.payment_mode) && app.invoice_sent_at && (
                                <>
                                  {app.invoice_file_path && (
                                    <button className="btn-secondary-small" onClick={() => handleViewInvoice(app.invoice_file_path)}>
                                      📄 View Invoice
                                    </button>
                                  )}
                                  <button className="btn-primary" onClick={() => handlePayment(job, app)}>
                                    💳 Pay Invoice{app.invoice_amount_cents ? ` — $${(app.invoice_amount_cents / 100).toFixed(2)}` : ''}
                                  </button>
                                </>
                              )}

                              {/* Additional escrow request */}
                              {app.additional_escrow_status === 'pending' && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px 14px', width: '100%', marginTop: '4px' }}>
                                  <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>⚠️ PI requests additional funds</p>
                                  <p style={{ fontSize: '13px', marginBottom: '8px' }}>Amount: ${(app.additional_escrow_requested_cents / 100).toFixed(2)}</p>
                                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>Reason: "{app.additional_escrow_reason}"</p>
                                  {app.additional_escrow_invoice_path && (
                                    <button className="btn-secondary-small" style={{ marginBottom: '8px' }} onClick={() => handleViewInvoice(app.additional_escrow_invoice_path)}>
                                      📄 View Supplemental Invoice
                                    </button>
                                  )}
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn-primary" onClick={() => handlePayment(job, app, true)}>
                                      ✓ Approve & Pay ${(app.additional_escrow_requested_cents / 100).toFixed(2)}
                                    </button>
                                    <button className="btn-danger-small" onClick={() => handleApproveAdditionalFunds(app.id, false)}>
                                      ✗ Decline
                                    </button>
                                  </div>
                                </div>
                              )}
                              {app.additional_escrow_status === 'approved' && (
                                <span style={{ fontSize: '13px', color: '#059669' }}>✓ Additional funds approved and paid</span>
                              )}
                              {app.additional_escrow_status === 'declined' && (
                                <span style={{ fontSize: '13px', color: '#dc2626' }}>✗ Additional funds request declined</span>
                              )}

                              {app.status === 'accepted' && (app.payment_mode === 'invoice' || !app.payment_mode) && !app.invoice_sent_at && (
                                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                                  {app.work_started_at ? '⏳ Work in progress — invoice pending' : '⏳ Awaiting PI to begin work'}
                                </span>
                              )}

                              <button className="btn-secondary-small" onClick={() => handleMessagePI(app.applicant_id)}>
                                💬 Message PI
                              </button>

                              {/* Cancellation */}
                              {app.status === 'accepted' && !app.work_started_at && !app.cancel_requested_by && (
                                <button className="btn-danger-small"
                                  onClick={() => handleCancelJob(app.id, job.id)}>
                                  Cancel Job
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Consultation Requests */}
      {consultationRequests.length > 0 && (
        <div className="dashboard-section">
          <h2>Consultation Requests</h2>
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
                        Sent to: <strong>{pi ? `${pi.first_name} ${pi.last_name}` : 'Unknown PI'}</strong>
                      </p>
                      <p className="request-meta">📍 {request.location} · 📅 {formatDate(request.created_at)}</p>
                    </div>
                    <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                  </div>
                  <div className="request-body">
                    <p>{request.description}</p>
                  </div>
                  {request.status === 'accepted' && pi && (
                    <div className="request-actions">
                      <button className="btn-primary-small" onClick={() => handleMessagePI(pi.user_id)}>
                        💬 Message {pi.first_name}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="dashboard-footer">
        <button onClick={onRefresh} className="btn-secondary">Refresh</button>
      </div>

      {showPaymentModal && selectedJob && selectedApp && (
        <PaymentModal
          job={selectedJob}
          application={selectedApp}
          user={user}
          onClose={() => { setShowPaymentModal(false); setSelectedJob(null); setSelectedApp(null) }}
          onSuccess={() => { setShowPaymentModal(false); setSelectedJob(null); setSelectedApp(null); onRefresh() }}
        />
      )}
    </div>
  )
}
