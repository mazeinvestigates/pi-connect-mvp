import React from 'react'

export default function TermsPage({ onNavigate }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="btn-back" onClick={() => onNavigate('search')}>← Back</button>

        <h1>Terms of Service</h1>
        <p className="legal-effective">Effective Date: March 2026</p>

        <section>
          <h2>1. Agreement to Terms</h2>
          <p>By accessing or using PI Connect ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform. These terms apply to all users including clients, private investigators, and administrators.</p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>PI Connect is a two-sided marketplace that connects clients seeking investigation services with licensed private investigators. The Platform facilitates discovery, communication, and payment processing but is not itself an investigation agency and does not employ any private investigators.</p>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must be at least 18 years of age to use the Platform.</p>
          <p>PI Connect reserves the right to suspend or terminate accounts that violate these Terms, provide false information, or engage in conduct harmful to other users or the Platform.</p>
        </section>

        <section>
          <h2>4. Private Investigator Accounts</h2>
          <p>Private investigators must hold a valid PI license in the state(s) where they conduct work. By registering as a PI, you represent that you are licensed, in good standing, and will only accept work you are legally authorized to perform. PI Connect reserves the right to verify credentials and remove any PI whose license cannot be confirmed.</p>
          <p>PIs are independent contractors, not employees of PI Connect. You are solely responsible for the quality of your work, compliance with applicable laws, and your own tax obligations.</p>
        </section>

        <section>
          <h2>5. Platform Fees</h2>
          <p>PI Connect charges a 15% platform fee on all labor transactions processed through the Platform. This fee is deducted from the PI's payment. Expenses passed through to clients are not subject to the platform fee. Referral fees, when applicable, are paid from the receiving PI's net payout after the platform fee is deducted.</p>
          <p>All fees are disclosed prior to payment confirmation. By completing a transaction, you agree to the applicable fee structure.</p>
        </section>

        <section>
          <h2>6. Payments and Refunds</h2>
          <p>All payments are processed through Stripe. By using the payment features, you agree to Stripe's Terms of Service. PI Connect does not store credit card information. Payments are generally non-refundable once a PI has accepted work, unless otherwise agreed between the parties or required by applicable law.</p>
          <p>Disputes regarding payment or services rendered should be raised through the Platform's messaging system. PI Connect may, at its discretion, mediate disputes but is not obligated to do so.</p>
        </section>

        <section>
          <h2>7. Prohibited Conduct</h2>
          <p>You agree not to use the Platform to:</p>
          <ul>
            <li>Request or perform any illegal investigation activity</li>
            <li>Circumvent the Platform's payment system by conducting transactions off-platform</li>
            <li>Share another user's personal information with third parties</li>
            <li>Harass, threaten, or abuse any other user</li>
            <li>Post false reviews or misrepresent your credentials or experience</li>
            <li>Use the Platform for any purpose that violates federal, state, or local law</li>
          </ul>
          <p>The Platform uses automated content filtering to detect and prevent off-platform contact sharing. Attempts to circumvent this system may result in account termination.</p>
        </section>

        <section>
          <h2>8. Confidentiality of Subcontract Arrangements</h2>
          <p>When a primary PI engages another PI as a silent subcontractor, the subcontractor agrees to treat all case-related information as strictly confidential and to communicate only with the primary PI, not the end client. Breach of this arrangement may result in account termination and potential legal liability.</p>
        </section>

        <section>
          <h2>9. Reviews and Ratings</h2>
          <p>Users may leave reviews after completed engagements. Reviews must be honest and based on actual experience. Fake, coerced, or retaliatory reviews are prohibited. PI Connect reserves the right to remove reviews that violate these standards.</p>
        </section>

        <section>
          <h2>10. Disclaimers</h2>
          <p>The Platform is provided "as is" without warranties of any kind. PI Connect does not guarantee the quality, legality, or accuracy of any investigation services performed through the Platform. PI Connect is not liable for any damages arising from your use of the Platform or from services provided by PIs you hire through it.</p>
        </section>

        <section>
          <h2>11. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, PI Connect's total liability to you for any claims arising from these Terms or your use of the Platform shall not exceed the total fees you paid to PI Connect in the twelve months preceding the claim.</p>
        </section>

        <section>
          <h2>12. Changes to Terms</h2>
          <p>PI Connect may update these Terms at any time. Continued use of the Platform after changes are posted constitutes acceptance of the updated Terms. We will notify users of material changes via email or in-app notification.</p>
        </section>

        <section>
          <h2>13. Governing Law</h2>
          <p>These Terms are governed by the laws of the State of New York, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of New York.</p>
        </section>

        <section>
          <h2>14. Contact</h2>
          <p>For questions about these Terms, contact us through the Platform's messaging system or at the contact information provided on our website.</p>
        </section>

        <div className="legal-footer">
          <button className="btn-secondary" onClick={() => onNavigate('search')}>Back to Home</button>
        </div>
      </div>
    </div>
  )
}
