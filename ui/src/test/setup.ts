import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';
import { uiState } from '../lib/stores/ui';

afterEach(() => {
  cleanup();
  uiState.resetForTests();
});
