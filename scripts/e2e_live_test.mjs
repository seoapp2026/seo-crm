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

const SCREENSHOT_DIR = path.resolve(__dirname, '../test-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function getBrowser() {
  // 1. First try connecting to the user's remote debugging Chrome on port 9222
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

async function runTest() {
  console.log(`\n======================================================`);
  console.log(`  SEO CRM E2E Production Test Suite`);
  console.log(`  Target: ${TARGET_URL}`);
  console.log(`  User:   ${EMAIL}`);
  console.log(`======================================================\n`);

  const { browser, isConnected } = await getBrowser();
  const page = await browser.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('response', resp => {
    const status = resp.status();
    if (status >= 400 && !resp.url().includes('favicon') && !resp.url().includes('chrome-extension')) {
      networkErrors.push(`[${status}] ${resp.url()}`);
    }
  });

  const testResults = [];

  async function step(name, action) {
    process.stdout.write(`⏳ Testing: ${name}... `);
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

  try {
    // 1. Health check
    await step('Public Health Check API', async () => {
      const resp = await page.goto(`${TARGET_URL}/api/seo-crm/health`, { waitUntil: 'networkidle0' });
      if (resp.status() !== 200) throw new Error(`Status ${resp.status()}`);
      const text = await resp.text();
      const data = JSON.parse(text);
      if (data.status !== 'ok') throw new Error(`Health response not ok: ${text}`);
    });

    // 2. Public Home page
    await step('Public Home Page (Landing)', async () => {
      await page.goto(`${TARGET_URL}/`, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_landing.png') });
    });

    // 3. Login Page
    await step('Navigate to Login Page', async () => {
      await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('#email', { timeout: 8000 });
      await page.waitForSelector('#password', { timeout: 8000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_login_page.png') });
    });

    // 4. Test Invalid Login
    await step('Test Invalid Password Handling', async () => {
      await page.focus('#email');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');
      await page.keyboard.press('Backspace');
      await page.type('#email', EMAIL);

      await page.focus('#password');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');
      await page.keyboard.press('Backspace');
      await page.type('#password', 'WrongPassword123!');

      await page.click('button[type="submit"]');
      await page.waitForFunction(() => {
        const err = document.querySelector('.error-banner, .alert, form [style*="color: red"], .login-card p.muted, [role="alert"]');
        return document.body.innerText.includes('Contraseña incorrecta') || 
               document.body.innerText.includes('error') || 
               document.body.innerText.includes('No se pudo');
      }, { timeout: 6000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_invalid_login.png') });
    });

    // 5. Test Valid Login
    await step('Submit Valid Credentials & Session Creation', async () => {
      await page.focus('#email');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');
      await page.keyboard.press('Backspace');
      await page.type('#email', EMAIL);

      await page.focus('#password');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');
      await page.keyboard.press('Backspace');
      await page.type('#password', PASSWORD);

      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      
      // Verify we arrived at dashboard or authenticated shell
      const url = page.url();
      if (!url.includes('/dashboard') && !url.includes('/projects')) {
        // Wait a bit if it took a moment
        await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 10000 });
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_dashboard_loaded.png') });
    });

    // 6. Navigate all main authenticated routes
    const routesToTest = [
      { path: '/dashboard', name: 'Dashboard / Panel' },
      { path: '/projects', name: 'Proyectos' },
      { path: '/niches', name: 'Nichos' },
      { path: '/pages', name: 'Páginas' },
      { path: '/keywords', name: 'Palabras clave' },
      { path: '/urls', name: 'URLs' },
      { path: '/links', name: 'Enlaces (Links)' },
      { path: '/notes', name: 'Notas' },
      { path: '/ai', name: 'Redacción AI' },
      { path: '/performance', name: 'Rendimiento Search Console' },
      { path: '/gsc-data', name: 'Datos Search Console' },
      { path: '/analytics-data', name: 'Datos GA4' },
      { path: '/ads-keywords', name: 'Google Ads Keywords' },
      { path: '/research', name: 'Investigación / Research' },
      { path: '/products', name: 'Productos' },
      { path: '/integrations', name: 'Integraciones' },
      { path: '/sync', name: 'Sincronización' },
      { path: '/competitors', name: 'Competidores' },
      { path: '/assistants', name: 'Asistentes AI' },
      { path: '/prompts', name: 'Prompts' },
      { path: '/wordpress', name: 'WordPress Export' },
      { path: '/help', name: 'Ayuda y Guía' }
    ];

    for (const route of routesToTest) {
      await step(`Route ${route.name} (${route.path})`, async () => {
        await page.goto(`${TARGET_URL}${route.path}`, { waitUntil: 'networkidle2', timeout: 15000 });
        const cleanName = route.path.replace('/', '');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `route_${cleanName}.png`) });
        // Check if page redirected back to login (which would mean auth lost)
        if (page.url().includes('/login')) {
          throw new Error('Redirected back to /login (session lost)');
        }
      });
    }

    // 7. Verify Session Persistence on Reload
    await step('Session Persistence on Reload', async () => {
      await page.reload({ waitUntil: 'networkidle2' });
      if (page.url().includes('/login')) {
        throw new Error('Session lost after reload');
      }
    });

  } finally {
    console.log(`\n======================================================`);
    console.log(`  E2E Test Execution Summary`);
    console.log(`======================================================`);
    const passed = testResults.filter(r => r.status === 'PASS').length;
    const failed = testResults.filter(r => r.status === 'FAIL').length;
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);

    if (networkErrors.length > 0) {
      console.log(`\n⚠️  Encountered ${networkErrors.length} Network Errors:`);
      networkErrors.slice(0, 10).forEach(e => console.log(`   ${e}`));
      if (networkErrors.length > 10) console.log(`   ...and ${networkErrors.length - 10} more`);
    }

    if (consoleErrors.length > 0) {
      console.log(`\n⚠️  Encountered ${consoleErrors.length} Browser Console Errors:`);
      consoleErrors.slice(0, 10).forEach(e => console.log(`   ${e}`));
      if (consoleErrors.length > 10) console.log(`   ...and ${consoleErrors.length - 10} more`);
    }

    console.log(`\n📸 Screenshots saved to: ${SCREENSHOT_DIR}`);

    if (!isConnected) {
      await browser.close();
    } else {
      console.log(`ℹ️  Chrome session left open on port 9222 for further inspection.`);
    }
  }
}

runTest().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
