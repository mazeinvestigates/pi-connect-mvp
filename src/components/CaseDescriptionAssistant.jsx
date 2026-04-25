import React, { useState } from 'react'

const INVESTIGATION_PROMPTS = {
  'Surveillance': [
    'Who is the subject? (describe without using their name — e.g., "my ex-spouse", "an employee")',
    'What behavior are you trying to document?',
    'What is the general location or area for surveillance?',
    'How many days of surveillance do you need?',
    'What format do you need the evidence in? (video, photos, written report)',
  ],
  'Infidelity Investigation': [
    'What suspicious behavior have you observed?',
    'What do you need documented? (e.g., meetings, locations, activities)',
    'What is the general area where the subject lives or works?',
    'Are there specific times or days that are most relevant?',
    'What will you use the evidence for?',
  ],
  'Insurance Investigation': [
    'What type of insurance claim is being investigated? (workers comp, disability, auto, etc.)',
    'What is the suspected fraud or misrepresentation?',
    'What activities or behaviors need to be documented?',
    'How long has the claim been active?',
    'What documentation does your carrier require?',
  ],
  'Background Check': [
    'What is your relationship to the subject? (potential employee, tenant, business partner, etc.)',
    'What specific records are you looking for? (criminal, financial, employment, etc.)',
    'What state or states should be searched?',
    'What will the results be used for?',
  ],
  'Missing Person': [
    'When was the person last seen and where?',
    'What is your relationship to this person?',
    'What do you already know about their possible whereabouts?',
    'Is this an adult who left voluntarily or a disappearance of concern?',
    'Have law enforcement been notified?',
  ],
  'Corporate Investigation': [
    'What type of misconduct are you investigating? (theft, fraud, harassment, espionage, etc.)',
    'Is this an internal employee or an external party?',
    'What evidence do you need to support potential legal action?',
    'What is the approximate scope? (one person, a team, a vendor)',
    'Do you need court-admissible documentation?',
  ],
  'Asset Search': [
    'What type of assets are you trying to locate? (real estate, vehicles, bank accounts, business interests)',
    'Is this related to a legal judgment, divorce, or debt collection?',
    'What state or states should be searched?',
    'Do you have any existing information about the subject\'s assets?',
  ],
  'Process Serving': [
    'What type of legal documents need to be served?',
    'What do you know about the subject\'s location or routine?',
    'Has serving been attempted before? If so, what happened?',
    'Is there a court deadline for service?',
  ],
  'Child Custody Investigation': [
    'What custody order violations are you concerned about?',
    'What specific behaviors need to be documented?',
    'What is the general location of the subject?',
    'What is the timeframe you need covered?',
    'Will this be used in family court proceedings?',
  ],
  'Tenant Screening': [
    'What type of property is being rented?',
    'What specific background information do you need? (rental history, criminal, employment verification)',
    'Are there specific concerns about this applicant?',
  ],
  'Skip Trace': [
    'What is your relationship to the person you are trying to locate?',
    'What is the purpose of locating them? (legal service, debt collection, reconnecting with family)',
    'What information do you already have? (last known address, employer, associates)',
    'What state were they last known to be in?',
  ],
  'Digital Investigation': [
    'What type of digital investigation do you need? (social media, email fraud, online identity, cyberstalking)',
    'What platforms or accounts are involved?',
    'What specific evidence or information are you looking for?',
    'Is this related to a legal proceeding?',
  ],
  'Nanny/Caregiver Investigation': [
    'What type of caregiver are you investigating? (nanny, home health aide, babysitter)',
    'What specific behaviors or concerns prompted this investigation?',
    'Does the caregiver know they are being evaluated?',
    'What format of evidence do you need?',
  ],
}

