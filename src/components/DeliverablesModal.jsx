import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function DeliverablesModal({ app, job, user, onClose, onSuccess }) {
  const [files, setFiles] = useState([])
  const [notes, setNotes] = useState('')
  const [existingFiles, setExistingFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [loadingExisting, setLoadingExisting] = useState(true)

  useEffect(() => {
    loadExistingFiles()
  }, [])

  const loadExistingFiles = async () => {
    try {
      const { data } = await supabase
        .from('job_deliverables')
        .select('*')
        .eq('application_id', app.id)
        .order('uploaded_at', { ascending: false })
      setExistingFiles(data || [])
    } catch (err) {
      console.warn('Could not load existing files:', err.message)
    } finally {
      setLoadingExisting(false)
    }
  }

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selected])
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) { setError('Please select at least one file to upload.'); return }
    setUploading(true)
    setError(null)

    try {
      const uploadedFiles = []

      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `deliverables/${app.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('deliverables')
          .upload(path, file, { upsert: false })

        if (uploadError) throw uploadError

        uploadedFiles.push({
          application_id: app.id,
          job_id: job?.id,
          uploaded_by: user.id,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          notes: notes || null,
          uploaded_at: new Date().toISOString()
        })
      }

      const { error: insertError } = await supabase
        .from('job_deliverables')
        .insert(uploadedFiles)

      if (insertError) throw insertError

      // Mark deliverables as uploaded on the application
      await supabase
        .from('job_applications')
        .update({ deliverables_uploaded_at: new Date().toISOString() })
        .eq('id', app.id)

      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleViewFile = async (filePath, fileName) => {
    const { data } = await supabase.storage
      .from('deliverables')
      .createSignedUrl(filePath, 3600)
    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = fileName
      a.target = '_blank'
      a.click()
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" onMouseDown={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>Case Files & Report</h2>
          <p>{job?.title}</p>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Existing files */}
          {!loadingExisting && existingFiles.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '10px' }}>Previously Uploaded</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {existingFiles.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', borderRadius: '6px', padding: '8px 12px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', margin: 0 }}>📄 {f.file_name}</p>
                      {f.file_size && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{formatSize(f.file_size)}</p>}
                    </div>
                    <button className="btn-secondary-small"
                      onClick={() => handleViewFile(f.file_path, f.file_name)}>
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload new files */}
          <div className="form-group">
            <label>Upload Files</label>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
              Upload your final report, surveillance footage, photos, or any other case documentation. The client will be able to download these files from their dashboard.
            </p>
            <div className="file-upload-area">
              <input
                type="file"
                id="deliverables-upload"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov,.zip,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <label htmlFor="deliverables-upload" className="file-upload-label">
                <span className="file-upload-icon">📁</span>
                <span>Select Files</span>
                <small>PDF, Word, images, video, ZIP — multiple files allowed</small>
              </label>
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', borderRadius: '6px', padding: '6px 10px' }}>
                    <span style={{ fontSize: '13px' }}>📄 {f.name} <span style={{ color: '#6b7280' }}>({formatSize(f.size)})</span></span>
                    <button onClick={() => removeFile(i)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes to Client (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes about the files, findings summary, or instructions for the client..."
            />
          </div>

          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleUpload}
              disabled={uploading || files.length === 0}>
              {uploading ? 'Uploading...' : `Upload ${files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : 'Files'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
