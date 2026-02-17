<script lang="ts">
  import { PanelLeftClose } from "lucide-svelte";
  import type { SidebarTab } from "../../types/ui";
  import type {
    BranchInfo,
    ChangeItem,
    HttpsAuthInput,
    RemoteInfo,
    SshAuthInput,
    StashEntry,
    SyncStatus,
  } from "../../types/git";
  import BranchPane from "../panes/BranchPane.svelte";
  import ChangesPane from "../panes/ChangesPane.svelte";
  import StashPane from "../panes/StashPane.svelte";

  let {
    activeTab,
    branches = [],
    changes = [],
    stashes = [],
    remotes = [],
    selectedRemote = "",
    defaultRemote = "",
    syncStatus = null,
    onSelectTab,
    onToggleCollapse,
    onStagePath,
    onUnstagePath,
    onCommit,
    onSetSelectedRemote,
    onSetDefaultRemote,
    onFetchRemote,
    onPullRemote,
    onPushRemote,
    onFetchSsh,
    onPullSsh,
    onPushSsh,
    onAddRemote,
    onRenameRemote,
    onSetRemoteUrl,
    onRemoveRemote,
    onCreateStash,
    onApplyStash,
    onDropStash,
    onCreateBranch,
    onCheckoutBranch,
    onDeleteBranch,
  }: {
    activeTab: SidebarTab;
    branches: BranchInfo[];
    changes: ChangeItem[];
    stashes: StashEntry[];
    remotes: RemoteInfo[];
    selectedRemote: string;
    defaultRemote: string;
    syncStatus: SyncStatus | null;
    onSelectTab: (tab: SidebarTab) => void;
    onToggleCollapse: () => void;
    onStagePath: (path: string) => Promise<void>;
    onUnstagePath: (path: string) => Promise<void>;
    onCommit: (message: string, description?: string) => Promise<void>;
    onSetSelectedRemote: (name: string) => Promise<void>;
    onSetDefaultRemote: (name: string) => void;
    onFetchRemote: (auth: HttpsAuthInput) => Promise<void>;
    onPullRemote: (auth: HttpsAuthInput) => Promise<void>;
    onPushRemote: (auth: HttpsAuthInput) => Promise<void>;
    onFetchSsh: (auth: SshAuthInput) => Promise<void>;
    onPullSsh: (auth: SshAuthInput) => Promise<void>;
    onPushSsh: (auth: SshAuthInput) => Promise<void>;
    onAddRemote: (name: string, url: string) => Promise<void>;
    onRenameRemote: (oldName: string, newName: string) => Promise<void>;
    onSetRemoteUrl: (name: string, url: string) => Promise<void>;
    onRemoveRemote: (name: string) => Promise<void>;
    onCreateStash: (message?: string) => Promise<void>;
    onApplyStash: (index: number) => Promise<void>;
    onDropStash: (index: number) => Promise<void>;
    onCreateBranch: (name: string) => Promise<void>;
    onCheckoutBranch: (name: string) => Promise<void>;
    onDeleteBranch: (name: string) => Promise<void>;
  } = $props();
</script>

<section class="gl-panel gl-pane" data-testid="sidebar-pane">
  <div class="gl-sidebar-tabs" data-testid="sidebar-tabs">
    <button
      type="button"
      class="gl-sidebar-tab"
      class:is-active={activeTab === "changes"}
      onclick={() => onSelectTab("changes")}
      data-testid="sidebar-tab-changes"
    >
      Changes
    </button>
    <button
      type="button"
      class="gl-sidebar-tab"
      class:is-active={activeTab === "branches"}
      onclick={() => onSelectTab("branches")}
      data-testid="sidebar-tab-branches"
    >
      Branches
    </button>
    <button
      type="button"
      class="gl-sidebar-tab"
      class:is-active={activeTab === "stash"}
      onclick={() => onSelectTab("stash")}
      data-testid="sidebar-tab-stash"
    >
      Stash
    </button>
  </div>

  <div class="gl-sidebar-content">
    {#if activeTab === "branches"}
      <BranchPane
        {branches}
        {onCreateBranch}
        {onCheckoutBranch}
        {onDeleteBranch}
      />
    {:else if activeTab === "changes"}
      <ChangesPane
        {changes}
        {remotes}
        {selectedRemote}
        {defaultRemote}
        {syncStatus}
        {onStagePath}
        {onUnstagePath}
        {onCommit}
        {onSetSelectedRemote}
        {onSetDefaultRemote}
        {onFetchRemote}
        {onPullRemote}
        {onPushRemote}
        {onFetchSsh}
        {onPullSsh}
        {onPushSsh}
        {onAddRemote}
        {onRenameRemote}
        {onSetRemoteUrl}
        {onRemoveRemote}
      />
    {:else}
      <StashPane {stashes} {onCreateStash} {onApplyStash} {onDropStash} />
    {/if}
  </div>

  <footer class="gl-sidebar-footer">
    <button
      type="button"
      class="gl-icon-button"
      onclick={onToggleCollapse}
      data-testid="sidebar-collapse"
      aria-label="Collapse sidebar"
      title="Collapse sidebar"
    >
      <PanelLeftClose size={16} />
    </button>
  </footer>
</section>

<style>
  .gl-sidebar-tabs {
    display: flex;
    padding: 8px 12px;
    gap: 4px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--line-soft);
  }

  .gl-sidebar-tab {
    flex: 1;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-soft);
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .gl-sidebar-tab:hover {
    background: var(--bg-hover);
    color: var(--text-strong);
  }

  .gl-sidebar-tab.is-active {
    background: var(--bg-active);
    color: var(--text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .gl-sidebar-content {
    flex: 1;
    overflow-y: auto;
  }

  .gl-sidebar-footer {
    padding: 8px 12px;
    border-top: 1px solid var(--line-soft);
    display: flex;
    justify-content: flex-end;
    background: var(--bg-surface);
  }
</style>
