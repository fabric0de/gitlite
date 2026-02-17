<script lang="ts">
  import {
    Check,
    Plus,
    Minus,
    Send,
    Share2,
    Trash2,
    Edit2,
    CheckCircle2,
    RefreshCw,
    Download,
    Upload,
    Settings2,
    Lock,
    Globe,
    ChevronDown,
    ChevronUp,
    X,
    Save,
  } from "lucide-svelte";
  import Dropdown from "../common/Dropdown.svelte";
  import type {
    ChangeItem,
    HttpsAuthInput,
    RemoteInfo,
    SshAuthInput,
    SyncStatus,
  } from "../../types/git";

  let {
    changes = [],
    remotes = [],
    selectedRemote = "",
    defaultRemote = "",
    syncStatus = null,
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
  }: {
    changes: ChangeItem[];
    remotes: RemoteInfo[];
    selectedRemote: string;
    defaultRemote: string;
    syncStatus: SyncStatus | null;
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
  } = $props();

  type AuthMode = "https" | "ssh";

  let commitMessage = $state("");
  let commitDescription = $state("");
  let busy = $state(false);

  let authMode = $state<AuthMode>("https");
  let httpsUsername = $state("");
  let httpsPassword = $state("");
  let sshKeyPath = $state("");
  let sshPassphrase = $state("");
  let showSyncConfig = $state(false);
  let showRemoteList = $state(true);
  let editingRemote = $state<string | null>(null);
  let editUrl = $state("");
  let nextRemoteName = $state("");
  let nextRemoteUrl = $state("");

  const staged = $derived(changes.filter((change) => change.staged));
  const unstaged = $derived(changes.filter((change) => !change.staged));
  const remoteOptions = $derived(
    remotes.map((r) => ({ label: r.name, value: r.name })),
  );

  function label(status: ChangeItem["status"]): string {
    switch (status) {
      case "added":
        return "A";
      case "modified":
        return "M";
      case "deleted":
        return "D";
      case "renamed":
        return "R";
      default:
        return "?";
    }
  }

  function clearAuthInputs() {
    // Only clear password/passphrase for security, keep username/path for convenience
    httpsPassword = "";
    sshPassphrase = "";
  }

  async function stage(path: string) {
    busy = true;
    try {
      await onStagePath(path);
    } finally {
      busy = false;
    }
  }

  async function unstage(path: string) {
    busy = true;
    try {
      await onUnstagePath(path);
    } finally {
      busy = false;
    }
  }

  async function commit() {
    if (!commitMessage.trim()) return;
    busy = true;
    try {
      await onCommit(commitMessage, commitDescription);
      commitMessage = "";
      commitDescription = "";
    } finally {
      busy = false;
    }
  }

  async function setRemote(name: string) {
    await onSetSelectedRemote(name);
  }

  async function runFetch() {
    busy = true;
    try {
      if (authMode === "https") {
        await onFetchRemote({
          username: httpsUsername.trim(),
          password: httpsPassword,
        });
      } else {
        await onFetchSsh({
          keyPath: sshKeyPath.trim(),
          passphrase: sshPassphrase || undefined,
        });
      }
    } finally {
      clearAuthInputs();
      busy = false;
    }
  }

  async function runPull() {
    busy = true;
    try {
      if (authMode === "https") {
        await onPullRemote({
          username: httpsUsername.trim(),
          password: httpsPassword,
        });
      } else {
        await onPullSsh({
          keyPath: sshKeyPath.trim(),
          passphrase: sshPassphrase || undefined,
        });
      }
    } finally {
      clearAuthInputs();
      busy = false;
    }
  }

  async function runPush() {
    busy = true;
    try {
      if (authMode === "https") {
        await onPushRemote({
          username: httpsUsername.trim(),
          password: httpsPassword,
        });
      } else {
        await onPushSsh({
          keyPath: sshKeyPath.trim(),
          passphrase: sshPassphrase || undefined,
        });
      }
    } finally {
      clearAuthInputs();
      busy = false;
    }
  }

  async function addRemote() {
    const name = nextRemoteName.trim();
    const url = nextRemoteUrl.trim();
    if (!name || !url) return;
    busy = true;
    try {
      await onAddRemote(name, url);
      nextRemoteName = "";
      nextRemoteUrl = "";
    } finally {
      busy = false;
    }
  }

  async function startEditingRemote(remote: RemoteInfo) {
    editingRemote = remote.name;
    editUrl = remote.url ?? "";
  }

  async function cancelEditingRemote() {
    editingRemote = null;
    editUrl = "";
  }

  async function saveRemoteUrl(name: string) {
    if (!editUrl.trim()) return;
    busy = true;
    try {
      await onSetRemoteUrl(name, editUrl.trim());
      editingRemote = null;
    } finally {
      busy = false;
    }
  }

  async function renameRemote(name: string) {
    if (typeof window === "undefined") return;
    const nextName = window.prompt("Rename remote", name)?.trim();
    if (!nextName || nextName === name) return;
    busy = true;
    try {
      await onRenameRemote(name, nextName);
    } finally {
      busy = false;
    }
  }

  async function removeRemote(name: string) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Remove remote '${name}'?`);
      if (!confirmed) return;
    }
    busy = true;
    try {
      await onRemoveRemote(name);
    } finally {
      busy = false;
    }
  }
</script>

<div class="gl-pane" data-testid="changes-pane">
  <div class="gl-pane-head">
    <div class="flex items-center gap-2">
      <CheckCircle2 size={14} class="opacity-60" />
      <span>Changes</span>
    </div>
    <span class="gl-badge">{changes.length}</span>
  </div>

  <div class="gl-list" data-testid="changes-list">
    <!-- Working Changes Section -->
    <section class="gl-section">
      <div class="gl-section-title">
        <div class="flex items-center gap-2">
          <span>Staged</span>
          <span class="opacity-40 text-[10px] font-mono">[{staged.length}]</span
          >
        </div>
      </div>

      <div class="gl-file-list">
        {#if staged.length === 0}
          <div class="px-3 py-4 text-center text-[11px] opacity-40 italic">
            No staged files
          </div>
        {:else}
          {#each staged as change}
            <div
              class="gl-file-row"
              data-testid={`change-staged-${change.path}`}
            >
              <span class="gl-status-tag is-staged">{label(change.status)}</span
              >
              <span class="gl-file-path" title={change.path}>{change.path}</span
              >
              <button
                type="button"
                class="gl-mini-button"
                onclick={() => unstage(change.path)}
                disabled={busy}
                aria-label="Unstage"
                title="Unstage file"
              >
                <Minus size={12} />
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <div class="gl-section-title mt-2">
        <div class="flex items-center gap-2">
          <span>Unstaged</span>
          <span class="opacity-40 text-[10px] font-mono"
            >[{unstaged.length}]</span
          >
        </div>
      </div>

      <div class="gl-file-list">
        {#if unstaged.length === 0}
          <div class="px-3 py-4 text-center text-[11px] opacity-40 italic">
            No unstaged files
          </div>
        {:else}
          {#each unstaged as change}
            <div
              class="gl-file-row"
              data-testid={`change-unstaged-${change.path}`}
            >
              <span class="gl-status-tag is-unstaged"
                >{label(change.status)}</span
              >
              <span class="gl-file-path" title={change.path}>{change.path}</span
              >
              <button
                type="button"
                class="gl-mini-button"
                onclick={() => stage(change.path)}
                disabled={busy}
                aria-label="Stage"
                title="Stage file"
              >
                <Plus size={12} />
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </section>

    <!-- Commit Section -->
    <section class="gl-section border-t border-[var(--line-soft)] mt-2">
      <div class="gl-section-title">Commit Message</div>
      <div class="p-4 flex flex-col gap-3">
        <div class="flex flex-col gap-2">
          <input
            id="commit-message"
            class="gl-input text-xs"
            bind:value={commitMessage}
            placeholder="What changed?"
            data-testid="commit-message"
          />
          <textarea
            class="gl-input text-xs min-h-[64px] resize-none leading-relaxed"
            bind:value={commitDescription}
            placeholder="Add a more detailed description..."
            data-testid="commit-description"
          ></textarea>
        </div>
        <button
          type="button"
          class="gl-button is-primary w-full gap-2 py-2"
          onclick={commit}
          disabled={busy || staged.length === 0 || !commitMessage.trim()}
          data-testid="commit-button"
        >
          <Send size={14} />
          <span class="font-bold">Commit Changes</span>
        </button>
      </div>
    </section>

    <!-- Sync Section -->
    <section
      class="gl-section border-t border-[var(--line-soft)] mt-2 pb-4"
      data-testid="sync-pane"
    >
      <div class="gl-section-title">
        <span>Remotes & Sync</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
            onclick={() => (showSyncConfig = !showSyncConfig)}
            title="Sync Configuration"
          >
            <Settings2
              size={12}
              class={showSyncConfig ? "text-[var(--accent)]" : "opacity-40"}
            />
          </button>
        </div>
      </div>

      <div class="px-4 pt-4 flex flex-col gap-4">
        <!-- Remote Selection & Status -->
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5 min-w-0">
            <span
              class="text-[9px] uppercase font-bold opacity-30 tracking-wider pl-1"
              >Remote Repository</span
            >
            <Dropdown
              value={selectedRemote}
              options={remoteOptions}
              onSelect={setRemote}
              label={remotes.length === 0 ? "No remotes" : "Select remote..."}
              icon={Globe}
              full
              testId="sync-remote-select"
            />
          </div>

          <div class="gl-sync-summary">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <div
                class="w-6 h-6 rounded bg-[var(--bg-active)] flex items-center justify-center flex-shrink-0"
              >
                <Share2 size={12} class="opacity-60" />
              </div>
              <div class="flex flex-col min-w-0">
                <span
                  class="text-[8px] uppercase font-black opacity-30 tracking-widest leading-none mb-0.5"
                  >Local Branch</span
                >
                <span class="text-[11px] font-bold truncate leading-none"
                  >{syncStatus?.branch ?? "-"}</span
                >
              </div>
            </div>

            <div
              class="flex items-center gap-3 border-l border-[var(--line-soft)] pl-3"
            >
              <div
                class="flex items-center gap-1.5"
                class:opacity-20={!syncStatus?.ahead || syncStatus.ahead === 0}
                title="Ahead of remote"
              >
                <Upload size={12} />
                <span
                  class="text-[12px] font-mono font-bold"
                  class:text-[var(--accent)]={syncStatus?.ahead &&
                    syncStatus.ahead > 0}
                >
                  {syncStatus?.ahead ?? 0}
                </span>
              </div>
              <div
                class="flex items-center gap-1.5"
                class:opacity-20={!syncStatus?.behind ||
                  syncStatus.behind === 0}
                title="Behind remote"
              >
                <Download size={12} />
                <span
                  class="text-[12px] font-mono font-bold"
                  class:text-[var(--warning)]={syncStatus?.behind &&
                    syncStatus.behind > 0}
                >
                  {syncStatus?.behind ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Auth Config (Hidden by default) -->
        {#if showSyncConfig}
          <div
            class="flex flex-col gap-3 p-3 bg-[var(--bg-canvas)] rounded-md border border-dashed border-[var(--line-soft)] animate-fade-in"
          >
            <div class="flex items-center gap-2 mb-1">
              <Lock size={10} class="opacity-40" />
              <span class="text-[10px] font-bold uppercase opacity-50"
                >Auth Settings</span
              >
            </div>

            <div class="gl-tabs-segmented">
              <button
                class:is-active={authMode === "https"}
                onclick={() => (authMode = "https")}>HTTPS</button
              >
              <button
                class:is-active={authMode === "ssh"}
                onclick={() => (authMode = "ssh")}>SSH</button
              >
            </div>

            <div class="flex flex-col gap-2">
              {#if authMode === "https"}
                <input
                  class="gl-input-clean-bordered"
                  bind:value={httpsUsername}
                  placeholder="Username"
                />
                <input
                  class="gl-input-clean-bordered"
                  bind:value={httpsPassword}
                  placeholder="Token / Pass"
                  type="password"
                />
              {:else}
                <input
                  class="gl-input-clean-bordered"
                  bind:value={sshKeyPath}
                  placeholder="Key Path (/Users/...)"
                />
                <input
                  class="gl-input-clean-bordered"
                  bind:value={sshPassphrase}
                  placeholder="Passphrase"
                  type="password"
                />
              {/if}
            </div>

            <div class="text-[10px] opacity-40 leading-tight">
              If GitHub OAuth is connected in Settings, GitLite auto-fills HTTPS
              auth for GitHub remotes. Manual credentials here always override.
            </div>
          </div>
        {/if}

        <!-- Sync Actions -->
        <div class="grid grid-cols-3 gap-2">
          <button
            class="gl-action-btn"
            onclick={runFetch}
            disabled={busy || !selectedRemote}
            data-testid="sync-fetch"
          >
            <RefreshCw size={12} class={busy ? "animate-spin" : ""} />
            <span>Fetch</span>
          </button>
          <button
            class="gl-action-btn"
            onclick={runPull}
            disabled={busy || !selectedRemote}
            data-testid="sync-pull"
          >
            <Download size={12} />
            <span>Pull</span>
          </button>
          <button
            class="gl-action-btn is-accent"
            onclick={runPush}
            disabled={busy || !selectedRemote}
            data-testid="sync-push"
          >
            <Upload size={12} />
            <span>Push</span>
          </button>
        </div>

        <!-- Manage Remotes Toggle -->
        <div class="mt-2 border-t border-[var(--line-soft)] pt-2">
          <button
            type="button"
            class="flex items-center justify-between w-full text-[10px] font-bold uppercase opacity-50 hover:opacity-100 transition-opacity pr-1 py-1"
            onclick={() => (showRemoteList = !showRemoteList)}
          >
            <span>Manage Remotes</span>
            {#if showRemoteList}
              <ChevronUp size={10} />
            {:else}
              <ChevronDown size={10} />
            {/if}
          </button>

          {#if showRemoteList}
            <div class="flex flex-col gap-2 mt-3 animate-fade-in px-1">
              {#each remotes as remote}
                <div
                  class="gl-remote-item-v3 group"
                  data-testid={`remote-row-${remote.name}`}
                >
                  <div class="flex-1 min-w-0">
                    {#if editingRemote === remote.name}
                      <div class="flex flex-col gap-2 p-1">
                        <div class="flex items-center gap-2">
                          <Share2 size={10} class="opacity-40" />
                          <span class="text-[11px] font-bold"
                            >{remote.name}</span
                          >
                        </div>
                        <div class="flex gap-2">
                          <input
                            class="gl-input-clean-bordered flex-1"
                            bind:value={editUrl}
                            placeholder="Remote URL"
                          />
                          <div class="flex gap-1">
                            <button
                              class="gl-icon-button p-1 text-[var(--success)]"
                              onclick={() => saveRemoteUrl(remote.name)}
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              class="gl-icon-button p-1"
                              onclick={cancelEditingRemote}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    {:else}
                      <div class="flex items-start justify-between">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <Share2 size={10} class="text-[var(--accent)]" />
                            <span class="text-[11px] font-bold truncate"
                              >{remote.name}</span
                            >
                            {#if remote.name === "origin"}
                              <span
                                class="text-[8px] bg-[var(--bg-active)] px-1 rounded opacity-50"
                                >DEFAULT</span
                              >
                            {/if}
                          </div>
                          <div
                            class="text-[9px] opacity-40 truncate font-mono mt-0.5 pl-4"
                          >
                            {remote.url ?? "no url"}
                          </div>
                        </div>
                        <div
                          class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <button
                            class="gl-icon-button p-1 hover:text-[var(--accent)]"
                            onclick={() => startEditingRemote(remote)}
                            title="Edit URL"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            class="gl-icon-button p-1 hover:text-[var(--error)]"
                            onclick={() => removeRemote(remote.name)}
                            title="Remove"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}

              <div class="gl-add-remote-box mt-2">
                <p
                  class="text-[9px] uppercase font-bold opacity-30 tracking-widest mb-2 px-1"
                >
                  Add New Remote
                </p>
                <div class="flex flex-col gap-2">
                  <div class="flex gap-2">
                    <input
                      class="gl-input-clean-bordered flex-[0.4]"
                      bind:value={nextRemoteName}
                      placeholder="Name (e.g. upstream)"
                    />
                    <input
                      class="gl-input-clean-bordered flex-1"
                      bind:value={nextRemoteUrl}
                      placeholder="Repository URL"
                    />
                  </div>
                  <button
                    class="gl-button w-full flex items-center justify-center gap-2 py-1.5"
                    onclick={addRemote}
                    disabled={busy ||
                      !nextRemoteName.trim() ||
                      !nextRemoteUrl.trim()}
                  >
                    <Plus size={14} />
                    <span>Add Remote</span>
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </div>
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: color-mix(in oklab, var(--bg-surface), transparent 40%);
  }

  .gl-file-list {
    display: flex;
    flex-direction: column;
  }

  .gl-file-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    transition: all var(--transition-fast);
    cursor: default;
    min-width: 0;
  }

  .gl-file-row:hover {
    background: var(--bg-hover);
  }

  .gl-status-tag {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .gl-status-tag.is-staged {
    background: color-mix(in oklab, var(--success), transparent 85%);
    color: var(--success);
    border: 1px solid color-mix(in oklab, var(--success), transparent 70%);
  }

  .gl-status-tag.is-unstaged {
    background: color-mix(in oklab, var(--accent), transparent 85%);
    color: var(--accent);
    border: 1px solid color-mix(in oklab, var(--accent), transparent 70%);
  }

  .gl-file-path {
    flex: 1;
    font-size: 12px;
    font-weight: 450;
    color: var(--text-normal);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.85;
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
  }

  .gl-badge {
    padding: 2px 6px;
    background: var(--bg-hover);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    font-family: var(--font-mono);
    opacity: 0.6;
  }

  .gl-input {
    background: var(--bg-canvas);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    color: var(--text-strong);
    width: 100%;
    outline: none;
    transition: all 0.2s;
  }

  .gl-input:focus {
    border-color: var(--accent);
    background: var(--bg-surface);
  }

  .gl-sync-summary {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    gap: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .gl-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 4px;
    background: var(--bg-surface);
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--text-soft);
    cursor: pointer;
    transition: all 0.2s;
  }

  .gl-action-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-strong);
    border-color: var(--line-medium);
    transform: translateY(-1px);
  }

  .gl-action-btn.is-accent:not(:disabled) {
    background: color-mix(in oklab, var(--accent), transparent 90%);
    color: var(--accent);
    border-color: color-mix(in oklab, var(--accent), transparent 70%);
  }

  .gl-action-btn.is-accent:hover:not(:disabled) {
    background: var(--accent);
    color: white;
    border-color: transparent;
  }

  .gl-tabs-segmented {
    display: flex;
    background: var(--bg-active);
    padding: 2px;
    border-radius: 6px;
    gap: 2px;
  }

  .gl-tabs-segmented button {
    flex: 1;
    padding: 4px;
    font-size: 10px;
    font-weight: 800;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-soft);
    cursor: pointer;
  }

  .gl-tabs-segmented button.is-active {
    background: var(--bg-surface);
    color: var(--text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .gl-input-clean-bordered {
    background: var(--bg-surface);
    border: 1px solid var(--line-soft);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    width: 100%;
    outline: none;
    color: var(--text-strong);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }

  .gl-remote-item-v3 {
    background: var(--bg-surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-md);
    padding: 10px;
    transition: all var(--transition-fast);
  }

  .gl-remote-item-v3:hover {
    border-color: var(--line-medium);
    box-shadow: var(--shadow-sm);
  }

  .gl-add-remote-box {
    background: var(--bg-active);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-md);
    padding: 12px;
  }

</style>
