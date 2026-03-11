import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const STATUS_LABELS = {
  pending: { label: 'Not Started', class: 'badge-pending' },
  accepted: { label: 'Accepted', class: 'badge-contacted' },
  in_progress: { label: 'In Progress', class: 'badge-processing' },
  report_submitted: { label: 'Report Submitted', class: 'badge-pending' },
  revision_requested: { label: 'Revision Requested', class: 'badge-failed' },
  approved: { label: 'Approved', class: 'badge-accepted' },
  completed: { label: 'Completed', class: 'badge-success' }
}

export default function ReportWorkflow({ subcontract, user, isPrimary, onUpdate }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Subcontractor: submit report
  const [reportFile, setReportFile] = useState(null)
  const [coverNotes, setCoverNotes] = useState('')
  const [showSubmitForm, setShowSubmitForm] = useState(false)

  // Primary PI: revision request
  const [revisionNotes, setRevisionNotes] = useState('')
  const [showRevisionForm, setShowRevisionForm] = useState(false)

  useEffect(() => { loadReports() }, [subcontract.id])

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('subcontract_reports')
        .select('*')
        .eq('subcontract_id', subcontract.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setReports(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) setReportFile(file)
  }

  const handleSubmitReport = async () => {
    if (!reportFile) {
      setError('Please select a report file')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Upload file to Supabase storage
      const fileExt = reportFile.name.split('.').pop()
      const fileName = `${subcontract.id}-v${reports.length + 1}-${Date.now()}.${fileExt}`
      const filePath = `reports/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('subcontract-reports')
        .upload(filePath, reportFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('subcontract-reports')
        .getPublicUrl(filePath)

      // Create report record
      const { error: reportError } = await supabase
        .from('subcontract_reports')
        .insert({
          subcontract_id: subcontract.id,
          submitted_by: user.id,
          report_url: filePath,
          report_filename: reportFile.name,
          cover_notes: coverNotes,
          version: reports.length + 1,
          status: 'submitted'
        })

      if (reportError) throw reportError

      // Update subcontract status
      await supabase
        .from('subcontracts')
        .update({ status: 'report_submitted' })
        .eq('id', subcontract.id)

      // Notify primary PI
      await supabase.from('notifications').insert({
        user_id: subcontract.primary_pi_id,
        type: 'report_submitted',
        title: 'Report Ready for Review',
        message: `A report has been submitted for your review`,
        related_id: subcontract.id,
        related_type: 'subcontract'
      })

      setShowSubmitForm(false)
      setReportFile(null)
      setCoverNotes('')
      loadReports()
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestRevision = async (reportId) => {
    if (!revisionNotes.trim()) {
      setError('Please describe what needs to be revised')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await supabase
        .from('subcontract_reports')
        .update({ status: 'revision_requested', revision_request: revisionNotes })
        .eq('id', reportId)

      await supabase
        .from('subcontracts')
        .update({ status: 'revision_requested' })
        .eq('id', subcontract.id)

      // Notify subcontractor
      await supabase.from('notifications').insert({
        user_id: subcontract.subcontractor_id,
        type: 'revision_requested',
        title: 'Report Revision Requested',
        message: `Revisions have been requested for your report`,
        related_id: subcontract.id,
        related_type: 'subcontract'
      })

      setShowRevisionForm(false)
      setRevisionNotes('')
      loadReports()
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleApproveReport = async (reportId) => {
    setSubmitting(true)
    setError(null)

    try {
      await supabase
        .from('subcontract_reports')
        .update({ status: 'approved' })
        .eq('id', reportId)

      await supabase
        .from('subcontracts')
        .update({ status: 'approved' })
        .eq('id', subcontract.id)

      loadReports()
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeliverToClient = async (reportId) => {
    setSubmitting(true)
    setError(null)

    try {
      await supabase
        .from('subcontract_reports')
        .update({ status: 'forwarded_to_client' })
        .eq('id', reportId)

      await supabase
        .from('subcontracts')
        .update({ status: 'completed' })
        .eq('id', subcontract.id)

      loadReports()
      onUpdate()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadReport = async (reportUrl, filename) => {
    try {
      const { data, error } = await supabase.storage
        .from('subcontract-reports')
        .download(reportUrl)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to download report: ' + err.message)
    }
  }

  const latestReport = reports[0]
  const statusInfo = STATUS_LABELS[subcontract.status] || STATUS_LABELS.pending

  return (
    <div className="report-workflow">
      <div className="report-workflow-header">
        <h3>📄 Report Workflow</h3>
        <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Status timeline */}
      <div className="status-timeline">
        {['in_progress', 'report_submitted', 'approved', 'completed'].map((s, i) => {
          const statuses = ['in_progress', 'report_submitted', 'revision_requested', 'approved', 'completed']
          const currentIdx = statuses.indexOf(subcontract.status)
          const stepIdx = statuses.indexOf(s)
          const isComplete = currentIdx > stepIdx
          const isCurrent = currentIdx === stepIdx
          return (
            <div key={s} className={`timeline-step ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}>
              <div className="timeline-dot"></div>
              <div className="timeline-label">{STATUS_LABELS[s]?.label || s}</div>
            </div>
          )
        })}
      </div>

      {/* Report history */}
      {reports.length > 0 && (
        <div className="report-history">
          <h4>Report History</h4>
          {reports.map((report, idx) => (
            <div key={report.id} className={`report-version-card ${idx === 0 ? 'latest' : 'older'}`}>
              <div className="report-version-header">
                <span className="version-label">Version {report.version}</span>
                <span className="report-date">{new Date(report.created_at).toLocaleDateString()}</span>
                <span className={`status-badge ${
                  report.status === 'approved' ? 'badge-accepted' :
                  report.status === 'revision_requested' ? 'badge-failed' :
                  report.status === 'forwarded_to_client' ? 'badge-success' : 'badge-pending'
                }`}>
                  {report.status.replace('_', ' ')}
                </span>
              </div>

              {report.cover_notes && (
                <div className="report-notes">
                  <strong>Subcontractor notes:</strong>
                  <p>{report.cover_notes}</p>
                </div>
              )}

              {report.revision_request && (
                <div className="revision-request-notes">
                  <strong>⚠️ Revision requested:</strong>
                  <p>{report.revision_request}</p>
                </div>
              )}

              <div className="report-actions">
                <button className="btn-secondary-small"
                  onClick={() => handleDownloadReport(report.report_url, report.report_filename)}>
                  ⬇️ Download {report.report_filename}
                </button>

                {/* Primary PI actions on latest report */}
                {isPrimary && idx === 0 && (
                  <>
                    {report.status === 'submitted' && (
                      <>
                        <button className="btn-primary-small"
                          onClick={() => handleApproveReport(report.id)}
                          disabled={submitting}>
                          ✓ Approve Report
                        </button>
                        <button className="btn-secondary-small"
                          onClick={() => setShowRevisionForm(!showRevisionForm)}>
                          ✏️ Request Revisions
                        </button>
                      </>
                    )}

                    {report.status === 'approved' && (
                      <button className="btn-primary-small"
                        onClick={() => handleDeliverToClient(report.id)}
                        disabled={submitting}>
                        📤 Deliver to Client
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Revision request form */}
              {showRevisionForm && isPrimary && idx === 0 && (
                <div className="revision-form">
                  <textarea
                    value={revisionNotes}
                    onChange={e => setRevisionNotes(e.target.value)}
                    rows={3}
                    placeholder="Describe what needs to be changed or added..." />
                  <div className="revision-form-actions">
                    <button className="btn-secondary-small" onClick={() => setShowRevisionForm(false)}>Cancel</button>
                    <button className="btn-primary-small"
                      onClick={() => handleRequestRevision(report.id)}
                      disabled={submitting || !revisionNotes.trim()}>
                      Send Revision Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Subcontractor: submit report */}
      {!isPrimary && ['accepted', 'in_progress', 'revision_requested'].includes(subcontract.status) && (
        <div className="submit-report-section">
          {!showSubmitForm ? (
            <button className="btn-primary" onClick={() => setShowSubmitForm(true)}>
              📎 {reports.length > 0 ? 'Submit Revised Report' : 'Submit Report'}
            </button>
          ) : (
            <div className="submit-report-form">
              <h4>{reports.length > 0 ? 'Submit Revised Report' : 'Submit Report'}</h4>
              <div className="form-group">
                <label>Report File (PDF or Word) *</label>
                <input type="file" accept=".pdf,.doc,.docx"
                  onChange={handleFileChange} />
                {reportFile && <small>Selected: {reportFile.name}</small>}
              </div>
              <div className="form-group">
                <label>Cover Notes <em>(visible to primary PI only)</em></label>
                <textarea value={coverNotes}
                  onChange={e => setCoverNotes(e.target.value)}
                  rows={3}
                  placeholder="Any notes for the primary PI about this report..." />
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowSubmitForm(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSubmitReport}
                  disabled={submitting || !reportFile}>
                  {submitting ? 'Uploading...' : 'Submit Report'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Update status to in_progress */}
      {!isPrimary && subcontract.status === 'accepted' && (
        <button className="btn-secondary" style={{ marginTop: '8px' }}
          onClick={async () => {
            await supabase.from('subcontracts').update({ status: 'in_progress' }).eq('id', subcontract.id)
            onUpdate()
          }}>
          ▶ Mark as In Progress
        </button>
      )}
    </div>
  )
}
