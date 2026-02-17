<script lang="ts">
  import { GitBranch, Plus, Trash2, CheckCircle2, Globe } from "lucide-svelte";
  import type { BranchInfo } from "../../types/git";

  let {
    branches = [],
    onCreateBranch,
    onCheckoutBranch,
    onDeleteBranch,
  }: {
    branches: BranchInfo[];
    onCreateBranch: (name: string) => Promise<void>;
    onCheckoutBranch: (name: string) => Promise<void>;
    onDeleteBranch: (name: string) => Promise<void>;
  } = $props();

  let nextBranchName = $state("");
  let busy = $state(false);

  const localBranches = $derived(branches.filter((branch) => !branch.isRemote));
  const remoteBranches = $derived(branches.filter((branch) => branch.isRemote));

  function branchTestId(name: string) {
    return name.replace(/[^a-zA-Z0-9_-]+/g, "-");
  }

  async function createBranch() {
    const normalized = nextBranchName.trim();
    if (!normalized) return;
    busy = true;
    try {
      await onCreateBranch(normalized);
      nextBranchName = "";
    } finally {
      busy = false;
    }
  }

  async function checkoutBranch(name: string) {
    busy = true;
    try {
      await onCheckoutBranch(name);
    } finally {
      busy = false;
    }
  }

  async function deleteBranch(name: string) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete branch '${name}'?`);
      if (!confirmed) return;
    }
    busy = true;
    try {
      await onDeleteBranch(name);
    } finally {
      busy = false;
    }
  }
</script>

<div class="gl-pane" data-testid="branch-pane">
  <div class="gl-pane-head">
    <div class="flex items-center gap-2">
      <GitBranch size={14} class="opacity-60" />
      <span>Branches</span>
    </div>
    <span class="gl-badge">{branches.length}</span>
  </div>

  <div class="gl-list" data-testid="branch-list">
    <!-- Create Branch -->
    <section class="gl-section p-4 border-b border-[var(--line-soft)]">
      <div class="flex flex-col gap-2">
        <label
          class="text-[10px] uppercase font-bold opacity-50"
          for="create-branch-name">Create New Branch</label
        >
        <div
          class="flex items-center gap-2 bg-[var(--bg-canvas)] p-2 rounded-md border border-[var(--line-soft)]"
        >
          <input
            id="create-branch-name"
            class="gl-input-clean"
            bind:value={nextBranchName}
            placeholder="feature/new-branch"
            data-testid="branch-create-input"
          />
          <button
            type="button"
            class="gl-mini-button is-accent"
            onclick={createBranch}
            disabled={busy || !nextBranchName.trim()}
            data-testid="branch-create-button"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </section>

    <!-- Local Branches -->
    <section class="gl-section">
      <div class="gl-section-title">Local</div>
      <div class="gl-branch-list">
        {#each localBranches as branch}
          <div
            class="gl-branch-row"
            class:is-active={branch.isCurrent}
            data-testid={`branch-row-${branch.name}`}
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              {#if branch.isCurrent}
                <CheckCircle2 size={12} class="text-[var(--accent)] shrink-0" />
              {:else}
                <GitBranch size={12} class="opacity-30 shrink-0" />
              {/if}
              <span class="gl-branch-name truncate">{branch.name}</span>
            </div>

            <div class="gl-branch-actions">
              {#if !branch.isCurrent}
                <button
                  type="button"
                  class="gl-action-tab"
                  onclick={() => checkoutBranch(branch.name)}
                  disabled={busy}
                  data-testid={`branch-checkout-${branchTestId(branch.name)}`}
                  title="Checkout"
                >
                  Checkout
                </button>
                <button
                  type="button"
                  class="gl-action-icon is-danger"
                  onclick={() => deleteBranch(branch.name)}
                  disabled={busy}
                  data-testid={`branch-delete-${branchTestId(branch.name)}`}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              {:else}
                <span
                  class="text-[10px] font-bold text-[var(--accent)] px-2 opacity-60"
                  >CURRENT</span
                >
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Remote Branches -->
    <section class="gl-section border-t border-[var(--line-soft)] mt-2">
      <div class="gl-section-title">Remote</div>
      <div class="gl-branch-list">
        {#each remoteBranches as branch}
          <div
            class="gl-branch-row is-remote"
            data-testid={`branch-row-${branch.name}`}
          >
            <Globe size={12} class="opacity-30 shrink-0" />
            <span class="gl-branch-name truncate">{branch.name}</span>
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .gl-section-title {
    padding: 10px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-soft);
    background: color-mix(in oklab, var(--bg-surface), transparent 40%);
  }

  .gl-branch-list {
    display: flex;
    flex-direction: column;
  }

  .gl-branch-row {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 10px;
    transition: all var(--transition-fast);
    cursor: default;
    min-width: 0;
  }

  .gl-branch-row:hover {
    background: var(--bg-hover);
  }

  .gl-branch-row.is-active {
    background: color-mix(in oklab, var(--accent), transparent 95%);
  }

  .gl-branch-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-normal);
    opacity: 0.85;
  }

  .gl-branch-row.is-active .gl-branch-name {
    color: var(--text-strong);
    font-weight: 600;
    opacity: 1;
  }

  .gl-branch-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .gl-branch-row:hover .gl-branch-actions {
    opacity: 1;
  }

  .gl-action-tab {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-active);
    color: var(--text-strong);
    border: 1px solid var(--line-soft);
    cursor: pointer;
  }

  .gl-action-tab:hover {
    background: var(--accent);
    color: white;
    border-color: transparent;
  }

  .gl-action-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-soft);
    cursor: pointer;
  }

  .gl-action-icon:hover {
    background: var(--bg-hover);
    color: var(--text-strong);
    border-color: var(--line-soft);
  }

  .gl-action-icon.is-danger:hover {
    background: color-mix(in oklab, var(--error), transparent 90%);
    color: var(--error);
    border-color: color-mix(in oklab, var(--error), transparent 80%);
  }

  .gl-badge {
    padding: 2px 6px;
    background: var(--bg-hover);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    opacity: 0.6;
  }

  .gl-mini-button {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-soft);
    cursor: pointer;
    transition: all var(--transition-fast);
    padding: 0;
    flex-shrink: 0;
  }

  .gl-mini-button.is-accent {
    background: var(--accent);
    color: white;
    border-color: transparent;
  }

  .gl-input-clean {
    background: transparent;
    border: none;
    font-size: 11px;
    width: 100%;
    outline: none;
    color: var(--text-strong);
  }
</style>
