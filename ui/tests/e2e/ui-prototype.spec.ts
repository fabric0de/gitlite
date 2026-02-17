import { expect, test, type Page } from '@playwright/test';

async function openProject(page: Page, path: string, source: 'empty' | 'tab-add' = 'empty') {
  const state = await page.evaluate(
    async ({ nextPath }) => {
      const w = window as Window & {
        __GITLITE_E2E_API__?: {
          openProject: (path: string) => Promise<void>;
          waitReady: () => Promise<void>;
          getActiveProjectPath: () => string;
          getProviderKind: () => 'mock' | 'tauri';
          hasRepository: () => boolean;
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
      return {
        activeProject: api.getActiveProjectPath(),
        providerKind: api.getProviderKind(),
        hasRepository: api.hasRepository()
      };
    },
    { nextPath: path, source }
  );

  if (!state.activeProject.includes(path)) {
    await page.evaluate((nextPath) => {
      const w = window as Window & { __GITLITE_E2E_PICK_PATHS__?: string[] };
      w.__GITLITE_E2E_PICK_PATHS__ = [nextPath];
    }, path);
    const trigger = source === 'empty' ? page.getByTestId('empty-open-project') : page.getByTestId('project-tab-add');
    await trigger.click();
  }

  await page.waitForTimeout(80);
  const opened = await page.getByTestId('workspace-open').isVisible().catch(() => false);
  if (!opened) {
    const debug = await page.evaluate(() => {
      const w = window as Window & {
        __GITLITE_E2E_API__?: {
          getProviderKind: () => 'mock' | 'tauri';
          getActiveProjectPath: () => string;
          getProjectPaths: () => string[];
          hasRepository: () => boolean;
        };
      };
      return {
        providerKind: w.__GITLITE_E2E_API__?.getProviderKind?.() ?? 'unknown',
        activeProject: w.__GITLITE_E2E_API__?.getActiveProjectPath?.() ?? '',
        projects: w.__GITLITE_E2E_API__?.getProjectPaths?.() ?? [],
        hasRepository: w.__GITLITE_E2E_API__?.hasRepository?.() ?? false,
        notice:
          (document.querySelector('[data-testid="ui-notice"]') as HTMLElement | null)?.textContent?.trim() ?? ''
      };
    });
    console.log('openProject debug', { path, source, state, debug });
  }
  await expect(page.getByTestId('workspace-open')).toBeVisible();
  const nonGit = page.getByTestId('workspace-not-git');
  if (await nonGit.isVisible().catch(() => false)) {
    await page.getByTestId('init-git-button').click();
  }
  await expect(page.getByTestId('main-grid')).toBeVisible();

  let currentPath = '';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    currentPath = (await page.getByTestId('repo-path').textContent())?.trim() ?? '';
    if (currentPath.includes(path)) break;
    await page.waitForTimeout(100);
  }

  if (!currentPath.includes(path)) {
    const debug = await page.evaluate(() => {
      const w = window as Window & {
        __GITLITE_E2E_PICK_PATHS__?: string[];
        __GITLITE_E2E_API__?: {
          getActiveProjectPath: () => string;
          getProjectPaths: () => string[];
        };
      };
      return {
        queue: w.__GITLITE_E2E_PICK_PATHS__ ?? [],
        activeProject: w.__GITLITE_E2E_API__?.getActiveProjectPath?.() ?? '',
        projects: w.__GITLITE_E2E_API__?.getProjectPaths?.() ?? []
      };
    });
    const notice = ((await page.getByTestId('ui-notice').textContent().catch(() => '')) ?? '').trim();
    console.log('E2E openProject mismatch:', {
      expectedPath: path,
      currentPath,
      source,
      notice,
      debug
    });
  }

  expect(currentPath).toContain(path);
}

async function ensureSidebarVisible(page: Page) {
  const sidebar = page.getByTestId('sidebar-pane');
  if (await sidebar.count()) return;
  const toggle = page.getByTestId('sidebar-overlay-toggle');
  if (await toggle.count()) {
    await toggle.click();
  }
}

test('switches sidebar tabs', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await ensureSidebarVisible(page);
  await page.getByTestId('sidebar-tab-branches').click();
  await ensureSidebarVisible(page);
  await expect(page.getByTestId('branch-pane')).toBeVisible();

  await page.getByTestId('sidebar-tab-stash').click();
  await ensureSidebarVisible(page);
  await expect(page.getByTestId('stash-pane')).toBeVisible();
});

