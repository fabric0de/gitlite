<script lang="ts">
  import { Archive, Plus, Trash2, Check } from "lucide-svelte";
  import type { StashEntry } from "../../types/git";

  let {
    stashes = [],
    onCreateStash,
    onApplyStash,
    onDropStash,
  }: {
    stashes: StashEntry[];
    onCreateStash: (message?: string) => Promise<void>;
    onApplyStash: (index: number) => Promise<void>;
    onDropStash: (index: number) => Promise<void>;
  } = $props();

  let stashMessage = $state("");
  let busy = $state(false);

  async function createStash() {
    busy = true;
    try {
      await onCreateStash(stashMessage);
      stashMessage = "";
    } finally {
      busy = false;
    }
  }

  async function applyStash(index: number) {
    busy = true;
    try {
      await onApplyStash(index);
    } finally {
      busy = false;
    }
  }

  async function dropStash(index: number) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Drop stash@{${index}}?`);
      if (!confirmed) return;
    }
    busy = true;
    try {
      await onDropStash(index);
    } finally {
      busy = false;
    }
  }
</script>

<div class="gl-pane" data-testid="stash-pane">
  <div class="gl-pane-head">
    <div class="flex items-center gap-2">
      <Archive size={14} class="opacity-60" />
      <span>Stash</span>
    </div>
    <span class="gl-badge">{stashes.length}</span>
  </div>

  <div class="gl-list" data-testid="stash-list">
    <!-- Create Stash -->
    <section class="gl-section p-4 border-b border-[var(--line-soft)]">
      <div class="flex flex-col gap-2">
        <label
          class="text-[10px] uppercase font-bold opacity-50"
          for="stash-message-input">Current Work</label
        >
        <div
          class="flex items-center gap-2 bg-[var(--bg-canvas)] p-2 rounded-md border border-[var(--line-soft)]"
        >
          <input
            id="stash-message-input"
            class="gl-input-clean"
            bind:value={stashMessage}
            placeholder="WIP: Descriptive message..."
            data-testid="stash-message"
          />
          <button
            type="button"
            class="gl-mini-button is-accent"
            onclick={createStash}
            disabled={busy}
            data-testid="stash-create"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </section>

    <!-- Stash List -->
    <section class="gl-section">
      <div class="gl-section-title">Saved States</div>
      <div class="gl-stash-list">
        {#if stashes.length === 0}
          <div class="px-4 py-8 text-center text-[11px] opacity-40 italic">
            No saved stashes found.
          </div>
        {:else}
          {#each stashes as stash}
            <div class="gl-stash-row" data-testid={`stash-row-${stash.index}`}>
              <div class="flex-1 min-w-0">
                <div class="gl-stash-msg truncate">
                  {stash.message || "No message"}
                </div>
                <div class="gl-stash-meta truncate">
                  stash@{"{"}{stash.index}{"}"} · {stash.author}
                </div>
              </div>
              <div class="gl-stash-actions">
                <button
                  type="button"
                  class="gl-action-tab"
                  onclick={() => applyStash(stash.index)}
                  disabled={busy}
                  data-testid={`stash-apply-${stash.index}`}
                  title="Apply stash"
                >
                  Apply
                </button>
                <button
                  type="button"
                  class="gl-action-icon is-danger"
                  onclick={() => dropStash(stash.index)}
                  disabled={busy}
                  data-testid={`stash-drop-${stash.index}`}
                  title="Drop stash"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          {/each}
        {/if}
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

  .gl-stash-list {
    display: flex;
    flex-direction: column;
  }

  .gl-stash-row {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    gap: 12px;
    border-bottom: 1px solid var(--line-soft);
    transition: all var(--transition-fast);
    cursor: default;
    min-width: 0;
  }

  .gl-stash-row:last-child {
    border-bottom: none;
  }

  .gl-stash-row:hover {
    background: var(--bg-hover);
  }

  .gl-stash-msg {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .gl-stash-meta {
    font-size: 10px;
    font-family: var(--font-mono);
    opacity: 0.4;
    margin-top: 2px;
  }

  .gl-stash-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .gl-stash-row:hover .gl-stash-actions {
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
