import { fireEvent, render, screen } from '@testing-library/svelte';
import ActivityRail from '../ActivityRail.svelte';
import { describe, expect, it, vi } from 'vitest';

describe('ActivityRail', () => {
  it('switches tabs on click', async () => {
    const onSelect = vi.fn();
    render(ActivityRail, {
      props: {
        activeTab: 'changes',
        onSelect
      }
    });

    await fireEvent.click(screen.getByTestId('rail-tab-branches'));
    expect(onSelect).toHaveBeenCalledWith('branches');

    await fireEvent.click(screen.getByTestId('rail-tab-stash'));
    expect(onSelect).toHaveBeenCalledWith('stash');
  });
});
