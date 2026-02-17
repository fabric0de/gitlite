<script lang="ts">
  import type { SidebarTab } from '../../types/ui';

  export let activeTab: SidebarTab;
  export let onSelect: (tab: SidebarTab) => void;

  const items: Array<{ tab: SidebarTab; label: string }> = [
    { tab: 'branches', label: 'Branches' },
    { tab: 'changes', label: 'Changes' },
    { tab: 'stash', label: 'Stash' }
  ];
</script>

<aside class="gl-rail gl-panel" data-testid="activity-rail">
  {#each items as item}
    <button
      type="button"
      class="gl-rail-button"
      class:is-active={activeTab === item.tab}
      title={item.label}
      on:click={() => onSelect(item.tab)}
      data-testid={`rail-tab-${item.tab}`}
      aria-label={item.label}
    >
      <span class="gl-rail-icon" aria-hidden="true">
        {#if item.tab === 'branches'}
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 4v6"></path>
            <path d="M6 14v6"></path>
            <path d="M6 10a2 2 0 1 0 0 4"></path>
            <path d="M6 6a2 2 0 1 0 0-4"></path>
            <path d="M6 20a2 2 0 1 0 0-4"></path>
            <path d="M8 6h5a5 5 0 0 1 5 5"></path>
            <path d="M8 18h5a5 5 0 0 0 5-5"></path>
          </svg>
        {:else if item.tab === 'changes'}
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M8 3h8l5 5v13H8z"></path>
            <path d="M16 3v5h5"></path>
            <path d="M11 13h7"></path>
            <path d="M11 17h7"></path>
            <path d="M3 10v6"></path>
            <path d="M0 13h6"></path>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 7h18v4H3z"></path>
            <path d="M5 11h14v9H5z"></path>
            <path d="M9 15h6"></path>
            <path d="M12 11v-4"></path>
          </svg>
        {/if}
      </span>
    </button>
  {/each}
</aside>
