import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import ClientDashboard from '../components/ClientDashboard'
import PIDashboard from '../components/PIDashboard'

export default function DashboardPage({ user, profile, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [user, profile])

  const loadDashboardData = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      if (profile?.type === 'pi') {
        // Load PI dashboard data
        const [requestsRes, acceptedJobsRes] = await Promise.all([
          supabase
            .from('consultation_requests')
            .select('*')
            .eq('pi_profile_id', profile.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('job_applications')
            .select('*, job:job_id (*, profiles:posted_by (full_name, email))')
            .eq('applicant_id', user.id)
            .in('status', ['accepted', 'in_progress'])
            .order('applied_at', { ascending: false })
        ])

        if (requestsRes.error) throw requestsRes.error

        setDashboardData({
          type: 'pi',
          consultationRequests: requestsRes.data || [],
          acceptedJobs: acceptedJobsRes.data || [],
          profile: profile,
          user: user
        })
      } else {
        // Load client dashboard data
        const [requestsRes, jobsRes, appsRes] = await Promise.all([
          supabase
            .from('consultation_requests')
            .select(`*, pi_profiles:pi_profile_id (id, user_id, first_name, last_name, company_name, city, state, phone, email)`)
            .eq('requester_user_id', user.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('jobs')
            .select('*')
            .eq('posted_by', user.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('job_applications')
            .select('*')
            .in('job_id', [])  // placeholder, will replace below
        ])

        if (requestsRes.error) throw requestsRes.error
        if (jobsRes.error) throw jobsRes.error

        const jobs = jobsRes.data || []
        const jobIds = jobs.map(j => j.id)

        // Fetch applications for all posted jobs
        let applications = []
        if (jobIds.length > 0) {
          const { data: appsData, error: appsError } = await supabase
            .from('job_applications')
            .select('*')
            .in('job_id', jobIds)
          if (!appsError) applications = appsData || []
        }

        // Fetch PI profiles for all applicants
        const applicantIds = [...new Set(applications.map(a => a.applicant_id))]
        let piMap = {}
        if (applicantIds.length > 0) {
          const { data: piData } = await supabase
            .from('pi_profiles')
            .select('user_id, first_name, last_name, company_name, city, state, hourly_rate')
            .in('user_id', applicantIds)
          piData?.forEach(pi => { piMap[pi.user_id] = pi })
        }

        // Attach applications with PI profiles to each job
        const jobsWithApps = jobs.map(job => ({
          ...job,
          job_applications: applications
            .filter(a => a.job_id === job.id)
            .map(a => ({ ...a, pi_profiles: piMap[a.applicant_id] || null }))
        }))

        setDashboardData({
          type: 'client',
          user: user,
          profile: profile,
          consultationRequests: requestsRes.data || [],
          postedJobs: jobsWithApps
        })
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      // Set empty data so dashboard renders rather than showing setup message
      setDashboardData({
        type: profile?.type === 'pi' ? 'pi' : 'client',
        user: user,
        consultationRequests: [],
        postedJobs: [],
        profile: profile
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="dashboard-page">
        <div className="empty-state">
          <h2>Welcome to PI Connect!</h2>
          <p>Your dashboard is being set up.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      {dashboardData.type === 'pi' ? (
        <PIDashboard 
          data={dashboardData} 
          onRefresh={loadDashboardData}
          onNavigate={onNavigate}
        />
      ) : (
        <ClientDashboard 
          data={dashboardData} 
          onRefresh={loadDashboardData}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