async function callAI(prompt) {
  const res = await fetch('/api/ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'AI request failed')
  return data.text
}

export default function CaseDescriptionAssistant({ investigationType, description, onDescriptionChange }) {
  const [mode, setMode] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [improved, setImproved] = useState(null)

  const questions = INVESTIGATION_PROMPTS[investigationType] || []

  const handleGenerateFromAnswers = async () => {
    const filled = Object.entries(answers).filter(([, v]) => v?.trim())
    if (filled.length === 0) { setError('Please answer at least one question.'); return }
    setLoading(true)
    setError(null)
    try {
      const answersText = questions
        .map((q, i) => answers[i]?.trim() ? `${q}\n${answers[i].trim()}` : '')
        .filter(Boolean).join('\n\n')

      const text = await callAI(
        `You are helping a client post a job on PI Connect, a private investigation marketplace.\n\nWrite a clear, professional job description for a ${investigationType || 'investigation'} based on these details:\n\n${answersText}\n\nRequirements:\n- 2-4 sentences, professional but plain language\n- Focus on what needs to be done and what evidence or deliverables are needed\n- Do NOT include any personal names — use descriptive terms like "the subject" or "the claimant"\n- Do NOT mention specific dollar amounts\n- End with what deliverables are needed (written report, video footage, photos, court-ready documentation, etc.)\n\nReturn only the description text, nothing else.`
      )
      onDescriptionChange(text)
      setMode(null)
      setAnswers({})
    } catch (err) {
      setError('Could not generate description. Please try writing it manually.')
    } finally {
      setLoading(false)
    }
  }

  const handleImproveExisting = async () => {
    if (!description || description.trim().length < 20) {
      setError('Please write at least a sentence before improving.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const text = await callAI(
        `You are helping a client improve a job posting on PI Connect, a private investigation marketplace.\n\nImprove this ${investigationType || 'investigation'} job description to be clearer, more professional, and more useful to a private investigator reviewing it:\n\n"${description}"\n\nRequirements:\n- Keep all the key facts the client provided\n- Be more specific about what deliverables are needed\n- Replace any personal names with "the subject"\n- 2-5 sentences, professional but plain language\n- Do NOT add information that was not in the original\n\nReturn only the improved description text, nothing else.`
      )
      setImproved(text)
    } catch (err) {
      setError('Could not improve description. Please edit manually.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {!mode && !improved && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {questions.length > 0 && (
            <button type="button" onClick={() => { setMode('guided'); setError(null) }}
              style={{ background: 'none', border: '1px solid #667eea', color: '#667eea', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              ✨ Help me write this
            </button>
          )}
          {description && description.trim().length > 20 && (
            <button type="button" onClick={handleImproveExisting} disabled={loading}
              style={{ background: 'none', border: '1px solid #667eea', color: '#667eea', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              {loading ? '⏳ Improving...' : '✨ Improve my description'}
            </button>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px' }}>{error}</p>}

      {mode === 'guided' && (
        <div style={{ background: '#f8f7ff', border: '1px solid #667eea', borderRadius: '10px', padding: '16px', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontWeight: '600', fontSize: '13px', color: '#374151', margin: 0 }}>✨ Answer a few questions to generate your description</p>
            <button type="button" onClick={() => { setMode(null); setAnswers({}); setError(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {questions.map((q, i) => (
              <div key={i}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '4px' }}>{q}</label>
                <input type="text" value={answers[i] || ''}
                  onChange={e => setAnswers({ ...answers, [i]: e.target.value })}
                  placeholder="Your answer..."
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {error && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button type="button" onClick={handleGenerateFromAnswers} disabled={loading}
              style={{ background: '#667eea', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: loading ? 0.7 : 1 }}>
              {loading ? '⏳ Writing...' : '✨ Generate Description'}
            </button>
            <button type="button" onClick={() => { setMode(null); setAnswers({}); setError(null) }}
              style={{ background: 'none', border: '1px solid #e5e7eb', color: '#374151', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {improved && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px', marginTop: '8px' }}>
          <p style={{ fontWeight: '600', fontSize: '13px', color: '#166534', marginBottom: '8px' }}>✨ Suggested improvement:</p>
          <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px' }}>{improved}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => { onDescriptionChange(improved); setImproved(null) }}
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
