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
        const { data: requests, error: reqError } = await supabase
          .from('consultation_requests')
          .select('*')
          .eq('pi_profile_id', profile.id)
          .order('created_at', { ascending: false })

        if (reqError) throw reqError

        setDashboardData({
          type: 'pi',
          consultationRequests: requests || [],
          profile: profile
        })
      } else {
        // Load client dashboard data
        const [requestsRes, jobsRes] = await Promise.all([
          supabase
            .from('consultation_requests')
            .select(`*, pi_profiles:pi_profile_id (id, first_name, last_name, company_name, city, state, phone, email)`)
            .eq('requester_user_id', user.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('jobs')
            .select(`*, job_applications (id, applicant_id, status, cover_letter, proposed_rate, estimated_timeline, applied_at, pi_profiles:applicant_id (first_name, last_name, company_name, city, state, hourly_rate))`)
            .eq('posted_by', user.id)
            .order('created_at', { ascending: false })
        ])

        if (requestsRes.error) throw requestsRes.error
        if (jobsRes.error) throw jobsRes.error

        setDashboardData({
          type: 'client',
          user: user,
          consultationRequests: requestsRes.data || [],
          postedJobs: jobsRes.data || []
        })
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
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
