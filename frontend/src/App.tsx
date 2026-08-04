import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { AppProvider } from './context/AppContext'
import { AiPage } from './pages/AiPage'
import { DashboardPage } from './pages/DashboardPage'
import { HelpPage } from './pages/HelpPage'
import { KeywordsPage } from './pages/KeywordsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { LegalLayout } from './pages/LegalLayout'
import { LinksPage } from './pages/LinksPage'
import { NichesPage } from './pages/NichesPage'
import { NotesPage } from './pages/NotesPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PagesPage } from './pages/PagesPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { TermsPage } from './pages/TermsPage'
import { UrlsPage } from './pages/UrlsPage'
import { AdsKeywordsPage } from './pages/phase2/AdsKeywordsPage'
import { AnalyticsDataPage } from './pages/phase2/AnalyticsDataPage'
import { AssistantsPage } from './pages/phase2/AssistantsPage'
import { CompetitorsPage } from './pages/phase2/CompetitorsPage'
import { GscDataPage } from './pages/phase2/GscDataPage'
import { IntegrationsPage } from './pages/phase2/IntegrationsPage'
import { PerformancePage } from './pages/phase2/PerformancePage'
import { PromptsPage } from './pages/phase2/PromptsPage'
import { SyncPage } from './pages/phase2/SyncPage'
import { WordPressPage } from './pages/phase2/WordPressPage'
import { ProductsPage } from './pages/phase2/ProductsPage'
import { ResearchPage } from './pages/phase2/ResearchPage'

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<LegalLayout />}>
          <Route index element={<HomePage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
        </Route>

        <Route path="login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="niches" element={<NichesPage />} />
          <Route path="pages" element={<PagesPage />} />
          <Route path="keywords" element={<KeywordsPage />} />
          <Route path="urls" element={<UrlsPage />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="gsc-data" element={<GscDataPage />} />
          <Route path="analytics-data" element={<AnalyticsDataPage />} />
          <Route path="ads-keywords" element={<AdsKeywordsPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="competitors" element={<CompetitorsPage />} />
          <Route path="assistants" element={<AssistantsPage />} />
          <Route path="prompts" element={<PromptsPage />} />
          <Route path="wordpress" element={<WordPressPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppProvider>
  )
}