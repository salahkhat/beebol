#!/usr/bin/env node
import { chromium } from 'playwright';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });

  const consoleMessages = [];
  page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  const requests = [];
  page.on('requestfailed', (r) => requests.push({ url: r.url(), failure: r.failure() }));

  try {
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
  } catch (err) {
    // continue
  }

  const headerHtml = await page.evaluate(() => {
    const hdr = document.querySelector('header');
    return hdr ? { outerHTML: hdr.outerHTML.slice(0, 10000), innerText: hdr.innerText.slice(0,1000) } : null;
  });

  console.log(JSON.stringify({ consoleMessages, pageErrors, requests, headerHtml }, null, 2));
  await browser.close();
})();