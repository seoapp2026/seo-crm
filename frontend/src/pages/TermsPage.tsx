import { APP } from '../constants'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const UPDATED = '9 July 2026'

export function TermsPage() {
  useDocumentTitle('Terms of Service')

  return (
    <article className="legal-doc card card-pad">
      <h1>Terms of Service</h1>
      <p className="legal-meta">Last updated: {UPDATED}</p>

      <p>
        These Terms of Service (“Terms”) govern access to and use of <strong>SEO CRM</strong> (the
        “Service”), available at{' '}
        <a href={APP.publicUrl} rel="noreferrer" target="_blank">
          {APP.publicUrl}
        </a>
        . By accessing or using the Service, you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        SEO CRM is an internal SEO operations application used to organize projects, niches, pages,
        keywords, URLs, notes, and related workflows, and to connect Google data sources (Search
        Console, Analytics, and Google Ads Keyword Planner–related research when authorized) to support
        content planning. Optional AI assistants can generate drafts and analyses for human review.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <ul>
        <li>You must be authorized by the SEO CRM operator to use the Service.</li>
        <li>You must provide accurate information and keep access credentials secure.</li>
        <li>
          You are responsible for activity under accounts and Google authorizations you control.
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for unlawful purposes or to violate third-party rights.</li>
        <li>Attempt to bypass security, scrape the Service abusively, or disrupt operations.</li>
        <li>Misuse Google APIs or violate Google’s terms, policies, or API Services User Data Policy.</li>
        <li>Resell raw Google Ads API access or share developer tokens / OAuth secrets.</li>
        <li>
          Use the Service to create or manage misleading ads, spam, or content that violates applicable
          advertising or consumer laws.
        </li>
      </ul>

      <h2>4. Google integrations</h2>
      <p>
        Google connections are optional and require your explicit OAuth consent. You may disconnect
        access. Features that depend on Google (including Keyword Planner metrics) may be unavailable
        until Google access levels and credentials are approved and configured. SEO CRM is not
        affiliated with or endorsed by Google except as a user of Google’s published APIs.
      </p>

      <h2>5. AI-generated content</h2>
      <p>
        AI features produce drafts and suggestions only. Outputs may be incomplete or inaccurate. You
        remain solely responsible for reviewing, editing, and publishing any content. The Service does
        not automatically publish to WordPress or other CMS systems without your intentional export and
        action.
      </p>

      <h2>6. Intellectual property</h2>
      <ul>
        <li>
          The Service software, branding, and UI are owned by the SEO CRM operator or its licensors.
        </li>
        <li>
          You retain rights to content and data you submit, and grant us a limited license to process
          that data solely to operate the Service for you.
        </li>
      </ul>

      <h2>7. Third-party services</h2>
      <p>
        The Service may depend on third parties (hosting, Google, AI providers). Their terms and
        availability apply. We are not responsible for outages or policy changes by third parties.
      </p>

      <h2>8. Disclaimer of warranties</h2>
      <p>
        The Service is provided “as is” and “as available” for internal business use. To the maximum
        extent permitted by law, we disclaim warranties of merchantability, fitness for a particular
        purpose, and non-infringement. We do not guarantee specific SEO rankings, traffic, or business
        outcomes.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, SEO CRM and its operators shall not be liable for
        indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or
        goodwill, arising from use of the Service. Aggregate liability for claims relating to the
        Service shall not exceed the fees you paid (if any) for the Service in the twelve months before
        the claim, or USD 100 if no fees were paid.
      </p>

      <h2>10. Suspension and termination</h2>
      <p>
        We may suspend or terminate access for security reasons, policy violations, or operational
        necessity. You may stop using the Service at any time and request deletion of workspace data
        where feasible.
      </p>

      <h2>11. Privacy</h2>
      <p>
        Our handling of personal and Google user data is described in the{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms. The “Last updated” date will change when we do. Continued use after
        changes become effective constitutes acceptance where permitted by law.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms:{' '}
        <a href="mailto:seo.app2026@gmail.com">seo.app2026@gmail.com</a>
        <br />
        Operator: SEO CRM · Nigeria
      </p>
    </article>
  )
}
