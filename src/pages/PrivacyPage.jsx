import React from 'react'

export default function PrivacyPage({ onNavigate }) {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="btn-back" onClick={() => onNavigate('search')}>← Back</button>

        <h1>Privacy Policy</h1>
        <p className="legal-effective">Effective Date: March 2026</p>

        <section>
          <h2>1. Overview</h2>
          <p>PI Connect ("we," "us," "the Platform") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data. By using the Platform, you consent to the practices described here.</p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <h3>Information you provide directly:</h3>
          <ul>
            <li>Account registration information (name, email address, password)</li>
            <li>PI profile information (license number, specialties, location, bio, photo)</li>
            <li>Job postings (description, location, budget, investigation type)</li>
            <li>Messages sent through the Platform</li>
            <li>Reviews and ratings you submit</li>
            <li>Payment information (processed and stored by Stripe — we do not store card numbers)</li>
          </ul>
          <h3>Identity verification documents (PI accounts only):</h3>
          <ul>
            <li>PI license document (photo or scan)</li>
            <li>Government-issued photo ID (driver's license, state ID, or passport)</li>
            <li>Selfie with ID (optional)</li>
          </ul>
          <p>See Section 5 for how verification documents are handled and deleted.</p>
          <h3>Information collected automatically:</h3>
          <ul>
            <li>Login timestamps and session data</li>
            <li>Pages viewed and features used</li>
            <li>IP address and browser type</li>
            <li>Transaction records and payment history</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>To operate and maintain the Platform</li>
            <li>To match clients with appropriate investigators</li>
            <li>To process payments and maintain transaction records</li>
            <li>To send notifications relevant to your account activity</li>
            <li>To verify PI credentials and maintain platform quality</li>
            <li>To detect and prevent fraud, abuse, and off-platform transactions</li>
            <li>To improve the Platform based on usage patterns</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2>4. Information Sharing</h2>
          <p>We do not sell your personal information. We share information only in the following circumstances:</p>
          <ul>
            <li><strong>With other users:</strong> PI profiles (name, credentials, location, ratings) are visible to clients. Client contact information is shared with PIs only after a job is accepted or a referral is accepted. Subcontractor arrangements are kept confidential — subcontractors do not receive client information.</li>
            <li><strong>With service providers:</strong> We use Stripe for payment processing and Supabase for database hosting. These providers have their own privacy policies.</li>
            <li><strong>For legal reasons:</strong> We may disclose information if required by law, subpoena, or to protect the rights and safety of users or the public.</li>
            <li><strong>Business transfers:</strong> In the event of a merger or acquisition, user data may be transferred as part of that transaction.</li>
          </ul>
        </section>

        <section>
          <h2>5. Identity Verification Documents</h2>
          <p>PI accounts are required to submit identity verification documents as part of the credentialing process. These documents are handled with heightened care:</p>
          <ul>
            <li><strong>Storage:</strong> All verification documents are stored in a private, encrypted storage bucket. They are not publicly accessible and cannot be viewed by other users, clients, or other PIs.</li>
            <li><strong>Access:</strong> Only PI Connect administrators can access verification documents, and only for the purpose of reviewing and approving PI applications.</li>
            <li><strong>Deletion on approval:</strong> Upon approval of a PI's verification application, all submitted identity documents (PI license document, government-issued ID, and selfie) are permanently deleted from our systems. The license number and issuing state are retained on the PI's profile as part of their credentials.</li>
            <li><strong>Deletion on request:</strong> If a PI's application is rejected or if a PI requests deletion of their documents, documents will be removed from storage. The PI may resubmit updated documents at any time.</li>
            <li><strong>No retention after verification:</strong> We do not retain copies of identity verification documents after the verification process is complete. This is a deliberate security practice to minimize the risk of sensitive document exposure.</li>
          </ul>
        </section>

        <section>
          <h2>6. Data Retention</h2>
          <p>We retain your account information for as long as your account is active or as needed to provide services. Transaction records are retained for at least seven years for accounting and legal purposes. Identity verification documents are deleted upon approval as described in Section 5. You may request deletion of your account and associated data by contacting us, subject to our legal retention obligations.</p>
        </section>

        <section>
          <h2>7. Security</h2>
          <p>We use industry-standard security measures including encrypted data transmission, row-level security on our database, role-based access controls, and private storage buckets for sensitive documents. No system is completely secure, and we cannot guarantee absolute security. We will notify users of any data breaches as required by applicable law.</p>
        </section>

        <section>
          <h2>8. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your data (subject to legal retention requirements)</li>
            <li>Opt out of non-essential communications</li>
            <li>Data portability (receive a copy of your data in a common format)</li>
          </ul>
          <p>To exercise any of these rights, contact us through the Platform.</p>
        </section>

        <section>
          <h2>9. Cookies and Tracking</h2>
          <p>The Platform uses session cookies necessary for authentication. We do not use third-party advertising cookies or tracking pixels. Analytics data is used solely for internal product improvement.</p>
        </section>

        <section>
          <h2>10. Children's Privacy</h2>
          <p>The Platform is not directed at children under 18 and we do not knowingly collect information from minors. If you believe a minor has created an account, please contact us immediately.</p>
        </section>

        <section>
          <h2>11. Changes to This Policy</h2>
          <p>We may update this Privacy Policy periodically. We will notify users of material changes via email or in-app notification. Continued use of the Platform after changes are posted constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>For privacy-related questions or to exercise your rights, contact us through the Platform's messaging system or at the contact information provided on our website.</p>
        </section>

        <div className="legal-footer">
          <button className="btn-secondary" onClick={() => onNavigate('search')}>Back to Home</button>
        </div>
      </div>
    </div>
  )
}
