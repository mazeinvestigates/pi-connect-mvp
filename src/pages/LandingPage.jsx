import React, { useState, useEffect, useRef } from 'react'

function AnimatedLogo({ size = 120 }) {
  const [phase, setPhase] = useState(0)
  // phase 0: elements appear, phase 1: line draws in, phase 2: hold, phase 3: fade out and reset

  useEffect(() => {
    const timings = [800, 1200, 1800, 500]
    let timeout
    const advance = (p) => {
      timeout = setTimeout(() => {
        const next = (p + 1) % 4
        setPhase(next)
        advance(next)
      }, timings[p])
    }
    advance(0)
    return () => clearTimeout(timeout)
  }, [])

  const color = '#667eea'
  const faded = phase === 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', borderRadius: '20px', padding: '28px 40px', border: '1px solid rgba(255,255,255,0.12)' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* Magnifying glass circle */}
        <circle
          cx="85" cy="85" r="55"
          fill="none"
          stroke={color}
          strokeWidth="14"
          style={{
            opacity: faded ? 0 : 1,
            transition: faded ? 'opacity 0.4s' : 'opacity 0.6s 0.1s'
          }}
        />
        {/* Handle */}
        <line
          x1="127" y1="127" x2="172" y2="172"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          style={{
            opacity: faded ? 0 : 1,
            transition: faded ? 'opacity 0.4s' : 'opacity 0.6s 0.2s'
          }}
        />
        {/* Left dot */}
        <circle
          cx="63" cy="77" r="9"
          fill={color}
          style={{
            opacity: faded ? 0 : 1,
            transform: faded ? 'scale(0)' : 'scale(1)',
            transformOrigin: '63px 77px',
            transition: faded
              ? 'opacity 0.4s, transform 0.4s'
              : 'opacity 0.5s 0.3s, transform 0.5s 0.3s'
          }}
        />
        {/* Right dot */}
        <circle
          cx="108" cy="96" r="9"
          fill={color}
          style={{
            opacity: faded ? 0 : 1,
            transform: faded ? 'scale(0)' : 'scale(1)',
            transformOrigin: '108px 96px',
            transition: faded
              ? 'opacity 0.4s, transform 0.4s'
              : 'opacity 0.5s 0.5s, transform 0.5s 0.5s'
          }}
        />
        {/* Connecting line — draws in during phase 1 */}
        <line
          x1="63" y1="77" x2="108" y2="96"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          style={{
            opacity: phase >= 1 && phase < 3 ? 0.6 : 0,
            strokeDasharray: '52',
            strokeDashoffset: phase >= 1 && phase < 3 ? '0' : '52',
            transition: phase >= 1 && phase < 3
              ? 'stroke-dashoffset 0.5s ease-out, opacity 0.3s'
              : 'opacity 0.3s'
          }}
        />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: `${size * 0.38}px`, lineHeight: 1, letterSpacing: '-0.02em' }}>
          <span style={{ fontWeight: 700, color: '#1a1a2e' }}>PI </span>
          <span style={{ fontWeight: 400, color }}>Connect</span>
        </div>
        <div style={{ fontSize: `${size * 0.14}px`, color: '#9797a8', letterSpacing: '0.04em', marginTop: '6px', fontWeight: 500 }}>
          Licensed Investigators, On Demand
        </div>
      </div>
    </div>
  )
}

