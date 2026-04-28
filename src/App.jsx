import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { ensureReferralCode, recordSignupReferral } from './referralUtils'
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
import SubscriptionPage from './pages/SubscriptionPage'
import ClientProfilePage from './pages/ClientProfilePage'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import RateCalculatorPage from './pages/RateCalculatorPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import LandingPage from './pages/LandingPage'
import PIOnboarding from './components/PIOnboarding'
import NotificationCenter from './components/NotificationCenter'
import './App.css'

// Disable browser scroll restoration — we handle it manually
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const getSkipKey = (userId) => `onboarding_skipped_${userId}`

  const [onboardingSkipped, setOnboardingSkipped] = useState(false)
  const [jobsInitialTab, setJobsInitialTab] = useState('marketplace')
  const [pendingDeepLink, setPendingDeepLink] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [navCounts, setNavCounts] = useState({ messages: 0, referrals: 0, subcontracts: 0 })

  useEffect(() => {
    if (user) loadNavCounts()
    const interval = setInterval(() => {
      if (user) loadNavCounts()
    }, 60000)
    return () => clearInterval(interval)
  }, [user])

  // Handle deep link URL params — store destination, navigate once authenticated
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    const tab = params.get('tab')
    const ref = params.get('ref')

    // Capture referral code — store in localStorage so it persists across browsers/sessions
    if (ref) {
      localStorage.setItem('ref_code', ref.toUpperCase())
      // Navigate to PI signup with ref code in URL preserved
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (page) {
      sessionStorage.setItem('deeplink_page', page)
      if (tab) sessionStorage.setItem('deeplink_tab', tab)
      window.history.replaceState({}, '', window.location.pathname)
      setPendingDeepLink(true)
    }
  }, [])

  // Once user AND profile are both loaded, fire the deep link navigation
  useEffect(() => {
    if (!user || !profile) return
    if (sessionStorage.getItem('subscription_success')) {
      sessionStorage.removeItem('subscription_success')
      alert('🎉 Subscription activated! Your membership is now live.')
    }
    const page = sessionStorage.getItem('deeplink_page')
    const tab = sessionStorage.getItem('deeplink_tab')
    if (!page) { setPendingDeepLink(false); return }
    sessionStorage.removeItem('deeplink_page')
    sessionStorage.removeItem('deeplink_tab')
    setPendingDeepLink(false)
    // Small delay to ensure all state is settled after profile load
    setTimeout(() => {
      if (page === 'jobs' && tab === 'my-jobs') {
        navigateTo('jobs:my-jobs')
      } else {
        navigateTo(page)
      }
      // Show success message after Stripe redirect
      const subResult = params.get('subscription')
      if (subResult === 'success') {
        setTimeout(() => alert('Subscription activated! Welcome to PI Connect.'), 500)
      }
    }, 100)
  }, [user, profile])

  // Clear badge when navigating to the relevant page
  useEffect(() => {
    if (currentPage === 'messages') {
      setNavCounts(prev => ({ ...prev, messages: 0 }))
    }
    if (currentPage === 'referrals') {
      setNavCounts(prev => ({ ...prev, referrals: 0, subcontracts: 0 }))
    }
  }, [currentPage])

  const loadNavCounts = async () => {
    try {
      const skipMessages = currentPage === 'messages'
      const skipReferrals = currentPage === 'referrals'

      // Get user's last seen referrals timestamp
      const { data: profileData } = await supabase
        .from('profiles')
        .select('last_seen_referrals_at')
        .eq('user_id', user.id)
        .single()
      const lastSeen = profileData?.last_seen_referrals_at || null

      // Get conversation IDs for unread message count
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      const convoIds = convos?.map(c => c.id) || []

      // Parallel count queries
      const [msgRes, refRes, subRes] = await Promise.all([
        convoIds.length > 0
          ? supabase.from('messages').select('*', { count: 'exact', head: true })
              .eq('read', false).neq('sender_id', user.id).in('conversation_id', convoIds)
          : Promise.resolve({ count: 0 }),

        (() => {
          let q = supabase.from('referrals').select('*', { count: 'exact', head: true })
            .eq('referred_pi_id', user.id).eq('status', 'pending')
          if (lastSeen) q = q.gt('created_at', lastSeen)
          return q
        })(),

        (() => {
          let q = supabase.from('subcontracts').select('*', { count: 'exact', head: true })
            .eq('subcontractor_id', user.id).eq('status', 'pending')
          if (lastSeen) q = q.gt('created_at', lastSeen)
          return q
        })()
      ])

      setNavCounts(prev => ({
        messages: skipMessages ? 0 : (msgRes.count || 0),
        referrals: skipReferrals ? 0 : (refRes.count || 0),
        subcontracts: skipReferrals ? 0 : (subRes.count || 0)
      }))
    } catch (err) {
      console.error('Error loading nav counts:', err)
    }
  }

  // Update skip state when user changes
  useEffect(() => {
    if (user) {
      setOnboardingSkipped(!!sessionStorage.getItem(getSkipKey(user.id)))
    } else {
      setOnboardingSkipped(false)
    }
  }, [user?.id])
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

    // Listen for auth changes — only act on meaningful events, not background token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
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
        .maybeSingle()

      if (piProfile) {
        setProfile({ ...piProfile, type: 'pi' })
        // If on landing page, redirect to dashboard
        if (currentPage === 'home') setCurrentPage('dashboard')
        // Ensure PI has a referral code
        if (!piProfile.referral_code) {
          ensureReferralCode(userId, piProfile.first_name, piProfile.last_name)
        }
        // Process pending referral from signup
        const pending = localStorage.getItem('pending_pi_signup')
        if (pending) {
          try {
            const data = JSON.parse(pending)
            if (data.refCode && data.userId === userId) {
              recordSignupReferral(userId, piProfile.email, data.refCode)
              sessionStorage.removeItem('ref_code')
            }
          } catch {}
          localStorage.removeItem('pending_pi_signup')
        }
      } else {
        // Regular client profile
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        setProfile({ ...clientProfile, type: 'client' })
        // If on home page with active session, redirect to dashboard
        if (currentPage === 'home') setCurrentPage('dashboard')
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateTo = (page) => {
    if (page === 'jobs:my-jobs') {
      setJobsInitialTab('my-jobs')
      setCurrentPage('jobs')
    } else if (page === 'jobs') {
      setJobsInitialTab('marketplace')
      setCurrentPage('jobs')
    } else {
      setCurrentPage(page)
    }
    // Clear nav badges when visiting relevant pages
    if (page === 'messages') {
      setNavCounts(prev => ({ ...prev, messages: 0 }))
    }
    if (page === 'referrals') {
      setNavCounts(prev => ({ ...prev, referrals: 0, subcontracts: 0 }))
      // Record when user last visited referrals so badge only shows new items
      if (user) {
        supabase.from('profiles').update({
          last_seen_referrals_at: new Date().toISOString()
        }).eq('user_id', user.id).then(() => {})
      }
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setCurrentPage('search')
  }

  if (loading || (pendingDeepLink && !profile)) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Nav badge helper
  const NavBadge = ({ count }) => count > 0 ? (
    <span style={{
      background: '#ef4444', color: 'white', borderRadius: '999px',
      fontSize: '11px', fontWeight: '700', padding: '1px 6px',
      marginLeft: '4px', lineHeight: '1.4', display: 'inline-block'
    }}>{count}</span>
  ) : null

  // Dropdown item style helper
  const DropdownItem = ({ children, onClick }) => (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
      onMouseEnter={e => e.target.style.background = '#f9fafb'}
      onMouseLeave={e => e.target.style.background = 'none'}>
      {children}
    </button>
  )

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
              {profile?.type === 'pi' && <button className="nav-link" onClick={() => setCurrentPage('jobs')}>Jobs</button>}
              {profile?.type === 'pi' && (
                <button className="nav-link" onClick={() => setCurrentPage('referrals')}>Referrals<NavBadge count={navCounts.referrals + navCounts.subcontracts} /></button>
              )}
              <button className="nav-link" onClick={() => setCurrentPage('messages')}>Messages<NavBadge count={navCounts.messages} /></button>
              <button className="nav-link" onClick={() => setCurrentPage('search')}>Search</button>
              <button className="nav-link" onClick={() => setCurrentPage('transactions')}>Payments</button>
              {profile?.type !== 'pi' && <button className="nav-link" onClick={() => setCurrentPage('client-profile')}>⚙️ Settings</button>}
              {profile?.role === 'admin' && (
                <>
                  <button className="nav-link admin-link" onClick={() => setCurrentPage('admin')}>Admin</button>
                  <button className="nav-link admin-link" onClick={() => setCurrentPage('analytics')}>Analytics</button>
                </>
              )}
              {/* More dropdown */}
              <div style={{ position: 'relative', display: 'inline-block' }} className="more-menu-container">
                <button className="nav-link" onClick={() => setShowMoreMenu(prev => !prev)}>More ▾</button>
                {showMoreMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '180px', zIndex: 1000, padding: '6px 0' }}
                    onMouseLeave={() => setShowMoreMenu(false)}>
                    {profile?.type === 'pi' && (
                      <button style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#374151" }} onMouseEnter={e => e.currentTarget.style.background="#f9fafb"} onMouseLeave={e => e.currentTarget.style.background="none"} onClick={() => { setCurrentPage('subscription'); setShowMoreMenu(false) }}>⭐ Membership</button>
                    )}
                    {profile?.type === 'pi' && (
                      <button style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#374151" }} onMouseEnter={e => e.currentTarget.style.background="#f9fafb"} onMouseLeave={e => e.currentTarget.style.background="none"} onClick={() => { setCurrentPage('rate-calculator'); setShowMoreMenu(false) }}>💰 Rate Calculator</button>
                    )}
                    <button style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#374151" }} onMouseEnter={e => e.currentTarget.style.background="#f9fafb"} onMouseLeave={e => e.currentTarget.style.background="none"} onClick={() => { setCurrentPage('email-preferences'); setShowMoreMenu(false) }}>✉️ Email Preferences</button>
                    {profile?.type === 'pi' && (
                      <button style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#374151" }} onMouseEnter={e => e.currentTarget.style.background="#f9fafb"} onMouseLeave={e => e.currentTarget.style.background="none"} onClick={() => { setCurrentPage('profile-edit'); setShowMoreMenu(false) }}>Edit Profile</button>
                    )}
                  </div>
                )}
              </div>
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
              {profile?.type === 'pi' && <button className="mobile-nav-link" onClick={() => { setCurrentPage('jobs'); setMobileMenuOpen(false) }}>Jobs</button>}
              {profile?.type !== 'pi' && <button className="mobile-nav-link" onClick={() => { setCurrentPage('client-profile'); setMobileMenuOpen(false) }}>⚙️ Settings</button>}
              {profile?.type === 'pi' && <button className="mobile-nav-link" onClick={() => { setCurrentPage('subscription'); setMobileMenuOpen(false) }}>⭐ Membership</button>}
              {profile?.type === 'pi' && (
                <button className="mobile-nav-link" onClick={() => { setCurrentPage('referrals'); setMobileMenuOpen(false) }}>Referrals<NavBadge count={navCounts.referrals + navCounts.subcontracts} /></button>
              )}
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('messages'); setMobileMenuOpen(false) }}>Messages<NavBadge count={navCounts.messages} /></button>
              {profile?.type === 'pi' && (
                <button className="mobile-nav-link" onClick={() => { setCurrentPage('rate-calculator'); setMobileMenuOpen(false) }}>💰 Rate Calculator</button>
              )}
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('transactions'); setMobileMenuOpen(false) }}>💳 Payments</button>
              <button className="mobile-nav-link" onClick={() => { setCurrentPage('email-preferences'); setMobileMenuOpen(false) }}>✉️ Email Preferences</button>
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
            onNavigate={setCurrentPage}
          />
        )}
        
        {currentPage === 'dashboard' && user && profile?.type === 'pi' && !profile?.onboarding_complete && !onboardingSkipped && (
          <PIOnboarding
            user={user}
            profile={profile}
            onComplete={(dest) => { loadProfile(user.id); setCurrentPage(dest || 'subscription') }}
            onSkip={() => { sessionStorage.setItem(getSkipKey(user.id), '1'); setOnboardingSkipped(true); setCurrentPage('dashboard') }}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'dashboard' && user && (profile?.type !== 'pi' || profile?.onboarding_complete || onboardingSkipped) && (
          <DashboardPage 
            user={user}
            profile={profile}
            onNavigate={navigateTo}
          />
        )}

        {currentPage === 'messages' && user && (
          <MessagingPage 
            user={user}
            profile={profile}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'jobs' && user && profile && (
          <JobsPage 
            user={user}
            profile={profile}
            onNavigate={navigateTo}
            initialTab={jobsInitialTab}
          />
        )}

        {currentPage === 'post-job' && (
          <PostJobPage 
            user={user}
            profile={profile}
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

        {currentPage === 'client-profile' && user && profile?.type !== 'pi' && (
          <ClientProfilePage user={user} profile={profile} onNavigate={navigateTo} />
        )}

        {currentPage === 'subscription' && user && profile?.type === 'pi' && (
          <SubscriptionPage user={user} profile={profile} onNavigate={navigateTo} />
        )}

        {currentPage === 'email-preferences' && (
          <EmailPreferencesPage user={user} onNavigate={navigateTo} />
        )}


        {currentPage === 'transactions' && (
          <TransactionsPage 
            user={user}
            profile={profile}
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
