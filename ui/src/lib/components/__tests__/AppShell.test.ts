import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import AppShell from '../layout/AppShell.svelte';
import { uiState } from '../../stores/ui';

describe('AppShell prototype flow', () => {
  beforeEach(() => {
    uiState.resetForTests();
  });

  async function renderWithRepository(path: string) {
    await uiState.init();
    await uiState.openProject(path);
    render(AppShell);
    await waitFor(() => {
      expect(uiState.repository?.path).toBe(path);
    });
    await screen.findByTestId('workspace-open');
  }

  async function openSidebarOverlayIfNeeded() {
    const existingTab = screen.queryByTestId('sidebar-tab-branches');
    if (existingTab) return;
    const toggle = await screen.findByTestId('sidebar-overlay-toggle');
    await fireEvent.click(toggle);
    await screen.findByTestId('sidebar-tab-branches');
  }

  it('switches sidebar tab and updates selected diff', async () => {
    await renderWithRepository('/tmp/gitlite-alpha');
    await screen.findByTestId('commit-row-8c0977e');
    await openSidebarOverlayIfNeeded();

    await fireEvent.click(screen.getByTestId('sidebar-tab-branches'));
    if (!screen.queryByTestId('branch-pane')) {
      await fireEvent.click(await screen.findByTestId('sidebar-overlay-toggle'));
    }
    await screen.findByTestId('branch-pane');

    await fireEvent.click(screen.getByTestId('commit-row-6f85307'));

    await waitFor(() => {
      expect(uiState.selectedCommitHash).toBe('6f85307');
      expect(uiState.selectedDiff[0]?.path).toBe('.github/workflows/release-please.yml');
    });
  });

  it('toggles dark and light theme', async () => {
    await renderWithRepository('/tmp/gitlite-alpha');
    await fireEvent.click(screen.getByTestId('open-settings'));
    await screen.findByTestId('theme-toggle');

    await fireEvent.click(screen.getByTestId('theme-light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themeMode).toBe('light');

    await fireEvent.click(screen.getByTestId('theme-dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themeMode).toBe('dark');

    await fireEvent.click(screen.getByTestId('theme-system'));
    expect(document.documentElement.dataset.themeMode).toBe('system');
  });

  it('stages and commits through provider-backed changes pane', async () => {
    await renderWithRepository('/tmp/gitlite-alpha');
    await openSidebarOverlayIfNeeded();
    await screen.findByTestId('changes-pane');
    const commitCountBefore = uiState.commits.length;

    await fireEvent.click(screen.getAllByRole('button', { name: 'Stage' })[0]);
    await fireEvent.input(screen.getByTestId('commit-message'), {
      target: { value: 'feat(ui): wire changes pane actions' }
    });
    await fireEvent.click(screen.getByTestId('commit-button'));

    await waitFor(() => {
      expect(uiState.commits.length).toBe(commitCountBefore + 1);
    });
  });

  it('closes settings and compact sidebar with Escape key', async () => {
    await renderWithRepository('/tmp/gitlite-alpha');

    await fireEvent.click(screen.getByTestId('open-settings'));
    await screen.findByTestId('settings-panel');
    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('settings-panel')).toBeNull();
    });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 900
    });
    await fireEvent(window, new Event('resize'));

    const overlayToggle = await screen.findByTestId('sidebar-overlay-toggle');
    await fireEvent.click(overlayToggle);
    await screen.findByTestId('sidebar-overlay');

    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('sidebar-overlay')).toBeNull();
    });
  });

  it('supports keyboard shortcuts for tabs and settings', async () => {
    await uiState.init();
    await uiState.openProject('/tmp/gitlite-alpha');
    await uiState.openProject('/tmp/gitlite-beta');
    render(AppShell);
    await screen.findByTestId('workspace-open');

    expect(uiState.activeProjectPath).toBe('/tmp/gitlite-beta');
    await fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true });
    await waitFor(() => {
      expect(uiState.activeProjectPath).toBe('/tmp/gitlite-alpha');
    });

    await fireEvent.keyDown(window, { key: ',', metaKey: true });
    await screen.findByTestId('settings-panel');
  });

  it('opens command settings modal and saves shortcut', async () => {
    await renderWithRepository('/tmp/gitlite-alpha');
    await fireEvent.click(screen.getByTestId('open-settings'));
    await screen.findByTestId('settings-panel');

    await fireEvent.click(screen.getByTestId('open-command-settings'));
    await screen.findByTestId('command-settings-panel');

    const input = screen.getByTestId(
      'command-shortcut-open_project'
    ) as HTMLInputElement;
    input.focus();
    await fireEvent.keyDown(input, { key: 'o', metaKey: true });
    await fireEvent.click(screen.getByTestId('command-settings-save'));

    await waitFor(() => {
      expect(screen.queryByTestId('command-settings-panel')).toBeNull();
      expect(uiState.commandShortcuts.open_project).toBe('CmdOrCtrl+O');
    });
  });
});
