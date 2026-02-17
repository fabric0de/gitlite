import { beforeEach, describe, expect, it } from 'vitest';
import { uiState } from '../ui.svelte';

describe('UIStore command shortcuts', () => {
  beforeEach(() => {
    uiState.resetForTests();
  });

  it('saves custom shortcut map', async () => {
    await uiState.init();

    await uiState.saveCommandShortcuts({
      ...uiState.commandShortcuts,
      open_project: 'CmdOrCtrl+O'
    });

    expect(uiState.commandShortcuts.open_project).toBe('CmdOrCtrl+O');
    const stored = window.localStorage.getItem('gitlite.shortcuts');
    expect(stored).toContain('CmdOrCtrl+O');
  });

  it('rejects duplicate shortcuts', async () => {
    await uiState.init();

    await expect(
      uiState.saveCommandShortcuts({
        ...uiState.commandShortcuts,
        open_project: 'CmdOrCtrl+T',
        close_project: 'CmdOrCtrl+T'
      })
    ).rejects.toThrow('E_SHORTCUT_CONFLICT');
  });
});
