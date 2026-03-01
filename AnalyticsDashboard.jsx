import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AnalyticsDashboard({ user, profile, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30') // days
  const [analytics, setAnalytics] = useState({
    revenue: { total: 0, growth: 0, chartData: [] },
    users: { total: 0, pis: 0, clients: 0, growth: 0 },
    jobs: { posted: 0, filled: 0, fillRate: 0 },
    transactions: { count: 0, volume: 0, avgValue: 0 },
    topPIs: [],
    recentActivity: []
  })

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      loadAnalytics()
    }
  }, [user, profile, dateRange])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const daysAgo = parseInt(dateRange)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysAgo)

      // Load all analytics data in parallel
      const [
        revenueData,
        usersData,
        jobsData,
        transactionsData,
        topPIsData
      ] = await Promise.all([
        loadRevenueAnalytics(startDate),
        loadUserAnalytics(startDate),
        loadJobAnalytics(startDate),
        loadTransactionAnalytics(startDate),
        loadTopPIs()
      ])

      setAnalytics({
        revenue: revenueData,
        users: usersData,
        jobs: jobsData,
        transactions: transactionsData,
        topPIs: topPIsData
      })
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRevenueAnalytics = async (startDate) => {
    try {
      // Get transactions for revenue
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('platform_fee_cents, created_at')
        .eq('status', 'succeeded')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      const total = transactions.reduce((sum, t) => sum + (t.platform_fee_cents / 100), 0)
      
      // Calculate growth (compare to previous period)
      const prevStartDate = new Date(startDate)
      prevStartDate.setDate(prevStartDate.getDate() - parseInt(dateRange))
      
      const { data: prevTransactions } = await supabase
        .from('transactions')
        .select('platform_fee_cents')
        .eq('status', 'succeeded')
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString())

      const prevTotal = prevTransactions?.reduce((sum, t) => sum + (t.platform_fee_cents / 100), 0) || 0
      const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0

      // Generate chart data (group by day)
      const chartData = generateDailyChartData(transactions, 'platform_fee_cents')

      return { total, growth, chartData }
    } catch (error) {
      console.error('Revenue analytics error:', error)
      return { total: 0, growth: 0, chartData: [] }
    }
  }

  const loadUserAnalytics = async (startDate) => {
    try {
      const { data: allUsers, error: usersError } = await supabase
        .from('profiles')
        .select('user_id, type, created_at')

      if (usersError) throw usersError

      const total = allUsers.length
      const pis = allUsers.filter(u => u.type === 'pi').length
      const clients = total - pis

      // New users in period
      const newUsers = allUsers.filter(u => new Date(u.created_at) >= startDate).length
      
      // Calculate growth
      const prevStartDate = new Date(startDate)
      prevStartDate.setDate(prevStartDate.getDate() - parseInt(dateRange))
      const prevUsers = allUsers.filter(u => 
        new Date(u.created_at) >= prevStartDate && new Date(u.created_at) < startDate
      ).length

      const growth = prevUsers > 0 ? ((newUsers - prevUsers) / prevUsers) * 100 : 0

      return { total, pis, clients, growth, newUsers }
    } catch (error) {
      console.error('User analytics error:', error)
      return { total: 0, pis: 0, clients: 0, growth: 0, newUsers: 0 }
    }
  }

  const loadJobAnalytics = async (startDate) => {
    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, status, created_at')
        .gte('created_at', startDate.toISOString())

      if (error) throw error

      const posted = jobs.length
      const filled = jobs.filter(j => j.status === 'filled' || j.status === 'completed').length
      const fillRate = posted > 0 ? (filled / posted) * 100 : 0

      return { posted, filled, fillRate }
    } catch (error) {
      console.error('Job analytics error:', error)
      return { posted: 0, filled: 0, fillRate: 0 }
    }
  }

  const loadTransactionAnalytics = async (startDate) => {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount_cents, created_at')
        .eq('status', 'succeeded')
        .gte('created_at', startDate.toISOString())

      if (error) throw error

      const count = transactions.length
      const volume = transactions.reduce((sum, t) => sum + (t.amount_cents / 100), 0)
      const avgValue = count > 0 ? volume / count : 0

      return { count, volume, avgValue }
    } catch (error) {
      console.error('Transaction analytics error:', error)
      return { count: 0, volume: 0, avgValue: 0 }
    }
  }

  const loadTopPIs = async () => {
    try {
      const { data: pis, error } = await supabase
        .from('pi_profiles')
        .select('first_name, last_name, rating, review_count')
        .eq('is_verified', true)
        .order('rating', { ascending: false })
        .limit(10)

      if (error) throw error
      return pis || []
    } catch (error) {
      console.error('Top PIs error:', error)
      return []
    }
  }

  const generateDailyChartData = (data, valueField) => {
    const dailyData = {}
    
    data.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString()
      if (!dailyData[date]) {
        dailyData[date] = 0
      }
      dailyData[date] += (item[valueField] / 100) || 1
    })

    return Object.entries(dailyData).map(([date, value]) => ({ date, value }))
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  if (!user || profile?.role !== 'admin') {
    return (
      <div className="analytics-page">
        <div className="empty-state">
          <h2>Access Denied</h2>
          <p>Only administrators can view analytics.</p>
          <button onClick={() => onNavigate('dashboard')} className="btn-primary">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1>📊 Analytics Dashboard</h1>
          <p>Platform performance and key metrics</p>
        </div>

        <div className="date-range-selector">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="metrics-grid">
            <div className="metric-card revenue">
              <div className="metric-header">
                <span className="metric-icon">💰</span>
                <span className="metric-label">Platform Revenue</span>
              </div>
              <div className="metric-value">{formatCurrency(analytics.revenue.total)}</div>
              <div className={`metric-change ${analytics.revenue.growth >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(analytics.revenue.growth)} vs previous period
              </div>
            </div>

            <div className="metric-card users">
              <div className="metric-header">
                <span className="metric-icon">👥</span>
                <span className="metric-label">Total Users</span>
              </div>
              <div className="metric-value">{analytics.users.total.toLocaleString()}</div>
              <div className="metric-detail">
                {analytics.users.pis} PIs • {analytics.users.clients} Clients
              </div>
              <div className={`metric-change ${analytics.users.growth >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(analytics.users.growth)} growth
              </div>
            </div>

            <div className="metric-card transactions">
              <div className="metric-header">
                <span className="metric-icon">💳</span>
                <span className="metric-label">Transaction Volume</span>
              </div>
              <div className="metric-value">{formatCurrency(analytics.transactions.volume)}</div>
              <div className="metric-detail">
                {analytics.transactions.count} transactions • {formatCurrency(analytics.transactions.avgValue)} avg
              </div>
            </div>

            <div className="metric-card jobs">
              <div className="metric-header">
                <span className="metric-icon">💼</span>
                <span className="metric-label">Jobs Posted</span>
              </div>
              <div className="metric-value">{analytics.jobs.posted}</div>
              <div className="metric-detail">
                {analytics.jobs.filled} filled • {analytics.jobs.fillRate.toFixed(0)}% fill rate
              </div>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="chart-section">
            <h2>Revenue Trend</h2>
            <div className="simple-chart">
              {analytics.revenue.chartData.length > 0 ? (
                <div className="bar-chart">
                  {analytics.revenue.chartData.map((item, idx) => (
                    <div key={idx} className="bar-item">
                      <div 
                        className="bar" 
                        style={{ 
                          height: `${(item.value / Math.max(...analytics.revenue.chartData.map(d => d.value))) * 100}%` 
                        }}
                      >
                        <span className="bar-value">${item.value.toFixed(0)}</span>
                      </div>
                      <span className="bar-label">{item.date.split('/').slice(0, 2).join('/')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-chart">No revenue data for this period</div>
              )}
            </div>
          </div>

          {/* Top PIs Leaderboard */}
          <div className="leaderboard-section">
            <h2>🏆 Top Rated PIs</h2>
            <div className="leaderboard-table">
              {analytics.topPIs.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>PI Name</th>
                      <th>Rating</th>
                      <th>Reviews</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topPIs.map((pi, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</span>
                        </td>
                        <td>{pi.first_name} {pi.last_name}</td>
                        <td>
                          <span className="rating-badge">⭐ {pi.rating?.toFixed(1) || 'N/A'}</span>
                        </td>
                        <td>{pi.review_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">No rated PIs yet</div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-row">
              <span className="stat-label">Average Rating:</span>
              <span className="stat-value">
                {analytics.topPIs.length > 0 
                  ? (analytics.topPIs.reduce((sum, pi) => sum + (pi.rating || 0), 0) / analytics.topPIs.length).toFixed(2)
                  : 'N/A'} ⭐
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Platform Take Rate:</span>
              <span className="stat-value">15%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">New Users (Period):</span>
              <span className="stat-value">{analytics.users.newUsers || 0}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
