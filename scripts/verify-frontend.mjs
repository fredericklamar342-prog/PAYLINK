import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run after npm test, against scripts/start-audit-app.mjs. No live services.
const directory = 'artifacts/frontend-audit/after';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const scans = [];
const layouts = [];
const errors = [];
async function capture(page, name, scan = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true, animations: 'disabled' });
  const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
    contentWidth: document.documentElement.scrollWidth, contentHeight: document.documentElement.scrollHeight }));
  layouts.push({ name, ...dimensions });
  assert.ok(dimensions.contentWidth <= dimensions.width, `${name} overflows horizontally`);
  if (scan) {
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    scans.push({ name, violations });
    console.log(`${name}: ${violations.length} accessibility violations`);
  }
}
try {
  for (const [device, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 375, 812]]) {
    const context = await browser.newContext({ viewport: { width, height }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:3100/');
    await capture(page, `home-${device}`, device !== 'tablet');
    await page.screenshot({ path: `${directory}/home-${device}-viewport.png`, animations: 'disabled' });
    await page.goto('http://127.0.0.1:3100/create');
    await capture(page, `create-${device}`, device !== 'tablet');
    await page.screenshot({ path: `${directory}/create-${device}-viewport.png`, animations: 'disabled' });
    await page.locator('#amount').fill('5');
    await page.locator('#token').selectOption('USDC');
    await page.locator('#recipient').fill('0x1234567890123456789012345678901234567890');
    await page.locator('#recipientName').fill('Ada Studio');
    await page.locator('#description').fill('Brand identity');
    await capture(page, `create-populated-${device}`, false);
    if (device !== 'tablet') {
      await page.locator('.expiry-more summary').click();
      await capture(page, `expiry-expanded-${device}`);
      await page.getByRole('button', { name: 'Custom', exact: true }).click();
      await page.locator('#expiry').fill('2020-01-01T12:00');
      await page.getByRole('button', { name: 'Create Payment Link', exact: true }).click();
      await page.getByText('Choose an expiry in the future.', { exact: true }).waitFor();
      await capture(page, `expiry-error-${device}`);
      await page.getByRole('button', { name: 'No expiry', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Create Payment Link', exact: true }).click();
    await page.getByRole('heading', { name: 'Your link is ready.' }).waitFor();
    await page.locator('.qr-code svg').waitFor();
    await page.evaluate(() => scrollTo(0, 0));
    await capture(page, `share-${device}`);
    await page.screenshot({ path: `${directory}/share-${device}-viewport.png`, animations: 'disabled' });
    const url = await page.getByLabel('Payment URL').inputValue();
    await page.getByRole('button', { name: 'Copy link', exact: true }).click();
    await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url);
    await capture(page, `copied-${device}`, false);
    await page.goto(url);
    await page.locator('.payment-summary').waitFor();
    await capture(page, `payment-${device}`, device !== 'tablet');
    await page.getByRole('button', { name: 'Connect Wallet', exact: true }).last().click();
    await capture(page, `wallet-${device}`, device !== 'tablet');
    await page.keyboard.press('Escape');
    await page.goto('http://127.0.0.1:3100/success');
    await capture(page, `empty-receipt-${device}`, device !== 'tablet');
    await context.close();
  }
  const page = await browser.newPage();
  for (const width of [320, 360, 390, 667, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: width === 667 ? 375 : 900 });
    for (const route of ['/', '/create']) {
      await page.goto(`http://127.0.0.1:3100${route}`);
      await capture(page, `${route === '/' ? 'home' : 'create'}-${width}`, false);
    }
  }
  await writeFile(`${directory}/accessibility.json`, JSON.stringify(scans, null, 2));
  await writeFile(`${directory}/browser-verification.json`, JSON.stringify({ layouts, errors }, null, 2));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(scans.reduce((count, scan) => count + scan.violations.length, 0), 0);
  console.log(`Verified ${layouts.length} layouts and ${scans.length} accessibility scans; no browser errors.`);
} finally { await browser.close(); }
