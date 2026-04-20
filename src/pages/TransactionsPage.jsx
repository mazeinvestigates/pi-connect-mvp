import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function TransactionsPage({ user, profile, onNavigate }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'paid', 'received'
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    if (user) {
      loadTransactions()
    }
  }, [user, filter])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          job:job_id (title, city, state, investigation_type),
          client_profile:client_id (full_name, email)
        `)
        .order('created_at', { ascending: false })

      // Filter based on user type and selection
      if (filter === 'paid') {
        query = query.eq('client_id', user.id)
      } else if (filter === 'received') {
        query = query.eq('pi_id', user.id)
      } else {
        // Show all transactions for this user
        query = query.or(`client_id.eq.${user.id},pi_id.eq.${user.id}`)
      }

      const { data, error } = await query

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (cents) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const getStatusBadge = (status) => {
    const badges = {
      succeeded: { class: 'badge-success', text: '✓ Succeeded' },
      pending: { class: 'badge-pending', text: '⏳ Pending' },
      processing: { class: 'badge-processing', text: '⚙️ Processing' },
      failed: { class: 'badge-failed', text: '✗ Failed' },
      refunded: { class: 'badge-refunded', text: '↩ Refunded' },
      disputed: { class: 'badge-disputed', text: '⚠ Disputed' }
    }
    return badges[status] || { class: '', text: status }
  }

  const getTotalPaid = () => {
    return transactions
      .filter(t => t.client_id === user.id && t.status === 'succeeded')
      .reduce((sum, t) => sum + t.amount_cents, 0)
  }

  const getTotalReceived = () => {
    return transactions
      .filter(t => t.pi_id === user.id && t.status === 'succeeded')
      .reduce((sum, t) => sum + t.pi_payout_cents, 0)
  }

  const getPlatformFees = () => {
    // Show platform fees for the current user's role
    return transactions
      .filter(t => (t.pi_id === user.id || t.client_id === user.id) && t.status === 'succeeded')
      .reduce((sum, t) => sum + t.platform_fee_cents, 0)
  }

  if (!user) {
    return (
      <div className="transactions-page">
        <div className="empty-state">
          <h2>Transactions</h2>
          <p>Please sign in to view your transactions.</p>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h1>💳 Transactions</h1>
        <p>View your payment history and receipts</p>
      </div>

      {/* Summary Cards */}
      <div className="transaction-summary">
        <div className="summary-card">
          <div className="summary-label">Total Paid</div>
          <div className="summary-amount">{formatAmount(getTotalPaid())}</div>
          <div className="summary-sublabel">As Client</div>
        </div>

        {profile?.type === 'pi' && (
          <>
            <div className="summary-card success">
              <div className="summary-label">Total Received</div>
              <div className="summary-amount">{formatAmount(getTotalReceived())}</div>
              <div className="summary-sublabel">As PI</div>
            </div>

            <div className="summary-card info">
              <div className="summary-label">Platform Fees</div>
              <div className="summary-amount">{formatAmount(getPlatformFees())}</div>
              <div className="summary-sublabel">10% of labor</div>
            </div>
          </>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="transaction-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Transactions
        </button>
        <button
          className={`filter-btn ${filter === 'paid' ? 'active' : ''}`}
          onClick={() => setFilter('paid')}
        >
          Payments Made
        </button>
        {profile?.type === 'pi' && (
          <button
            className={`filter-btn ${filter === 'received' ? 'active' : ''}`}
            onClick={() => setFilter('received')}
          >
            Payments Received
          </button>
        )}
      </div>

      {/* Archive toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          onClick={() => setShowArchived(prev => !prev)}
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
          {showArchived ? '← Recent Transactions' : '🗂 View Archived (90+ days)'}
        </button>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading transactions...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions yet</p>
          <button onClick={() => onNavigate('jobs')} className="btn-primary">
            Browse Jobs
          </button>
        </div>
      ) : (
        <div className="transactions-list">
          {transactions.filter(t => {
            const isOld = new Date(t.created_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            return showArchived ? isOld : !isOld
          }).length === 0 && transactions.length > 0 && (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p style={{ color: '#6b7280' }}>No {showArchived ? 'archived' : 'recent'} transactions.</p>
            </div>
          )}
          {transactions.filter(t => {
            const isOld = new Date(t.created_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            return showArchived ? isOld : !isOld
          }).map(transaction => {
            const isPayment = transaction.client_id === user.id
            const badge = getStatusBadge(transaction.status)
            const clientName = transaction.client_profile?.full_name || transaction.client_profile?.email || 'Client'
            const piName = 'PI'
            const jobTitle = transaction.job?.title || transaction.description || 'Payment'
            const jobLocation = transaction.job ? `${transaction.job.city}, ${transaction.job.state}` : null
            const jobType = transaction.job?.investigation_type || null

            return (
              <div key={transaction.id} className="transaction-card">
                <div className="transaction-header">
                  <div className="transaction-info">
                    <h3>{jobTitle}</h3>
                    <p className="transaction-meta">
                      {isPayment ? `To: ${piName}` : `From: ${clientName}`}
                      {jobLocation && ` · ${jobLocation}`}
                      {jobType && ` · ${jobType}`}
                    </p>
                  </div>
                  <div className={`transaction-badge ${badge.class}`}>
                    {badge.text}
                  </div>
                </div>

                <div className="transaction-body">
                  <div className="transaction-amounts">
                    <div className="amount-row">
                      <span>Amount:</span>
                      <strong>{formatAmount(transaction.amount_cents)}</strong>
                    </div>
                    <div className="amount-row">
                      <span>Platform Fee:</span>
                      <span className="fee-amount">-{formatAmount(transaction.platform_fee_cents)}</span>
                    </div>
                    <div className="amount-row total">
                      <span>{isPayment ? 'Total Paid:' : 'You Received:'}</span>
                      <strong>
                        {isPayment 
                          ? formatAmount(transaction.amount_cents)
                          : formatAmount(transaction.pi_payout_cents)}
                      </strong>
                    </div>
                  </div>

                  {transaction.description && (
                    <div className="transaction-description">
                      {transaction.description}
                    </div>
                  )}

                  <div className="transaction-footer">
                    <span className="transaction-date">
                      {transaction.paid_at 
                        ? formatDate(transaction.paid_at)
                        : formatDate(transaction.created_at)}
                    </span>
                    {transaction.payment_method && (
                      <span className="payment-method">
                        💳 {transaction.payment_method}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
