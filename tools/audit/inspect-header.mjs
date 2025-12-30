#!/usr/bin/env node
import { chromium } from 'playwright';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const results = await page.evaluate(() => {
    const hdr = document.querySelector('header');
    if (!hdr) return { error: 'no header' };
    const rect = hdr.getBoundingClientRect();
    const children = Array.from(hdr.querySelectorAll('*')).filter((el) => el.parentElement === hdr || el.closest('header') === hdr);
    const nodes = [];
    for (const c of children) {
      try {
        const r = c.getBoundingClientRect();
        const style = window.getComputedStyle(c);
        nodes.push({
          tag: c.tagName,
          className: c.className ? c.className.toString().slice(0,200) : '',
          left: Math.round(r.left),
          top: Math.round(r.top),
          right: Math.round(r.right),
          bottom: Math.round(r.bottom),
          width: Math.round(r.width),
          height: Math.round(r.height),
          display: style.display,
          position: style.position,
          zIndex: style.zIndex,
          overflow: style.overflow,
        });
      } catch (e) {}
    }
    return { header: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }, nodes };
  });
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();