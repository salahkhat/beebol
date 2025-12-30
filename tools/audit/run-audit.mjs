#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const pages = JSON.parse(fs.readFileSync(path.resolve('tools/audit/pages.json'), 'utf8'));
const viewports = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 }
];

const outDir = path.resolve('docs', 'audit-output', 'screenshots');
await fs.promises.mkdir(outDir, { recursive: true });

console.log('Starting audit against', baseUrl);

const browser = await chromium.launch();
const report = [];
for (const pagePath of pages) {
  const pageReport = { path: pagePath, results: [] };
  const pageObj = await browser.newPage();
  for (const vp of viewports) {
    await pageObj.setViewportSize({ width: vp.width, height: vp.height });
    const url = baseUrl + pagePath;
    try {
      const res = await pageObj.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await pageObj.waitForTimeout(500);
      const bodyOverflow = await pageObj.evaluate(() => {
        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;
        // find elements that exceed the viewport width
        const offenders = [];
        for (const el of Array.from(document.querySelectorAll('*'))) {
          try {
            const r = el.getBoundingClientRect();
            const w = Math.round(r.width);
            if (w > innerWidth + 1) {
              offenders.push({
                tag: el.tagName,
                className: el.className ? el.className.toString().slice(0, 200) : '',
                width: w,
                html: (el.outerHTML || '').slice(0, 300),
              });
            }
            if (offenders.length >= 10) break;
          } catch (e) {
            // ignore
          }
        }
        return { scrollWidth, innerWidth, offenders };
      });
      const hasHorizontalOverflow = bodyOverflow.scrollWidth > bodyOverflow.innerWidth;
      const safePath = (pagePath === '/' ? 'home' : pagePath.replace(/\//g, '_').replace(/^_/, ''));
      const dir = path.join(outDir, safePath);
      await fs.promises.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${vp.name}-${vp.width}x${vp.height}.png`);
      await pageObj.screenshot({ path: filePath, fullPage: true });
      pageReport.results.push({ viewport: vp.name, width: vp.width, height: vp.height, url, hasHorizontalOverflow, scrollWidth: bodyOverflow.scrollWidth, innerWidth: bodyOverflow.innerWidth, offenders: bodyOverflow.offenders || [], screenshot: path.relative('docs', path.join('audit-output', 'screenshots', safePath, `${vp.name}-${vp.width}x${vp.height}.png`)) });
    } catch (err) {
      pageReport.results.push({ viewport: vp.name, error: String(err) });
    }
  }
  report.push(pageReport);
  await pageObj.close();
}
await browser.close();
const reportPath = path.resolve('docs', 'audit-output', 'report.json');
await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log('Audit complete. Report saved to', reportPath);
