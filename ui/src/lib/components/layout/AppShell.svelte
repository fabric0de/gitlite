<script lang="ts">
  import { onMount } from "svelte";
  import { PanelLeftOpen, PanelLeftClose } from "lucide-svelte";
  import SidebarPane from "./SidebarPane.svelte";
  import TopChrome from "./TopChrome.svelte";
  import SettingsPanel from "./SettingsPanel.svelte";
  import CommandSettingsModal from "./CommandSettingsModal.svelte";
  import CommitTable from "../commits/CommitTable.svelte";
  import DiffTextView from "../diff/DiffTextView.svelte";
  import ToastContainer from "../notifications/ToastContainer.svelte";
  import { uiState } from "../../stores/ui";
  import type { SidebarTab } from "../../types/ui";

  type LayoutMode = "wide" | "medium" | "narrow";
  type MainPanel = "commit" | "diff";

  const SIDEBAR_MIN = 240;
  const SIDEBAR_MAX = 460;
  const COMMIT_MIN = 320;
  const COMMIT_MAX = 980;
  const DIFF_MIN_WIDE = 280;
  const DIFF_MIN_MEDIUM = 300;
  const RESIZER_WIDTH = 10; // Match CSS

  let settingsOpen = $state(false);
  let commandSettingsOpen = $state(false);
  let layoutMode = $state<LayoutMode>("wide");
  let mainPanel = $state<MainPanel>("commit");
  let wideSidebarCollapsed = $state(false);
  let compactSidebarOpen = $state(false);
  let sidebarWidth = $state(280); // Slightly narrower default
  let commitWidth = $state(460); // Commit panel can now expand significantly wider
  let resizing = $state<"sidebar" | "commit" | null>(null);
  let mainGrid = $state<HTMLElement | null>(null);

  const repository = $derived(uiState.repository);
  const activeTab = $derived(uiState.activeTab);
  const branches = $derived(uiState.branches);
  const changes = $derived(uiState.changes);
  const stashes = $derived(uiState.stashes);
  const remotes = $derived(uiState.remotes);
  const selectedRemote = $derived(uiState.selectedRemote);
  const defaultRemote = $derived(uiState.defaultRemote);
  const syncStatus = $derived(uiState.syncStatus);
  const commits = $derived(uiState.commits);
  const selectedCommitHash = $derived(uiState.selectedCommitHash);
  const localBranchNames = $derived(uiState.localBranchNames);
  const commitBranchFilter = $derived(uiState.commitBranchFilter);
  const selectedCommit = $derived(uiState.selectedCommit);
  const selectedDiff = $derived(uiState.selectedDiff);
  const projectTabs = $derived(uiState.projectTabs);
  const activeProjectPath = $derived(uiState.activeProjectPath);
  const notice = $derived(uiState.notice);
  const themeMode = $derived(uiState.theme);
  const diffViewMode = $derived(uiState.diffViewMode);
  const gitUserConfig = $derived(uiState.gitUserConfig);
  const toasts = $derived(uiState.toasts);
  const githubUser = $derived(uiState.githubUser);
  const githubClientId = $derived(uiState.githubClientId);
  const githubAuthPending = $derived(uiState.githubAuthPending);
  const githubUserCode = $derived(uiState.githubUserCode);
  const githubVerificationUrl = $derived(uiState.githubVerificationUrl);
  const updateChannel = $derived(uiState.updateChannel);
  const autoUpdateCheck = $derived(uiState.autoUpdateCheck);
  const commitViewMode = $derived(uiState.commitViewMode);
  const commandShortcuts = $derived(uiState.commandShortcuts);

  const hasRepository = $derived(!!repository?.path);
  const hasGitRepository = $derived(!!repository?.isGitRepository);
  const sidebarInlineVisible = $derived(
    layoutMode === "wide" && !wideSidebarCollapsed,
  );
  const showCommitPanel = $derived(
    layoutMode !== "narrow" || mainPanel === "commit",
  );
  const showDiffPanel = $derived(
    layoutMode !== "narrow" || mainPanel === "diff",
  );

  onMount(() => {
    if (typeof window === "undefined") return;
    updateLayoutMode(window.innerWidth);
  });

  function onSelectTab(tab: SidebarTab) {
    uiState.switchTab(tab);
    if (layoutMode !== "wide") {
      compactSidebarOpen = false;
    }
  }

  function startResize(kind: "sidebar" | "commit", event: MouseEvent) {
    event.preventDefault();
    if (kind === "sidebar" && !sidebarInlineVisible) return;
    if (kind === "commit" && layoutMode === "narrow") return;
    resizing = kind;
  }

  function startSidebarResize(event: MouseEvent) {
    startResize("sidebar", event);
  }

  function startCommitResize(event: MouseEvent) {
    startResize("commit", event);
  }

  function stopResize() {
    resizing = null;
  }

  function updateLayoutMode(width: number) {
    if (width >= 1260) {
      layoutMode = "wide";
      compactSidebarOpen = false;
      return;
    }
    if (width >= 1000) {
      layoutMode = "medium";
      compactSidebarOpen = false;
      return;
    }
    layoutMode = "narrow";
    compactSidebarOpen = false;
  }

  function onPointerMove(event: MouseEvent) {
    if (!resizing || !mainGrid) return;
    const rect = mainGrid.getBoundingClientRect();
    const x = event.clientX - rect.left;

    if (resizing === "sidebar") {
      sidebarWidth = Math.max(
        SIDEBAR_MIN,
        Math.min(SIDEBAR_MAX, Math.round(x)),
      );
      return;
    }

    const sidebarOffset = sidebarInlineVisible
      ? sidebarWidth + RESIZER_WIDTH
      : 0;
    const commitColumn = Math.round(x - sidebarOffset);
    const diffMin = layoutMode === "medium" ? DIFF_MIN_MEDIUM : DIFF_MIN_WIDE;
    const dynamicMax = Math.max(
      COMMIT_MIN,
      rect.width - sidebarOffset - RESIZER_WIDTH - diffMin,
    );
    const commitMax = Math.min(COMMIT_MAX, Math.floor(dynamicMax));
    commitWidth = Math.max(COMMIT_MIN, Math.min(commitMax, commitColumn));
  }

  function collapseSidebar() {
    if (layoutMode === "wide") {
      wideSidebarCollapsed = true;
      return;
    }
    compactSidebarOpen = false;
  }

  function expandSidebar() {
    if (layoutMode === "wide") {
      wideSidebarCollapsed = false;
      return;
    }
    compactSidebarOpen = true;
  }

  function toggleCompactSidebar() {
    compactSidebarOpen = !compactSidebarOpen;
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (isTypingContext(event.target)) {
      if (event.key === "Escape" && (settingsOpen || commandSettingsOpen)) {
        commandSettingsOpen = false;
        settingsOpen = false;
      }
      return;
    }

    if (commandSettingsOpen) {
      if (event.key === "Escape") {
        commandSettingsOpen = false;
      }
      return;
    }

    if (handleShortcut(event)) {
      return;
    }

    if (event.key !== "Escape") return;
    if (commandSettingsOpen) {
      commandSettingsOpen = false;
      return;
    }
    if (settingsOpen) {
      settingsOpen = false;
      return;
    }
    if (compactSidebarOpen) {
      compactSidebarOpen = false;
    }
  }

  async function openSettings() {
    await uiState.loadGitUserConfig();
    settingsOpen = true;
  }

  function openCommandSettings() {
    settingsOpen = false;
    commandSettingsOpen = true;
  }

  function isTypingContext(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return (
      target.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select"
    );
  }

  async function cycleProjectTabs(direction: 1 | -1) {
    if (projectTabs.length < 2 || !activeProjectPath) return;
    const currentIndex = projectTabs.findIndex(
      (tab) => tab.path === activeProjectPath,
    );
    if (currentIndex < 0) return;
    const nextIndex =
      (currentIndex + direction + projectTabs.length) % projectTabs.length;
    const target = projectTabs[nextIndex];
    if (target) {
      await uiState.switchProjectTab(target.path);
    }
  }

  function normalizeShortcutToken(token: string): string {
    return token
      .trim()
      .toLowerCase()
      .replace(/command/g, "cmd")
      .replace(/control/g, "ctrl")
      .replace(/option/g, "alt")
      .replace(/escape/g, "esc");
  }

  function normalizeEventKey(key: string): string {
    const lowered = key.toLowerCase();
    if (lowered === "escape") return "esc";
    if (lowered === " ") return "space";
    return lowered;
  }

  function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.split("+").map(normalizeShortcutToken).filter(Boolean);
    if (parts.length === 0) return false;

    let needShift = false;
    let needAlt = false;
    let needCtrl = false;
    let needCmd = false;
    let needCmdOrCtrl = false;
    let keyToken = "";

    for (const part of parts) {
      if (part === "shift") {
        needShift = true;
      } else if (part === "alt") {
        needAlt = true;
      } else if (part === "ctrl") {
        needCtrl = true;
      } else if (part === "cmd" || part === "meta") {
        needCmd = true;
      } else if (part === "cmdorctrl") {
        needCmdOrCtrl = true;
      } else if (part === "comma") {
        keyToken = ",";
      } else {
        keyToken = part;
      }
    }

    if (needShift !== event.shiftKey) return false;
    if (needAlt !== event.altKey) return false;
    if (needCtrl && !event.ctrlKey) return false;
    if (needCmd && !event.metaKey) return false;
    if (needCmdOrCtrl && !(event.metaKey || event.ctrlKey)) return false;
    if (!needCtrl && !needCmdOrCtrl && event.ctrlKey) return false;
    if (!needCmd && !needCmdOrCtrl && event.metaKey) return false;

    if (!keyToken) return false;
    return normalizeEventKey(event.key) === keyToken;
  }

  function handleShortcut(event: KeyboardEvent): boolean {
    if (matchesShortcut(event, commandShortcuts.next_project)) {
      event.preventDefault();
      void cycleProjectTabs(1);
      return true;
    }
    if (matchesShortcut(event, commandShortcuts.prev_project)) {
      event.preventDefault();
      void cycleProjectTabs(-1);
      return true;
    }
    if (matchesShortcut(event, commandShortcuts.open_settings)) {
      event.preventDefault();
      void openSettings();
      return true;
    }
    if (matchesShortcut(event, commandShortcuts.open_project)) {
      event.preventDefault();
      void uiState.openRepositoryPicker();
      return true;
    }
    if (
      activeProjectPath &&
      matchesShortcut(event, commandShortcuts.close_project)
    ) {
      event.preventDefault();
      void uiState.closeProjectTab(activeProjectPath);
      return true;
    }
    if (matchesShortcut(event, commandShortcuts.switch_branches)) {
      event.preventDefault();
      onSelectTab("branches");
      return true;
    }
    if (matchesShortcut(event, commandShortcuts.switch_changes)) {
      event.preventDefault();
      onSelectTab("changes");
      return true;
    }
    if (matchesShortcut(event, commandShortcuts.switch_stash)) {
      event.preventDefault();
      onSelectTab("stash");
      return true;
    }

    return false;
  }

  $effect(() => {
    if (notice) {
      if (notice.startsWith("E_") || notice.toLowerCase().includes("error")) {
        uiState.addToast(notice, "error");
      } else {
        uiState.addToast(notice, "info");
      }
      uiState.notice = ""; // Clear after toast is added
    }
  });
