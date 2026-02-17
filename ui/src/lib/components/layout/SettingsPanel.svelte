<script lang="ts">
  import {
    Github,
    LogOut,
    Globe,
    User,
    Palette,
    Settings,
    X,
    Save,
    GitGraph,
  } from "lucide-svelte";
  import type {
    GitHubUser,
    ThemeMode,
    CommitViewMode
  } from "../../types/ui";

  let {
    open = false,
    onClose,
    theme = "system",
    diffViewMode = "unified",
    commitViewMode = "flow",
    defaultRemote = "origin",
    gitUserName = "",
    gitUserEmail = "",
    canEditGit = false,
    githubUser = null,
    githubClientId = "",
    githubAuthPending = false,
    githubUserCode = "",
    githubVerificationUrl = "",
    updateChannel = "stable",
    autoUpdateCheck = true,
    onSetTheme,
    onSetDiffViewMode,
    onSetCommitViewMode,
    onSetDefaultRemote,
    onSetGitHubClientId,
    onSetUpdateChannel,
    onSetAutoUpdateCheck,
    onSaveGitUser,
    onGitHubLogin,
    onGitHubLogout,
    onOpenCommandSettings,
  }: {
    open: boolean;
    onClose: () => void;
    theme: ThemeMode;
    diffViewMode: "unified" | "split";
    commitViewMode: CommitViewMode;
    defaultRemote: string;
    gitUserName: string;
    gitUserEmail: string;
    canEditGit: boolean;
    githubUser: GitHubUser | null;
    githubClientId: string;
    githubAuthPending: boolean;
    githubUserCode: string;
    githubVerificationUrl: string;
    updateChannel: "stable" | "beta";
    autoUpdateCheck: boolean;
    onSetTheme: (mode: ThemeMode) => void;
    onSetDiffViewMode: (mode: "unified" | "split") => void;
    onSetCommitViewMode: (mode: CommitViewMode) => void;
    onSetDefaultRemote: (name: string) => void;
    onSetGitHubClientId: (clientId: string) => void;
    onSetUpdateChannel: (channel: "stable" | "beta") => Promise<void>;
    onSetAutoUpdateCheck: (enabled: boolean) => Promise<void>;
    onSaveGitUser: (name: string, email: string) => Promise<void>;
    onGitHubLogin: () => Promise<void>;
    onGitHubLogout: () => Promise<void> | void;
    onOpenCommandSettings: () => void;
  } = $props();

  let nameInput = $state("");
  let emailInput = $state("");
  let remoteInput = $state("");
  let githubClientIdInput = $state("");
  let savingGitUser = $state(false);

  $effect(() => {
    if (open) {
      nameInput = gitUserName;
      emailInput = gitUserEmail;
      remoteInput = defaultRemote;
      githubClientIdInput = githubClientId;
    }
  });

  async function saveGitUser() {
    if (!canEditGit) return;
    savingGitUser = true;
    try {
      await onSaveGitUser(nameInput.trim(), emailInput.trim());
    } finally {
      savingGitUser = false;
    }
  }

  function saveDefaultRemote() {
    const normalized = remoteInput.trim();
    if (!normalized) return;
    onSetDefaultRemote(normalized);
  }

  function saveGitHubClientId() {
    onSetGitHubClientId(githubClientIdInput.trim());
  }
</script>

