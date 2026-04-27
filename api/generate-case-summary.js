import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { userId, jobId, formData } = req.body
    if (!userId || !formData) return res.status(400).json({ error: 'userId and formData required' })

    // Get PI profile and config
    const [{ data: pi }, { data: configs }] = await Promise.all([
      supabase.from('pi_profiles').select('membership_tier, ai_credits_balance, ai_premium_uses_this_month, ai_premium_uses_reset_at').eq('user_id', userId).single(),
      supabase.from('platform_config').select('key, value').in('key', ['ai_credit_price_cents', 'ai_premium_monthly_allowance'])
    ])

    if (!pi) return res.status(404).json({ error: 'PI profile not found' })

    const configMap = {}
    configs?.forEach(c => { configMap[c.key] = c.value })
    const monthlyAllowance = parseInt(configMap.ai_premium_monthly_allowance || '3')
    const isPremium = pi.membership_tier === 'premium' || pi.membership_tier === 'featured'

    // Check/reset monthly allowance for premium
    let premiumUsesThisMonth = pi.ai_premium_uses_this_month || 0
    const resetAt = pi.ai_premium_uses_reset_at ? new Date(pi.ai_premium_uses_reset_at) : null
    const now = new Date()

    if (isPremium) {
      // Reset monthly counter if it's a new month
      if (!resetAt || now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
        premiumUsesThisMonth = 0
        await supabase.from('pi_profiles').update({
          ai_premium_uses_this_month: 0,
          ai_premium_uses_reset_at: now.toISOString()
        }).eq('user_id', userId)
      }

      if (premiumUsesThisMonth < monthlyAllowance) {
        // Use free allowance
        await supabase.from('pi_profiles').update({
          ai_premium_uses_this_month: premiumUsesThisMonth + 1
        }).eq('user_id', userId)

        await supabase.from('ai_usage').insert({
          user_id: userId,
          job_id: jobId || null,
          feature: 'case_summary',
          credits_used: 1,
          is_premium_allowance: true
        })
      } else {
        // Premium exhausted free uses — check credit balance
        if ((pi.ai_credits_balance || 0) < 1) {
          return res.status(402).json({
            error: 'insufficient_credits',
            message: `You have used your ${monthlyAllowance} free summaries this month. Purchase additional credits to continue.`,
            creditsBalance: pi.ai_credits_balance || 0
          })
        }
        // Deduct paid credit
        await supabase.from('pi_profiles').update({
          ai_credits_balance: (pi.ai_credits_balance || 0) - 1
        }).eq('user_id', userId)
        await supabase.from('ai_usage').insert({ user_id: userId, job_id: jobId || null, feature: 'case_summary', credits_used: 1, is_premium_allowance: false })
      }
    } else {
      // Basic PI — check credit balance
      if ((pi.ai_credits_balance || 0) < 1) {
        return res.status(402).json({
          error: 'insufficient_credits',
          message: 'Purchase credits to use the AI Case Summary Generator.',
          creditsBalance: pi.ai_credits_balance || 0,
          pricePerCredit: parseInt(configMap.ai_credit_price_cents || '199')
        })
      }
      await supabase.from('pi_profiles').update({
        ai_credits_balance: (pi.ai_credits_balance || 0) - 1
      }).eq('user_id', userId)
      await supabase.from('ai_usage').insert({ user_id: userId, job_id: jobId || null, feature: 'case_summary', credits_used: 1, is_premium_allowance: false })
    }

    // Build prompt
    const { investigationType, subjectDescription, methodology, keyFindings, evidenceCollected, additionalContext } = formData

    const prompt = `You are a professional report writer for a licensed private investigator. Write a formal case summary report based on the following investigation details.

Investigation Type: ${investigationType || 'Not specified'}
Subject Description: ${subjectDescription || 'Not provided'}
Methodology: ${methodology || 'Not provided'}
Key Findings: ${keyFindings || 'Not provided'}
Evidence Collected: ${evidenceCollected || 'Not provided'}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Write a professional case summary with exactly these four sections:

**OVERVIEW**
A 2-3 sentence executive summary of the investigation, its purpose, and overall outcome.

**METHODOLOGY**
A professional description of the investigative methods and techniques employed. 2-4 sentences.

**KEY FINDINGS**
A clear, factual summary of what was discovered during the investigation. Use specific, professional language suitable for legal proceedings. 3-6 sentences.

**RECOMMENDATIONS**
Professional recommendations based on the findings — next steps, suggested follow-up investigation, or how the evidence can be used. 2-3 sentences.

Important guidelines:
- Write in third person professional language
- Do not include any names — refer to "the subject" throughout
- Keep language factual and suitable for court proceedings or legal use
- Do not editorialize or make legal conclusions
- Format each section header in bold as shown above`

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'AI request failed')

    const summary = data.content?.[0]?.text?.trim()
    if (!summary) throw new Error('No summary generated')

    // Get remaining credits/uses for response
    const { data: updatedPi } = await supabase
      .from('pi_profiles')
      .select('ai_credits_balance, ai_premium_uses_this_month')
      .eq('user_id', userId)
      .single()

    return res.status(200).json({
      summary,
      creditsBalance: updatedPi?.ai_credits_balance || 0,
      premiumUsesRemaining: isPremium ? Math.max(0, monthlyAllowance - (updatedPi?.ai_premium_uses_this_month || 0)) : null,
      usedPremiumAllowance: isPremium && premiumUsesThisMonth < monthlyAllowance
    })

  } catch (err) {
    console.error('Generate case summary error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
