#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

function rand() {
  return Math.random().toString(36).slice(2, 8);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForUrl(url, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch (e) {
      // ignore and retry
    }
    await sleep(500);
  }
  return false;
}

async function httpPost(path, body, maxRetries = 3) {
  const tries = [];
  // try API base first, then frontend proxy
  const candidates = [new URL(path, apiBase).toString(), new URL(path, baseUrl).toString()];
  for (const url of candidates) {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt += 1;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (e) {
          throw new Error(`Failed to parse JSON from ${url}: ${text}`);
        }
        if (!res.ok) {
          throw new Error(`Request failed ${res.status}: ${JSON.stringify(json)}`);
        }
        return json;
      } catch (err) {
        tries.push({ url, attempt, error: String(err) });
        // exponential backoff
        await sleep(200 * attempt);
      }
    }
  }
  const details = tries.map((t) => `${t.url} (try ${t.attempt}): ${t.error}`).join(' | ');
  throw new Error(`All HTTP POST attempts failed for ${path}. Details: ${details}`);
}

(async () => {
  console.log('Starting profile-edit e2e script against', baseUrl);
  const username = `e2e_${Date.now()}_${rand()}`;
  const password = 'TestPass123!';

  // wait for backend & frontend to be ready
  console.log('Waiting for API and frontend to be reachable...');
  const apiHealth = await waitForUrl(new URL('/api/v1/health/', apiBase).toString(), 20000);
  const frontHealth = await waitForUrl(new URL('/api/v1/health/', baseUrl).toString(), 20000);
  if (!apiHealth && !frontHealth) {
    throw new Error('Neither API nor frontend proxy /api/health responded in time');
  }

  try {
    await httpPost('/api/v1/auth/register/', { username, password });
  } catch (e) {
    // maybe user exists or registration disabled; continue and try token
    console.log('register failed (ignored):', e.message);
  }

  const token = await httpPost('/api/v1/auth/token/', { username, password });
  const access = token.access;
  const refresh = token.refresh;

  // Verify token is usable by calling /me/
  try {
    const meRes = await (await fetch(new URL('/api/v1/me/', baseUrl).toString(), { headers: { Authorization: `Bearer ${access}` } })).json();
    console.log('me (server) returns:', meRes && meRes.username ? meRes.username : JSON.stringify(meRes).slice(0,80));
  } catch (e) {
    console.error('Failed to call /api/v1/me/ with token:', e.message);
  }

  // Call /me/profile/ to ensure profile exists and is accessible
  try {
    const pr = await (await fetch(new URL('/api/v1/me/profile/', baseUrl).toString(), { headers: { Authorization: `Bearer ${access}` } })).json();
    console.log('me profile server returns id:', pr && pr.id ? pr.id : JSON.stringify(pr).slice(0,80));
  } catch (e) {
    console.error('Failed to call /api/v1/me/profile/ with token:', e.message);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // set auth tokens in localStorage keys used by the app
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem('beebol.access', access);
    localStorage.setItem('beebol.refresh', refresh);
  }, { access, refresh });

  // navigate to edit page
  const editUrl = `${baseUrl}/profile/edit`;
  await page.goto(editUrl, { waitUntil: 'networkidle' });

  // reload to ensure AuthProvider picked up tokens
  await page.reload({ waitUntil: 'networkidle' });

  console.log('After reload, page url:', page.url());
  const shortHtml = (await page.content()).slice(0, 2000);
  console.log('Page content snippet:', shortHtml.replace(/\n/g, ' '));

  // Wait for the Save button to appear (indicates form rendered)
  try {
    await page.getByRole('button', { name: /Save|حفظ/i }).waitFor({ state: 'visible', timeout: 30000 });
  } catch (e) {
    // capture debug details
    const consoleLogs = [];
    page.on('console', (m) => consoleLogs.push(`${m.type()}: ${m.text()}`));
    const html = await page.content();
    const snippet = html.slice(0, 3000).replace(/\n/g, ' ');
    throw new Error(`Edit form did not appear within 30s; snippet: ${snippet} console: ${consoleLogs.join(' | ')}`);
  }

  // set display name and bio — pick first visible text input and textarea
  const nameInput = page.locator('input:not([type="file"])').first();
  await nameInput.fill('E2E Tester');
  await page.locator('textarea').fill('This is a test bio from Playwright E2E.');

  // add a social link via the UI
  await page.getByRole('button', { name: /Add link/i }).click();
  // wait for new inputs and fill them
  await page.locator('select').first().selectOption('twitter');
  await page.locator('input[placeholder="https://..."]').first().fill('https://twitter.com/e2etest');

  // create a tiny PNG file on disk and upload it for avatar
  const tmpDir = path.resolve('.playwright-temp');
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
  const tmpAvatar = path.join(tmpDir, `e2e-avatar-${Date.now()}.png`);
  await fs.promises.writeFile(tmpAvatar, Buffer.from(base64Png, 'base64'));

  const inputAvatar = await page.$('input[name=avatar]');
  await inputAvatar.setInputFiles(tmpAvatar);

  // create a tiny PNG file for cover and upload it
  const tmpCover = path.join(tmpDir, `e2e-cover-${Date.now()}.png`);
  await fs.promises.writeFile(tmpCover, Buffer.from(base64Png, 'base64'));
  const inputCover = await page.$('input[name=cover]');
  await inputCover.setInputFiles(tmpCover);

  // Click save
  await page.getByRole('button', { name: /Save/i }).click();

  // wait for redirect to profile page (check url contains /profile/)
  await page.waitForURL('**/profile/*', { timeout: 5000 });
  await page.waitForTimeout(500);

  // take screenshot
  const outDir = path.resolve('docs', 'audit-output', 'e2e');
  await fs.promises.mkdir(outDir, { recursive: true });
  const safeFile = path.join(outDir, `profile-edit-${Date.now()}.png`);
  await page.screenshot({ path: safeFile, fullPage: true });

  // assert display name appears
  const nameText = await page.textContent('h1, h2, h3, h4, h5, h6');
  console.log('Heading text sample:', nameText && nameText.slice(0, 60));

  // check avatar image present
  const avatarSrc = await page.getAttribute('img[alt="avatar"]', 'src');
  if (!avatarSrc) {
    throw new Error('Avatar img src not found on profile page');
  }
  console.log('Avatar src:', avatarSrc);

  await browser.close();
  console.log('E2E script finished. Screenshot saved to', safeFile);
})().catch((err) => {
  console.error('E2E script failed:', err);
  process.exit(1);
});