{#if open}
  <button
    type="button"
    class="gl-settings-backdrop"
    onclick={onClose}
    data-testid="settings-backdrop"
    aria-label="Close settings"
  ></button>
  <div
    class="gl-settings-panel"
    data-testid="settings-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-panel-title"
  >
    <div class="gl-settings-head">
      <div class="flex items-center gap-2">
        <Settings size={18} class="text-[var(--accent)]" />
        <h2 id="settings-panel-title" class="gl-text-strong">Settings</h2>
      </div>
      <button
        type="button"
        class="gl-icon-button p-1"
        onclick={onClose}
        data-testid="settings-close"
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>

    <div class="gl-settings-scroll-container">
      <!-- Accounts Section -->
      <section class="gl-settings-section mb-6">
        <div class="flex items-center gap-2 mb-3">
          <Globe size={14} class="opacity-40" />
          <p class="gl-text-soft text-[11px] uppercase tracking-wide font-bold">
            Accounts
          </p>
        </div>
        <div class="gl-account-card">
          <div class="gl-input-group mb-3">
            <span class="gl-input-label">GitHub OAuth Client ID</span>
            <div class="flex gap-2">
              <input
                class="gl-input flex-1"
                bind:value={githubClientIdInput}
                placeholder="Iv1...."
                data-testid="settings-github-client-id"
                aria-label="GitHub OAuth Client ID"
              />
              <button
                type="button"
                class="gl-button py-1 px-3"
                onclick={saveGitHubClientId}
                data-testid="settings-github-client-id-save"
                title="Save Client ID"
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          {#if githubAuthPending}
            <div
              class="mb-3 rounded border border-[var(--line-soft)] bg-[var(--bg-canvas)] p-2.5"
              data-testid="github-oauth-pending"
            >
              <p class="text-[11px] font-semibold">Authorizing with GitHub...</p>
              {#if githubUserCode}
                <p class="mt-1 text-[10px] gl-text-soft">
                  Verification code:
                  <span class="font-mono text-[var(--text-strong)]"
                    >{githubUserCode}</span
                  >
                </p>
              {/if}
              {#if githubVerificationUrl}
                <p class="mt-1 text-[10px] gl-text-soft break-all">
                  {githubVerificationUrl}
                </p>
              {/if}
            </div>
          {/if}

          {#if githubUser}
            <div class="flex items-center gap-3">
              <img
                src={githubUser.avatar_url}
                alt={githubUser.login}
                class="w-8 h-8 rounded-full border border-[var(--line-soft)]"
              />
              <div class="flex-1 min-width-0">
                <p class="text-[13px] font-semibold truncate">
                  {githubUser.name || githubUser.login}
                </p>
                <p class="text-[11px] gl-text-soft truncate">
                  github.com/{githubUser.login}
                </p>
              </div>
              <button
                type="button"
                class="gl-icon-button hover:text-[var(--error)]"
                onclick={onGitHubLogout}
                title="Logout from GitHub"
              >
                <LogOut size={16} />
              </button>
            </div>
          {:else}
            <button
              type="button"
              class="gl-button w-full flex items-center justify-center gap-2 py-2"
              onclick={onGitHubLogin}
              disabled={githubAuthPending}
              data-testid="github-connect-button"
            >
              <Github size={16} />
              {githubAuthPending ? "Connecting..." : "Connect GitHub"}
            </button>
          {/if}
        </div>
      </section>

      <div class="gl-settings-divider"></div>
      <section class="gl-settings-section">
        <div class="flex items-center gap-2 mb-3">
          <Palette size={14} class="opacity-40" />
          <p class="gl-text-soft text-[11px] uppercase tracking-wide font-bold">
            Appearance
          </p>
        </div>

        <div class="gl-settings-item">
          <span class="text-[12px] gl-text-soft">Theme</span>
          <div class="gl-theme-toggle" data-testid="theme-toggle">
            <button
              type="button"
              class:is-active={theme === "dark"}
              onclick={() => onSetTheme("dark")}
              data-testid="theme-dark"
            >
              Dark
            </button>
            <button
              type="button"
              class:is-active={theme === "light"}
              onclick={() => onSetTheme("light")}
              data-testid="theme-light"
            >
              Light
            </button>
            <button
              type="button"
              class:is-active={theme === "system"}
              onclick={() => onSetTheme("system")}
              data-testid="theme-system"
            >
              System
            </button>
          </div>
        </div>

        <div class="gl-settings-item mt-4">
          <span class="text-[12px] gl-text-soft">Diff View</span>
          <div class="gl-theme-toggle" data-testid="settings-diff-mode">
            <button
              type="button"
              class:is-active={diffViewMode === "unified"}
              onclick={() => onSetDiffViewMode("unified")}
              data-testid="settings-diff-unified"
            >
              Unified
            </button>
            <button
              type="button"
              class:is-active={diffViewMode === "split"}
              onclick={() => onSetDiffViewMode("split")}
              data-testid="settings-diff-split"
            >
              Split
            </button>
          </div>
        </div>

        <div class="gl-settings-item mt-4">
          <span class="text-[12px] gl-text-soft">Commit View</span>
          <div class="gl-theme-toggle" data-testid="settings-commit-view-mode">
            <button
              type="button"
              class:is-active={commitViewMode === "graph"}
              onclick={() => onSetCommitViewMode("graph")}
              data-testid="settings-commit-view-graph"
            >
              Graph
            </button>
            <button
              type="button"
              class:is-active={commitViewMode === "flow"}
              onclick={() => onSetCommitViewMode("flow")}
              data-testid="settings-commit-view-flow"
            >
              Flow
            </button>
          </div>
        </div>
      </section>

      <div class="gl-settings-divider"></div>

      <section class="gl-settings-section">
        <div class="flex items-center gap-2 mb-3">
          <Settings size={14} class="opacity-40" />
          <p class="gl-text-soft text-[11px] uppercase tracking-wide font-bold">
            Updates
          </p>
        </div>

        <div class="gl-settings-item">
          <span class="text-[12px] gl-text-soft">Release Channel</span>
          <div class="gl-theme-toggle" data-testid="settings-update-channel">
            <button
              type="button"
              class:is-active={updateChannel === "stable"}
              onclick={() => void onSetUpdateChannel("stable")}
              data-testid="settings-channel-stable"
            >
              Stable
            </button>
            <button
              type="button"
              class:is-active={updateChannel === "beta"}
              onclick={() => void onSetUpdateChannel("beta")}
              data-testid="settings-channel-beta"
            >
              Beta
            </button>
          </div>
        </div>

        <label
          class="mt-4 flex items-center justify-between gap-3 text-[12px] gl-text-soft"
          data-testid="settings-auto-update-check"
        >
          <span>Check for updates on launch</span>
          <input
            type="checkbox"
            checked={autoUpdateCheck}
            onchange={(event) =>
              void onSetAutoUpdateCheck(
                (event.currentTarget as HTMLInputElement).checked,
              )}
          />
        </label>
      </section>

      <div class="gl-settings-divider"></div>

      <section class="gl-settings-section">
        <div class="flex items-center gap-2 mb-3">
          <User size={14} class="opacity-40" />
          <p class="gl-text-soft text-[11px] uppercase tracking-wide font-bold">
            Git Configuration
          </p>
        </div>

        <div class="grid gap-3">
          <div class="gl-input-group">
            <span class="gl-input-label">Default Remote</span>
            <div class="flex gap-2">
              <input
                class="gl-input flex-1"
                bind:value={remoteInput}
                placeholder="origin"
                data-testid="settings-default-remote"
                aria-label="Default remote"
              />
              <button
                type="button"
                class="gl-button py-1 px-3"
                onclick={saveDefaultRemote}
                data-testid="settings-default-remote-save"
                title="Save Remote"
              >
                <Save size={14} />
              </button>
            </div>
          </div>

          <div class="gl-input-group">
            <span class="gl-input-label">User Identity</span>
            <div class="grid gap-2">
              <input
                class="gl-input"
                bind:value={nameInput}
                placeholder="user.name"
                disabled={!canEditGit}
                data-testid="settings-git-name"
                aria-label="Git user name"
              />
              <input
                class="gl-input"
                bind:value={emailInput}
                placeholder="user.email"
                disabled={!canEditGit}
                data-testid="settings-git-email"
                aria-label="Git user email"
              />
              <button
                type="button"
                class="gl-button w-full flex items-center justify-center gap-2 py-2"
                onclick={saveGitUser}
                disabled={!canEditGit || savingGitUser}
                data-testid="settings-git-save"
              >
                {savingGitUser ? "Saving..." : "Save Identity"}
              </button>
            </div>
            {#if !canEditGit}
              <p class="text-[10px] gl-text-soft italic mt-1 leading-relaxed">
                Open a git repository to modify local identity.
              </p>
            {/if}
          </div>
        </div>
      </section>

      <div class="gl-settings-divider"></div>

      <section class="gl-settings-section">
        <div class="flex items-center gap-2 mb-3">
          <GitGraph size={14} class="opacity-40" />
          <p class="gl-text-soft text-[11px] uppercase tracking-wide font-bold">
            Keyboard Shortcuts
          </p>
        </div>
        <div class="rounded border border-[var(--line-soft)] bg-[var(--bg-canvas)] p-3">
          <p class="text-[11px] gl-text-soft leading-relaxed">
            Shortcuts are managed in a dedicated command settings modal.
          </p>
          <button
            type="button"
            class="gl-button w-full mt-3 justify-center"
            onclick={onOpenCommandSettings}
            data-testid="open-command-settings"
          >
            Customize Shortcuts
          </button>
        </div>
      </section>
    </div>
  </div>
{/if}

<style>
  .gl-settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    z-index: 40;
    border: none;
    backdrop-filter: blur(4px);
    cursor: default;
  }

  .gl-settings-panel {
    position: fixed;
    top: 60px;
    right: 24px;
    width: 320px;
    max-height: calc(100vh - 100px);
    background: var(--bg-surface);
    border: 1px solid var(--line-medium);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    z-index: 100;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .gl-settings-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: color-mix(in oklab, var(--bg-surface), transparent 50%);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line-soft);
    z-index: 2;
  }

  .gl-settings-head h2 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }

  .gl-settings-scroll-container {
    overflow-y: auto;
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .gl-settings-section {
    display: flex;
    flex-direction: column;
  }

  .gl-settings-divider {
    height: 1px;
    background: var(--line-soft);
    margin: 20px 0;
  }

  /* Account Card */
  .gl-account-card {
    background: color-mix(in oklab, var(--bg-hover), transparent 30%);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-md);
    padding: 16px;
    transition: all var(--transition-fast);
  }

  .gl-account-card:hover {
    background: var(--bg-hover);
    border-color: var(--line-medium);
  }

  .gl-settings-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .gl-theme-toggle {
    display: inline-flex;
    background: var(--bg-canvas);
    padding: 2px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-soft);
  }

  .gl-theme-toggle button {
    border: none;
    background: transparent;
    color: var(--text-soft);
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border-radius: calc(var(--radius-sm) - 2px);
    transition: all var(--transition-fast);
  }

  .gl-theme-toggle button:hover {
    color: var(--text-strong);
  }

  .gl-theme-toggle button.is-active {
    background: var(--bg-active);
    color: var(--text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  /* Input Groups */
  .gl-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .gl-input-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-soft);
    padding-left: 2px;
  }

  .gl-input {
    width: 100%;
    background: var(--bg-canvas);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    color: var(--text-strong);
    font-size: 12px;
    outline: none;
    transition: all var(--transition-fast);
  }

  .gl-input:focus {
    border-color: var(--accent);
    background: var(--bg-surface);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent), transparent 90%);
  }

  .gl-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--bg-hover);
  }

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

</style>