test('supports branch create/checkout/delete flow', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await ensureSidebarVisible(page);
  await page.getByTestId('sidebar-tab-branches').click();
  await ensureSidebarVisible(page);

  await page.getByTestId('branch-create-input').fill('feature/e2e-branch');
  await page.getByTestId('branch-create-button').click();
  await expect(page.getByTestId('branch-row-feature/e2e-branch')).toBeVisible();

  await page.getByTestId('branch-checkout-feature-e2e-branch').click();
  await expect(page.getByTestId('branch-row-feature/e2e-branch')).toContainText(/current/i);

  await page.getByTestId('branch-checkout-main').click();
  await expect(page.getByTestId('branch-row-main')).toContainText(/current/i);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('branch-delete-feature-e2e-branch').click();
  await expect(page.getByTestId('branch-row-feature/e2e-branch')).toHaveCount(0);
});

test('switches projects with top tabs in same window', async ({ page }) => {
  await page.goto('/');

  await openProject(page, '/tmp/gitlite-alpha');
  await expect(page.getByTestId('project-tab-0')).toBeVisible();

  await openProject(page, '/tmp/gitlite-beta', 'tab-add');

  await expect(page.getByTestId('project-tab-1')).toBeVisible();
  await expect(page.getByTestId('repo-path')).toContainText('/tmp/gitlite-beta');

  await page.getByTestId('project-tab-0').click();
  await expect(page.getByTestId('repo-path')).toContainText('/tmp/gitlite-alpha');

  await page.getByTestId('project-tab-1').click();
  await expect(page.getByTestId('repo-path')).toContainText('/tmp/gitlite-beta');

  const tabs = page.locator('.gl-project-tab');
  const beforeClose = await tabs.count();

  await page.getByTestId('project-tab-close-1').click();
  await expect(tabs).toHaveCount(beforeClose - 1);
});

test('updates diff when commit row is selected', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await page.getByTestId('commit-row-6f85307').click();

  await expect(page.getByText('.github/workflows/release-please.yml')).toBeVisible();
});

test('switches commit views between flow and graph', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');

  await expect(page.getByTestId('commit-flow-list')).toBeVisible();
  await expect(page.getByTestId('flow-toolbar')).toBeVisible();

  const firstToggle = page.locator('[data-testid^="flow-toggle-"]').first();
  await firstToggle.click({ force: true });
  await expect(page.locator('.gl-flow-group.is-collapsed')).toHaveCount(1);
  await firstToggle.click({ force: true });
  await expect(page.locator('.gl-flow-group.is-collapsed')).toHaveCount(0);

  await page.getByTestId('commit-view-graph').click({ force: true });
  await expect(page.getByTestId('commit-list')).toBeVisible();

  await page.getByTestId('commit-view-flow').click({ force: true });
  await expect(page.getByTestId('commit-flow-list')).toBeVisible();
});

test('toggles dark and light theme', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'light');

  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark');

  const systemTheme = await page.evaluate(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  await page.getByTestId('theme-system').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', systemTheme);
});

test('keeps readable text contrast across dark/light/system themes', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');

  await page.getByTestId('open-settings').click();

  const themeButtons = ['theme-dark', 'theme-light', 'theme-system'] as const;
  for (const themeButton of themeButtons) {
    await page.getByTestId(themeButton).click();
    const ratio = await page.evaluate(() => {
      function parseRgb(input: string): [number, number, number] {
        const values = input.match(/\d+(\.\d+)?/g) ?? [];
        return [
          Number(values[0] ?? 0),
          Number(values[1] ?? 0),
          Number(values[2] ?? 0)
        ];
      }

      function luminance([r, g, b]: [number, number, number]): number {
        const normalized = [r, g, b].map((value) => {
          const s = value / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * normalized[0] + 0.7152 * normalized[1] + 0.0722 * normalized[2];
      }

      function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
        const la = luminance(a);
        const lb = luminance(b);
        const light = Math.max(la, lb);
        const dark = Math.min(la, lb);
        return (light + 0.05) / (dark + 0.05);
      }

      const sample = document.querySelector('.gl-commit-message') as HTMLElement | null;
      const panel = document.querySelector('[data-testid="commit-table"]') as HTMLElement | null;
      if (!sample || !panel) return 0;
      const fg = parseRgb(getComputedStyle(sample).color);
      const bg = parseRgb(getComputedStyle(panel).backgroundColor);
      return contrastRatio(fg, bg);
    });

    expect(ratio).toBeGreaterThan(3);
  }
});

