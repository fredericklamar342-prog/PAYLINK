import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const phase = process.argv[2] ?? 'pre-optimization';
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid phase');
const directory = `artifacts/release-review/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ args: ['--remote-debugging-port=9225'] });
const measurements = [];
try {
  for (const route of ['/', '/create']) {
    for (let run = 1; run <= 3; run++) {
      // Identical Lighthouse options to the original audit. Additional output only.
      const result = await lighthouse(`http://127.0.0.1:3100${route}`, {
        port: 9225, output: 'json', logLevel: 'error', onlyCategories: ['performance'],
      });
      if (!result || result.lhr.runtimeError) throw new Error(JSON.stringify(result?.lhr.runtimeError));
      const { audits, categories, environment } = result.lhr;
      const measurement = {
        route, run, score: categories.performance.score,
        fcp: audits['first-contentful-paint'].numericValue,
        lcp: audits['largest-contentful-paint'].numericValue,
        si: audits['speed-index'].numericValue,
        cls: audits['cumulative-layout-shift'].numericValue,
        tbt: audits['total-blocking-time'].numericValue,
        scriptBytes: audits['resource-summary'].details.items.find(item => item.resourceType === 'script')?.transferSize,
        benchmarkIndex: environment.benchmarkIndex,
      };
      measurements.push(measurement);
      console.log(JSON.stringify(measurement));
      const name = `${route === '/' ? 'home' : 'create'}-${run}`;
      await writeFile(`${directory}/lighthouse-${name}.json`, result.report);
      if (run === 2) {
        await writeFile(`${directory}/trace-${name}.json`, JSON.stringify(result.artifacts.Trace));
        await writeFile(`${directory}/network-${name}.json`, JSON.stringify(result.artifacts.DevtoolsLog));
      }
    }
  }
  await writeFile(`${directory}/performance.json`, JSON.stringify(measurements, null, 2));
} finally { await browser.close(); }
