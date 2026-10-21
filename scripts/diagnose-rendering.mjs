import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

// Diagnostic CSS ablations only. These are NOT Lighthouse scores or release evidence.
const variants = {
  unchanged: '',
  unbalanced: 'h1,h2,h3 {text-wrap:wrap!important}',
  contained: '.how-section,.token-section,.security-section,.closing-section {content-visibility:auto;contain-intrinsic-size:auto 600px}',
  noEntry: '.payment-demo,.composer-grid {animation:none!important}',
};
const browser = await chromium.launch();
const rows = [];
try {
  for (let run = 1; run <= 3; run++) {
    for (const [variant, css] of Object.entries(variants)) {
      const context = await browser.newContext({ viewport: { width: 412, height: 823 } });
      const page = await context.newPage();
      // Every variant uses interception, including unchanged, to avoid an asymmetric path.
      await page.route('**/*.css', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: `${await response.text()}\n${css}` });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await page.goto('http://127.0.0.1:3100/');
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: 'Split a bill' }).click();
      await page.getByText('Your share of dinner', { exact: true }).waitFor();
      const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const row = { run, variant, layout: metrics.LayoutDuration, style: metrics.RecalcStyleDuration, script: metrics.ScriptDuration };
      rows.push(row);
      console.log(JSON.stringify(row));
      await context.close();
    }
  }
  await writeFile('artifacts/release-review/rendering-diagnostics.json', JSON.stringify(rows, null, 2));
} finally { await browser.close(); }
