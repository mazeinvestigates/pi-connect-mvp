import React from 'react'

export default function PIConnectLogo({ size = 32, showWordmark = true, darkBackground = false }) {
  const markColor = '#667eea'
  const textDark = darkBackground ? '#ffffff' : '#1a1a2e'
  const textAccent = '#667eea'

  if (!showWordmark) {
    return (
      <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="85" cy="85" r="55" fill="none" stroke={markColor} strokeWidth="14"/>
        <line x1="127" y1="127" x2="172" y2="172" stroke={markColor} strokeWidth="16" strokeLinecap="round"/>
        <line x1="63" y1="77" x2="108" y2="96" stroke={markColor} strokeWidth="4" strokeLinecap="round" opacity="0.5"/>
        <circle cx="63" cy="77" r="9" fill={markColor}/>
        <circle cx="108" cy="96" r="9" fill={markColor}/>
      </svg>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${size * 0.25}px` }}>
      <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="85" cy="85" r="55" fill="none" stroke={markColor} strokeWidth="14"/>
        <line x1="127" y1="127" x2="172" y2="172" stroke={markColor} strokeWidth="16" strokeLinecap="round"/>
        <line x1="63" y1="77" x2="108" y2="96" stroke={markColor} strokeWidth="4" strokeLinecap="round" opacity="0.5"/>
        <circle cx="63" cy="77" r="9" fill={markColor}/>
        <circle cx="108" cy="96" r="9" fill={markColor}/>
      </svg>
      <span style={{ fontSize: `${size * 0.38}px`, lineHeight: 1, letterSpacing: '-0.02em' }}>
        <span style={{ fontWeight: 700, color: textDark }}>PI </span>
        <span style={{ fontWeight: 400, color: textAccent }}>Connect</span>
      </span>
    </div>
  )
}
