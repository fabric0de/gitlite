import { describe, expect, it } from 'vitest';
import { uiState } from '../ui.svelte';

describe('uiState project tab switching', () => {
  it('switches repository path when selecting another project', async () => {
    uiState.resetForTests();
    await uiState.init();

    await uiState.switchProjectTab('/tmp/gitlite-alpha');
    expect(uiState.repository?.path).toBe('/tmp/gitlite-alpha');

    await uiState.switchProjectTab('/tmp/gitlite-beta');
    expect(uiState.repository?.path).toBe('/tmp/gitlite-beta');
  });
});
