import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SearchPage from './pages/SearchPage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import MessagingPage from './pages/MessagingPage'
import JobsPage from './pages/JobsPage'
import PostJobPage from './pages/PostJobPage'
import ReferralsPage from './pages/ReferralsPage'
import './App.css'

export default function App() {
  const [currentPage, setCurrentPage] = useState('search') // 'search' | 'auth' | 'dashboard'
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check current auth status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    try {
      // Check if user has a PI profile
      const { data: piProfile } = await supabase
        .from('pi_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (piProfile) {
        setProfile({ ...piProfile, type: 'pi' })
      } else {
        // Regular client profile
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        setProfile({ ...clientProfile, type: 'client' })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setCurrentPage('search')
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Navigation header
  const renderHeader = () => (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="logo" onClick={() => setCurrentPage('search')}>
            PI Connect
          </h1>
        </div>
        <nav className="header-nav">
          {user ? (
            <>
              <button 
                className="nav-link" 
                onClick={() => setCurrentPage('dashboard')}
              >
                Dashboard
              </button>
              <button 
                className="nav-link" 
                onClick={() => setCurrentPage('jobs')}
              >
                Jobs
              </button>
              {profile?.type === 'pi' && (
                <button 
                  className="nav-link" 
                  onClick={() => setCurrentPage('referrals')}
                >
                  Referrals
                </button>
              )}
              <button 
                className="nav-link" 
                onClick={() => setCurrentPage('messages')}
              >
                Messages
              </button>
              <button 
                className="nav-link" 
                onClick={() => setCurrentPage('search')}
              >
                Search
              </button>
              <div className="user-menu">
                <span className="user-email">{user.email}</span>
                <button className="btn-secondary-small" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <button 
                className="nav-link" 
                onClick={() => setCurrentPage('search')}
              >
                Search PIs
              </button>
              <button 
                className="btn-primary-small" 
                onClick={() => setCurrentPage('auth')}
              >
                Sign In
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )

  return (
    <div className="app">
      {renderHeader()}
      
      <main className="app-main">
        {currentPage === 'search' && (
          <SearchPage 
            user={user} 
            onNavigate={setCurrentPage}
          />
        )}
        
        {currentPage === 'auth' && (
          <AuthPage 
            onSuccess={() => setCurrentPage('dashboard')}
          />
        )}
        
        {currentPage === 'dashboard' && user && (
          <DashboardPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'messages' && user && (
          <MessagingPage 
            user={user}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'jobs' && (
          <JobsPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'post-job' && (
          <PostJobPage 
            user={user}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'referrals' && (
          <ReferralsPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}
      </main>
    </div>
  )
}