export default function LandingPage({ onNavigate }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  const piFeatures = [
    {
      icon: '📋',
      title: 'More Cases, Less Legwork',
      body: 'Browse open jobs from clients across the country. Apply with your proposal and let the platform handle the rest.'
    },
    {
      icon: '🤝',
      title: 'Subcontract & Refer',
      body: 'Expand your reach without expanding your staff. Subcontract field work to verified PIs in any market, or refer jobs for a fee.'
    },
    {
      icon: '💳',
      title: 'Get Paid Reliably',
      body: 'Secure payments processed through the platform. No more chasing invoices or dealing with non-paying clients.'
    },
    {
      icon: '⭐',
      title: 'Build Your Reputation',
      body: 'Accumulate verified client reviews and professional peer reviews that set you apart from the competition.'
    },
  ]

  const clientFeatures = [
    {
      icon: '🔍',
      title: 'Find the Right PI Fast',
      body: 'Search verified investigators by location, specialty, and rating. See credentials, reviews, and pricing upfront.'
    },
    {
      icon: '✅',
      title: 'Every PI is Verified',
      body: 'All investigators are licensed and admin-verified before appearing in search results. No guesswork, no risk.'
    },
    {
      icon: '🔒',
      title: 'Secure & Confidential',
      body: 'Your case details stay private. Encrypted messaging, secure payments, and built-in confidentiality controls.'
    },
    {
      icon: '📊',
      title: 'Full Case Visibility',
      body: 'Track application status, communicate directly with your PI, and manage payments — all in one place.'
    },
  ]

  const investigationTypes = [
    'Surveillance', 'Background Investigation', 'Fraud Investigation',
    'Missing Person', 'Infidelity Investigation', 'Corporate Investigation',
    'Insurance Investigation', 'Skip Tracing', 'Cyber Investigation',
    'Asset Investigation', 'Workers Compensation', 'Domestic Investigation'
  ]

  return (
    <div className="landing-page">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className={`hero-content ${visible ? 'hero-visible' : ''}`}>

          {/* Animated logo mark */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <AnimatedLogo size={100} />
          </div>

          <div className="hero-badge">Now in Beta — Join Early</div>
          <h1 className="hero-headline">
            The Marketplace for<br />
            <span className="hero-highlight">Private Investigation</span>
          </h1>
          <p className="hero-sub">
            PI Connect connects licensed investigators with clients who need them.
            Whether you're looking for a PI or you are one — this is where the work gets done.
          </p>

          <div className="hero-ctas">
            <div className="cta-card cta-client">
              <div className="cta-label">Need an Investigator?</div>
              <p>Post a job or search verified PIs in your area.</p>
              <button className="btn-cta-primary" onClick={() => onNavigate('search')}>
                Find a PI
              </button>
              <button className="btn-cta-ghost" onClick={() => onNavigate('auth')}>
                Post a Job
              </button>
            </div>

            <div className="cta-divider">or</div>

            <div className="cta-card cta-pi">
              <div className="cta-label">Are You a PI?</div>
              <p>Join our network and start connecting with clients nationwide.</p>
              <button className="btn-cta-primary btn-cta-pi-primary" onClick={() => onNavigate('auth')}>
                Join as a PI
              </button>
              <button className="btn-cta-ghost btn-cta-pi-ghost" onClick={() => onNavigate('search')}>
                Browse Open Jobs
              </button>
            </div>
          </div>
        </div>

        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-grid" />
        </div>
      </section>

      {/* ── FOR PIs ──────────────────────────────────────────────────────── */}
      <section className="landing-section landing-pi">
        <div className="section-inner">
          <div className="section-eyebrow">For Private Investigators</div>
          <h2 className="section-headline">Grow Your Business.<br />Keep Your Independence.</h2>
          <p className="section-sub">
            PI Connect is built by people who understand the industry. No corporate overhead,
            no exclusive contracts — just a platform that connects you with clients and lets you work your way.
          </p>

          <div className="features-grid">
            {piFeatures.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>

          <div className="section-cta">
            <button className="btn-section-primary" onClick={() => onNavigate('auth')}>
              Register as a PI
            </button>
            <span className="section-cta-note">Free to join. No monthly fees during beta.</span>
          </div>
        </div>
      </section>

      {/* ── FOR CLIENTS ──────────────────────────────────────────────────── */}
      <section className="landing-section landing-clients">
        <div className="section-inner">
          <div className="section-eyebrow section-eyebrow-dark">For Clients</div>
          <h2 className="section-headline section-headline-dark">The Right Investigator.<br />For Your Specific Case.</h2>
          <p className="section-sub section-sub-dark">
            Finding a qualified PI used to mean cold calls and crossed fingers.
            PI Connect shows you verified credentials, real reviews, and transparent pricing
            before you ever make contact.
          </p>

          <div className="features-grid">
            {clientFeatures.map((f, i) => (
              <div key={i} className="feature-card feature-card-dark">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>

          <div className="section-cta">
            <button className="btn-section-secondary" onClick={() => onNavigate('search')}>
              Search Investigators
            </button>
            <button className="btn-section-ghost" onClick={() => onNavigate('auth')}>
              Create a Free Account
            </button>
          </div>
        </div>
      </section>

      {/* ── INVESTIGATION TYPES ──────────────────────────────────────────── */}
      <section className="landing-types">
        <div className="section-inner">
          <div className="section-eyebrow">Areas of Practice</div>
          <h2 className="section-headline">What We Cover</h2>
          <div className="types-grid">
            {investigationTypes.map((type, i) => (
              <div key={i} className="type-chip">{type}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="landing-section landing-how">
        <div className="section-inner">
          <div className="section-eyebrow">How It Works</div>
          <h2 className="section-headline section-headline-dark">Simple by Design</h2>

          <div className="how-grid">
            <div className="how-col">
              <div className="how-col-label">For Clients</div>
              {[
                ['Post a Job or Search', 'Describe your case and post it, or browse PIs directly by location and specialty.'],
                ['Review & Connect', 'Compare profiles, credentials, and reviews. Message PIs directly before committing.'],
                ['Get It Done', 'Accept a proposal, fund the job, and track progress through to delivery.'],
              ].map(([title, body], i) => (
                <div key={i} className="how-step">
                  <div className="how-step-num">{i + 1}</div>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="how-divider" />

            <div className="how-col">
              <div className="how-col-label">For Investigators</div>
              {[
                ['Register & Get Verified', 'Create your profile, submit your license, and get verified by our admin team within 24-48 hours.'],
                ['Apply or Get Found', 'Apply to posted jobs with your proposal, or let clients find you through search.'],
                ['Work & Get Paid', 'Accept the job, complete the work, and collect payment securely through the platform.'],
              ].map(([title, body], i) => (
                <div key={i} className="how-step">
                  <div className="how-step-num how-step-num-pi">{i + 1}</div>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="landing-final-cta">
        <div className="final-cta-bg">
          <div className="hero-orb hero-orb-1" style={{ opacity: 0.15 }} />
          <div className="hero-orb hero-orb-2" style={{ opacity: 0.1 }} />
        </div>
        <div className="final-cta-content">
          <h2>Ready to Get Started?</h2>
          <p>Join PI Connect today — whether you're looking for an investigator or ready to take on more cases.</p>
          <div className="final-cta-buttons">
            <button className="btn-final-primary" onClick={() => onNavigate('search')}>
              Find an Investigator
            </button>
            <button className="btn-final-secondary" onClick={() => onNavigate('auth')}>
              Join as a PI
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}