test('keeps three-panel shell layout visible', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await expect(page.getByTestId('sidebar-pane')).toBeVisible();
  await expect(page.getByTestId('commit-table')).toBeVisible();
  await expect(page.getByTestId('diff-view')).toBeVisible();
});

test('adapts layout across 1260/1000/800 widths', async ({ page }) => {
  await page.setViewportSize({ width: 1260, height: 900 });
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await expect(page.getByTestId('sidebar-pane')).toBeVisible();
  await expect(page.getByTestId('narrow-main-toggle')).toHaveCount(0);

  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(page.getByTestId('commit-table')).toBeVisible();
  await expect(page.getByTestId('diff-view')).toBeVisible();
  await expect(page.getByTestId('sidebar-overlay-toggle')).toBeVisible();

  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.getByTestId('narrow-main-toggle')).toBeVisible();
  await page.getByTestId('main-toggle-diff').click();
  await expect(page.getByTestId('diff-view')).toBeVisible();
  await page.getByTestId('main-toggle-commit').click();
  await expect(page.getByTestId('commit-table')).toBeVisible();
});

test('supports stash create/apply/drop flow', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await ensureSidebarVisible(page);
  await page.getByTestId('sidebar-tab-stash').click();
  await ensureSidebarVisible(page);

  const rows = page.locator('[data-testid^="stash-row-"]');
  const before = await rows.count();

  await page.getByTestId('stash-message').fill('WIP: stash from e2e');
  await page.getByTestId('stash-create').click();
  await expect(rows).toHaveCount(before + 1);
  await expect(page.getByTestId('stash-row-0')).toContainText('WIP: stash from e2e');

  await page.getByTestId('stash-apply-0').click();
  await expect(page.getByTestId('stash-row-0')).toContainText('WIP: stash from e2e');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('stash-drop-0').click();
  await expect(rows).toHaveCount(before);
});

test('shows remote sync section in changes pane', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await ensureSidebarVisible(page);
  await page.getByTestId('sidebar-tab-changes').click();
  await ensureSidebarVisible(page);

  await expect(page.getByTestId('sync-pane')).toBeVisible();
  await expect(page.getByTestId('sync-remote-select')).toBeVisible();
  await expect(page.getByTestId('remote-row-origin')).toBeVisible();
});

test('runs core flow: open -> stage -> commit -> diff -> branch -> stash -> sync', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');
  await ensureSidebarVisible(page);

  await page.getByTestId('sidebar-tab-changes').click();
  await ensureSidebarVisible(page);

  const firstUnstaged = page.locator('[data-testid^="change-unstaged-"]').first();
  await expect(firstUnstaged).toBeVisible();
  await firstUnstaged.getByRole('button', { name: 'Stage' }).click();
  await expect(page.locator('[data-testid^="change-staged-"]').first()).toBeVisible();

  const commitMessage = `e2e-core-${Date.now()}`;
  await page.getByTestId('commit-message').fill(commitMessage);
  await page.getByTestId('commit-button').click();

  const commitRow = page.locator('.gl-commit-row', { hasText: commitMessage }).first();
  await expect(commitRow).toBeVisible();
  await commitRow.click();
  await expect(page.locator('.gl-diff-title')).toContainText(commitMessage);

  await page.getByTestId('sidebar-tab-branches').click();
  await ensureSidebarVisible(page);
  const branchName = `feature/e2e-core-flow`;
  await page.getByTestId('branch-create-input').fill(branchName);
  await page.getByTestId('branch-create-button').click();
  await expect(page.getByTestId(`branch-row-${branchName}`)).toBeVisible();
  await page.getByTestId(`branch-checkout-${branchName.replace(/[^a-zA-Z0-9_-]+/g, '-')}`).click();
  await expect(page.getByTestId(`branch-row-${branchName}`)).toContainText(/current/i);
  await page.getByTestId('branch-checkout-main').click();

  await page.getByTestId('sidebar-tab-stash').click();
  await ensureSidebarVisible(page);
  await page.getByTestId('stash-message').fill('WIP: core-flow');
  await page.getByTestId('stash-create').click();
  await expect(page.getByTestId('stash-row-0')).toContainText('WIP: core-flow');

  await page.getByTestId('sidebar-tab-changes').click();
  await ensureSidebarVisible(page);
  await expect(page.getByTestId('sync-pane')).toBeVisible();
  await page.getByTestId('sync-fetch').click();
  await page.getByTestId('sync-pull').click();
  await page.getByTestId('sync-push').click();
});

