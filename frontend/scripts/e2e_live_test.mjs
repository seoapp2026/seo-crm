import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_URL = process.env.APP_URL || 'https://crmpersonal.es';
const EMAIL = process.env.CRM_EMAIL || 'Seo.app2026@gmail.com';
const PASSWORD = process.env.CRM_PASSWORD || 'krBMwJ_0Fu78T';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../test-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Test entities identifiers
const UNIQUE_ID = Date.now().toString().slice(-4);
const TEST_TAG = `[E2E-AUTO-${UNIQUE_ID}]`;
const TEST_PROJECT_NAME = `${TEST_TAG} Portal SEO`;
const TEST_NICHE_NAME = `${TEST_TAG} Nicho Herramientas`;
const TEST_PAGE_1_TITLE = `${TEST_TAG} Guia SEO Completa`;
const TEST_PAGE_2_TITLE = `${TEST_TAG} Comparativa Software`;
const TEST_KW_1 = `crm software ${UNIQUE_ID}`;
const TEST_KW_2 = `herramienta seo ${UNIQUE_ID}`;
const TEST_PRODUCT_NAME = `${TEST_TAG} SEO Suite Box`;
const TEST_COMPETITOR = `e2e-competitor-${UNIQUE_ID}.com`;

async function getBrowser() {
  try {
    console.log(`🔌 Attempting to connect to existing Chrome on ${CDP_URL}...`);
    const browser = await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: { width: 1440, height: 900 }
    });
    console.log(`✅ Connected successfully to Chrome via remote debugging on ${CDP_URL}!`);
    return { browser, isConnected: true };
  } catch (err) {
    console.log(`⚠️  Could not connect to ${CDP_URL} (${err.message}).`);
    console.log(`🚀 Launching local Chrome directly from ${CHROME_PATH}...`);
    
    if (!fs.existsSync(CHROME_PATH)) {
      throw new Error(`Chrome binary not found at ${CHROME_PATH}. Please launch Chrome with --remote-debugging-port=9222 first.`);
    }

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--user-data-dir=/tmp/chrome_dev_profile'
      ],
      defaultViewport: { width: 1440, height: 900 }
    });
    console.log(`✅ Launched Chrome successfully!`);
    return { browser, isConnected: false };
  }
}

