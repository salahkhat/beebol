import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8000';

test('profile edit flow (avatar, social link)', async ({ page, request, baseURL }) => {
  // register (best-effort)
  const username = `e2e_${Date.now()}`;
  const password = 'TestPass123!';
  await request.post(`${API_BASE}/api/v1/auth/register/`, { data: { username, password } }).catch(() => {});
  const tokenResp = await request.post(`${API_BASE}/api/v1/auth/token/`, { data: { username, password } });
  const token = await tokenResp.json();
  const access = token.access;

  // Verify web dev server is up
  const WEB_ROOT = process.env.BASE_URL || baseURL || 'http://localhost:3000';
  const webResp = await request.get(WEB_ROOT);
  console.log('WEB root status:', webResp.status());
  const webText = await webResp.text();
  console.log('WEB root body snippet:', webText.slice(0,200));
  if (webResp.status() >= 400) {
    console.log('WEB root body:', webText);
    throw new Error('Web dev server not available at ' + WEB_ROOT);
  }

  // Verify tokens work with API directly before touching the browser
  const meResp = await request.get(`${API_BASE}/api/v1/me/`, { headers: { Authorization: `Bearer ${access}` } });
  console.log('ME status:', meResp.status());
  if (meResp.status() !== 200) {
    console.log('ME body:', await meResp.text());
    throw new Error('Auth token not valid for /api/v1/me/');
  }

  // Log client console/page errors and API responses to help debugging in CI/local runs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', resp => {
    if (resp.url().startsWith(API_BASE)) {
      console.log('API RESP', resp.status(), resp.url());
      if (resp.status() >= 400) resp.text().then(t => console.log('API BODY', t)).catch(()=>{});
    }
  });

  // Ensure tokens are present before page scripts run
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('beebol.access', access);
    if (refresh) localStorage.setItem('beebol.refresh', refresh);
  }, { access, refresh: token.refresh });

  // Ensure server-side profile exists (avoids client rendering errors on empty state)
  await request.patch(`${API_BASE}/api/v1/me/profile/`, { headers: { Authorization: `Bearer ${access}` }, data: { display_name: 'E2E Tester' } }).catch(() => {});

  // Navigate directly to edit page; AuthProvider will find tokens immediately
  const editUrl = new URL('/profile/edit', WEB_ROOT).toString();
  await page.goto(editUrl, { waitUntil: 'networkidle' });

  // If the ErrorBoundary captured an error, surface it (helps debugging unstable E2E failures)
  const lastErr = await waitForLastError(page, 10000);
  if (lastErr) {
    console.log('Captured ErrorBoundary error:', JSON.stringify(lastErr));
    throw new Error('App rendered error: ' + (lastErr.message || JSON.stringify(lastErr)));
  }

  // Wait for Edit form to be ready (display name input visible)
  await page.locator('input:not([type=file])').first().waitFor({ timeout: 60000 });

  async function waitForLastError(page, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const x = await page.evaluate(() => (typeof window !== 'undefined' ? window.__LAST_ERROR__ : null));
      if (x) return x;
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  // fill fields
  await page.locator('input:not([type=file])').first().fill('E2E Tester');

  // add a social link
  await page.getByRole('button', { name: /Add link|إضافة رابط/i }).click();
  // Select "Twitter" from the Radix Select
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Twitter|تويتر/i }).click();
  await page.locator('input[placeholder="https://..."]').first().fill('https://twitter.com/e2etest');

  // create tiny PNG file for avatar
  const tmpDir = path.resolve('.playwright-temp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
  const avatarPath = path.join(tmpDir, `avatar-${Date.now()}.png`);
  fs.writeFileSync(avatarPath, Buffer.from(base64Png, 'base64'));

  await page.setInputFiles('input[name=avatar]', avatarPath);

  // submit
  await page.getByRole('button', { name: /Save|حفظ/i }).click();

  // ensure redirect to profile page and assertions
  await page.waitForURL('**/profile/*', { timeout: 10000 });
  await expect(page.getByText('E2E Tester')).toBeVisible();
  await expect(page.getByRole('link', { name: /twitter|تويتر|link|رابط/i })).toBeVisible();
});