test('persists theme/diff/default-remote/commit-view settings after reload', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');

  await page.getByTestId('open-settings').click();
  await page.getByTestId('theme-light').click();
  await page.getByTestId('settings-diff-split').click();
  await page.getByTestId('settings-commit-view-graph').click();
  await page.getByTestId('settings-default-remote').fill('upstream');
  await page.getByTestId('settings-default-remote-save').click();
  await page.getByTestId('settings-close').click();

  await page.reload();
  await openProject(page, '/tmp/gitlite-alpha');

  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByTestId('commit-list')).toBeVisible();
  await expect(page.getByTestId('diff-view')).toHaveAttribute('data-view-mode', 'split');

  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings-default-remote')).toHaveValue('upstream');
});

test('measures performance baseline on 1k+ commit repository', async ({ page }) => {
  await page.goto('/');

  const openStart = Date.now();
  await openProject(page, '/tmp/gitlite-large');
  const openMs = Date.now() - openStart;

  await page.getByTestId('commit-view-graph').click();
  await page.getByTestId('commit-range').click();
  await page.getByRole('button', { name: 'All', exact: true }).click();

  const rows = page.locator('[data-testid^="commit-row-"]');
  await expect(rows).toHaveCount(1400);

  const target = rows.nth(1100);
  const selectStart = Date.now();
  await target.click();
  await expect(target).toHaveClass(/is-active/);
  const selectMs = Date.now() - selectStart;

  await ensureSidebarVisible(page);
  const tabStart = Date.now();
  await page.getByTestId('sidebar-tab-branches').click();
  await expect(page.getByTestId('branch-pane')).toBeVisible();
  await page.getByTestId('sidebar-tab-changes').click();
  await expect(page.getByTestId('changes-pane')).toBeVisible();
  const tabSwitchMs = Date.now() - tabStart;

  const scrollSweepMs = await page.evaluate(async () => {
    const container = document.querySelector('[data-testid="commit-list"]') as HTMLElement | null;
    if (!container) return 9_999;
    const start = performance.now();
    for (let i = 0; i < 6; i += 1) {
      container.scrollTop = i % 2 === 0 ? container.scrollHeight : 0;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    return performance.now() - start;
  });

  const heapDelta = await page.evaluate(async () => {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    if (!perf.memory) {
      return null;
    }
    const before = perf.memory.usedJSHeapSize;
    const rows = Array.from(document.querySelectorAll('[data-testid^="commit-row-"]')) as HTMLElement[];
    for (let i = 0; i < 240; i += 1) {
      const row = rows[(i * 17) % rows.length];
      row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const after = perf.memory.usedJSHeapSize;
    return { before, after, ratio: before > 0 ? after / before : 1 };
  });

  expect(openMs).toBeLessThan(2200);
  expect(selectMs).toBeLessThan(450);
  expect(tabSwitchMs).toBeLessThan(700);
  expect(scrollSweepMs).toBeLessThan(850);
  if (heapDelta) {
    expect(heapDelta.ratio).toBeLessThan(2.2);
  }

  console.log('perf baseline', {
    openMs,
    selectMs,
    tabSwitchMs,
    scrollSweepMs,
    heapRatio: heapDelta?.ratio ?? null
  });
});

test('supports keyboard-first settings flow', async ({ page }) => {
  await page.goto('/');
  await openProject(page, '/tmp/gitlite-alpha');

  await page.keyboard.press('Control+,');
  await expect(page.getByTestId('settings-panel')).toBeVisible();

  await page.getByTestId('theme-dark').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-panel')).toHaveCount(0);
});
