import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import JobCard from '../components/JobCard'
import JobApplicationModal from '../components/JobApplicationModal'

export default function JobsPage({ user, profile, onNavigate }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    location: '',
    investigationType: '',
    urgency: '',
    budgetMin: '',
    budgetMax: ''
  })
  const [selectedJob, setSelectedJob] = useState(null)
  const [showApplicationModal, setShowApplicationModal] = useState(false)
  const [myApplications, setMyApplications] = useState({})

  const investigationTypes = [
    'All Types',
    'Surveillance',
    'Background Investigation',
    'Fraud Investigation',
    'Missing Person',
    'Infidelity Investigation',
    'Corporate Investigation',
    'Insurance Investigation'
  ]

  const urgencyLevels = [
    'All Urgencies',
    'low',
    'medium',
    'high',
    'urgent'
  ]

  useEffect(() => {
    loadJobs()
    if (user && profile?.type === 'pi') {
      loadMyApplications()
    }
  }, [user, profile])

  const loadJobs = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('jobs')
        .select(`
          *,
          profiles:posted_by (full_name, email)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.location) {
        query = query.or(`city.ilike.%${filters.location}%,state.ilike.%${filters.location}%,location.ilike.%${filters.location}%`)
      }

      if (filters.investigationType && filters.investigationType !== 'All Types') {
        query = query.eq('investigation_type', filters.investigationType)
      }

      if (filters.urgency && filters.urgency !== 'All Urgencies') {
        query = query.eq('urgency', filters.urgency)
      }

      if (filters.budgetMin) {
        query = query.gte('budget_max', parseFloat(filters.budgetMin))
      }

      if (filters.budgetMax) {
        query = query.lte('budget_min', parseFloat(filters.budgetMax))
      }

      const { data, error } = await query

      if (error) throw error

      setJobs(data || [])
    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMyApplications = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('job_id, status')
        .eq('applicant_id', user.id)

      if (error) throw error

      // Create a map of job_id -> application status
      const applicationsMap = {}
      data.forEach(app => {
        applicationsMap[app.job_id] = app.status
      })
      setMyApplications(applicationsMap)
    } catch (error) {
      console.error('Error loading applications:', error)
    }
  }

  const handleApplyClick = (job) => {
    if (!user) {
      if (window.confirm('You need to sign in as a PI to apply. Sign in now?')) {
        onNavigate('auth')
      }
      return
    }

    if (profile?.type !== 'pi') {
      alert('Only Private Investigators can apply to jobs.')
      return
    }

    setSelectedJob(job)
    setShowApplicationModal(true)
  }

  const handleApplicationSuccess = () => {
    setShowApplicationModal(false)
    setSelectedJob(null)
    loadMyApplications()
    alert('Application submitted successfully!')
  }

  const getUrgencyBadge = (urgency) => {
    const badges = {
      low: { text: 'Low Priority', class: 'urgency-low' },
      medium: { text: 'Medium', class: 'urgency-medium' },
      high: { text: 'High Priority', class: 'urgency-high' },
      urgent: { text: 'URGENT', class: 'urgency-urgent' }
    }
    return badges[urgency] || badges.medium
  }

  return (
    <div className="jobs-page">
      <div className="jobs-header">
        <div>
          <h1>Job Marketplace</h1>
          <p>Find investigation opportunities nationwide</p>
        </div>
        {user && profile?.type !== 'pi' && (
          <button 
            onClick={() => onNavigate('post-job')} 
            className="btn-primary"
          >
            + Post a Job
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="jobs-filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Location (city, state, or zip)"
            value={filters.location}
            onChange={(e) => setFilters({...filters, location: e.target.value})}
            onBlur={loadJobs}
          />
        </div>

        <div className="filter-group">
          <select
            value={filters.investigationType}
            onChange={(e) => {
              setFilters({...filters, investigationType: e.target.value})
              setTimeout(loadJobs, 100)
            }}
          >
            {investigationTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select
            value={filters.urgency}
            onChange={(e) => {
              setFilters({...filters, urgency: e.target.value})
              setTimeout(loadJobs, 100)
            }}
          >
            {urgencyLevels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        <div className="filter-group budget-range">
          <input
            type="number"
            placeholder="Min Budget"
            value={filters.budgetMin}
            onChange={(e) => setFilters({...filters, budgetMin: e.target.value})}
            onBlur={loadJobs}
          />
          <span>to</span>
          <input
            type="number"
            placeholder="Max Budget"
            value={filters.budgetMax}
            onChange={(e) => setFilters({...filters, budgetMax: e.target.value})}
            onBlur={loadJobs}
          />
        </div>

        <button onClick={loadJobs} className="btn-secondary">
          Apply Filters
        </button>
      </div>

      {/* Job Listings */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <h2>No jobs found</h2>
          <p>Try adjusting your filters or check back later for new opportunities.</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {jobs.map(job => {
            const urgency = getUrgencyBadge(job.urgency)
            const hasApplied = myApplications[job.id]

            return (
              <JobCard
                key={job.id}
                job={job}
                urgency={urgency}
                hasApplied={hasApplied}
                applicationStatus={myApplications[job.id]}
                onApply={() => handleApplyClick(job)}
                isPIUser={profile?.type === 'pi'}
              />
            )
          })}
        </div>
      )}

      {/* Application Modal */}
      {showApplicationModal && selectedJob && (
        <JobApplicationModal
          job={selectedJob}
          user={user}
          piProfile={profile}
          onClose={() => {
            setShowApplicationModal(false)
            setSelectedJob(null)
          }}
          onSuccess={handleApplicationSuccess}
        />
      )}
    </div>
  )
}
