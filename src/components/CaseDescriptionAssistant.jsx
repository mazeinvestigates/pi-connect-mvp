import React, { useState, useRef } from 'react'

const INVESTIGATION_PROMPTS = {
  'Surveillance': ['Who is the subject?', 'What behavior are you trying to document?', 'What is the location?', 'How many days of surveillance do you need?'],
  'Background Check': ['Who needs to be checked?', 'What is your relationship to this person?', 'What specific records are you looking for?'],
  'Infidelity Investigation': ['What suspicious behavior have you observed?', 'What do you need documented?', 'What is the subject\'s general location?'],
  'Insurance Investigation': ['What type of claim is being investigated?', 'What is the suspected fraud?', 'What documentation do you need for the claim?'],
  'Missing Person': ['When was the person last seen?', 'What is their last known location?', 'What relationship do you have to this person?'],
  'Corporate Investigation': ['What type of corporate misconduct are you investigating?', 'What is the scale of the investigation?', 'Do you need court-admissible evidence?'],
  'Process Serving': ['What documents need to be served?', 'What is known about the subject\'s location?', 'Is this time-sensitive?'],
  'Asset Search': ['What type of assets are you looking for?', 'Is this related to a legal proceeding?', 'What is the approximate scope?'],
}

export default function CaseDescriptionAssistant({ investigationType, description, onDescriptionChange }) {
  const [mode, setMode] = useState(null) // null | 'guided' | 'ai-improve'
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [improved, setImproved] = useState(null)
  const textareaRef = useRef(null)

  const questions = INVESTIGATION_PROMPTS[investigationType] || []

  const handleGenerateFromAnswers = async () => {
    const filled = Object.values(answers).filter(Boolean)
    if (filled.length === 0) { setError('Please answer at least one question.'); return }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are helping a client post a job on PI Connect, a private investigation marketplace. 
            
Write a clear, professional job description for a ${investigationType} investigation based on these details:

${questions.map((q, i) => answers[i] ? `${q}\n${answers[i]}` : '').filter(Boolean).join('\n\n')}

Requirements:
- 2-4 sentences, professional but plain language
- Focus on what needs to be done and what evidence/deliverables are needed
- Do NOT include any personal names, addresses, or identifying information
- Do NOT mention specific dollar amounts
- End with what format of deliverables is needed (written report, video footage, photos, etc.)

Return only the description text, nothing else.`
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text?.trim()
      if (text) {
        onDescriptionChange(text)
        setMode(null)
        setAnswers({})
      }
    } catch (err) {
      setError('Could not generate description. Please try writing it manually.')
    } finally {
      setLoading(false)
    }
  }

  const handleImproveExisting = async () => {
    if (!description || description.length < 20) {
      setError('Please write at least a sentence before improving.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are helping a client improve a job posting on PI Connect, a private investigation marketplace.

Improve this ${investigationType} job description to be clearer, more professional, and more useful to a private investigator who will bid on it:

"${description}"

Requirements:
- Keep all the key facts the client provided
- Make it more specific about deliverables needed
- Remove any personal names if present (replace with "the subject")
- 2-5 sentences
- Professional but plain language
- Do NOT add information that wasn't in the original

Return only the improved description text, nothing else.`
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text?.trim()
      if (text) {
        setImproved(text)
      }
    } catch (err) {
      setError('Could not improve description. Please edit manually.')
    } finally {
      setLoading(false)
    }
  }

  const acceptImprovement = () => {
    onDescriptionChange(improved)
    setImproved(null)
    setMode(null)
  }

  return (
    <div style={{ marginTop: '8px' }}>

      {/* Trigger buttons */}
      {!mode && !improved && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {questions.length > 0 && (
            <button type="button"
              onClick={() => setMode('guided')}
              style={{ background: 'none', border: '1px solid #667eea', color: '#667eea', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ✨ Help me write this
            </button>
          )}
          {description && description.length > 20 && (
            <button type="button"
              onClick={handleImproveExisting}
              disabled={loading}
              style={{ background: 'none', border: '1px solid #667eea', color: '#667eea', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {loading ? '⏳ Improving...' : '✨ Improve my description'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{error}</p>
      )}

      {/* Guided Q&A mode */}
      {mode === 'guided' && (
        <div style={{ background: '#f8f7ff', border: '1px solid #667eea', borderRadius: '10px', padding: '16px', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontWeight: '600', fontSize: '13px', color: '#374151', margin: 0 }}>
              ✨ Answer a few questions to generate your description
            </p>
            <button type="button" onClick={() => { setMode(null); setAnswers({}) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px' }}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {questions.map((q, i) => (
              <div key={i}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>{q}</label>
                <input type="text"
                  value={answers[i] || ''}
                  onChange={e => setAnswers({ ...answers, [i]: e.target.value })}
                  placeholder="Your answer..."
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
            ))}
          </div>

          {error && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button type="button" onClick={handleGenerateFromAnswers} disabled={loading}
              style={{ background: '#667eea', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {loading ? '⏳ Writing...' : '✨ Generate Description'}
            </button>
            <button type="button" onClick={() => { setMode(null); setAnswers({}) }}
              style={{ background: 'none', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Improvement preview */}
      {improved && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px', marginTop: '8px' }}>
          <p style={{ fontWeight: '600', fontSize: '13px', color: '#166534', marginBottom: '8px' }}>✨ Suggested improvement:</p>
          <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px' }}>{improved}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={acceptImprovement}
              style={{ background: '#059669', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              ✓ Use this
            </button>
            <button type="button" onClick={() => setImproved(null)}
              style={{ background: 'none', border: '1px solid #e5e7eb', color: '#374151', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Keep mine
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
