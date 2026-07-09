import { useDocumentTitle } from '../hooks/useDocumentTitle'

const UPDATED = '9 July 2026'

export function PrivacyPage() {
  useDocumentTitle('Privacy Policy')

  return (
    <article className="legal-doc card card-pad">
      <h1>Privacy Policy</h1>
      <p className="legal-meta">Last updated: {UPDATED}</p>

      <p>
        This Privacy Policy describes how <strong>SEO CRM</strong> (“we”, “us”, “our”), an internal SEO
        operations tool operated from Nigeria, collects, uses, and protects information when you use our
        application at{' '}
        <a href="https://seo-crm.up.railway.app" rel="noreferrer" target="_blank">
          https://seo-crm.up.railway.app
        </a>{' '}
        (the “Service”).
      </p>

      <h2>1. Who this Service is for</h2>
      <p>
        SEO CRM is designed for internal use by authorized team members and contractors. It is not a
        public consumer social network and is not intended for children under 16.
      </p>

      <h2>2. Information we process</h2>
      <ul>
        <li>
          <strong>Account and contact data</strong> you provide (for example email used for support or
          Google sign-in).
        </li>
        <li>
          <strong>SEO workspace data</strong> you enter into the Service: projects, niches, pages,
          keywords, URLs, notes, competitors, and related content drafts.
        </li>
        <li>
          <strong>Google account connection data</strong> when you authorize integrations: OAuth tokens
          and profile identifiers needed to access Google Search Console, Google Analytics, and Google
          Ads (Keyword Planner–related keyword research), subject to the permissions you grant.
        </li>
        <li>
          <strong>Google performance and research metrics</strong> synced into the Service on your
          behalf (for example Search Console clicks/impressions, Analytics sessions, Keyword Planner
          volume/competition/CPC estimates).
        </li>
        <li>
          <strong>Technical logs</strong> such as error logs, sync job status, and basic request
          metadata needed to operate and secure the Service.
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>To provide and maintain the SEO CRM workspace and features you use.</li>
        <li>To connect Google properties you authorize and display synced metrics inside the app.</li>
        <li>
          To generate AI-assisted content drafts or analyses when you request them (processed via our
          configured AI provider using only the context you or the system supply for that task).
        </li>
        <li>To secure the Service, troubleshoot issues, and improve reliability.</li>
        <li>To respond to support requests sent to our contact email.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information. We do not use Google user data for
        advertising to third parties, and we do not allow the Service to be used as a public marketplace
        for Google Ads API access.
      </p>

      <h2>4. Google user data</h2>
      <p>
        When you connect Google services, our use of information received from Google APIs will adhere to
        the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noreferrer" target="_blank">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <ul>
        <li>
          Google OAuth tokens and synced metrics are stored on our servers to power features you enable
          (for example dashboards and keyword research tables).
        </li>
        <li>
          We request only the scopes needed for Search Console, Analytics, user profile identification,
          and Google Ads keyword research as configured in the product.
        </li>
        <li>
          You may revoke access at any time in your Google Account permissions and by disconnecting
          integrations in the Service where available.
        </li>
      </ul>

      <h2>5. AI processing</h2>
      <p>
        If you use AI features, relevant workspace context (for example page title, keywords, and
        selected metrics) may be sent to our AI provider solely to generate the requested draft or
        analysis. AI output is supervisory: humans review before any external publishing. Do not submit
        sensitive personal data into prompts unless necessary.
      </p>

      <h2>6. Sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li>
          <strong>Infrastructure providers</strong> that host the Service (for example application and
          database hosting).
        </li>
        <li>
          <strong>Google</strong> when you authorize OAuth and API access.
        </li>
        <li>
          <strong>AI providers</strong> when you run generation features.
        </li>
        <li>
          <strong>Authorities</strong> if required by applicable law.
        </li>
      </ul>

      <h2>7. Retention</h2>
      <p>
        We retain workspace data and integration tokens for as long as the Service is used by the
        organization, or until deleted by an authorized operator. Technical logs may be retained for a
        limited period for security and debugging.
      </p>

      <h2>8. Security</h2>
      <p>
        We use reasonable technical and organizational measures appropriate to an internal business tool,
        including server-side storage of secrets (API keys, OAuth client secrets, developer tokens) and
        HTTPS for the public application URL. No method of transmission or storage is 100% secure.
      </p>

      <h2>9. International transfers</h2>
      <p>
        The Service may be hosted on infrastructure located outside Nigeria. By using the Service, you
        understand that data may be processed in those locations subject to provider safeguards.
      </p>

      <h2>10. Your choices</h2>
      <ul>
        <li>Request correction or deletion of workspace data you control, where feasible.</li>
        <li>Revoke Google access from your Google Account settings.</li>
        <li>Contact us with privacy questions at the email below.</li>
      </ul>

      <h2>11. Contact</h2>
      <p>
        Privacy and support contact:{' '}
        <a href="mailto:seo.app2026@gmail.com">seo.app2026@gmail.com</a>
        <br />
        Operator: SEO CRM · Nigeria
        <br />
        Application:{' '}
        <a href="https://seo-crm.up.railway.app" rel="noreferrer" target="_blank">
          https://seo-crm.up.railway.app
        </a>
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update this Privacy Policy from time to time. The “Last updated” date at the top will
        change when we do. Continued use of the Service after an update constitutes acceptance of the
        revised policy where permitted by law.
      </p>
    </article>
  )
}
