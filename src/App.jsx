import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SearchPage from './pages/SearchPage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import MessagingPage from './pages/MessagingPage'
import JobsPage from './pages/JobsPage'
import PostJobPage from './pages/PostJobPage'
import ReferralsPage from './pages/ReferralsPage'
import ProfileEditPage from './pages/ProfileEditPage'
import AdminPage from './pages/AdminPage'
import TransactionsPage from './pages/TransactionsPage'
import EmailPreferencesPage from './pages/EmailPreferencesPage'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import RateCalculatorPage from './pages/RateCalculatorPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import LandingPage from './pages/LandingPage'
import PIOnboarding from './components/PIOnboarding'
import NotificationCenter from './components/NotificationCenter'
import './App.css'

export default function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
          <h1 className="logo" onClick={() => { setCurrentPage('home'); setMobileMenuOpen(false) }}>
            PI Connect
          </h1>
        </div>

        {/* Desktop nav */}
        <nav className="header-nav desktop-nav">
          {user ? (
            <>
              <button className="nav-link" onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
              <button className="nav-link" onClick={() => setCurrentPage('jobs')}>Jobs</button>
              {profile?.type === 'pi' && (
                <button className="nav-link" onClick={() => setCurrentPage('referrals')}>Referrals</button>
              )}
              <button className="nav-link" onClick={() => setCurrentPage('messages')}>Messages</button>
              {profile?.type === 'pi' && (
                <button className="nav-link" onClick={() => setCurrentPage('rate-calculator')}>💰 Rates</button>
              )}
              <button className="nav-link" onClick={() => setCurrentPage('transactions')}>💳 Payments</button>
              <button className="nav-link" onClick={() => setCurrentPage('search')}>Search</button>
              {profile?.role === 'admin' && (
                <>
                  <button className="nav-link admin-link" onClick={() => setCurrentPage('admin')}>🛡️ Admin</button>
                  <button className="nav-link admin-link" onClick={() => setCurrentPage('analytics')}>📊 Analytics</button>
                </>
              )}
              <div className="user-menu">
                <NotificationCenter user={user} onNavigate={setCurrentPage} />
                <span className="user-email">{user.email}</span>
                <button className="btn-secondary-small" onClick={handleSignOut}>Sign Out</button>
              </div>
            </>
          ) : (
            <>
              <button className="nav-link" onClick={() => setCurrentPage('search')}>Search PIs</button>
              <button className="btn-primary-small" onClick={() => setCurrentPage('auth')}>Sign In</button>
            </>
          )}
        </nav>

        {/* Mobile right side */}
        <div className="mobile-nav-right">
          {user && <NotificationCenter user={user} onNavigate={setCurrentPage} />}
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          {user ? (
            <>
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('dashboard'); setMobileMenuOpen(false) }}>Dashboard</button>
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('jobs'); setMobileMenuOpen(false) }}>Jobs</button>
              {profile?.type === 'pi' && (
                <button className="mobile-nav-link" onClick={() => { setCurrentPage('referrals'); setMobileMenuOpen(false) }}>Referrals</button>
              )}
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('messages'); setMobileMenuOpen(false) }}>Messages</button>
              {profile?.type === 'pi' && (
                <button className="mobile-nav-link" onClick={() => { setCurrentPage('rate-calculator'); setMobileMenuOpen(false) }}>💰 Rate Calculator</button>
              )}
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('transactions'); setMobileMenuOpen(false) }}>💳 Payments</button>
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('search'); setMobileMenuOpen(false) }}>Search PIs</button>
              {profile?.type === 'pi' && (
                <button className="mobile-nav-link" onClick={() => { setCurrentPage('profile-edit'); setMobileMenuOpen(false) }}>Edit Profile</button>
              )}
              {profile?.role === 'admin' && (
                <>
                  <button className="mobile-nav-link admin-link" onClick={() => { setCurrentPage('admin'); setMobileMenuOpen(false) }}>🛡️ Admin</button>
                  <button className="mobile-nav-link admin-link" onClick={() => { setCurrentPage('analytics'); setMobileMenuOpen(false) }}>📊 Analytics</button>
                </>
              )}
              <div className="mobile-nav-footer">
                <span className="mobile-user-email">{user.email}</span>
                <button className="btn-secondary-small" onClick={() => { handleSignOut(); setMobileMenuOpen(false) }}>Sign Out</button>
              </div>
            </>
          ) : (
            <>
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('search'); setMobileMenuOpen(false) }}>Search PIs</button>
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('auth'); setMobileMenuOpen(false) }}>Sign In</button>
            </>
          )}
        </div>
      )}
    </header>
  )

  return (
    <div className="app">
      {renderHeader()}
      
      <main className="app-main">
        {currentPage === 'home' && (
          <LandingPage onNavigate={setCurrentPage} />
        )}

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
        
        {currentPage === 'dashboard' && user && profile?.type === 'pi' && !profile?.onboarding_complete && !sessionStorage.getItem('onboarding_skipped') && (
          <PIOnboarding
            user={user}
            profile={profile}
            onComplete={() => { loadProfile(user.id); setCurrentPage('dashboard') }}
            onSkip={() => { sessionStorage.setItem('onboarding_skipped', '1'); setCurrentPage('dashboard') }}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'dashboard' && user && (profile?.type !== 'pi' || profile?.onboarding_complete || sessionStorage.getItem('onboarding_skipped')) && (
          <DashboardPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'messages' && user && (
          <MessagingPage 
            user={user}
            profile={profile}
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

        {currentPage === 'profile-edit' && (
          <ProfileEditPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
            onProfileUpdate={loadProfile}
          />
        )}

        {currentPage === 'admin' && (
          <AdminPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'transactions' && (
          <TransactionsPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'email-preferences' && (
          <EmailPreferencesPage 
            user={user}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'analytics' && (
          <AnalyticsDashboard 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'rate-calculator' && (
          <RateCalculatorPage 
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'terms' && (
          <TermsPage onNavigate={setCurrentPage} />
        )}

        {currentPage === 'privacy' && (
          <PrivacyPage onNavigate={setCurrentPage} />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-links">
          <button className="footer-link" onClick={() => setCurrentPage('terms')}>Terms of Service</button>
          <span className="footer-divider">·</span>
          <button className="footer-link" onClick={() => setCurrentPage('privacy')}>Privacy Policy</button>
          <span className="footer-divider">·</span>
          <span className="footer-copy">© {new Date().getFullYear()} PI Connect</span>
        </div>
      </footer>
    </div>
  )
}
