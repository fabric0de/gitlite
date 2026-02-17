import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

type PerfCase = {
  label: string;
  path: string;
  expectedRows: number;
  budget: {
    openMs: number;
    selectMs: number;
    scrollSweepMs: number;
  };
};

type PerfResult = {
  case: string;
  openMs: number;
  selectMs: number;
  scrollSweepMs: number;
  rows: number;
  measuredAt: string;
};

const PERF_CASES: PerfCase[] = [
  {
    label: '5k',
    path: '/tmp/gitlite-5k',
    expectedRows: 5000,
    budget: { openMs: 5000, selectMs: 900, scrollSweepMs: 1500 }
  },
  {
    label: '10k',
    path: '/tmp/gitlite-10k',
    expectedRows: 10000,
    budget: { openMs: 7500, selectMs: 1200, scrollSweepMs: 2100 }
  },
  {
    label: '20k',
    path: '/tmp/gitlite-20k',
    expectedRows: 20000,
    budget: { openMs: 12000, selectMs: 1800, scrollSweepMs: 3200 }
  }
];

const results: PerfResult[] = [];

async function openProject(page: Page, path: string) {
  await page.evaluate(async (nextPath) => {
    const w = window as Window & {
      __GITLITE_E2E_API__?: {
        openProject: (path: string) => Promise<void>;
        waitReady: () => Promise<void>;
      };
    };

    let api = w.__GITLITE_E2E_API__;
    const start = Date.now();
    while (!api && Date.now() - start < 3000) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      api = w.__GITLITE_E2E_API__;
    }
    if (!api) {
      throw new Error('E2E API unavailable');
    }
    await api.waitReady();
    await api.openProject(nextPath);
    await api.waitReady();
  }, path);

  const opened = await page.getByTestId('workspace-open').isVisible().catch(() => false);
  if (!opened) {
    await page.evaluate((nextPath) => {
      const w = window as Window & { __GITLITE_E2E_PICK_PATHS__?: string[] };
      w.__GITLITE_E2E_PICK_PATHS__ = [nextPath];
    }, path);
    await page.getByTestId('empty-open-project').click();
  }

  await expect(page.getByTestId('workspace-open')).toBeVisible();
}

test.describe('performance trend @perf', () => {
  test.describe.configure({ mode: 'serial' });

  for (const item of PERF_CASES) {
    test(`records commit graph performance for ${item.label}`, async ({ page }) => {
      await page.goto('/');

      const openStart = Date.now();
      await openProject(page, item.path);
      const openMs = Date.now() - openStart;

      await page.getByTestId('commit-view-graph').click();
      await page.getByTestId('commit-range').click();
      await page.getByRole('button', { name: 'All', exact: true }).click();

      const rows = page.locator('[data-testid^="commit-row-"]');
      await expect(rows).toHaveCount(item.expectedRows);

      const target = rows.nth(Math.floor(item.expectedRows * 0.8));
      const selectStart = Date.now();
      await target.click();
      await expect(target).toHaveClass(/is-active/);
      const selectMs = Date.now() - selectStart;

      const scrollSweepMs = await page.evaluate(async () => {
        const container = document.querySelector('[data-testid="commit-list"]') as HTMLElement | null;
        if (!container) return 9_999;
        const start = performance.now();
        for (let i = 0; i < 8; i += 1) {
          container.scrollTop = i % 2 === 0 ? container.scrollHeight : 0;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }
        return performance.now() - start;
      });

      expect(openMs).toBeLessThan(item.budget.openMs);
      expect(selectMs).toBeLessThan(item.budget.selectMs);
      expect(scrollSweepMs).toBeLessThan(item.budget.scrollSweepMs);

      const result: PerfResult = {
        case: item.label,
        openMs,
        selectMs,
        scrollSweepMs,
        rows: item.expectedRows,
        measuredAt: new Date().toISOString()
      };
      results.push(result);
      console.log('PERF_RESULT', JSON.stringify(result));
    });
  }

  test.afterAll(async () => {
    const outputPath = 'test-results/perf-metrics.json';
    await mkdir('test-results', { recursive: true });
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          results
        },
        null,
        2
      ),
      'utf8'
    );
  });
});
