import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function HomePage() {
  useDocumentTitle('SEO CRM — Organic search operations platform')

  return (
    <article className="legal-doc card card-pad home-page">
      <h1>SEO CRM</h1>
      <p className="legal-meta">Organic search operations for SEO teams</p>

      <p>
        <strong>SEO CRM</strong> is a web application that helps SEO teams plan, organize, and
        improve organic search performance across one or more websites. It combines project
        management (niches, pages, keywords, URLs), Google data integrations, and supervised AI
        assistants in a single workspace.
      </p>

      <h2>What SEO CRM does</h2>
      <ul>
        <li>
          <strong>Organize SEO work</strong> — Structure projects, niches, pages, keywords, and
          URLs; track internal links, cannibalization, and indexing status.
        </li>
        <li>
          <strong>Connect Google services</strong> — With your authorization via OAuth, import
          Search Console performance (impressions, clicks, CTR, position) and Google Analytics 4
          traffic data into the app for reporting and AI-assisted recommendations.
        </li>
        <li>
          <strong>Sync data on a schedule</strong> — Background jobs pull historical metrics from
          Google APIs and store them for dashboards and assistant workflows.
        </li>
        <li>
          <strong>AI-assisted workflows (supervised)</strong> — Generate and refine content drafts,
          classify keywords, analyze competitors, and suggest optimizations. A human always reviews
          before anything is published.
        </li>
        <li>
          <strong>Prepare WordPress publishing</strong> — Export approved content for manual
          publication; the app does not publish without user review.
        </li>
      </ul>

      <h2>Why we request Google OAuth access</h2>
      <p>
        SEO CRM uses Google OAuth so <em>you</em> can connect your own Google Search Console and
        Google Analytics properties. We request read-only scopes to fetch metrics you already have
        access to in those Google products. OAuth tokens are stored securely on our servers and used
        only to sync data for projects you configure. We do not sell your data.
      </p>
      <p>
        See our <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms of Service</Link>{' '}
        for details on data handling and acceptable use.
      </p>

      <h2>Who it is for</h2>
      <p>
        SEO CRM is built for authorized SEO operators, agencies, and in-house teams managing
        content and organic performance. Access is limited to users invited by the operator.
      </p>

      <div className="home-actions">
        <Link to="/login" className="btn btn-primary">
          Sign in
        </Link>
        <a href="mailto:seo.app2026@gmail.com" className="btn btn-ghost">
          Contact support
        </a>
      </div>
    </article>
  )
}