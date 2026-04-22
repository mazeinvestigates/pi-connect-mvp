import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import JobCard from '../components/JobCard'
import JobApplicationModal from '../components/JobApplicationModal'
import RecommendedJobsSection from '../components/RecommendedJobsSection'
import { VerificationGate, UnverifiedBanner } from '../components/VerificationGate'
import SubcontractModal from '../components/SubcontractModal'
import ReferralModal from '../components/ReferralModal'
import SendInvoiceModal from '../components/SendInvoiceModal'
import SendContractModal, { generateContractHTML } from '../components/SendContractModal'
import DeliverablesModal from '../components/DeliverablesModal'
import RequestAdditionalFundsModal from '../components/RequestAdditionalFundsModal'
import ReportWorkflow from '../components/ReportWorkflow'
import { getRecommendedJobs } from '../matchingAlgorithm'
import { INVESTIGATION_TYPES_WITH_ALL } from '../investigationTypes'
import { US_STATES } from '../usStates'

const INVESTIGATION_TYPES = INVESTIGATION_TYPES_WITH_ALL

const URGENCY_LEVELS = ['All Urgencies', 'low', 'medium', 'high', 'urgent']

// ─── Marketplace tab (original browse) ──────────────────────────────────────
function MarketplaceTab({ user, profile, onNavigate }) {
  const [jobs, setJobs] = useState([])
  const [recommendedJobs, setRecommendedJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ city: '', state: '', investigationType: '', urgency: '', budgetMin: '', budgetMax: '' })
  const [selectedJob, setSelectedJob] = useState(null)
  const [showApplicationModal, setShowApplicationModal] = useState(false)
  const [showSubcontractModal, setShowSubcontractModal] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [myApplications, setMyApplications] = useState({})

  useEffect(() => {
    loadJobs()
    if (user && profile?.type === 'pi') loadMyApplications()
  }, [user, profile])

  const loadJobs = async () => {
    let isMounted = true
    try {
      setLoading(true)
      let query = supabase.from('jobs').select('*, profiles:posted_by (full_name, email)')
        .eq('status', 'open')
        .eq('is_private', false).order('created_at', { ascending: false })

      if (filters.city) query = query.ilike('city', `%${filters.city}%`)
      if (filters.state) query = query.ilike('state', `%${filters.state}%`)
      if (filters.investigationType && filters.investigationType !== 'All Types') query = query.eq('investigation_type', filters.investigationType)
      if (filters.urgency && filters.urgency !== 'All Urgencies') query = query.eq('urgency', filters.urgency)
      if (filters.budgetMin) query = query.gte('budget_max', parseFloat(filters.budgetMin))
      if (filters.budgetMax) query = query.lte('budget_min', parseFloat(filters.budgetMax))

      const { data, error } = await query
      if (error) throw error
      setJobs(data || [])

      if (profile?.type === 'pi' && data?.length > 0) {
        const { data: piData } = await supabase.from('pi_profiles').select('*').eq('user_id', user.id).single()
        if (piData) setRecommendedJobs(getRecommendedJobs(data, piData, 60).slice(0, 5))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadMyApplications = async () => {
    const { data } = await supabase.from('job_applications').select('job_id, status').eq('applicant_id', user.id)
    const map = {}
    data?.forEach(app => { map[app.job_id] = app.status })
    setMyApplications(map)
  }

  const handleApplyClick = (job) => {
    if (!user) { onNavigate('auth'); return }
    if (profile?.type !== 'pi') { alert('Only Private Investigators can apply to jobs.'); return }
    setSelectedJob(job)
    setShowApplicationModal(true)
  }

  const getUrgencyBadge = (urgency) => ({
    low: { text: 'Low Priority', class: 'urgency-low' },
    medium: { text: 'Medium', class: 'urgency-medium' },
    high: { text: 'High Priority', class: 'urgency-high' },
    urgent: { text: 'URGENT', class: 'urgency-urgent' }
  }[urgency] || { text: 'Medium', class: 'urgency-medium' })

  return (
    <div>
      <div className="jobs-header">
        <div>
          <h2>Job Marketplace</h2>
          <p>Find investigation opportunities nationwide</p>
        </div>
        {user && (
          <button onClick={() => onNavigate('post-job')} className="btn-primary">
            {profile?.type === 'pi' ? '+ Post Private Job' : '+ Post a Job'}
          </button>
        )}
      </div>

      <div className="jobs-filters">
        <input type="text" placeholder="City" value={filters.city}
          onChange={e => setFilters({ ...filters, city: e.target.value })} onBlur={loadJobs} />
        <select value={filters.state}
          onChange={e => { setFilters({ ...filters, state: e.target.value }); setTimeout(loadJobs, 100) }}>
          <option value="">All States</option>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.investigationType}
          onChange={e => { setFilters({ ...filters, investigationType: e.target.value }); setTimeout(loadJobs, 100) }}>
          {INVESTIGATION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filters.urgency}
          onChange={e => { setFilters({ ...filters, urgency: e.target.value }); setTimeout(loadJobs, 100) }}>
          {URGENCY_LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
        <div className="budget-range">
          <input type="number" placeholder="Min $" value={filters.budgetMin}
            onChange={e => setFilters({ ...filters, budgetMin: e.target.value })} onBlur={loadJobs} />
          <span>–</span>
          <input type="number" placeholder="Max $" value={filters.budgetMax}
            onChange={e => setFilters({ ...filters, budgetMax: e.target.value })} onBlur={loadJobs} />
        </div>
        <button onClick={loadJobs} className="btn-secondary">Search</button>
      </div>

      {profile?.type === 'pi' && recommendedJobs.length > 0 && !loading && (
        <RecommendedJobsSection
          jobs={recommendedJobs}
          onApply={handleApplyClick}
          onViewJob={(job) => { setSelectedJob(job); setShowApplicationModal(true) }}
          myApplications={myApplications}
        />
      )}

      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state"><p>No jobs found. Try adjusting your filters.</p></div>
      ) : (
        <div className="jobs-grid">
          {jobs.map(job => (
            <JobCard key={job.id} job={job}
              urgency={getUrgencyBadge(job.urgency)}
              hasApplied={myApplications[job.id]}
              applicationStatus={myApplications[job.id]}
              onApply={() => handleApplyClick(job)}
              isPIUser={profile?.type === 'pi'}
              onSubcontract={null}
              onRefer={profile?.type === 'pi' ? () => { setSelectedJob(job); setShowReferralModal(true) } : null}
              profile={profile}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      {showApplicationModal && selectedJob && (
        <JobApplicationModal job={selectedJob} user={user} piProfile={profile} hasApplied={!!myApplications[selectedJob?.id]}
          onClose={() => { setShowApplicationModal(false); setSelectedJob(null) }}
          onSuccess={() => { setShowApplicationModal(false); setSelectedJob(null); loadMyApplications() }} />
      )}

      {showSubcontractModal && selectedJob && (
        <SubcontractModal job={selectedJob} user={user} piProfile={profile}
          onClose={() => { setShowSubcontractModal(false); setSelectedJob(null) }}
          onSuccess={() => { setShowSubcontractModal(false); setSelectedJob(null); alert('Subcontract offer sent!') }} />
      )}

      {showReferralModal && selectedJob && (
        <ReferralModal job={selectedJob} user={user}
          onClose={() => { setShowReferralModal(false); setSelectedJob(null) }}
          onSuccess={() => { setShowReferralModal(false); setSelectedJob(null); alert('Referral sent!') }} />
      )}
    </div>
  )
}

// ─── My Jobs tab ─────────────────────────────────────────────────────────────
function ArchivedDeliverables({ appId }) {
  const [files, setFiles] = React.useState([])
  React.useEffect(() => {
    supabase.from('job_deliverables').select('*').eq('application_id', appId)
      .order('uploaded_at', { ascending: false })
      .then(({ data }) => setFiles(data || []))
  }, [appId])
  if (!files.length) return null
  return (
    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {files.map(f => (
        <button key={f.id} style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px', textAlign: 'left', padding: 0 }}
          onClick={async () => {
            const { data } = await supabase.storage.from('deliverables').createSignedUrl(f.file_path, 3600)
            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
          }}>
          📄 {f.file_name}
        </button>
      ))}
    </div>
  )
}

function MyJobsTab({ user, profile, onNavigate }) {
  const [showArchive, setShowArchive] = useState(false)
  const [expandedArchiveJob, setExpandedArchiveJob] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showSubcontractModal, setShowSubcontractModal] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [updating, setUpdating] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showAdditionalFundsModal, setShowAdditionalFundsModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showDeliverablesModal, setShowDeliverablesModal] = useState(false)
  const [selectedApp, setSelectedApp] = useState(null)

  useEffect(() => { loadMyJobs() }, [user])

  const loadMyJobs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`*, job:job_id (*, profiles:posted_by (full_name, email))`)
        .eq('applicant_id', user.id)
        .in('status', ['accepted', 'in_progress', 'completed'])
        .order('applied_at', { ascending: false })

      if (error) throw error
      setJobs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSetPaymentMode = async (appId, mode, escrowAmountCents = null) => {
    setUpdating(appId)
    try {
      const updates = { payment_mode: mode }
      if (escrowAmountCents) updates.escrow_amount_cents = escrowAmountCents
      const { error } = await supabase
        .from('job_applications')
        .update(updates)
        .eq('id', appId)
      if (error) throw error
      loadMyJobs()
    } catch (err) {
      alert('Failed to update payment mode.')
    } finally {
      setUpdating(null)
    }
  }

  const handleMarkWorkStarted = async (appId) => {
    setUpdating(appId)
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ work_started_at: new Date().toISOString(), status: 'in_progress' })
        .eq('id', appId)
      if (error) throw error
      loadMyJobs()
    } catch (err) {
      alert('Failed to update job status.')
    } finally {
      setUpdating(null)
    }
  }

  const handleSendInvoice = async (appId) => {
    setUpdating(appId)
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ invoice_sent_at: new Date().toISOString() })
        .eq('id', appId)
      if (error) throw error
      alert('Invoice sent to client. They can now process payment from their dashboard.')
      loadMyJobs()
    } catch (err) {
      alert('Failed to send invoice.')
    } finally {
      setUpdating(null)
    }
  }

  const handleCancelRequest = async (appId, job) => {
    // If work has started, client must agree — PI can only request
    const reason = window.prompt('Please provide a reason for cancellation:')
    if (!reason) return
    setUpdating(appId)
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({
          cancel_requested_by: user.id,
          cancel_requested_at: new Date().toISOString(),
          cancel_request_reason: reason
        })
        .eq('id', appId)
      if (error) throw error
      alert('Cancellation request sent to client.')
      loadMyJobs()
    } catch (err) {
      alert('Failed to send cancellation request.')
    } finally {
      setUpdating(null)
    }
  }

  const handleCancelJob = async (appId) => {
    // Before work starts — either party can cancel freely
    const reason = window.prompt('Please provide a reason for cancellation:')
    if (!reason) return
    if (!window.confirm('Are you sure you want to cancel this job? This cannot be undone.')) return
    setUpdating(appId)
    try {
      const { error: appError } = await supabase
        .from('job_applications')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancel_reason: reason
        })
        .eq('id', appId)
      if (appError) throw appError

      // Reopen the job
      const app = jobs.find(j => j.id === appId)
      if (app?.job_id) {
        await supabase.from('jobs').update({ status: 'open' }).eq('id', app.job_id)
      }
      loadMyJobs()
    } catch (err) {
      alert('Failed to cancel job.')
    } finally {
      setUpdating(null)
    }
  }

  const convertToPublic = async (jobId) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_private: false })
        .eq('id', jobId)
      if (error) throw error
      loadMyJobs()
    } catch (err) {
      alert('Failed to convert job. Please try again.')
    }
  }

  const getStatusBadge = (status) => ({
    accepted: { text: 'Accepted', class: 'badge-accepted' },
    in_progress: { text: 'In Progress', class: 'badge-processing' },
    completed: { text: 'Completed', class: 'badge-success' },
    pending: { text: 'Pending', class: 'badge-pending' }
  }[status] || { text: status, class: 'badge-pending' })

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>

  return (
    <div>
      <div className="tab-header">
        <h2>My Jobs</h2>
        <p>Jobs you've been accepted for as the primary PI</p>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <p>No active jobs yet.</p>
          <button onClick={() => {}} className="btn-primary">Browse Marketplace</button>
        </div>
      ) : (
        <div>
          {jobs.filter(a => !['completed','cancelled'].includes(a.status)).concat(
            jobs.filter(a => ['completed','cancelled'].includes(a.status)).length > 0 ? [] : []
          ).length === 0 && jobs.length > 0 && (
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>All your jobs are archived.</p>
          )}
          {jobs.filter(a => !['completed','cancelled'].includes(a.status)).map(app => {
            const job = app.job
            const badge = getStatusBadge(app.status)
            return (
              <div key={app.id} className="job-management-card">
                <div className="job-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3>{job?.title}</h3>
                      {job?.is_private && <span className="private-job-badge">🔒 Private</span>}
                      {job?.posted_by_pi && <span className="pi-posted-badge">🤝 Subcontract Sought</span>}
                    </div>
                    <p className="job-meta">📍 {job?.location} · {job?.investigation_type}</p>
                    <p className="job-meta">Client: {job?.profiles?.full_name}</p>
                  </div>
                  <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                </div>

                {/* Paid/funded status */}
                {app.payment_status === 'paid' && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                    <p style={{ fontWeight: '600', fontSize: '14px', color: '#166534', margin: 0 }}>
                      ✓ {app.payment_mode === 'escrow' ? 'Escrow funded — you can begin work' : 'Payment received'}
                    </p>
                    {app.agreed_amount_cents && (
                      <p style={{ fontSize: '13px', color: '#166534', margin: '4px 0 0' }}>
                        Amount: ${(app.agreed_amount_cents / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {/* Payment mode selector */}
                {app.payment_status !== 'paid' && app.status === 'accepted' && !app.work_started_at && (
                  <div className="payment-mode-selector">
                    <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                      Payment Mode
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className={app.payment_mode === 'escrow' || !app.payment_mode ? 'btn-mode-inactive' : 'btn-mode-active'}
                        onClick={() => handleSetPaymentMode(app.id, 'invoice')}
                        style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', background: app.payment_mode === 'invoice' ? '#667eea' : 'white', color: app.payment_mode === 'invoice' ? 'white' : '#374151' }}
                      >
                        📄 Invoice on Completion
                      </button>
                      <button
                        onClick={() => handleSetPaymentMode(app.id, 'escrow')}
                        style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', background: app.payment_mode === 'escrow' ? '#667eea' : 'white', color: app.payment_mode === 'escrow' ? 'white' : '#374151' }}
                      >
                        🔒 Require Upfront Payment
                      </button>
                    </div>
                    {app.payment_mode === 'escrow' && (
                      <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>
                          Escrow Amount ($) *
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="number" min="0" step="0.01"
                            defaultValue={app.escrow_amount_cents ? (app.escrow_amount_cents / 100).toFixed(2) : ''}
                            placeholder="Enter total estimated amount"
                            id={`escrow-amount-${app.id}`}
                            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '180px' }}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: '13px', padding: '6px 14px' }}
                            onClick={() => {
                              const val = document.getElementById(`escrow-amount-${app.id}`)?.value
                              if (!val || parseFloat(val) <= 0) { alert('Please enter a valid amount.'); return }
                              handleSetPaymentMode(app.id, 'escrow', Math.round(parseFloat(val) * 100))
                            }}
                          >
                            Set Amount
                          </button>
                        </div>
                        {app.escrow_amount_cents && (
                          <p style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
                            ✓ Escrow amount set: ${(app.escrow_amount_cents / 100).toFixed(2)} — client will be prompted to pay this amount before work begins.
                          </p>
                        )}
                        {!app.escrow_amount_cents && (
                          <p style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>
                            ⚠️ Set the escrow amount before the client can pay.
                          </p>
                        )}
                      </div>
                    )}
                    {(app.payment_mode === 'invoice' || !app.payment_mode) && (
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                        You complete the work first, then send an invoice to the client.
                      </p>
                    )}
                  </div>
                )}

                {/* Cancellation request notice */}
                {app.cancel_requested_by && app.cancel_requested_by !== user.id && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontSize: '13px' }}>
                    ⚠️ Client has requested cancellation: "{app.cancel_request_reason}"
                  </div>
                )}

                <div className="job-card-actions">
                  <button className="btn-secondary-small" onClick={() => onNavigate('messages')}>
                    💬 Message Client
                  </button>

                  {/* Contract section */}
                  {!app.contract_status && (
                    <button className="btn-secondary-small"
                      onClick={() => { setSelectedApp(app); setShowContractModal(true) }}>
                      📄 Send Contract (Optional)
                    </button>
                  )}
                  {app.contract_status === 'pending_signature' && (
                    <span style={{ fontSize: '13px', color: '#d97706', fontWeight: '500' }}>⏳ Awaiting client signature</span>
                  )}
                  {app.contract_status === 'signed' && (
                    <span style={{ fontSize: '13px', color: '#059669', fontWeight: '500' }}>✓ Contract signed by client</span>
                  )}
                  {app.contract_status === 'declined' && (
                    <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>✗ Client declined contract — job reopened</span>
                  )}

                  {/* Mark work started */}
                  {app.status === 'accepted' && !app.work_started_at && (app.payment_mode === 'invoice' || !app.payment_mode) && app.payment_status !== 'paid' && (
                    <button className="btn-primary"
                      disabled={updating === app.id}
                      onClick={() => { if(window.confirm('Mark work as started? The client will not be able to cancel after this point without your agreement.')) handleMarkWorkStarted(app.id) }}>
                      ▶️ Start Work
                    </button>
                  )}

                  {/* Escrow: start work after funded */}
                  {app.payment_mode === 'escrow' && app.payment_status === 'paid' && !app.work_started_at && (
                    <button className="btn-primary"
                      disabled={updating === app.id}
                      onClick={() => { if(window.confirm('Start work on this job? This confirms escrow funds are received.')) handleMarkWorkStarted(app.id) }}>
                      ▶️ Start Work
                    </button>
                  )}

                  {/* Send invoice — show for both invoice and escrow modes after work starts */}
                  {app.work_started_at && !app.invoice_sent_at && (
                    <button className="btn-primary"
                      disabled={updating === app.id}
                      onClick={() => { setSelectedApp(app); setShowInvoiceModal(true) }}>
                      📨 Send Invoice to Client
                    </button>
                  )}

                  {app.invoice_sent_at && app.status !== 'completed' && (
                    <span style={{ fontSize: '13px', color: '#059669', fontWeight: '600' }}>
                      {app.payment_mode === 'escrow'
                        ? '✓ Invoice sent — itemization delivered to client'
                        : '✓ Invoice sent — awaiting payment'}
                    </span>
                  )}

                  {app.status === 'completed' && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 14px' }}>
                      <p style={{ fontWeight: '600', fontSize: '14px', color: '#166534', margin: '0 0 6px' }}>
                        ✓ Job completed
                      </p>
                      <p style={{ fontSize: '12px', color: '#166534', margin: '0 0 4px' }}>
                        The client has confirmed receipt of deliverables and closed the job.
                      </p>
                      {app.payment_mode === 'escrow' && app.agreed_amount_cents && (
                        <p style={{ fontSize: '12px', color: '#166534', margin: '4px 0 0', fontWeight: '500' }}>
                          💰 Escrow amount: ${(app.agreed_amount_cents / 100).toFixed(2)} — contact PI Connect to arrange payout until Stripe Connect is enabled.
                        </p>
                      )}
                      {app.payment_mode === 'invoice' && app.payment_status === 'paid' && (
                        <p style={{ fontSize: '12px', color: '#166534', margin: '4px 0 0', fontWeight: '500' }}>
                          💰 Payment received
                        </p>
                      )}
                    </div>
                  )}

                  {/* Deliverables upload — available once work has started */}
                  {app.work_started_at && (
                    <button className="btn-secondary-small"
                      onClick={() => { setSelectedApp(app); setShowDeliverablesModal(true) }}>
                      📁 Upload Case Files / Report
                    </button>
                  )}
                  {app.deliverables_uploaded_at && (
                    <span style={{ fontSize: '13px', color: '#059669' }}>
                      ✓ Files uploaded — visible to client
                    </span>
                  )}

                  {/* Additional funds request for escrow jobs */}
                  {app.status !== 'completed' && app.payment_mode === 'escrow' && app.work_started_at && !app.additional_escrow_status && (
                    <button className="btn-secondary-small"
                      onClick={() => { setSelectedApp(app); setShowAdditionalFundsModal(true) }}>
                      ➕ Request Additional Funds
                    </button>
                  )}
                  {app.additional_escrow_status === 'pending' && (
                    <span style={{ fontSize: '13px', color: '#d97706', fontWeight: '500' }}>⏳ Additional funds request pending client approval</span>
                  )}
                  {app.additional_escrow_status === 'approved' && (
                    <span style={{ fontSize: '13px', color: '#059669', fontWeight: '500' }}>✓ Additional funds approved</span>
                  )}
                  {app.additional_escrow_status === 'declined' && (
                    <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>✗ Additional funds request declined</span>
                  )}

                  {job && (
                    <>
                      <button className="btn-secondary-small"
                        onClick={() => { setSelectedJob(job); setShowSubcontractModal(true) }}>
                        🤝 Subcontract
                      </button>
                      <button className="btn-secondary-small"
                        onClick={() => { setSelectedJob(job); setShowReferralModal(true) }}>
                        ↗️ Refer
                      </button>
                      {job?.is_private && (
                        <button className="btn-secondary-small"
                          onClick={() => { if(window.confirm('Convert this to a public job posting?')) convertToPublic(job.id) }}>
                          🌐 Convert to Public
                        </button>
                      )}
                    </>
                  )}

                  {/* Cancellation */}
                  {app.status !== 'cancelled' && app.status !== 'completed' && (
                    app.work_started_at || app.payment_status === 'paid' ? (
                      // After work starts OR escrow is funded — can only request cancellation
                      app.cancel_requested_by ? (
                        <span style={{ fontSize: '13px', color: '#d97706', fontWeight: '500' }}>⏳ Cancellation request pending client approval</span>
                      ) : (
                        <button className="btn-danger-small"
                          disabled={updating === app.id}
                          onClick={() => handleCancelRequest(app.id, job)}>
                          {app.payment_status === 'paid' && !app.work_started_at
                            ? 'Request Cancellation (escrow will be refunded if approved)'
                            : 'Request Cancellation'}
                        </button>
                      )
                    ) : (
                      // Before work and before payment — can cancel freely
                      <button className="btn-danger-small"
                        disabled={updating === app.id}
                        onClick={() => handleCancelJob(app.id)}>
                        Cancel Job
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── My Subcontracts tab (I'm the field operative) ───────────────────────────
function MySubcontractsTab({ user }) {
  const [subcontracts, setSubcontracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { loadSubcontracts() }, [user])

  const loadSubcontracts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('subcontracts')
        .select('*, job:job_id (title, location, investigation_type)')
        .eq('subcontractor_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSubcontracts(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (id) => {
    await supabase.from('subcontracts').update({ status: 'accepted' }).eq('id', id)
    loadSubcontracts()
  }

  const handleDecline = async (id) => {
    await supabase.from('subcontracts').update({ status: 'declined' }).eq('id', id)
    loadSubcontracts()
  }

  const statusBadge = (status) => ({
    pending: { text: '⏳ Offer Pending', class: 'badge-pending' },
    accepted: { text: '✓ Accepted', class: 'badge-accepted' },
    declined: { text: '✗ Declined', class: 'badge-failed' },
    in_progress: { text: '▶ In Progress', class: 'badge-processing' },
    report_submitted: { text: '📄 Report Submitted', class: 'badge-pending' },
    revision_requested: { text: '✏️ Revision Requested', class: 'badge-failed' },
    approved: { text: '✓ Approved', class: 'badge-accepted' },
    completed: { text: '✅ Completed', class: 'badge-success' }
  }[status] || { text: status, class: 'badge-pending' })

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>

  return (
    <div>
      <div className="tab-header">
        <h2>My Subcontracts</h2>
        <p>Jobs where you're the field operative — reporting to the primary PI. Client details are not shown.</p>
      </div>

      {subcontracts.length === 0 ? (
        <div className="empty-state"><p>No subcontract offers yet.</p></div>
      ) : (
        <div className="jobs-list">
          {subcontracts.map(sub => {
            const badge = statusBadge(sub.status)
            const isExpanded = expanded === sub.id
            return (
              <div key={sub.id} className="job-management-card">
                <div className="job-card-header">
                  <div>
                    <h3>{sub.job?.title || 'Subcontract Job'}</h3>
                    <p className="job-meta">📍 {sub.job?.location} · {sub.job?.investigation_type}</p>
                    <p className="job-meta">
                      Rate: {sub.subcontractor_rate_cents
                        ? `$${(sub.subcontractor_rate_cents / 100).toFixed(2)}`
                        : 'To be confirmed'}
                    </p>
                    {sub.deadline && (
                      <p className="job-meta">⏰ Due: {new Date(sub.deadline).toLocaleDateString()}</p>
                    )}
                  </div>
                  <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                </div>

                {sub.status === 'pending' && (
                  <div className="job-card-actions">
                    <VerificationGate profile={profile} onNavigate={onNavigate}>
                      <button className="btn-primary-small" onClick={() => handleAccept(sub.id)}>✓ Accept</button>
                    </VerificationGate>
                    <button className="btn-secondary-small" onClick={() => handleDecline(sub.id)}>✗ Decline</button>
                  </div>
                )}

                {sub.job_details && (
                  <div className="job-details-section">
                    <button className="btn-text" onClick={() => setExpanded(isExpanded ? null : sub.id)}>
                      {isExpanded ? '▲ Hide job details' : '▼ View job details'}
                    </button>
                    {isExpanded && (
                      <div className="job-details-content">
                        <p>{sub.job_details}</p>
                      </div>
                    )}
                  </div>
                )}

                {['accepted', 'in_progress', 'report_submitted', 'revision_requested'].includes(sub.status) && (
                  <ReportWorkflow
                    subcontract={sub}
                    user={{ id: user.id }}
                    isPrimary={false}
                    onUpdate={loadSubcontracts}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ─── Referrals tab ────────────────────────────────────────────────────────────
function ReferralsTab({ user }) {
  const [outgoing, setOutgoing] = useState([])
  const [incoming, setIncoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('outgoing')

  useEffect(() => { loadReferrals() }, [user])

  const loadReferrals = async () => {
    setLoading(true)
    try {
      const [out, inc] = await Promise.all([
        supabase.from('referrals')
          .select('*, job:job_id (title, location), referred_pi:referred_pi_id (*)')
          .eq('referring_pi_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('referrals')
          .select('*, job:job_id (*, profiles:posted_by (full_name, email, phone)), referring_pi:referring_pi_id (*)')
          .eq('referred_pi_id', user.id)
          .order('created_at', { ascending: false })
      ])

      setOutgoing(out.data || [])
      setIncoming(inc.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptReferral = async (id) => {
    await supabase.from('referrals').update({ status: 'accepted' }).eq('id', id)
    loadReferrals()
  }

  const handleDeclineReferral = async (id) => {
    await supabase.from('referrals').update({ status: 'declined' }).eq('id', id)
    loadReferrals()
  }

  const statusBadge = (status) => ({
    pending: { text: '⏳ Pending', class: 'badge-pending' },
    accepted: { text: '✓ Accepted', class: 'badge-accepted' },
    declined: { text: '✗ Declined', class: 'badge-failed' },
    in_progress: { text: '▶ In Progress', class: 'badge-processing' },
    completed: { text: '✅ Completed', class: 'badge-success' },
    fee_paid: { text: '💰 Fee Paid', class: 'badge-success' }
  }[status] || { text: status, class: 'badge-pending' })

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>

  return (
    <div>
      <div className="tab-header">
        <h2>Referrals</h2>
        <p>Job handoffs — send or receive jobs and earn referral fees</p>
      </div>

      <div className="subtab-row">
        <button className={`subtab ${view === 'outgoing' ? 'active' : ''}`}
          onClick={() => setView('outgoing')}>
          Sent ({outgoing.length})
        </button>
        <button className={`subtab ${view === 'incoming' ? 'active' : ''}`}
          onClick={() => setView('incoming')}>
          Received ({incoming.length})
        </button>
      </div>

      {view === 'outgoing' && (
        outgoing.length === 0 ? (
          <div className="empty-state"><p>No referrals sent yet.</p></div>
        ) : (
          <div className="jobs-list">
            {outgoing.map(ref => {
              const badge = statusBadge(ref.status)
              const refPI = ref.referred_pi
              return (
                <div key={ref.id} className="job-management-card">
                  <div className="job-card-header">
                    <div>
                      <h3>{ref.job?.title}</h3>
                      <p className="job-meta">📍 {ref.job?.location}</p>
                      <p className="job-meta">
                        Referred to: <strong>
                          {refPI ? `${refPI.first_name} ${refPI.last_name}` : 'Unknown'}
                        </strong>
                      </p>
                      <p className="job-meta">
                        Your fee: <strong>{ref.referral_fee_percent}%
                          {ref.referral_fee_cents ? ` (~$${(ref.referral_fee_cents / 100).toFixed(2)})` : ''}
                        </strong>
                      </p>
                    </div>
                    <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                  </div>
                  {ref.handoff_note && (
                    <div className="job-details-content" style={{ marginTop: '8px' }}>
                      <strong>Handoff note:</strong> <span>{ref.handoff_note}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {view === 'incoming' && (
        incoming.length === 0 ? (
          <div className="empty-state"><p>No referrals received yet.</p></div>
        ) : (
          <div className="jobs-list">
            {incoming.map(ref => {
              const badge = statusBadge(ref.status)
              const refPI = ref.referring_pi
              const job = ref.job
              const client = job?.profiles
              return (
                <div key={ref.id} className="job-management-card">
                  <div className="job-card-header">
                    <div>
                      <h3>{job?.title}</h3>
                      <p className="job-meta">📍 {job?.location} · {job?.investigation_type}</p>
                      <p className="job-meta">
                        Referred by: <strong>
                          {refPI ? `${refPI.first_name} ${refPI.last_name}` : 'Unknown'}
                        </strong>
                      </p>
                      <p className="job-meta">
                        Referral fee owed: <strong>{ref.referral_fee_percent}%</strong>
                      </p>
                    </div>
                    <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                  </div>

                  {ref.handoff_note && (
                    <div className="job-details-content" style={{ marginTop: '8px' }}>
                      <strong>From {refPI?.first_name}:</strong> <span>{ref.handoff_note}</span>
                    </div>
                  )}

                  {/* Full client info shown on accepted referrals */}
                  {ref.status !== 'pending' && ref.status !== 'declined' && client && (
                    <div className="client-info-revealed">
                      <h4>📋 Client Information</h4>
                      <p><strong>Name:</strong> {client.full_name}</p>
                      {client.email && <p><strong>Email:</strong> {client.email}</p>}
                      {client.phone && <p><strong>Phone:</strong> {client.phone}</p>}
                      {job?.description && <p><strong>Case:</strong> {job.description}</p>}
                    </div>
                  )}

                  {ref.status === 'pending' && (
                    <div className="job-card-actions">
                      <div className="info-box" style={{ marginBottom: '8px' }}>
                        <small>Accept to see full client information and take ownership of this job.</small>
                      </div>
                      <VerificationGate profile={profile} onNavigate={onNavigate}>
                        <button className="btn-primary-small" onClick={() => handleAcceptReferral(ref.id)}>
                          ✓ Accept Referral
                        </button>
                      </VerificationGate>
                      <button className="btn-secondary-small" onClick={() => handleDeclineReferral(ref.id)}>
                        ✗ Decline
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

// ─── Main JobsPage ────────────────────────────────────────────────────────────
export default function JobsPage({ user, profile, onNavigate, initialTab }) {
  const isPI = profile?.type === 'pi'

  if (!profile) return null

  // Clients don't need the marketplace — redirect to their dashboard
  if (user && profile && !isPI) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
        <h2 style={{ marginBottom: '12px' }}>Looking for an Investigator?</h2>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          Post a job from your dashboard and PIs will apply, or search for a PI directly.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={() => onNavigate('dashboard')}>Go to My Dashboard</button>
          <button className="btn-secondary" onClick={() => onNavigate('search')}>Search for a PI</button>
        </div>
      </div>
    )
  }

  // Non-PI users just see the marketplace
  const tabs = isPI ? [
    { key: 'marketplace', label: '🔍 Marketplace' },
    { key: 'my-jobs', label: '💼 My Jobs' },
    { key: 'my-subcontracts', label: '📋 My Subcontracts' },
    { key: 'i-subcontracted', label: '🤝 I Subcontracted' },
    { key: 'referrals', label: '↗️ Referrals' },
  ] : []

  const [activeTab, setActiveTab] = useState(initialTab || 'marketplace')

  // Respond to initialTab prop changes (e.g. deep links)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  if (!isPI) {
    return (
      <div className="jobs-page">
        <MarketplaceTab user={user} profile={profile} onNavigate={onNavigate} />
      </div>
    )
  }

  return (
    <div className="jobs-page">
      <div className="jobs-page-tabs">
        {tabs.map(tab => (
          <button key={tab.key}
            className={`jobs-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="jobs-tab-content">
        {activeTab === 'marketplace' && <MarketplaceTab user={user} profile={profile} onNavigate={onNavigate} />}
        {activeTab === 'my-jobs' && <MyJobsTab user={user} profile={profile} onNavigate={onNavigate} />}
        {activeTab === 'my-subcontracts' && <MySubcontractsTab user={user} />}
        {activeTab === 'i-subcontracted' && <ISubcontractedTab user={user} onNavigate={onNavigate} />}
        {activeTab === 'referrals' && <ReferralsTab user={user} />}
      </div>
    </div>
  )
}
