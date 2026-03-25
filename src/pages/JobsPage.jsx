import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import JobCard from '../components/JobCard'
import JobApplicationModal from '../components/JobApplicationModal'
import RecommendedJobsSection from '../components/RecommendedJobsSection'
import { VerificationGate, UnverifiedBanner } from '../components/VerificationGate'
import SubcontractModal from '../components/SubcontractModal'
import ReferralModal from '../components/ReferralModal'
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
function MyJobsTab({ user, profile, onNavigate }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showSubcontractModal, setShowSubcontractModal] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)

  useEffect(() => { loadMyJobs() }, [user])

  const loadMyJobs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`*, job:job_id (*, profiles:posted_by (full_name, email))`)
        .eq('applicant_id', user.id)
        .in('status', ['accepted', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setJobs(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
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
        <div className="jobs-list">
          {jobs.map(app => {
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

                <div className="job-card-actions">
                  <button className="btn-secondary-small" onClick={() => onNavigate('messages')}>
                    💬 Message Client
                  </button>
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
                          onClick={() => { if(window.confirm('Convert this to a public job posting? It will appear in the marketplace for all PIs to see.')) convertToPublic(job.id) }}>
                          🌐 Convert to Public
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
        .select(`
          *,
          job:job_id (title, location, investigation_type),
          subcontractor:subcontractor_id (*)
        `)
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

  const statusBadge = (status) => ({
    pending: { text: '⏳ Offer Sent', class: 'badge-pending' },
    accepted: { text: '✓ Accepted', class: 'badge-accepted' },
    declined: { text: '✗ Declined', class: 'badge-failed' },
    in_progress: { text: '▶ In Progress', class: 'badge-processing' },
    report_submitted: { text: '📄 Review Required', class: 'badge-pending' },
    revision_requested: { text: '✏️ Revisions Requested', class: 'badge-failed' },
    approved: { text: '✓ Ready to Deliver', class: 'badge-accepted' },
    completed: { text: '✅ Delivered', class: 'badge-success' }
  }[status] || { text: status, class: 'badge-pending' })

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>

  return (
    <div>
      <div className="tab-header">
        <h2>I Subcontracted</h2>
        <p>Jobs you've farmed out — you remain client-facing and manage the subcontractor.</p>
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
                    <p className="job-meta">
                      Field operative: <strong>
                        {subPI ? `${subPI.first_name} ${subPI.last_name}` : 'Unknown'}
                      </strong>
                    </p>
                    <p className="job-meta">
                      Their rate: {sub.subcontractor_rate_cents
                        ? `$${(sub.subcontractor_rate_cents / 100).toFixed(2)}`
                        : 'TBD'}
                    </p>
                  </div>
                  <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                </div>

                <div className="job-card-actions">
                  <button className="btn-secondary-small" onClick={() => onNavigate('messages')}>
                    💬 Message Subcontractor
                  </button>
                </div>

                {['in_progress', 'report_submitted', 'revision_requested', 'approved'].includes(sub.status) && (
                  <ReportWorkflow
                    subcontract={sub}
                    user={{ id: user.id }}
                    isPrimary={true}
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
export default function JobsPage({ user, profile, onNavigate }) {
  const isPI = profile?.type === 'pi'

  // Non-PI users just see the marketplace
  const tabs = isPI ? [
    { key: 'marketplace', label: '🔍 Marketplace' },
    { key: 'my-jobs', label: '💼 My Jobs' },
    { key: 'my-subcontracts', label: '📋 My Subcontracts' },
    { key: 'i-subcontracted', label: '🤝 I Subcontracted' },
    { key: 'referrals', label: '↗️ Referrals' },
  ] : []

  const [activeTab, setActiveTab] = useState('marketplace')

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
