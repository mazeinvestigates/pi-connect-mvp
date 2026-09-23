import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const PDFDocument = require('pdfkit')

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
    const { appId, userId } = req.body
    if (!appId || !userId) return res.status(400).json({ error: 'appId and userId required' })

    // Fetch application with job and PI profile
    const { data: app } = await supabase
      .from('job_applications')
      .select(`
        *,
        job:job_id (
          title, description, location, budget_min, budget_max,
          profiles:posted_by (full_name, email)
        )
      `)
      .eq('id', appId)
      .single()

    if (!app) return res.status(404).json({ error: 'Application not found' })

    // Verify requester is the PI on this application
    if (app.applicant_id !== userId) return res.status(403).json({ error: 'Unauthorized' })

    // Fetch PI profile
    const { data: pi } = await supabase
      .from('pi_profiles')
      .select('first_name, last_name, email, license_number, license_state')
      .eq('user_id', userId)
      .single()

    const piName = pi ? `${pi.first_name} ${pi.last_name}` : 'Private Investigator'
    const clientName = app.contract_signed_by_name || app.job?.profiles?.full_name || 'Client'
    const clientEmail = app.contract_signed_by_email || app.job?.profiles?.email || ''
    const signedAt = app.contract_signed_at ? new Date(app.contract_signed_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'
    const agreedAmount = app.agreed_amount_cents ? `$${(app.agreed_amount_cents / 100).toFixed(2)}` : 'As agreed'

    // Build PDF
    const doc = new PDFDocument({ margin: 72, size: 'letter' })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))

    await new Promise((resolve, reject) => {
      doc.on('end', resolve)
      doc.on('error', reject)

      // Header
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#4472C4').text('PI Connect', { align: 'center' })
      doc.fontSize(11).font('Helvetica').fillColor('#6B7280').text('Private Investigator Marketplace', { align: 'center' })
      doc.moveDown(0.5)
      doc.moveTo(72, doc.y).lineTo(540, doc.y).strokeColor('#4472C4').lineWidth(2).stroke()
      doc.moveDown(0.5)

      // Title
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1F2937').text('Private Investigation Services Agreement', { align: 'center' })
      doc.moveDown(1)

      // Parties
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('PARTIES')
      doc.moveDown(0.3)
      doc.font('Helvetica').fillColor('#374151')
      doc.text(`Investigator: ${piName}${pi?.license_number ? ` — License #${pi.license_number}${pi?.license_state ? ` (${pi.license_state})` : ''}` : ''}`)
      doc.text(`Client: ${clientName}${clientEmail ? ` (${clientEmail})` : ''}`)
      doc.moveDown(1)

      // Engagement
      doc.font('Helvetica-Bold').text('ENGAGEMENT')
      doc.moveDown(0.3)
      doc.font('Helvetica')
      doc.text(`Matter: ${app.job?.title || 'Investigation Services'}`)
      doc.text(`Location: ${app.job?.location || 'As agreed'}`)
      doc.text(`Compensation: ${agreedAmount}`)
      doc.moveDown(1)

      // Terms
      doc.font('Helvetica-Bold').text('TERMS AND CONDITIONS')
      doc.moveDown(0.3)
      doc.font('Helvetica').fontSize(10).fillColor('#374151')

      const terms = [
        '1. SERVICES. The Investigator agrees to perform private investigation services as described above and as further directed by the Client. All services will be performed in a professional manner and in compliance with all applicable laws and regulations.',
        '2. COMPENSATION. Client agrees to pay the Investigator the agreed compensation set forth above. A platform fee of 10% is retained by PI Connect. Documented expenses are passed through at cost and are separate from the agreed compensation.',
        '3. CONFIDENTIALITY. The Investigator agrees to maintain the confidentiality of all information obtained during the course of this engagement and shall not disclose such information to any third party without the prior written consent of the Client, except as required by law.',
        '4. COMPLIANCE WITH LAW. The Investigator represents that they hold all licenses required by applicable state law to perform private investigation services and that all investigation activities will be conducted in full compliance with applicable federal, state, and local laws.',
        '5. INDEPENDENT CONTRACTOR. The Investigator is an independent contractor and not an employee of the Client or PI Connect. The Investigator is solely responsible for all taxes, insurance, and other obligations arising from this engagement.',
        '6. LIMITATION OF LIABILITY. PI Connect\'s role is limited to facilitating the connection between Client and Investigator. PI Connect is not a party to this agreement and bears no liability for the performance of either party.',
        '7. RETAINER / PAYMENT. If a retainer was paid, those funds were transferred directly to the Investigator upon payment. Any refund of unused retainer funds is the responsibility of the Investigator and is governed by the applicable PI Connect Terms of Service.',
        '8. GOVERNING LAW. This Agreement shall be governed by and construed in accordance with the laws of the state in which the Investigator is licensed.',
      ]

      terms.forEach(term => {
        doc.text(term, { width: 468, align: 'justify' })
        doc.moveDown(0.5)
      })

      doc.moveDown(0.5)

      // Signature block
      doc.moveTo(72, doc.y).lineTo(540, doc.y).strokeColor('#E5E7EB').lineWidth(1).stroke()
      doc.moveDown(0.5)

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151').text('ELECTRONIC ACCEPTANCE RECORD')
      doc.moveDown(0.3)

      // Acceptance box
      const boxY = doc.y
      doc.rect(72, boxY, 468, 90).fillAndStroke('#F0FDF4', '#86EFAC')
      doc.fillColor('#166534').font('Helvetica-Bold').fontSize(10)
      doc.text('✓ This agreement was electronically accepted by the Client:', 84, boxY + 10, { width: 444 })
      doc.font('Helvetica').fillColor('#374151')
      doc.text(`Name: ${clientName}`, 84, boxY + 28)
      doc.text(`Email: ${clientEmail || 'On file'}`, 84, boxY + 43)
      doc.text(`Date & Time: ${signedAt} (Eastern Time)`, 84, boxY + 58)
      doc.text('Method: PI Connect Platform — Electronic Click-Wrap Acceptance', 84, boxY + 73, { width: 444 })
      doc.moveDown(5)

      doc.fontSize(9).font('Helvetica').fillColor('#9CA3AF')
        .text('This document was generated by PI Connect (piconnect.ai). Electronic acceptance constitutes a binding agreement under applicable e-signature laws including the Electronic Signatures in Global and National Commerce Act (E-SIGN) and the Uniform Electronic Transactions Act (UETA).', { align: 'center', width: 468 })

      doc.end()
    })

    const pdfBuffer = Buffer.concat(chunks)
    const filename = `PI-Connect-Agreement-${app.job?.title?.replace(/[^a-z0-9]/gi, '-') || 'Contract'}-${new Date().toISOString().split('T')[0]}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    return res.status(200).send(pdfBuffer)

  } catch (err) {
    console.error('Generate contract PDF error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
