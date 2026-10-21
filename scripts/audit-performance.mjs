import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Run against the isolated production fixture server, never the live service.
const phase = process.argv[2] ?? 'after';
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after');
const directory = `artifacts/frontend-audit/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ args: ['--remote-debugging-port=9225'] });
const measurements = [];
try {
  for (const route of ['/', '/create']) {
    for (let run = 1; run <= 3; run++) {
      const result = await lighthouse(`http://127.0.0.1:3100${route}`, {
        port: 9225, output: 'json', logLevel: 'error', onlyCategories: ['performance'],
      });
      if (!result || result.lhr.runtimeError) throw new Error(JSON.stringify(result?.lhr.runtimeError));
      const { audits, categories } = result.lhr;
      const measurement = {
        route, run, score: categories.performance.score,
        lcp: audits['largest-contentful-paint'].numericValue,
        cls: audits['cumulative-layout-shift'].numericValue,
        tbt: audits['total-blocking-time'].numericValue,
        scriptBytes: audits['resource-summary'].details.items.find(item => item.resourceType === 'script')?.transferSize,
      };
      measurements.push(measurement);
      console.log(JSON.stringify(measurement));
      await writeFile(`${directory}/lighthouse-${route === '/' ? 'home' : 'create'}-${run}.json`, result.report);
    }
  }
  await writeFile(`${directory}/performance.json`, JSON.stringify(measurements, null, 2));
} finally { await browser.close(); }
