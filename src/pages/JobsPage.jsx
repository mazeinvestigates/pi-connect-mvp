import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import JobCard from '../components/JobCard'
import JobApplicationModal from '../components/JobApplicationModal'
import RecommendedJobsSection from '../components/RecommendedJobsSection'
import { VerificationGate, UnverifiedBanner } from '../components/VerificationGate'
import SubcontractModal from '../components/SubcontractModal'
import AISummaryModal from '../components/AISummaryModal'
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
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryJob, setSummaryJob] = useState(null)
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
          onNavigate={onNavigate}
          onClose={() => { setShowSubcontractModal(false); setSelectedJob(null) }}
          onSuccess={() => { setShowSubcontractModal(false); setSelectedJob(null); alert('Subcontract offer sent!') }} />
      )}

      {showSummaryModal && summaryJob && (
        <AISummaryModal job={summaryJob} user={user} profile={profile}
          onClose={() => { setShowSummaryModal(false); setSummaryJob(null) }} />
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
  const [privateJobs, setPrivateJobs] = useState([])
  const [loadingPrivate, setLoadingPrivate] = useState(true)
  const [expandedArchiveJob, setExpandedArchiveJob] = useState(null)
  const [expandedJob, setExpandedJob] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [editingRate, setEditingRate] = useState(null) // app id
  const [editRateValue, setEditRateValue] = useState('')
  const [editRateType, setEditRateType] = useState('hourly')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showSubcontractModal, setShowSubcontractModal] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryJob, setSummaryJob] = useState(null)
  const [updating, setUpdating] = useState(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showAdditionalFundsModal, setShowAdditionalFundsModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [showDeliverablesModal, setShowDeliverablesModal] = useState(false)
  const [selectedApp, setSelectedApp] = useState(null)

  useEffect(() => { loadMyJobs() }, [user])
  useEffect(() => { loadPrivateJobs() }, [user])

  const loadPrivateJobs = async () => {
    setLoadingPrivate(true)
    try {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('posted_by', user.id)
        .eq('is_private', true)
        .order('created_at', { ascending: false })
      setPrivateJobs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingPrivate(false)
    }
  }

  const handleConvertToPublic = async (jobId) => {
    if (!window.confirm('Make this job visible in the public marketplace?')) return
    await supabase.from('jobs').update({ is_private: false }).eq('id', jobId)
    loadPrivateJobs()
  }

  const handleDeletePrivateJob = async (jobId) => {
    if (!window.confirm('Delete this private job? This cannot be undone.')) return
    await supabase.from('jobs').delete().eq('id', jobId)
    loadPrivateJobs()
  }

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
      setInitialLoadDone(true)
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

  const handleUpdateRate = async (appId) => {
    if (!editRateValue || parseFloat(editRateValue) <= 0) {
      alert('Please enter a valid rate.')
      return
    }
    setUpdating(appId)
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({
          proposed_rate: parseFloat(editRateValue),
          rate_type: editRateType
        })
        .eq('id', appId)
      if (error) throw error
      setEditingRate(null)
      loadMyJobs()
    } catch (err) {
      alert('Failed to update rate.')
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

  if (loading && !initialLoadDone) return <div className="loading-container"><div className="spinner"></div></div>

  return (
    <div>
      <div className="tab-header">
        <h2>My Jobs</h2>
        <p>Jobs you've been accepted for as the primary PI</p>
      </div>

      {/* Private Jobs Section */}
      {privateJobs.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
            🔒 My Private Jobs
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {privateJobs.map(job => (
              <div key={job.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>{job.title}</h4>
                      <span className="private-job-badge">🔒 Private</span>
                      <span className={`status-badge badge-${job.status}`}>{job.status}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 2px' }}>📍 {job.city}, {job.state} · {job.investigation_type}</p>
                    {job.budget_min && job.budget_max && (
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>💰 ${job.budget_min} – ${job.budget_max}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-secondary-small"
                      onClick={() => { setSelectedJob(job); setShowSubcontractModal(true) }}>
                      🔗 Subcontract
                    </button>
                    <button className="btn-secondary-small"
                      onClick={() => handleConvertToPublic(job.id)}>
                      🌐 Make Public
                    </button>
                    <button className="btn-danger-small"
                      onClick={() => handleDeletePrivateJob(job.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                {job.description && (
                  <p style={{ fontSize: '13px', color: '#374151', marginTop: '10px', lineHeight: '1.5', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                    {job.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Jobs Section */}
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
        ✓ Accepted Jobs
      </h3>

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
                <div className="job-card-header" style={{ cursor: job?.description ? 'pointer' : 'default' }}
                  onClick={() => job?.description && setExpandedJob(expandedJob === app.id ? null : app.id)}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3>{job?.title}</h3>
                      {job?.is_private && <span className="private-job-badge">🔒 Private</span>}
                      {job?.posted_by_pi && <span className="pi-posted-badge">🤝 Subcontract Sought</span>}
                    </div>
                    <p className="job-meta">📍 {job?.location} · {job?.investigation_type}</p>
                    <p className="job-meta">Client: {job?.profiles?.full_name}</p>
                    {job?.budget_min && job?.budget_max && (
                      <p className="job-meta">💰 Budget: ${job.budget_min} – ${job.budget_max}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                    {job?.description && (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{expandedJob === app.id ? '▲' : '▼'}</span>
                    )}
                  </div>
                </div>

                {expandedJob === app.id && job?.description && (
                  <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                    <p style={{ fontWeight: '600', marginBottom: '6px' }}>Case Details</p>
                    <p style={{ margin: 0 }}>{job.description}</p>
                    {job.urgency && <p style={{ marginTop: '8px', color: '#6b7280' }}>Urgency: {job.urgency}</p>}
                    {job.deadline && <p style={{ marginTop: '4px', color: '#6b7280' }}>Deadline: {new Date(job.deadline).toLocaleDateString()}</p>}
                  </div>
                )}

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
                {app.status === 'accepted' && !app.work_started_at && (
                  <div style={{ marginBottom: '12px', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: 0 }}>
                        💰 Agreed Rate: {app.proposed_rate
                          ? `$${app.proposed_rate}${app.rate_type === 'flat' ? ' flat fee' : '/hr'}`
                          : 'Not set'}
                      </p>
                      {editingRate !== app.id && (
                        <button type="button"
                          onClick={() => { setEditingRate(app.id); setEditRateValue(app.proposed_rate || ''); setEditRateType(app.rate_type || 'hourly') }}
                          style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '12px', padding: 0 }}>
                          ✏️ Adjust rate
                        </button>
                      )}
                    </div>
                    {editingRate === app.id && (
                      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                          Update the agreed rate. The client will see the new rate on their dashboard.
                        </p>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                          {[{v:'hourly',l:'Hourly'},{v:'flat',l:'Flat Fee'}].map(o => (
                            <button key={o.v} type="button"
                              onClick={() => setEditRateType(o.v)}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '12px', background: editRateType === o.v ? '#667eea' : 'white', color: editRateType === o.v ? 'white' : '#374151' }}>
                              {o.l}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="number" min="0" step="0.01"
                            value={editRateValue}
                            onChange={e => setEditRateValue(e.target.value)}
                            placeholder={editRateType === 'flat' ? 'Total flat fee' : 'Hourly rate'}
                            style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
                          <button type="button" onClick={() => handleUpdateRate(app.id)}
                            disabled={updating === app.id}
                            style={{ background: '#667eea', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingRate(null)}
                            style={{ background: 'none', border: '1px solid #e5e7eb', color: '#374151', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {app.payment_status !== 'paid' && app.status === 'accepted' && !app.work_started_at && (
                  <div className="payment-mode-selector">
                    <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                      Payment Mode
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={app.payment_mode === 'escrow' || !app.payment_mode ? 'btn-mode-inactive' : 'btn-mode-active'}
                        onClick={() => handleSetPaymentMode(app.id, 'invoice')}
                        style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', background: app.payment_mode === 'invoice' ? '#667eea' : 'white', color: app.payment_mode === 'invoice' ? 'white' : '#374151' }}
                      >
                        📄 Invoice on Completion
                      </button>
                      <button
                        type="button"
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
                    <>
                      <button type="button" className="btn-secondary-small"
                        onClick={() => { setSelectedApp(app); setShowDeliverablesModal(true) }}>
                        📁 Upload Case Files / Report
                      </button>
                      <button type="button" className="btn-secondary-small"
                        onClick={() => { setSummaryJob(job); setShowSummaryModal(true) }}>
                        ✨ AI Case Summary
                      </button>
                    </>
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
          {jobs.filter(a => ['completed','cancelled'].includes(a.status)).length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <button
                onClick={() => setShowArchive(prev => !prev)}
                style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px', color: '#6b7280', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🗂 Archived Jobs ({jobs.filter(a => ['completed','cancelled'].includes(a.status)).length})</span>
                <span>{showArchive ? '▲ Hide' : '▼ Show'}</span>
              </button>
              {showArchive && (
                <div style={{ marginTop: '12px' }}>
                  {jobs.filter(a => ['completed','cancelled'].includes(a.status)).map(app => {
                    const job = app.job
                    const badge = getStatusBadge(app.status)
                    const isExpanded = expandedArchiveJob === app.id
                    return (
                      <div key={app.id} className="job-management-card" style={{ opacity: 0.9 }}>
                        <div className="job-card-header" style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedArchiveJob(isExpanded ? null : app.id)}>
                          <div>
                            <h3>{job?.title}</h3>
                            <p className="job-meta">📍 {job?.location} · {job?.investigation_type}</p>
                            <p className="job-meta">
                              {app.completed_at ? `Completed ${new Date(app.completed_at).toLocaleDateString()}` :
                               app.cancelled_at ? `Cancelled ${new Date(app.cancelled_at).toLocaleDateString()}` : ''}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="job-card-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {app.payment_mode === 'escrow' && app.agreed_amount_cents && (
                                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px' }}>
                                  <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>💰 Escrow Payment</p>
                                  <p style={{ fontSize: '13px', margin: 0 }}>${(app.agreed_amount_cents / 100).toFixed(2)} — {app.payment_status === 'paid' ? 'funded by client' : app.payment_status}</p>
                                </div>
                              )}
                              {app.contract_status && (
                                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px' }}>
                                  <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>📄 Contract</p>
                                  <p style={{ fontSize: '13px', margin: '0 0 6px' }}>
                                    {app.contract_type === 'platform' ? 'PI Connect standard agreement' : 'Custom contract'} — {app.contract_status === 'signed' ? `Signed${app.contract_signed_at ? ` on ${new Date(app.contract_signed_at).toLocaleDateString()}` : ''}` : app.contract_status}
                                  </p>
                                  {app.contract_file_path && (
                                    <button style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                                      onClick={async () => { const { data } = await supabase.storage.from('contracts').createSignedUrl(app.contract_file_path, 3600); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }}>
                                      📄 Download Contract
                                    </button>
                                  )}
                                </div>
                              )}
                              {app.invoice_sent_at && (
                                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px' }}>
                                  <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>🧾 Invoice</p>
                                  <p style={{ fontSize: '13px', margin: '0 0 6px' }}>Sent {new Date(app.invoice_sent_at).toLocaleDateString()}{app.invoice_amount_cents ? ` · $${(app.invoice_amount_cents / 100).toFixed(2)}` : ''}</p>
                                  {app.invoice_file_path && (
                                    <button style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                                      onClick={async () => { const { data } = await supabase.storage.from('invoices').createSignedUrl(app.invoice_file_path, 3600); if (data?.signedUrl) window.open(data.signedUrl, '_blank') }}>
                                      📄 Download Invoice
                                    </button>
                                  )}
                                </div>
                              )}
                              {app.deliverables_uploaded_at && (
                                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px' }}>
                                  <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>📁 Case Files</p>
                                  <p style={{ fontSize: '13px', margin: 0 }}>Uploaded {new Date(app.deliverables_uploaded_at).toLocaleDateString()}</p>
                                  <ArchivedDeliverables appId={app.id} />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showSubcontractModal && selectedJob && (
        <SubcontractModal job={selectedJob} user={user} piProfile={profile}
          onNavigate={onNavigate}
          onClose={() => { setShowSubcontractModal(false); setSelectedJob(null) }}
          onSuccess={() => { setShowSubcontractModal(false); setSelectedJob(null); alert('Subcontract offer sent!') }} />
      )}

      {showSummaryModal && summaryJob && (
        <AISummaryModal job={summaryJob} user={user} profile={profile}
          onClose={() => { setShowSummaryModal(false); setSummaryJob(null) }} />
      )}

      {showReferralModal && selectedJob && (
        <ReferralModal job={selectedJob} user={user}
          onClose={() => { setShowReferralModal(false); setSelectedJob(null) }}
          onSuccess={() => { setShowReferralModal(false); setSelectedJob(null); alert('Referral sent!') }} />
      )}

      {showInvoiceModal && selectedApp && (
        <SendInvoiceModal
          app={selectedApp}
          job={jobs.find(j => j.id === selectedApp.job_id)?.job || selectedApp.job}
          user={user}
          onClose={() => { setShowInvoiceModal(false); setSelectedApp(null) }}
          onSuccess={() => { setShowInvoiceModal(false); setSelectedApp(null); loadMyJobs(); alert('Invoice sent to client!') }}
        />
      )}

      {showAdditionalFundsModal && selectedApp && (
        <RequestAdditionalFundsModal
          app={selectedApp}
          job={jobs.find(j => j.id === selectedApp.job_id) || selectedApp.job}
          user={user}
          onClose={() => { setShowAdditionalFundsModal(false); setSelectedApp(null) }}
          onSuccess={() => { setShowAdditionalFundsModal(false); setSelectedApp(null); loadMyJobs(); alert('Request sent to client!') }}
        />
      )}

      {showContractModal && selectedApp && (
        <SendContractModal
          app={selectedApp}
          job={jobs.find(j => j.id === selectedApp.job_id)?.job || selectedApp.job}
          user={user}
          piProfile={profile}
          onClose={() => { setShowContractModal(false); setSelectedApp(null) }}
          onSuccess={() => { setShowContractModal(false); setSelectedApp(null); loadMyJobs(); alert('Contract sent to client!') }}
        />
      )}

      {showDeliverablesModal && selectedApp && (
        <DeliverablesModal
          app={selectedApp}
          job={jobs.find(j => j.id === selectedApp.job_id) || selectedApp.job}
          user={user}
          onClose={() => { setShowDeliverablesModal(false); setSelectedApp(null) }}
          onSuccess={() => { setShowDeliverablesModal(false); setSelectedApp(null); loadMyJobs(); alert('Files uploaded — client can now download them.') }}
        />
      )}
    </div>
  )
}

function RateNegotiationResponse({ subId, onRefresh }) {
  const [mode, setMode] = useState(null) // 'approve' | 'counter'
  const [counterType, setCounterType] = useState('hourly')
  const [counterRate, setCounterRate] = useState('')
  const [counterMessage, setCounterMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const handleApprove = async () => {
    setSaving(true)
    const { data: sub } = await supabase.from('subcontracts').select('subcontractor_proposed_rate, subcontractor_proposed_rate_type').eq('id', subId).single()
    await supabase.from('subcontracts').update({
      status: 'accepted',
      rate_status: 'agreed',
      agreed_rate: sub.subcontractor_proposed_rate,
      agreed_rate_type: sub.subcontractor_proposed_rate_type
    }).eq('id', subId)
    setSaving(false)
    onRefresh()
  }

  const handleCounter = async () => {
    if (!counterRate) { alert('Please enter a counter rate.'); return }
    setSaving(true)
    await supabase.from('subcontracts').update({
      rate_status: 'countered',
      counter_offer_rate: parseFloat(counterRate),
      counter_offer_rate_type: counterType,
      counter_offer_message: counterMessage || null
    }).eq('id', subId)
    setSaving(false)
    setMode(null)
    onRefresh()
  }

  if (mode === 'counter') return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {[{v:'hourly',l:'Hourly'},{v:'fixed',l:'Fixed'},{v:'percentage',l:'% of Fee'}].map(o => (
          <button key={o.v} type="button" onClick={() => setCounterType(o.v)}
            style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '12px',
              background: counterType === o.v ? '#667eea' : 'white', color: counterType === o.v ? 'white' : '#374151' }}>
            {o.l}
          </button>
        ))}
      </div>
      <input type="number" min="0" step="0.01" value={counterRate} onChange={e => setCounterRate(e.target.value)}
        placeholder="Your counter rate" style={{ width: '100%', marginBottom: '6px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
      <textarea value={counterMessage} onChange={e => setCounterMessage(e.target.value)}
        placeholder="Optional message..." rows={2}
        style={{ width: '100%', marginBottom: '8px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn-primary-small" onClick={handleCounter} disabled={saving}>Send Counter</button>
        <button className="btn-secondary-small" onClick={() => setMode(null)}>Cancel</button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button className="btn-primary-small" onClick={handleApprove} disabled={saving}>✓ Approve Rate</button>
      <button className="btn-secondary-small" onClick={() => setMode('counter')}>↩ Counter</button>
    </div>
  )
}

// ─── I Subcontracted tab (I'm the primary PI) ────────────────────────────────
function ISubcontractedTab({ user, onNavigate }) {
  const [subcontracts, setSubcontracts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSubcontracts() }, [user])

  const loadSubcontracts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('subcontracts')
        .select('*, job:job_id (title, location, investigation_type), subcontractor:subcontractor_id (*)')
        .eq('primary_pi_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setSubcontracts(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleWithdrawOffer = async (id) => {
    if (!window.confirm('Withdraw this subcontract offer? The offer will be cancelled and the PI will be notified.')) return
    await supabase.from('subcontracts').update({ status: 'withdrawn' }).eq('id', id)
    loadSubcontracts()
  }

  const handleRequestCancellation = async (id) => {
    const reason = window.prompt('Please provide a reason for requesting cancellation:')
    if (!reason) return
    await supabase.from('subcontracts').update({
      cancel_requested_by: 'primary',
      cancel_request_reason: reason,
      cancel_requested_at: new Date().toISOString()
    }).eq('id', id)
    loadSubcontracts()
  }

  const handleApproveCancellation = async (id) => {
    if (!window.confirm("Approve the subcontractor's cancellation request?")) return
    await supabase.from('subcontracts').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    }).eq('id', id)
    loadSubcontracts()
  }

  const handleDeclineCancellation = async (id) => {
    await supabase.from('subcontracts').update({
      cancel_requested_by: null,
      cancel_request_reason: null,
      cancel_requested_at: null
    }).eq('id', id)
    loadSubcontracts()
  }

  const statusBadge = (status) => ({
    pending: { text: '⏳ Offer Sent', class: 'badge-pending' },
    withdrawn: { text: '↩ Withdrawn', class: 'badge-failed' },
    cancelled: { text: '✗ Cancelled', class: 'badge-failed' },
    accepted: { text: '✓ Accepted', class: 'badge-accepted' },
    declined: { text: '✗ Declined', class: 'badge-failed' },
    in_progress: { text: '▶ In Progress', class: 'badge-processing' },
    report_submitted: { text: '📄 Review Required', class: 'badge-pending' },
    revision_requested: { text: '✏️ Revisions Requested', class: 'badge-failed' },
    approved: { text: '✓ Ready to Deliver', class: 'badge-accepted' },
    completed: { text: '✅ Delivered', class: 'badge-success' }
  }[status] || { text: status, class: 'badge-pending' })

  if (loading && !initialLoadDone) return <div className="loading-container"><div className="spinner"></div></div>

  return (
    <div>
      <div className="tab-header">
        <h2>I Subcontracted</h2>
        <p>Jobs you have farmed out — you remain client-facing and manage the subcontractor.</p>
      </div>
      {subcontracts.length === 0 ? (
        <div className="empty-state"><p>No subcontracts created yet.</p></div>
      ) : (
        <div className="jobs-list">
          {subcontracts.map(sub => {
            const badge = statusBadge(sub.status)
            const subPI = sub.subcontractor
            return (
              <div key={sub.id} className="job-management-card">
                <div className="job-card-header">
                  <div>
                    <h3>{sub.job?.title || 'Subcontract'}</h3>
                    <p className="job-meta">📍 {sub.job?.location}</p>
                    <p className="job-meta">Field operative: <strong>{subPI ? `${subPI.first_name} ${subPI.last_name}` : 'Unknown'}</strong></p>
                    <p className="job-meta">Rate: {
                      sub.agreed_rate ? (
                        sub.agreed_rate_type === 'hourly' ? `$${sub.agreed_rate}/hr (agreed)` :
                        sub.agreed_rate_type === 'percentage' ? `${sub.agreed_rate}% (agreed)` :
                        `$${sub.agreed_rate} fixed (agreed)`
                      ) : sub.rate_type === 'open' ? 'Open — awaiting sub proposal' :
                      sub.subcontractor_rate_cents ? (
                        sub.rate_type === 'hourly' ? `$${(sub.subcontractor_rate_cents/100).toFixed(2)}/hr offered` :
                        sub.rate_type === 'percentage' ? `${sub.subcontractor_rate_cents/100}% offered` :
                        `$${(sub.subcontractor_rate_cents/100).toFixed(2)} fixed offered`
                      ) : 'TBD'
                    }</p>
                  </div>
                  <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                </div>
                <div className="job-card-actions" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                  <button className="btn-secondary-small" onClick={() => onNavigate('messages')}>💬 Message Subcontractor</button>

                  {sub.status === 'pending' && !sub.cancel_requested_by && (
                    <button className="btn-danger-small"
                      onClick={() => handleWithdrawOffer(sub.id)}>
                      ↩ Withdraw Offer
                    </button>
                  )}

                  {['accepted','in_progress'].includes(sub.status) && !sub.cancel_requested_by && (
                    <button className="btn-danger-small"
                      onClick={() => handleRequestCancellation(sub.id)}>
                      Request Cancellation
                    </button>
                  )}

                  {sub.cancel_requested_by === 'primary' && (
                    <span style={{ fontSize: '13px', color: '#d97706', fontWeight: '500' }}>
                      ⏳ Cancellation request pending subcontractor approval
                    </span>
                  )}

                  {sub.cancel_requested_by === 'sub' && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', width: '100%' }}>
                      <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>⚠️ Subcontractor requested cancellation</p>
                      {sub.cancel_request_reason && (
                        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>Reason: "{sub.cancel_request_reason}"</p>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-primary-small" onClick={() => handleApproveCancellation(sub.id)}>Approve</button>
                        <button className="btn-secondary-small" onClick={() => handleDeclineCancellation(sub.id)}>Decline</button>
                      </div>
                    </div>
                  )}

                  {/* Sub proposed a rate — primary can approve or counter */}
                  {sub.rate_status === 'proposed' && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', width: '100%' }}>
                      <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>Sub proposed a rate:</p>
                      <p style={{ fontSize: '13px', marginBottom: sub.subcontractor_proposal_message ? '4px' : '10px' }}>
                        {sub.subcontractor_proposed_rate_type === 'hourly' ? `$${sub.subcontractor_proposed_rate}/hr` :
                         sub.subcontractor_proposed_rate_type === 'percentage' ? `${sub.subcontractor_proposed_rate}%` :
                         `$${sub.subcontractor_proposed_rate} fixed`}
                      </p>
                      {sub.subcontractor_proposal_message && (
                        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px', fontStyle: 'italic' }}>"{sub.subcontractor_proposal_message}"</p>
                      )}
                      <RateNegotiationResponse subId={sub.id} onRefresh={loadSubcontracts} />
                    </div>
                  )}
                </div>
                {['in_progress', 'report_submitted', 'revision_requested', 'approved'].includes(sub.status) && (
                  <ReportWorkflow subcontract={sub} user={{ id: user.id }} isPrimary={true} onUpdate={loadSubcontracts} />
                )}
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

  const [proposingRate, setProposingRate] = useState(null) // sub id
  const [proposedRateType, setProposedRateType] = useState('hourly')
  const [proposedRateValue, setProposedRateValue] = useState('')
  const [proposalMessage, setProposalMessage] = useState('')

  const formatRate = (sub) => {
    const agreed = sub.agreed_rate
    const agreedType = sub.agreed_rate_type
    if (agreed && agreedType) {
      if (agreedType === 'percentage') return `${agreed}% of client fee (agreed)`
      if (agreedType === 'hourly') return `$${agreed}/hr (agreed)`
      return `$${agreed} fixed (agreed)`
    }
    if (sub.rate_type === 'open') return 'Open — awaiting your proposal'
    if (sub.rate_type === 'hourly' && sub.subcontractor_rate_cents) return `$${(sub.subcontractor_rate_cents / 100).toFixed(2)}/hr`
    if (sub.rate_type === 'percentage' && sub.subcontractor_rate_cents) return `${sub.subcontractor_rate_cents / 100}% of client fee`
    if (sub.subcontractor_rate_cents) return `$${(sub.subcontractor_rate_cents / 100).toFixed(2)} fixed`
    return 'To be confirmed'
  }

  const handleAcceptAtOfferedRate = async (id) => {
    const sub = subcontracts.find(s => s.id === id)
    await supabase.from('subcontracts').update({
      status: 'accepted',
      rate_status: 'agreed',
      agreed_rate: sub.subcontractor_rate_cents / 100,
      agreed_rate_type: sub.rate_type
    }).eq('id', id)
    loadSubcontracts()
  }

  const handleProposeRate = async (id) => {
    if (!proposedRateValue) { alert('Please enter a rate.'); return }
    await supabase.from('subcontracts').update({
      status: 'pending',
      rate_status: 'proposed',
      subcontractor_proposed_rate: parseFloat(proposedRateValue),
      subcontractor_proposed_rate_type: proposedRateType,
      subcontractor_proposal_message: proposalMessage || null
    }).eq('id', id)
    setProposingRate(null)
    setProposedRateValue('')
    setProposalMessage('')
    loadSubcontracts()
  }

  const handleAcceptCounterOffer = async (id) => {
    const sub = subcontracts.find(s => s.id === id)
    await supabase.from('subcontracts').update({
      status: 'accepted',
      rate_status: 'agreed',
      agreed_rate: sub.counter_offer_rate,
      agreed_rate_type: sub.counter_offer_rate_type
    }).eq('id', id)
    loadSubcontracts()
  }

  const handleDecline = async (id) => {
    await supabase.from('subcontracts').update({ status: 'declined' }).eq('id', id)
    loadSubcontracts()
  }

  const handleSubRequestCancellation = async (id) => {
    const reason = window.prompt('Please provide a reason for requesting cancellation:')
    if (!reason) return
    await supabase.from('subcontracts').update({
      cancel_requested_by: 'sub',
      cancel_request_reason: reason,
      cancel_requested_at: new Date().toISOString()
    }).eq('id', id)
    loadSubcontracts()
  }

  const handleSubApproveCancellation = async (id) => {
    if (!window.confirm('Approve the cancellation request?')) return
    await supabase.from('subcontracts').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    }).eq('id', id)
    loadSubcontracts()
  }

  const handleSubDeclineCancellation = async (id) => {
    await supabase.from('subcontracts').update({
      cancel_requested_by: null,
      cancel_request_reason: null,
      cancel_requested_at: null
    }).eq('id', id)
    loadSubcontracts()
  }

  const statusBadge = (status) => ({
    pending: { text: '⏳ Offer Pending', class: 'badge-pending' },
    accepted: { text: '✓ Accepted', class: 'badge-accepted' },
    declined: { text: '✗ Declined', class: 'badge-failed' },
    withdrawn: { text: '↩ Offer Withdrawn', class: 'badge-failed' },
    cancelled: { text: '✗ Cancelled', class: 'badge-failed' },
    in_progress: { text: '▶ In Progress', class: 'badge-processing' },
    report_submitted: { text: '📄 Report Submitted', class: 'badge-pending' },
    revision_requested: { text: '✏️ Revision Requested', class: 'badge-failed' },
    approved: { text: '✓ Approved', class: 'badge-accepted' },
    completed: { text: '✅ Completed', class: 'badge-success' }
  }[status] || { text: status, class: 'badge-pending' })

  if (loading && !initialLoadDone) return <div className="loading-container"><div className="spinner"></div></div>

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
                    <p className="job-meta">Rate: {formatRate(sub)}</p>
                    {sub.deadline && (
                      <p className="job-meta">⏰ Due: {new Date(sub.deadline).toLocaleDateString()}</p>
                    )}
                  </div>
                  <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                </div>

                {sub.status === 'pending' && sub.rate_status !== 'proposed' && (
                  <div className="job-card-actions" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                    {/* Counter-offer from primary PI */}
                    {sub.rate_status === 'countered' && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', width: '100%' }}>
                        <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>Primary PI counter-offered:</p>
                        <p style={{ fontSize: '13px', marginBottom: sub.counter_offer_message ? '4px' : '8px' }}>
                          {sub.counter_offer_rate_type === 'hourly' ? `$${sub.counter_offer_rate}/hr` :
                           sub.counter_offer_rate_type === 'percentage' ? `${sub.counter_offer_rate}%` :
                           `$${sub.counter_offer_rate} fixed`}
                        </p>
                        {sub.counter_offer_message && (
                          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontStyle: 'italic' }}>"{sub.counter_offer_message}"</p>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-primary-small" onClick={() => handleAcceptCounterOffer(sub.id)}>✓ Accept Counter</button>
                          <button className="btn-secondary-small" onClick={() => handleDecline(sub.id)}>✗ Decline</button>
                        </div>
                      </div>
                    )}

                    {sub.rate_status !== 'countered' && (
                      <>
                        {proposingRate === sub.id ? (
                          <div style={{ width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px' }}>
                            <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '8px' }}>Propose your rate</p>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                              {[{v:'hourly',l:'Hourly'},{v:'fixed',l:'Fixed Total'},{v:'percentage',l:'% of Fee'}].map(o => (
                                <button key={o.v} type="button" onClick={() => setProposedRateType(o.v)}
                                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '12px',
                                    background: proposedRateType === o.v ? '#667eea' : 'white', color: proposedRateType === o.v ? 'white' : '#374151' }}>
                                  {o.l}
                                </button>
                              ))}
                            </div>
                            <input type="number" min="0" step="0.01" value={proposedRateValue}
                              onChange={e => setProposedRateValue(e.target.value)}
                              placeholder={proposedRateType === 'hourly' ? 'e.g., 85.00/hr' : proposedRateType === 'percentage' ? 'e.g., 75' : 'e.g., 650.00'}
                              style={{ width: '100%', marginBottom: '8px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
                            <textarea value={proposalMessage} onChange={e => setProposalMessage(e.target.value)}
                              placeholder="Optional message to primary PI..."
                              rows={2} style={{ width: '100%', marginBottom: '8px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn-primary-small" onClick={() => handleProposeRate(sub.id)}>Send Proposal</button>
                              <button className="btn-secondary-small" onClick={() => setProposingRate(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {sub.rate_type !== 'open' && (
                              <button className="btn-primary-small" onClick={() => handleAcceptAtOfferedRate(sub.id)}>✓ Accept at offered rate</button>
                            )}
                            <button className="btn-secondary-small" onClick={() => setProposingRate(sub.id)}>
                              {sub.rate_type === 'open' ? '💬 Propose my rate' : '💬 Counter-offer'}
                            </button>
                            <button className="btn-danger-small" onClick={() => handleDecline(sub.id)}>✗ Decline</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Pending primary PI approval of sub's proposal */}
                {sub.status === 'pending' && sub.rate_status === 'proposed' && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', margin: '8px 16px' }}>
                    <p style={{ fontSize: '13px', color: '#92400e', margin: 0 }}>⏳ Your rate proposal is awaiting approval from the primary PI.</p>
                    {sub.subcontractor_proposal_message && <p style={{ fontSize: '13px', color: '#92400e', marginTop: '4px', fontStyle: 'italic' }}>Your message: "{sub.subcontractor_proposal_message}"</p>}
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

                {['accepted','in_progress'].includes(sub.status) && !sub.cancel_requested_by && (
                  <div style={{ padding: '4px 16px 8px' }}>
                    <button className="btn-danger-small"
                      onClick={() => handleSubRequestCancellation(sub.id)}>
                      Request Cancellation
                    </button>
                  </div>
                )}

                {sub.cancel_requested_by === 'sub' && (
                  <div style={{ padding: '4px 16px 8px' }}>
                    <span style={{ fontSize: '13px', color: '#d97706' }}>⏳ Cancellation request pending primary PI approval</span>
                  </div>
                )}

                {sub.cancel_requested_by === 'primary' && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', margin: '4px 16px 8px' }}>
                    <p style={{ fontWeight: '600', fontSize: '13px', marginBottom: '4px' }}>⚠️ Primary PI requested cancellation</p>
                    {sub.cancel_request_reason && (
                      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>Reason: "{sub.cancel_request_reason}"</p>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-primary-small" onClick={() => handleSubApproveCancellation(sub.id)}>Approve</button>
                      <button className="btn-secondary-small" onClick={() => handleSubDeclineCancellation(sub.id)}>Decline</button>
                    </div>
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

  if (loading && !initialLoadDone) return <div className="loading-container"><div className="spinner"></div></div>

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
  const prevInitialTab = React.useRef(initialTab)

  // Only respond to initialTab prop changes when it actually changes value
  // (prevents loadMyJobs re-renders from resetting the tab)
  useEffect(() => {
    if (initialTab && initialTab !== prevInitialTab.current) {
      setActiveTab(initialTab)
      prevInitialTab.current = initialTab
    }
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
