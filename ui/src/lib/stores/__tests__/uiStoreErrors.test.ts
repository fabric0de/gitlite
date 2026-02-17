import { beforeEach, describe, expect, it } from 'vitest';
import { uiState } from '../ui.svelte';

describe('UIStore error mapping', () => {
  beforeEach(() => {
    uiState.resetForTests();
  });

  function mapMessage(input: string): string {
    return (uiState as unknown as { messageOf: (value: string) => string }).messageOf(input);
  }

  it('maps branch/stash/remote prefixed errors to friendly messages', () => {
    expect(mapMessage('E_BRANCH_DELETE_CURRENT: cannot delete current branch')).toBe(
      'Cannot delete the currently checked-out branch.'
    );
    expect(mapMessage('E_STASH_INVALID_INDEX: stash 99 does not exist')).toBe(
      'Selected stash entry no longer exists.'
    );
    expect(mapMessage('E_REMOTE_EXISTS: origin')).toBe('Remote already exists.');
    expect(mapMessage('E_PUSH_NON_FF: rejected')).toBe(
      'Push blocked because remote is ahead. Pull/rebase first.'
    );
  });

  it('maps non-prefixed backend branch/remote errors', () => {
    expect(mapMessage("Failed to add remote 'origin': invalid url")).toBe(
      'Failed to add remote. Check name/URL and try again.'
    );
    expect(mapMessage("Failed to find branch: reference not found")).toBe(
      'Branch operation failed. Verify the branch name and working tree state.'
    );
    expect(mapMessage('cannot delete current branch')).toBe(
      'Cannot delete the currently checked-out branch.'
    );
  });

  it('masks credentials and secrets in surfaced messages', () => {
    const raw =
      'E_PULL_AUTH: failed for https://alice:supersecret@example.com/repo.git token=ghp_123 password=abcd';
    const mapped = mapMessage(raw);
    expect(mapped).not.toContain('supersecret');
    expect(mapped).not.toContain('ghp_123');
    expect(mapped).not.toContain('abcd');
  });
});