</script>

<svelte:window
  onmousemove={onPointerMove}
  onmouseup={stopResize}
  onkeydown={onWindowKeydown}
  onresize={(event) =>
    updateLayoutMode((event.currentTarget as Window).innerWidth)}
/>

<div class="gl-app" data-testid="app-shell">
  <div class="gl-main-scroll" data-testid="main-scroll">
    {#if !hasRepository}
      <section class="gl-workspace-empty" data-testid="workspace-empty">
        <div class="gl-empty-card">
          <p class="gl-empty-eyebrow">Workspace</p>
          <h1 class="gl-empty-title">Open a repository to start</h1>
          <p class="gl-empty-desc">
            Use the button below or the <span class="gl-code">+</span> tab in the
            top bar to add another project.
          </p>
          <button
            type="button"
            class="gl-button is-primary"
            onclick={() => uiState.openRepositoryPicker()}
            data-testid="empty-open-project"
          >
            Open Project
          </button>
        </div>
      </section>
    {:else}
      <section class="gl-workspace-open" data-testid="workspace-open">
        <TopChrome
          repositoryName={repository?.name ?? "GitLite"}
          repositoryPath={repository?.path ?? ""}
          {activeProjectPath}
          bind:projectTabs={uiState.projectTabs}
          onOpenRepository={() => uiState.openRepositoryPicker()}
          onSwitchProject={(path) => uiState.switchProjectTab(path)}
          onCloseProject={(path) => uiState.closeProjectTab(path)}
          onReorderProjects={(tabs) => uiState.reorderProjectTabs(tabs)}
          onToggleSettings={() => void openSettings()}
        />

        {#if hasGitRepository}
          <main
            bind:this={mainGrid}
            class="gl-main-grid"
            class:is-resizing={!!resizing}
            class:is-mode-wide={layoutMode === "wide"}
            class:is-mode-medium={layoutMode === "medium"}
            class:is-mode-narrow={layoutMode === "narrow"}
            class:is-sidebar-collapsed={!sidebarInlineVisible}
            data-testid="main-grid"
            style={`--sidebar-width:${sidebarInlineVisible ? sidebarWidth : 0}px; --sidebar-resizer-width:${
              sidebarInlineVisible ? RESIZER_WIDTH : 0
            }px; --commit-width:${commitWidth}px;`}
          >
            {#if sidebarInlineVisible}
              <section class="gl-sidebar-column">
                <SidebarPane
                  {activeTab}
                  {branches}
                  {changes}
                  {stashes}
                  {remotes}
                  {selectedRemote}
                  {defaultRemote}
                  {syncStatus}
                  {onSelectTab}
                  onToggleCollapse={collapseSidebar}
                  onStagePath={(path) => uiState.stagePath(path)}
                  onUnstagePath={(path) => uiState.unstagePath(path)}
                  onCommit={(message, description) =>
                    uiState.commit(message, description)}
                  onSetSelectedRemote={(name) =>
                    uiState.setSelectedRemote(name)}
                  onSetDefaultRemote={(name) => uiState.setDefaultRemote(name)}
                  onFetchRemote={(auth) => uiState.fetchRemote(auth)}
                  onPullRemote={(auth) => uiState.pullRemote(auth)}
                  onPushRemote={(auth) => uiState.pushRemote(auth)}
                  onFetchSsh={(auth) => uiState.fetchSsh(auth)}
                  onPullSsh={(auth) => uiState.pullSsh(auth)}
                  onPushSsh={(auth) => uiState.pushSsh(auth)}
                  onAddRemote={(name, url) => uiState.addRemote(name, url)}
                  onRenameRemote={(oldName, newName) =>
                    uiState.renameRemote(oldName, newName)}
                  onSetRemoteUrl={(name, url) =>
                    uiState.setRemoteUrl(name, url)}
                  onRemoveRemote={(name) => uiState.removeRemote(name)}
                  onCreateStash={(message) => uiState.createStash(message)}
                  onApplyStash={(index) => uiState.applyStash(index)}
                  onDropStash={(index) => uiState.dropStash(index)}
                  onCreateBranch={(name) => uiState.createBranch(name)}
                  onCheckoutBranch={(name) => uiState.checkoutBranch(name)}
                  onDeleteBranch={(name) => uiState.deleteBranch(name)}
                />
              </section>

              <button
                type="button"
                class="gl-resizer"
                onmousedown={startSidebarResize}
                data-testid="sidebar-resizer"
                aria-label="Resize sidebar"
              ></button>
            {/if}

            {#if layoutMode === "narrow"}
              <div class="gl-main-segment" data-testid="narrow-main-toggle">
                <button
                  type="button"
                  class:is-active={mainPanel === "commit"}
                  onclick={() => (mainPanel = "commit")}
                  data-testid="main-toggle-commit"
                >
                  Commits
                </button>
                <button
                  type="button"
                  class:is-active={mainPanel === "diff"}
                  onclick={() => (mainPanel = "diff")}
                  data-testid="main-toggle-diff"
                >
                  Diff
                </button>
              </div>
            {/if}

            {#if showCommitPanel}
              <CommitTable
                {commits}
                {branches}
                selectedHash={selectedCommitHash}
                branchFilters={localBranchNames}
                activeBranchFilter={commitBranchFilter}
                onChangeBranchFilter={(filter) =>
                  uiState.setCommitBranchFilter(filter)}
                onSelect={(hash) => uiState.selectCommit(hash)}
                onCherryPick={(hash) => uiState.cherryPickCommit(hash)}
                onReset={(hash, mode) => uiState.resetCurrentBranch(hash, mode)}
                onCreateBranch={(hash, name) =>
                  uiState.createBranchFromCommit(hash, name)}
                onCheckoutCommit={(hash) => uiState.checkoutCommit(hash)}
                onRevert={(hash) => uiState.revertCommit(hash)}
                viewMode={commitViewMode}
                onSetViewMode={(mode) => uiState.setCommitViewMode(mode)}
              />
            {/if}

            {#if layoutMode !== "narrow"}
              <button
                type="button"
                class="gl-resizer"
                onmousedown={startCommitResize}
                data-testid="commit-resizer"
                aria-label="Resize commit panel"
              ></button>
            {/if}

            {#if showDiffPanel}
              <DiffTextView commit={selectedCommit} files={selectedDiff} />
            {/if}
          </main>

          {#if layoutMode === "wide" && wideSidebarCollapsed}
            <button
              type="button"
              class="gl-sidebar-expand-fab"
              onclick={expandSidebar}
              data-testid="sidebar-expand"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          {/if}

          {#if layoutMode !== "wide"}
            <button
              type="button"
              class="gl-sidebar-expand-fab is-compact"
              class:is-active={compactSidebarOpen}
              onclick={toggleCompactSidebar}
              data-testid="sidebar-overlay-toggle"
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              {#if compactSidebarOpen}
                <PanelLeftClose size={16} />
              {:else}
                <PanelLeftOpen size={16} />
              {/if}
            </button>
          {/if}

          {#if layoutMode !== "wide" && compactSidebarOpen}
            <button
              type="button"
              class="gl-sidebar-overlay-backdrop"
              aria-label="Close sidebar"
              onclick={() => (compactSidebarOpen = false)}
              data-testid="sidebar-overlay-backdrop"
            ></button>
            <aside class="gl-sidebar-overlay" data-testid="sidebar-overlay">
              <SidebarPane
                {activeTab}
                {branches}
                {changes}
                {stashes}
                {remotes}
                {selectedRemote}
                {defaultRemote}
                {syncStatus}
                {onSelectTab}
                onToggleCollapse={collapseSidebar}
                onStagePath={(path) => uiState.stagePath(path)}
                onUnstagePath={(path) => uiState.unstagePath(path)}
                onCommit={(message, description) =>
                  uiState.commit(message, description)}
                onSetSelectedRemote={(name) => uiState.setSelectedRemote(name)}
                onSetDefaultRemote={(name) => uiState.setDefaultRemote(name)}
                onFetchRemote={(auth) => uiState.fetchRemote(auth)}
                onPullRemote={(auth) => uiState.pullRemote(auth)}
                onPushRemote={(auth) => uiState.pushRemote(auth)}
                onFetchSsh={(auth) => uiState.fetchSsh(auth)}
                onPullSsh={(auth) => uiState.pullSsh(auth)}
                onPushSsh={(auth) => uiState.pushSsh(auth)}
                onAddRemote={(name, url) => uiState.addRemote(name, url)}
                onRenameRemote={(oldName, newName) =>
                  uiState.renameRemote(oldName, newName)}
                onSetRemoteUrl={(name, url) => uiState.setRemoteUrl(name, url)}
                onRemoveRemote={(name) => uiState.removeRemote(name)}
                onCreateStash={(message) => uiState.createStash(message)}
                onApplyStash={(index) => uiState.applyStash(index)}
                onDropStash={(index) => uiState.dropStash(index)}
                onCreateBranch={(name) => uiState.createBranch(name)}
                onCheckoutBranch={(name) => uiState.checkoutBranch(name)}
                onDeleteBranch={(name) => uiState.deleteBranch(name)}
              />
            </aside>
          {/if}
        {:else}
          <section
            class="gl-workspace-empty gl-inline-empty"
            data-testid="workspace-not-git"
          >
            <div class="gl-empty-card">
              <p class="gl-empty-eyebrow">Repository</p>
              <h2 class="gl-empty-title">
                This folder is not a Git repository
              </h2>
              <p class="gl-empty-desc">
                Initialize this folder with Git or open another project.
              </p>
              <div class="gl-empty-actions">
                <button
                  type="button"
                  class="gl-button is-primary"
                  onclick={() => uiState.initRepositoryForCurrentPath()}
                  data-testid="init-git-button"
                >
                  Initialize Git
                </button>
                <button
                  type="button"
                  class="gl-button"
                  onclick={() => uiState.openRepositoryPicker()}
                  data-testid="open-other-project"
                >
                  Open Other Project
                </button>
              </div>
            </div>
          </section>
        {/if}
      </section>

      <SettingsPanel
        open={settingsOpen}
        theme={themeMode}
        {diffViewMode}
        {commitViewMode}
        {defaultRemote}
        gitUserName={gitUserConfig.name ?? ""}
        gitUserEmail={gitUserConfig.email ?? ""}
        canEditGit={hasGitRepository}
        {githubUser}
        {githubClientId}
        {githubAuthPending}
        {githubUserCode}
        {githubVerificationUrl}
        {updateChannel}
        {autoUpdateCheck}
        onSetTheme={(mode) => uiState.setTheme(mode)}
        onSetDiffViewMode={(mode) => uiState.setDiffViewMode(mode)}
        onSetCommitViewMode={(mode) => uiState.setCommitViewMode(mode)}
        onSetDefaultRemote={(name) => uiState.setDefaultRemote(name)}
        onSetGitHubClientId={(clientId) => uiState.setGitHubClientId(clientId)}
        onSetUpdateChannel={(channel) => uiState.setUpdateChannel(channel)}
        onSetAutoUpdateCheck={(enabled) => uiState.setAutoUpdateCheck(enabled)}
        onSaveGitUser={(name, email) => uiState.saveGitUserConfig(name, email)}
        onGitHubLogin={() => uiState.loginWithGitHub()}
        onGitHubLogout={() => void uiState.logoutGitHub()}
        onOpenCommandSettings={openCommandSettings}
        onClose={() => (settingsOpen = false)}
      />

      <CommandSettingsModal
        open={commandSettingsOpen}
        shortcuts={commandShortcuts}
        onSave={(shortcuts) => uiState.saveCommandShortcuts(shortcuts)}
        onReset={() => uiState.resetCommandShortcuts()}
        onClose={() => (commandSettingsOpen = false)}
      />
    {/if}
  </div>
</div>

<ToastContainer {toasts} onRemoveToast={(id) => uiState.removeToast(id)} />