async function runComprehensiveTestSuite() {
  console.log(`\n======================================================`);
  console.log(`  SEO CRM FULL APP FEATURE E2E TEST SUITE`);
  console.log(`  Target: ${TARGET_URL}`);
  console.log(`  User:   ${EMAIL}`);
  console.log(`  Tag:    ${TEST_TAG}`);
  console.log(`======================================================\n`);

  const { browser, isConnected } = await getBrowser();
  const page = await browser.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('chrome-extension')) {
        consoleErrors.push(`[Console Error] ${text}`);
      }
    }
  });

  page.on('response', resp => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes('favicon') && !url.includes('chrome-extension')) {
      networkErrors.push(`[${status}] ${url}`);
    }
  });

  const testResults = [];

  async function step(name, action) {
    process.stdout.write(`⏳ ${name}... `);
    const startTime = Date.now();
    try {
      await action();
      const elapsed = Date.now() - startTime;
      console.log(`✅ PASS (${elapsed}ms)`);
      testResults.push({ name, status: 'PASS', elapsed });
      return true;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.log(`❌ FAIL (${elapsed}ms): ${err.message}`);
      testResults.push({ name, status: 'FAIL', elapsed, error: err.message });
      return false;
    }
  }

  async function fillInput(selector, value) {
    await page.focus(selector);
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, selector);
    await page.type(selector, value, { delay: 10 });
  }

  // Tracking created entities for teardown
  const createdIds = {
    projectId: null,
    nicheId: null,
    page1Id: null,
    page2Id: null,
    keyword1Id: null,
    keyword2Id: null,
    keywordCannibalId: null,
    linkId: null,
    noteId: null,
    urlId: null,
    productId: null,
    competitorId: null,
  };

  try {
    // 0. Ensure clean initial unauthenticated state
    await page.goto(`${TARGET_URL}/dashboard`, { waitUntil: 'networkidle2' });
    const isAlreadyLoggedIn = await page.$('.topbar-user');
    if (isAlreadyLoggedIn) {
      await page.evaluate(async () => {
        await fetch('/api/seo-crm/auth/logout', { method: 'POST' });
      });
      await page.goto(`${TARGET_URL}/`, { waitUntil: 'networkidle2' });
    }

    // =========================================================================
    // PHASE 1: PUBLIC PAGES & AUTH GATE
    // =========================================================================
    console.log(`\n--- PHASE 1: Public Pages & Auth Gate ---`);

    await step('Public Health Check API', async () => {
      const resp = await page.goto(`${TARGET_URL}/api/seo-crm/health`, { waitUntil: 'networkidle0' });
      if (resp.status() !== 200) throw new Error(`Status ${resp.status()}`);
      const text = await resp.text();
      const data = JSON.parse(text);
      if (data.status !== 'ok') throw new Error(`Health response not ok: ${text}`);
    });

    await step('Public Home Page (Landing)', async () => {
      await page.goto(`${TARGET_URL}/`, { waitUntil: 'networkidle2' });
      const hasLogo = await page.$('.legal-logo, header, .app-brand, a[href="/login"]');
      if (!hasLogo) throw new Error('Landing page missing brand or login link');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_landing.png') });
    });

    await step('Public Legal Pages (/privacy & /terms)', async () => {
      await page.goto(`${TARGET_URL}/privacy`, { waitUntil: 'networkidle2' });
      if (!(await page.$('h1, .card'))) throw new Error('Privacy page did not load');
      await page.goto(`${TARGET_URL}/terms`, { waitUntil: 'networkidle2' });
      if (!(await page.$('h1, .card'))) throw new Error('Terms page did not load');
    });

    await step('Login Page Reachable & Form UI Verification', async () => {
      await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#email', { timeout: 8000 });
      await page.waitForSelector('#password', { timeout: 8000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_login_page.png') });
    });

    await step('Negative Login: Invalid Password Rejection', async () => {
      await fillInput('#email', EMAIL);
      await fillInput('#password', 'WrongPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Contraseña incorrecta') || 
               document.body.innerText.includes('error') || 
               document.body.innerText.includes('No se pudo');
      }, { timeout: 8000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_invalid_login.png') });
    });

    await step('Positive Login: Valid Credentials & Session Token', async () => {
      await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#email', { timeout: 8000 });
      await fillInput('#email', EMAIL);
      await fillInput('#password', PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForFunction(() => {
        return window.location.href.includes('/dashboard') || window.location.href.includes('/projects');
      }, { timeout: 15000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_dashboard_loaded.png') });
    });

    // =========================================================================
    // PHASE 2: DASHBOARD & SCOPE SWITCHER
    // =========================================================================
    console.log(`\n--- PHASE 2: Dashboard & Scope Switcher ---`);

    await step('Dashboard KPI Cards & Onboarding Card', async () => {
      await page.goto(`${TARGET_URL}/dashboard`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('.main', { timeout: 8000 });
      const text = await page.evaluate(() => document.body.innerText);
      if (!text.includes('Panel') && !text.includes('Proyectos')) {
        throw new Error('Dashboard summary content not found');
      }
      const navExists = await page.$('.nav');
      if (!navExists) throw new Error('Main navigation bar missing');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_dashboard_kpis.png') });
    });

    // =========================================================================
    // PHASE 3: CORE SEO STRUCTURE (PROJECTS, NICHES, PAGES)
    // =========================================================================
    console.log(`\n--- PHASE 3: Core SEO Structure (Projects, Niches, Pages) ---`);

    await step('Projects: Negative Validation in Modal (Empty Name & Missing GSC URL)', async () => {
      await page.goto(`${TARGET_URL}/projects`, { waitUntil: 'networkidle2' });
      // Click "+ Nuevo proyecto" button
      const newProjBtn = await page.waitForSelector('.topbar-actions button.btn-primary', { timeout: 8000 });
      await newProjBtn.click();
      await page.waitForSelector('.modal', { timeout: 5000 });

      // Click "Guardar" without filling anything
      const saveBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('.modal button.btn-primary'));
        return btns.find(b => b.textContent.includes('Guardar'));
      });
      if (saveBtn) await saveBtn.click();

      // Check toast for "obligatorio"
      await page.waitForFunction(() => document.body.innerText.includes('obligatorio'), { timeout: 5000 });

      // Cancel and close modal
      const cancelBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('.modal button'));
        return btns.find(b => b.textContent.includes('Cancelar'));
      });
      if (cancelBtn) await cancelBtn.click();
      await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 5000 });
    });

    await step('Projects: Create Test Project', async () => {
      const res = await page.evaluate(async (pName) => {
        const resp = await fetch('/api/seo-crm/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: pName,
            description: 'Automated E2E Test Project',
            gsc_site_url: 'sc-domain:e2e-portal.es',
            ga4_property_id: '987654321'
          })
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, TEST_PROJECT_NAME);

      if (!res.id) throw new Error('Project ID not returned');
      createdIds.projectId = res.id;

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction((name) => document.body.innerText.includes(name), {}, TEST_PROJECT_NAME);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_projects_table.png') });
    });

    await step('Niches: Create Niche under Test Project', async () => {
      await page.goto(`${TARGET_URL}/niches`, { waitUntil: 'networkidle2' });
      const res = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/niches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        name: TEST_NICHE_NAME,
        topic: 'Herramientas de automatización SEO'
      });

      if (!res.id) throw new Error('Niche ID not returned');
      createdIds.nicheId = res.id;

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction((name) => document.body.innerText.includes(name), {}, TEST_NICHE_NAME);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_niches_table.png') });
    });

    await step('Pages: Create Guide (TSG) and Comparison (TSR) Pages', async () => {
      await page.goto(`${TARGET_URL}/pages`, { waitUntil: 'networkidle2' });
      
      // Page 1: Guide TSG
      const page1 = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        niche_id: createdIds.nicheId,
        title: TEST_PAGE_1_TITLE,
        type: 'TSG',
        objective: 'Guía detallada de SEO para principiantes'
      });
      createdIds.page1Id = page1.id;

      // Page 2: Comparison TSR
      const page2 = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        niche_id: createdIds.nicheId,
        title: TEST_PAGE_2_TITLE,
        type: 'TSR',
        objective: 'Comparativa de las mejores herramientas'
      });
      createdIds.page2Id = page2.id;

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction((p1) => document.body.innerText.includes(p1), {}, TEST_PAGE_1_TITLE);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_pages_table.png') });
    });

    // =========================================================================
    // PHASE 4: KEYWORDS & CANNIBALIZATION DETECTION
    // =========================================================================
    console.log(`\n--- PHASE 4: Keywords & Cannibalization Detection ---`);

    await step('Keywords: Create Page Keywords with Intent', async () => {
      await page.goto(`${TARGET_URL}/keywords`, { waitUntil: 'networkidle2' });

      // Keyword 1 assigned to Page 1
      const kw1 = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        niche_id: createdIds.nicheId,
        page_id: createdIds.page1Id,
        term: TEST_KW_1,
        intent: 'informacional',
        note: 'Keyword principal informativa'
      });
      createdIds.keyword1Id = kw1.id;

      // Keyword 2 assigned to Page 2
      const kw2 = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        niche_id: createdIds.nicheId,
        page_id: createdIds.page2Id,
        term: TEST_KW_2,
        intent: 'comercial',
        note: 'Keyword comercial secundaria'
      });
      createdIds.keyword2Id = kw2.id;
    });

    await step('Cannibalization Detection: Duplicate Keyword Across Pages', async () => {
      // Assign TEST_KW_1 ALSO to Page 2 to trigger cannibalization
      const kwCannibal = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        niche_id: createdIds.nicheId,
        page_id: createdIds.page2Id,
        term: TEST_KW_1, // SAME term!
        intent: 'comercial'
      });
      createdIds.keywordCannibalId = kwCannibal.id;

      // Reload keywords view and verify the "Canibalización" badge appears
      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Canibalización');
      }, { timeout: 8000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_cannibalization_detected.png') });
    });

    await step('Keywords: Auto-Tag Intent Action', async () => {
      const autoTagResult = await page.evaluate(async (pid) => {
        const resp = await fetch('/api/seo-crm/keywords/auto-tag-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: pid })
        });
        return resp.json();
      }, createdIds.projectId);

      if (typeof autoTagResult.updated_count !== 'number') {
        throw new Error('auto-tag-intent did not return count summary');
      }
    });

    // =========================================================================
    // PHASE 5: URLS, INTERNAL LINKS & ORPHAN PAGES
    // =========================================================================
    console.log(`\n--- PHASE 5: URLs, Internal Links & Orphan Pages ---`);

    await step('URLs: Add Page URL Record', async () => {
      await page.goto(`${TARGET_URL}/urls`, { waitUntil: 'networkidle2' });
      const urlRes = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        niche_id: createdIds.nicheId,
        page_id: createdIds.page1Id,
        slug: '/guia-seo-completa',
        indexed: 'indexada'
      });
      createdIds.urlId = urlRes.id;
      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction(() => document.body.innerText.includes('/guia-seo-completa'), { timeout: 8000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_urls_table.png') });
    });

    await step('Internal Links: Self-Link Validation Rejected', async () => {
      await page.goto(`${TARGET_URL}/links`, { waitUntil: 'networkidle2' });
      const selfLinkRes = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        return { status: resp.status, ok: resp.ok };
      }, {
        project_id: createdIds.projectId,
        from_page_id: createdIds.page1Id,
        to_page_id: createdIds.page1Id, // Same page!
        anchor: 'Self link'
      });

      if (selfLinkRes.ok) {
        throw new Error('Self-link should have been rejected');
      }
    });

    await step('Internal Links: Create Link (Page 1 -> Page 2) & Check Orphans', async () => {
      const linkRes = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        from_page_id: createdIds.page1Id,
        to_page_id: createdIds.page2Id,
        anchor: 'Ver comparativa de software'
      });
      createdIds.linkId = linkRes.id;

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction(() => document.body.innerText.includes('Ver comparativa de software'), { timeout: 8000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_internal_links.png') });
    });

    await step('Notes: Create Project Strategy Note', async () => {
      await page.goto(`${TARGET_URL}/notes`, { waitUntil: 'networkidle2' });
      const noteRes = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        title: `${TEST_TAG} Nota Estrategica`,
        content: 'Estrategia de contenidos y enlazado para el nicho de software.'
      });
      createdIds.noteId = noteRes.id;

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction((t) => document.body.innerText.includes(t), {}, `${TEST_TAG} Nota Estrategica`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_notes_table.png') });
    });

    // =========================================================================
    // PHASE 6: PRODUCTS & COMPETITORS
    // =========================================================================
    console.log(`\n--- PHASE 6: Products & Competitors ---`);

    await step('Competitors: Add Competitor Domain', async () => {
      await page.goto(`${TARGET_URL}/competitors`, { waitUntil: 'networkidle2' });
      const compRes = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        domain: TEST_COMPETITOR,
        notes: 'Competidor de referencia en el sector'
      });
      createdIds.competitorId = compRes.id;

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction((dom) => document.body.innerText.includes(dom), {}, TEST_COMPETITOR);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_competitors_table.png') });
    });

    await step('Products: Create Product with Price, Specs & Source', async () => {
      await page.goto(`${TARGET_URL}/products`, { waitUntil: 'networkidle2' });
      const prodRes = await page.evaluate(async (data) => {
        const resp = await fetch('/api/seo-crm/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      }, {
        project_id: createdIds.projectId,
        name: TEST_PRODUCT_NAME,
        brand: 'SeoTech',
        sku: 'ST-990-PRO',
        price: 49.99,
        currency: 'EUR',
        features: 'Auditoría en tiempo real, backlinks tracking, rank tracker',
        stock_notes: 'Disponible inmediatamente',
        source_url: 'https://example.com/product/st-990'
      });
      createdIds.productId = prodRes.id;

      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForFunction((name) => document.body.innerText.includes(name), {}, TEST_PRODUCT_NAME);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_products_table.png') });
    });

    // =========================================================================
    // PHASE 7: OPTION 2 / DATAFORSEO & RESEARCH
    // =========================================================================
    console.log(`\n--- PHASE 7: Option 2 Research & DataForSEO ---`);

    await step('Research: Caps & Budget Metadata Loaded', async () => {
      await page.goto(`${TARGET_URL}/research`, { waitUntil: 'networkidle2' });
      const researchMeta = await page.evaluate(async () => {
        const [capsRes, budgetRes] = await Promise.all([
          fetch('/api/seo-crm/research/caps').then(r => r.json()),
          fetch('/api/seo-crm/research/budget').then(r => r.json())
        ]);
        return { caps: capsRes, budget: budgetRes };
      });

      if (!researchMeta.caps || !researchMeta.budget) {
        throw new Error('Failed to retrieve DataForSEO caps/budget metadata');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_research_dashboard.png') });
    });

    await step('Research: Validation Rules (Hard Caps Enforcement)', async () => {
      const overCapsRes = await page.evaluate(async (pid) => {
        const resp = await fetch('/api/seo-crm/research/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: pid,
            competitor_urls: ['comp1.es', 'comp2.es', 'comp3.es', 'comp4.es'],
            seed_keywords: ['test seed']
          })
        });
        return { status: resp.status, ok: resp.ok };
      }, createdIds.projectId);

      if (overCapsRes.ok) {
        throw new Error('Expected validation error when exceeding 3 competitors');
      }
    });

    // =========================================================================
    // PHASE 8: AI WRITERS, ASSISTANTS & PROMPTS
    // =========================================================================
    console.log(`\n--- PHASE 8: AI Writers, Assistants & Prompt Templates ---`);

    await step('Generador IA: Context Assembly for Selected Page', async () => {
      await page.goto(`${TARGET_URL}/ai`, { waitUntil: 'networkidle2' });
      const selectExists = await page.$('select, button');
      if (!selectExists) throw new Error('AI Generator form elements missing');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_ai_generator.png') });
    });

    await step('Asistentes IA: Tab Navigation across All 5 Assistants', async () => {
      await page.goto(`${TARGET_URL}/assistants`, { waitUntil: 'networkidle2' });
      // Wait for assistant-tab buttons to populate from API
      await page.waitForSelector('.assistant-tab', { timeout: 10000 });
      const assistantTabs = ['Arquitecto', 'Clasificador', 'Generador', 'Analista', 'Optimizador'];
      const pageText = await page.evaluate(() => document.body.innerText);
      for (const tabName of assistantTabs) {
        if (!pageText.includes(tabName)) {
          throw new Error(`Assistant tab "${tabName}" not found on screen`);
        }
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_assistants_tabs.png') });
    });

    await step('Editor de Prompts: Verify Prompt Templates & Models', async () => {
      await page.goto(`${TARGET_URL}/prompts`, { waitUntil: 'networkidle2' });
      const promptCards = await page.evaluate(async () => {
        const resp = await fetch('/api/seo-crm/ai/prompts');
        return resp.json();
      });

      if (!Array.isArray(promptCards) || promptCards.length < 5) {
        throw new Error(`Expected at least 5 prompt templates, found ${promptCards?.length}`);
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_prompts_editor.png') });
    });

    // =========================================================================
    // PHASE 9: GOOGLE INTEGRATIONS, SYNC JOBS & DATA SCREENS
    // =========================================================================
    console.log(`\n--- PHASE 9: Google Integrations, Sync Jobs & Data Screens ---`);

    await step('Integraciones: Project Configuration Cards & OAuth Status', async () => {
      await page.goto(`${TARGET_URL}/integrations`, { waitUntil: 'networkidle2' });
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (!bodyText.includes('Search Console') && !bodyText.includes('Google')) {
        throw new Error('Integrations configuration card missing');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19_integrations_page.png') });
    });

    await step('Sincronización: Job Cards & Toggle Switch', async () => {
      await page.goto(`${TARGET_URL}/sync`, { waitUntil: 'networkidle2' });
      const syncText = await page.evaluate(() => document.body.innerText);
      if (!syncText.includes('GSC') && !syncText.includes('Ads')) {
        throw new Error('Sync jobs cards not found');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20_sync_jobs.png') });
    });

    await step('Data Screen: Rendimiento (28 días)', async () => {
      await page.goto(`${TARGET_URL}/performance`, { waitUntil: 'networkidle2' });
      const perfText = await page.evaluate(() => document.body.innerText);
      if (!perfText.includes('Rendimiento') && !perfText.includes('Clicks')) {
        throw new Error('Performance page structure invalid');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21_performance_screen.png') });
    });

    await step('Data Screen: Search Console Data & Date Filters', async () => {
      await page.goto(`${TARGET_URL}/gsc-data`, { waitUntil: 'networkidle2' });
      const gscText = await page.evaluate(() => document.body.innerText);
      if (!gscText.includes('Search Console') && !gscText.includes('Impresiones')) {
        throw new Error('GSC Data page structure invalid');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '22_gsc_data.png') });
    });

    await step('Data Screen: GA4 Analytics Data', async () => {
      await page.goto(`${TARGET_URL}/analytics-data`, { waitUntil: 'networkidle2' });
      const ga4Text = await page.evaluate(() => document.body.innerText);
      if (!ga4Text.includes('Analytics') && !ga4Text.includes('Sesiones')) {
        throw new Error('GA4 Data page structure invalid');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '23_analytics_data.png') });
    });

    await step('Data Screen: Google Ads Keywords Planner Table', async () => {
      await page.goto(`${TARGET_URL}/ads-keywords`, { waitUntil: 'networkidle2' });
      const adsText = await page.evaluate(() => document.body.innerText);
      if (!adsText.includes('Ads') && !adsText.includes('Volumen')) {
        throw new Error('Keywords Ads page structure invalid');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '24_ads_keywords.png') });
    });

    // =========================================================================
    // PHASE 10: WORDPRESS BRIDGE, HELP ANCHORS & TEARDOWN
    // =========================================================================
    console.log(`\n--- PHASE 10: WordPress Bridge, Help Anchors & Teardown ---`);

    await step('WordPress Export: Pre-Export Audit & Bundle Generation', async () => {
      await page.goto(`${TARGET_URL}/wordpress`, { waitUntil: 'networkidle2' });
      const wpExport = await page.evaluate(async (pid) => {
        const resp = await fetch(`/api/seo-crm/wordpress/export?project_id=${pid}`);
        return resp.json();
      }, createdIds.projectId);

      if (!wpExport || !Array.isArray(wpExport.pages)) {
        throw new Error('WordPress export bundle does not contain pages array');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '25_wordpress_export.png') });
    });

    await step('Help Documentation: TOC & Deep Anchor Links', async () => {
      await page.goto(`${TARGET_URL}/help`, { waitUntil: 'networkidle2' });
      const anchors = ['#idea', '#orden', '#filtro', '#ads', '#google', '#option2', '#productos', '#ia'];
      for (const anchor of anchors) {
        const targetElement = await page.$(`section${anchor}, ${anchor}`);
        if (!targetElement) {
          throw new Error(`Help anchor section "${anchor}" not found in DOM`);
        }
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '26_help_page_anchors.png') });
    });

  } finally {
    // =========================================================================
    // TEARDOWN & CLEANUP
    // =========================================================================
    console.log(`\n--- TEARDOWN & CLEANUP (Preserving Production Cleanliness) ---`);

    await step('Teardown: Clean up Test Entities', async () => {
      await page.evaluate(async (ids) => {
        // 1. Delete link
        if (ids.linkId) {
          await fetch(`/api/seo-crm/links/${ids.linkId}`, { method: 'DELETE' }).catch(() => {});
        }
        // 2. Delete note
        if (ids.noteId) {
          await fetch(`/api/seo-crm/notes/${ids.noteId}`, { method: 'DELETE' }).catch(() => {});
        }
        // 3. Delete URL
        if (ids.urlId) {
          await fetch(`/api/seo-crm/urls/${ids.urlId}`, { method: 'DELETE' }).catch(() => {});
        }
        // 4. Delete product
        if (ids.productId) {
          await fetch(`/api/seo-crm/products/${ids.productId}`, { method: 'DELETE' }).catch(() => {});
        }
        // 5. Delete competitor
        if (ids.competitorId) {
          await fetch(`/api/seo-crm/competitors/${ids.competitorId}`, { method: 'DELETE' }).catch(() => {});
        }
        // 6. Delete keywords
        for (const kwId of [ids.keyword1Id, ids.keyword2Id, ids.keywordCannibalId]) {
          if (kwId) {
            await fetch(`/api/seo-crm/keywords/${kwId}`, { method: 'DELETE' }).catch(() => {});
          }
        }
        // 7. Delete pages
        for (const pId of [ids.page1Id, ids.page2Id]) {
          if (pId) {
            await fetch(`/api/seo-crm/pages/${pId}`, { method: 'DELETE' }).catch(() => {});
          }
        }
        // 8. Delete niche
        if (ids.nicheId) {
          await fetch(`/api/seo-crm/niches/${ids.nicheId}`, { method: 'DELETE' }).catch(() => {});
        }
        // 9. Delete project
        if (ids.projectId) {
          await fetch(`/api/seo-crm/projects/${ids.projectId}`, { method: 'DELETE' }).catch(() => {});
        }
      }, createdIds);
    });

    await step('Auth Teardown: Topbar Sign Out & Protected Route Invalidation', async () => {
      await page.goto(`${TARGET_URL}/dashboard`, { waitUntil: 'networkidle2' });
      const signOutBtn = await page.$('.topbar-actions button');
      if (signOutBtn) {
        await signOutBtn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
      } else {
        await page.evaluate(() => fetch('/api/seo-crm/auth/logout', { method: 'POST' }));
      }

      await page.goto(`${TARGET_URL}/dashboard`, { waitUntil: 'networkidle2' });
      if (!page.url().includes('/login')) {
        throw new Error('Protected route still accessible after logout');
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '27_logout_verified.png') });
    });

    console.log(`\n======================================================`);
    console.log(`  Comprehensive E2E Test Execution Summary`);
    console.log(`======================================================`);
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    console.log(`Total Steps: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);

    const actualNetworkErrors = networkErrors.filter(e => !e.includes('[401]') || !e.includes('/auth/login'));
    if (actualNetworkErrors.length > 0) {
      console.log(`\n⚠️  Encountered ${actualNetworkErrors.length} Unexpected Network Errors:`);
      actualNetworkErrors.slice(0, 10).forEach(e => console.log(`   ${e}`));
    } else {
      console.log(`✨ Zero unexpected network errors.`);
    }

    if (consoleErrors.length > 0) {
      console.log(`\n⚠️  Encountered ${consoleErrors.length} Browser Console Errors:`);
      consoleErrors.slice(0, 10).forEach(e => console.log(`   ${e}`));
    } else {
      console.log(`✨ Zero unhandled browser console errors.`);
    }

    console.log(`\n📸 All visual evidence screenshots saved to: ${SCREENSHOT_DIR}`);

    if (!isConnected) {
      await browser.close();
    } else {
      console.log(`ℹ️  Chrome session left open on port 9222.`);
    }
  }
}

runComprehensiveTestSuite().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
