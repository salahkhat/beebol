#!/usr/bin/env node
import { chromium } from 'playwright';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  // click the hamburger
  await page.click('button[aria-label="القائمة"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/audit-output/screenshots/drawer-open-mobile.png', fullPage: false });
  console.log('screenshot saved');
  await browser.close();
})();