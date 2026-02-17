import { createGitProvider } from '../services/providerFactory';
import { isTauriRuntime, tauriInvoke } from '../services/tauriBridge';
import type {
  BranchInfo,
  ChangeItem,
  CommitSummary,
  DiffFile,
  GitUserConfig,
  HttpsAuthInput,
  RemoteInfo,
  RepositoryMeta,
  SshAuthInput,
  StashEntry,
  SyncStatus
} from '../types/git';
import type {
  GitHubUser,
  ProjectTab,
  SidebarTab,
  ThemeMode,
  Toast,
  CommitViewMode,
  ShortcutMap
} from '../types/ui';

const THEME_KEY = 'gitlite.theme';
const PROJECT_TABS_KEY = 'gitlite.projectTabs';
const ACTIVE_PROJECT_KEY = 'gitlite.activeProject';
const DIFF_VIEW_MODE_KEY = 'gitlite.diffViewMode';
const DEFAULT_REMOTE_KEY = 'gitlite.defaultRemote';
const GITHUB_TOKEN_KEY = 'gitlite.githubToken';
const GITHUB_USER_KEY = 'gitlite.githubUser';
const GITHUB_CLIENT_ID_KEY = 'gitlite.githubClientId';
const COMMIT_VIEW_MODE_KEY = 'gitlite.commitViewMode';
const SHORTCUTS_KEY = 'gitlite.shortcuts';

const DEFAULT_SHORTCUTS: ShortcutMap = {
  open_project: 'CmdOrCtrl+T',
  close_project: 'CmdOrCtrl+W',
  next_project: 'Ctrl+Tab',
  prev_project: 'Ctrl+Shift+Tab',
  open_settings: 'CmdOrCtrl+,',
  switch_branches: 'CmdOrCtrl+1',
  switch_changes: 'CmdOrCtrl+2',
  switch_stash: 'CmdOrCtrl+3'
};

interface AppSettingsPayload {
  theme: string;
  git_user_name: string | null;
  git_user_email: string | null;
  diff_context_lines: number;
  default_remote: string;
  font_size: number;
  tab_size: number;
  show_line_numbers: boolean;
  auto_fetch: boolean;
  max_recent_repos: number;
  keyboard_shortcuts: Record<string, string> | null;
  language: string | null;
  update_channel: string;
  auto_update_check: boolean;
}

interface GitHubOAuthStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string | null;
  expires_in: number;
  interval: number;
}

interface GitHubOAuthPollResponse {
  status: 'pending' | 'slow_down' | 'success' | 'denied' | 'expired';
  access_token?: string | null;
  user?: GitHubUser | null;
  retry_after?: number | null;
}

class UIStore {
  private provider = createGitProvider();
  private systemThemeQuery: MediaQueryList | null = null;
  private reloadVersion = 0;

  initialized = $state(false);
  loading = $state(false);
  providerKind = $state<'mock' | 'tauri'>(this.provider.kind);
  notice = $state('');
  toasts = $state<Toast[]>([]);

  githubUser = $state<GitHubUser | null>(null);
  githubClientId = $state('');
  githubAuthPending = $state(false);
  githubUserCode = $state('');
  githubVerificationUrl = $state('');
  private githubToken: string | null = null;
  commandShortcuts = $state<ShortcutMap>({ ...DEFAULT_SHORTCUTS });

  theme = $state<ThemeMode>('system');
  activeTab = $state<SidebarTab>('changes');
  projectTabs = $state<ProjectTab[]>([]);
  activeProjectPath = $state('');

  repository = $state<RepositoryMeta | null>(null);
  branches = $state<BranchInfo[]>([]);
  changes = $state<ChangeItem[]>([]);
  stashes = $state<StashEntry[]>([]);
  commits = $state<CommitSummary[]>([]);
  commitBranchFilter = $state<string>('all');
  remotes = $state<RemoteInfo[]>([]);
  selectedRemote = $state('origin');
  syncStatus = $state<SyncStatus | null>(null);
  gitUserConfig = $state<GitUserConfig>({ name: null, email: null });
  defaultRemote = $state('origin');

  selectedCommitHash = $state('');
  diffByCommit = $state<Record<string, DiffFile[]>>({});

  diffViewMode = $state<'unified' | 'split'>('unified');
  commitViewMode = $state<CommitViewMode>('flow');
  updateChannel = $state<'stable' | 'beta'>('stable');
  autoUpdateCheck = $state(true);
  collapsedDiffFiles = $state<Map<string, Set<string>>>(new Map());

  async init() {
    if (this.initialized) return;

    this.loading = true;
    this.bootstrapProjectTabs();
    this.theme = this.getStoredTheme();
    this.diffViewMode = this.getStoredDiffViewMode();
    this.commitViewMode = this.getStoredCommitViewMode();
    this.defaultRemote = this.getStoredDefaultRemote();
    await this.loadAppSettings();
    await this.loadCommandShortcuts();
    this.selectedRemote = this.defaultRemote;
    this.setupSystemThemeListener();
    this.applyTheme(this.theme);
    await this.restoreGitHubSession();
    await this.reload();
    this.initialized = true;
  }

  resetForTests() {
    void this.provider.clearRepositoryPath();
    this.teardownSystemThemeListener();
    this.initialized = false;
    this.loading = false;
    this.theme = 'system';
    this.activeTab = 'changes';
    this.projectTabs = [];
    this.activeProjectPath = '';
    this.repository = null;
    this.branches = [];
    this.changes = [];
    this.stashes = [];
    this.commits = [];
    this.selectedCommitHash = '';
    this.diffByCommit = {};
    this.commitBranchFilter = 'all';
    this.remotes = [];
    this.selectedRemote = 'origin';
    this.syncStatus = null;
    this.defaultRemote = 'origin';
    this.gitUserConfig = { name: null, email: null };
    this.notice = '';
    this.diffViewMode = 'unified';
    this.commitViewMode = 'flow';
    this.updateChannel = 'stable';
    this.autoUpdateCheck = true;
    this.collapsedDiffFiles = new Map();
    this.githubUser = null;
    this.githubClientId = '';
    this.githubAuthPending = false;
    this.githubUserCode = '';
    this.githubVerificationUrl = '';
    this.githubToken = null;
    this.commandShortcuts = { ...DEFAULT_SHORTCUTS };
    this.applyTheme('system');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PROJECT_TABS_KEY);
      window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
      window.localStorage.removeItem(DIFF_VIEW_MODE_KEY);
      window.localStorage.removeItem(DEFAULT_REMOTE_KEY);
      window.localStorage.removeItem(COMMIT_VIEW_MODE_KEY);
      window.localStorage.removeItem(GITHUB_TOKEN_KEY);
      window.localStorage.removeItem(GITHUB_USER_KEY);
      window.localStorage.removeItem(GITHUB_CLIENT_ID_KEY);
      window.localStorage.removeItem(SHORTCUTS_KEY);
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('gitlite.diff.collapsed.')) {
          window.localStorage.removeItem(key);
        }
      }
    }
  }

  switchTab(tab: SidebarTab) {
    this.activeTab = tab;
  }

  setTheme(next: ThemeMode) {
    this.theme = next;
    this.setStoredTheme(next);
    this.applyTheme(next);
  }

  async setUpdateChannel(channel: 'stable' | 'beta') {
    this.updateChannel = channel;
    await this.persistAppSettingPatch({ update_channel: channel });
    this.addToast(`Update channel set to ${channel}.`, 'info');
  }

  async setAutoUpdateCheck(enabled: boolean) {
    this.autoUpdateCheck = enabled;
    await this.persistAppSettingPatch({ auto_update_check: enabled });
    this.addToast(
      enabled ? 'Auto update check enabled.' : 'Auto update check disabled.',
      'info'
    );
  }

  async saveCommandShortcuts(next: ShortcutMap) {
    const normalized = this.normalizeShortcutMap(next);
    const conflict = this.detectShortcutConflict(normalized);
    if (conflict) {
      throw new Error(`E_SHORTCUT_CONFLICT: ${conflict}`);
    }

    this.commandShortcuts = normalized;
    await this.persistCommandShortcuts(normalized);
    this.addToast('Command shortcuts updated.', 'success');
  }

  async resetCommandShortcuts() {
    const defaults = { ...DEFAULT_SHORTCUTS };
    this.commandShortcuts = defaults;
    await this.persistCommandShortcuts(defaults);
    this.addToast('Command shortcuts reset to defaults.', 'info');
  }

  setGitHubClientId(clientId: string) {
    const normalized = clientId.trim();
    this.githubClientId = normalized;
    if (typeof window !== 'undefined') {
      if (normalized) {
        window.localStorage.setItem(GITHUB_CLIENT_ID_KEY, normalized);
      } else {
        window.localStorage.removeItem(GITHUB_CLIENT_ID_KEY);
      }
    }
  }

  async initRepositoryForCurrentPath() {
    const target = this.repository?.path?.trim();
    if (!target) {
      this.notice = 'E_REPO_EMPTY: repository path is empty';
      return;
    }
    try {
      await this.provider.initRepository(target);
      await this.reload();
      this.notice = 'Initialized Git repository.';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async loadGitUserConfig() {
    if (!this.repository?.isGitRepository) {
      this.gitUserConfig = { name: null, email: null };
      return;
    }
    try {
      this.gitUserConfig = await this.provider.getGitUserConfig();
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async saveGitUserConfig(name: string, email: string) {
    try {
      await this.provider.setGitUserConfig(name, email);
      this.gitUserConfig = { name: name.trim() || null, email: email.trim() || null };
      this.notice = 'Saved git user configuration.';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async selectCommit(hash: string) {
    this.selectedCommitHash = hash;
    if (this.diffByCommit[hash]) return;

    try {
      const diff = await this.provider.getDiffForCommit(hash);
      this.diffByCommit = {
        ...this.diffByCommit,
        [hash]: diff
      };
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async refreshStashes() {
    this.stashes = await this.provider.getStashes();
  }

  async refreshBranches() {
    this.branches = await this.provider.getBranches();
    if (this.repository) {
      const currentBranch = this.branches.find((branch) => !branch.isRemote && branch.isCurrent)?.name ?? '-';
      this.repository = { ...this.repository, currentBranch };
    }
  }

  async refreshChanges() {
    this.changes = await this.provider.getChanges();
  }

  async refreshRemotes() {
    this.remotes = await this.provider.listRemotes();
    const remoteNames = new Set(this.remotes.map((remote) => remote.name));
    if (remoteNames.size === 0) {
      this.selectedRemote = this.defaultRemote;
      this.syncStatus = null;
      return;
    }

    if (!remoteNames.has(this.selectedRemote)) {
      this.selectedRemote = remoteNames.has(this.defaultRemote)
        ? this.defaultRemote
        : this.remotes[0]?.name ?? this.defaultRemote;
    }
  }

  async refreshSyncStatus() {
    if (!this.repository?.isGitRepository) {
      this.syncStatus = null;
      return;
    }
    if (!this.selectedRemote) {
      this.syncStatus = null;
      return;
    }
    try {
      this.syncStatus = await this.provider.getSyncStatus(this.selectedRemote);
    } catch {
      this.syncStatus = null;
    }
  }

  async setSelectedRemote(name: string) {
    const normalized = name.trim();
    if (!normalized || normalized === this.selectedRemote) return;
    this.selectedRemote = normalized;
    await this.refreshSyncStatus();
  }

  setDefaultRemote(name: string) {
    const normalized = name.trim() || 'origin';
    this.defaultRemote = normalized;
    if (!this.selectedRemote) {
      this.selectedRemote = normalized;
    }
    this.setStoredDefaultRemote(normalized);
  }

  async fetchRemote(auth: HttpsAuthInput) {
    const remoteName = this.selectedRemote || this.defaultRemote;
    const resolvedAuth = this.resolveHttpsAuth(auth, remoteName);
    try {
      await this.provider.fetchRemote(remoteName, resolvedAuth);
      await this.refreshSyncStatus();
      this.notice = `Fetched from ${remoteName}.`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async pullRemote(auth: HttpsAuthInput) {
    const remoteName = this.selectedRemote || this.defaultRemote;
    const resolvedAuth = this.resolveHttpsAuth(auth, remoteName);
    try {
      await this.provider.pullRemote(remoteName, resolvedAuth);
      await this.reload();
      this.notice = `Pulled from ${remoteName}.`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async pushRemote(auth: HttpsAuthInput) {
    const remoteName = this.selectedRemote || this.defaultRemote;
    const resolvedAuth = this.resolveHttpsAuth(auth, remoteName);
    try {
      await this.provider.pushRemote(remoteName, resolvedAuth);
      await this.refreshSyncStatus();
      this.notice = `Pushed to ${remoteName}.`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async fetchSsh(auth: SshAuthInput) {
    try {
      await this.provider.fetchSsh(this.selectedRemote || this.defaultRemote, auth);
      await this.refreshSyncStatus();
      this.notice = `Fetched from ${this.selectedRemote || this.defaultRemote}.`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async pullSsh(auth: SshAuthInput) {
    try {
      await this.provider.pullSsh(this.selectedRemote || this.defaultRemote, auth);
      await this.reload();
      this.notice = `Pulled from ${this.selectedRemote || this.defaultRemote}.`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async pushSsh(auth: SshAuthInput) {
    try {
      await this.provider.pushSsh(this.selectedRemote || this.defaultRemote, auth);
      await this.refreshSyncStatus();
      this.notice = `Pushed to ${this.selectedRemote || this.defaultRemote}.`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async addRemote(name: string, url: string) {
    try {
      await this.provider.addRemote(name, url);
      await this.refreshRemotes();
      await this.refreshSyncStatus();
      this.notice = `Remote added: ${name.trim()}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async renameRemote(oldName: string, newName: string) {
    try {
      await this.provider.renameRemote(oldName, newName);
      if (this.selectedRemote === oldName) {
        this.selectedRemote = newName;
      }
      await this.refreshRemotes();
      await this.refreshSyncStatus();
      this.notice = `Remote renamed: ${oldName} -> ${newName}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async setRemoteUrl(name: string, url: string) {
    try {
      await this.provider.setRemoteUrl(name, url);
      await this.refreshRemotes();
      this.notice = `Updated remote URL: ${name}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async removeRemote(name: string) {
    try {
      await this.provider.removeRemote(name);
      await this.refreshRemotes();
      await this.refreshSyncStatus();
      this.notice = `Remote removed: ${name}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async createBranch(name: string) {
    try {
      await this.provider.createBranch(name);
      await this.refreshBranches();
      this.notice = `Branch created: ${name.trim()}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async checkoutBranch(name: string) {
    try {
      await this.provider.checkoutBranch(name);
      await this.reload();
      this.notice = `Checked out: ${name}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async deleteBranch(name: string) {
    try {
      await this.provider.deleteBranch(name);
      await this.refreshBranches();
      this.notice = `Branch deleted: ${name}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async createStash(message?: string) {
    try {
      await this.provider.createStash(message);
      await Promise.all([this.refreshStashes(), this.refreshChanges()]);
      this.notice = 'Stash created.';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async applyStash(index: number) {
    try {
      await this.provider.applyStash(index);
      await this.refreshChanges();
      this.notice = 'Stash applied.';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async dropStash(index: number) {
    try {
      await this.provider.dropStash(index);
      await this.refreshStashes();
      this.notice = 'Stash dropped.';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async stagePath(path: string) {
    try {
      await this.provider.stageFiles([path]);
      await this.refreshChanges();
      this.notice = '';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async unstagePath(path: string) {
    try {
      await this.provider.unstageFiles([path]);
      await this.refreshChanges();
      this.notice = '';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async commit(message: string, description = '') {
    try {
      const oid = await this.provider.commitChanges(message, description);
      await this.reload();
      this.notice = `Committed ${oid.slice(0, 7)}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async setCommitBranchFilter(filter: string) {
    const normalized = filter.trim() || 'all';
    this.commitBranchFilter = normalized;
    await this.reload();
  }

  async cherryPickCommit(hash: string) {
    try {
      const newOid = await this.provider.cherryPickCommit(hash);
      await this.reload();
      this.notice = `Cherry-picked ${hash.slice(0, 8)} -> ${newOid.slice(0, 8)}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async resetCurrentBranch(hash: string, mode: 'soft' | 'mixed' | 'hard') {
    try {
      await this.provider.resetCurrentBranch(hash, mode);
      await this.reload();
      this.notice = `Reset ${mode} to ${hash.slice(0, 8)}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async createBranchFromCommit(hash: string, name: string) {
    try {
      await this.provider.createBranchFromCommit(name, hash);
      await this.refreshBranches();
      this.notice = `Created branch '${name}' from ${hash.slice(0, 8)}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async checkoutCommit(hash: string) {
    try {
      await this.provider.checkoutCommit(hash);
      await this.reload();
      this.notice = `Checked out commit ${hash.slice(0, 8)} (detached HEAD)`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async revertCommit(hash: string) {
    try {
      const oid = await this.provider.revertCommit(hash);
      await this.reload();
      this.notice = `Reverted ${hash.slice(0, 8)} -> ${oid.slice(0, 8)}`;
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async openRepositoryPicker(path?: string) {
    if (!this.initialized) {
      await this.init();
    }
    await this.waitForIdleState();
    const current = this.activeProjectPath || this.provider.getRepositoryPath() || '';
    let picked = path?.trim() || '';
    if (!picked) {
      picked = (await this.provider.pickRepositoryPath(current))?.trim() || '';
    }
    if (!picked) return;

    try {
      await this.activateProject(picked);
      this.notice = '';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async openProject(path: string) {
    if (!this.initialized) {
      await this.init();
    }
    await this.waitForIdleState();
    const normalized = path.trim();
    if (!normalized) {
      throw new Error('E_REPO_EMPTY: repository path is empty');
    }

    await this.activateProject(normalized);
    this.notice = '';
  }

  async switchProjectTab(path: string) {
    if (!this.initialized) {
      await this.init();
    }
    await this.waitForIdleState();
    const currentPath = this.provider.getRepositoryPath() ?? '';
    if (!path || path === currentPath) return;
    try {
      await this.activateProject(path);
      this.notice = '';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  async closeProjectTab(path: string) {
    const index = this.projectTabs.findIndex((tab) => tab.path === path);
    if (index < 0) return;

    const nextTabs = this.projectTabs.filter((tab) => tab.path !== path);
    this.projectTabs = nextTabs;

    if (path !== this.activeProjectPath) {
      this.persistProjectTabs();
      return;
    }

    const fallback = nextTabs[Math.min(index, nextTabs.length - 1)];
    if (!fallback) {
      await this.provider.clearRepositoryPath();
      this.activeProjectPath = '';
      this.clearWorkspaceData();
      this.persistProjectTabs();
      return;
    }

    try {
      await this.provider.setRepositoryPath(fallback.path);
      this.activeProjectPath = fallback.path;
      this.persistProjectTabs();
      await this.reload();
      this.notice = '';
    } catch (error) {
      this.notice = this.messageOf(error);
    }
  }

  get selectedDiff(): DiffFile[] {
    return this.diffByCommit[this.selectedCommitHash] ?? [];
  }

  get selectedCommit(): CommitSummary | null {
    return this.commits.find((commit) => commit.hash === this.selectedCommitHash) ?? null;
  }

  get hasRepository(): boolean {
    return !!this.repository?.path;
  }

  get hasGitRepository(): boolean {
    return !!this.repository?.isGitRepository;
  }

  reorderProjectTabs(tabs: ProjectTab[]) {
    this.projectTabs = tabs;
    this.persistProjectTabs();
  }

  addToast(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', duration = 3000) {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type, duration };
    this.toasts = [...this.toasts, toast];

    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  async loginWithGitHub() {
    this.loading = true;
    this.githubAuthPending = true;
    try {
      if (!isTauriRuntime()) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        this.githubUser = {
          login: 'mockuser',
          avatar_url: 'https://github.com/github.png',
          name: 'Mock User'
        };
        this.githubToken = 'mock-token';
        await this.persistGitHubSession();
        this.addToast('Connected to GitHub (mock runtime).', 'success');
        return;
      }

      const clientId = this.githubClientId.trim();
      if (!clientId) {
        throw new Error(
          'E_GITHUB_CLIENT_ID_MISSING: Enter a GitHub OAuth Client ID in Settings first.'
        );
      }

      const start = await tauriInvoke<GitHubOAuthStartResponse>('github_oauth_start', {
        clientId
      });
      this.githubUserCode = start.user_code;
      this.githubVerificationUrl = start.verification_uri_complete ?? start.verification_uri;

      await tauriInvoke<void>('plugin:opener|open_url', {
        url: this.githubVerificationUrl
      });
      this.addToast(`GitHub verification code: ${start.user_code}`, 'info', 15000);

      const session = await this.pollGitHubOAuth(clientId, start);
      this.githubUser = session.user;
      this.githubToken = session.accessToken;
      await this.persistGitHubSession();
      this.addToast('Connected to GitHub.', 'success');
    } catch (error) {
      this.addToast(this.messageOf(error), 'error');
    } finally {
      this.githubAuthPending = false;
      this.githubUserCode = '';
      this.githubVerificationUrl = '';
      this.loading = false;
    }
  }

  async logoutGitHub() {
    this.githubToken = null;
    this.githubUser = null;
    await this.persistGitHubSession();
    this.addToast('Disconnected from GitHub', 'info');
  }

  get localBranchNames(): string[] {
    return this.branches.filter((branch) => !branch.isRemote).map((branch) => branch.name);
  }

  private async reload() {
    const currentReload = ++this.reloadVersion;
    this.loading = true;
    try {
      const currentPath = this.provider.getRepositoryPath();
      if (!currentPath) {
        if (currentReload !== this.reloadVersion) return;
        this.activeProjectPath = '';
        this.clearWorkspaceData();
        return;
      }

      const [repository, branches, changes, stashes, remotes] = await Promise.all([
        this.provider.getRepository(),
        this.provider.getBranches(),
        this.provider.getChanges(),
        this.provider.getStashes(),
        this.provider.listRemotes()
      ]);

      const localBranchNames = branches.filter((branch) => !branch.isRemote).map((branch) => branch.name);
      if (this.commitBranchFilter !== 'all' && !localBranchNames.includes(this.commitBranchFilter)) {
        this.commitBranchFilter = 'all';
      }

      const commitReference =
        this.commitBranchFilter === 'all' ? 'all' : `refs/heads/${this.commitBranchFilter}`;
      const commits = await this.provider.getCommits(commitReference);
      if (currentReload !== this.reloadVersion) return;

      const resolvedPath = (repository.path || currentPath).trim();
      this.repository = resolvedPath ? { ...repository, path: resolvedPath } : repository;
      if (resolvedPath) {
        this.upsertProjectTab(resolvedPath);
      }
      this.branches = branches;
      this.changes = changes;
      this.stashes = stashes;
      this.remotes = remotes;
      this.gitUserConfig = repository.isGitRepository
        ? await this.provider.getGitUserConfig().catch(() => ({ name: null, email: null }))
        : { name: null, email: null };
      this.commits = commits;
      this.diffByCommit = {};
      this.selectedCommitHash = '';
      const remoteNames = new Set(remotes.map((remote) => remote.name));
      if (remoteNames.size > 0) {
        const preferred = remoteNames.has(this.selectedRemote)
          ? this.selectedRemote
          : remoteNames.has(this.defaultRemote)
            ? this.defaultRemote
            : remotes[0]?.name ?? this.defaultRemote;
        this.selectedRemote = preferred;
        this.syncStatus = repository.isGitRepository
          ? await this.provider.getSyncStatus(preferred).catch(() => null)
          : null;
      } else {
        this.selectedRemote = this.defaultRemote;
        this.syncStatus = null;
      }
      this.notice = repository.isGitRepository
        ? ''
        : 'Opened folder is not a git repository. Initialize Git or open another folder.';

      if (commits.length > 0) {
        await this.selectCommit(commits[0].hash);
      }
    } catch (error) {
      if (currentReload !== this.reloadVersion) return;
      this.notice = this.messageOf(error);
      this.clearWorkspaceData();
    } finally {
      if (currentReload !== this.reloadVersion) return;
      this.loading = false;
    }
  }

  private resolveHttpsAuth(auth: HttpsAuthInput, remoteName: string): HttpsAuthInput {
    const explicitUsername = auth.username.trim();
    if (explicitUsername && auth.password) {
      return {
        username: explicitUsername,
        password: auth.password
      };
    }

    const remoteUrl = this.remotes.find((remote) => remote.name === remoteName)?.url?.toLowerCase() ?? '';
    if (this.githubToken && remoteUrl.includes('github.com')) {
      return {
        username: 'x-access-token',
        password: this.githubToken
      };
    }

    return {
      username: explicitUsername,
      password: auth.password
    };
  }

  private async pollGitHubOAuth(clientId: string, start: GitHubOAuthStartResponse): Promise<{
    accessToken: string;
    user: GitHubUser;
  }> {
    const expiresAt = Date.now() + Math.max(start.expires_in, 10) * 1000;
    let intervalMs = Math.max(start.interval, 2) * 1000;

    while (Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const poll = await tauriInvoke<GitHubOAuthPollResponse>('github_oauth_poll', {
        clientId,
        deviceCode: start.device_code
      });

      if (poll.status === 'pending') {
        if (poll.retry_after && poll.retry_after > 0) {
          intervalMs = Math.max(intervalMs, poll.retry_after * 1000);
        }
        continue;
      }

      if (poll.status === 'slow_down') {
        intervalMs = Math.max(intervalMs + 1000, (poll.retry_after ?? 5) * 1000);
        continue;
      }

      if (poll.status === 'denied') {
        throw new Error('E_GITHUB_OAUTH_DENIED: GitHub authorization was denied.');
      }

      if (poll.status === 'expired') {
        throw new Error('E_GITHUB_OAUTH_EXPIRED: GitHub device code expired.');
      }

      if (poll.status === 'success' && poll.access_token && poll.user) {
        return {
          accessToken: poll.access_token,
          user: poll.user
        };
      }

      throw new Error(`E_GITHUB_OAUTH_POLL_ERROR: Unexpected OAuth status '${poll.status}'.`);
    }

    throw new Error('E_GITHUB_OAUTH_EXPIRED: GitHub device code expired.');
  }

  private async restoreGitHubSession() {
    if (typeof window === 'undefined') return;

    const storedClientId = window.localStorage.getItem(GITHUB_CLIENT_ID_KEY)?.trim();
    this.githubClientId = storedClientId || '';

    if (isTauriRuntime()) {
      try {
        this.githubToken = await tauriInvoke<string | null>('load_github_token');
      } catch (error) {
        this.githubToken = null;
        this.addToast(this.messageOf(error), 'warning');
      }
    } else {
      const storedToken = window.localStorage.getItem(GITHUB_TOKEN_KEY)?.trim();
      this.githubToken = storedToken || null;
    }

    const storedUser = window.localStorage.getItem(GITHUB_USER_KEY);
    if (!storedUser) {
      this.githubUser = null;
    } else {
      try {
        const parsed = JSON.parse(storedUser);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.login === 'string' &&
          typeof parsed.avatar_url === 'string'
        ) {
          this.githubUser = {
            login: parsed.login,
            avatar_url: parsed.avatar_url,
            name: typeof parsed.name === 'string' ? parsed.name : null
          };
        } else {
          this.githubUser = null;
        }
      } catch {
        this.githubUser = null;
      }
    }

    if (isTauriRuntime()) {
      if (!this.githubToken) {
        this.githubUser = null;
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(GITHUB_USER_KEY);
        }
        return;
      }

      try {
        this.githubUser = await tauriInvoke<GitHubUser>('github_fetch_user', {
          accessToken: this.githubToken
        });
        window.localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(this.githubUser));
      } catch {
        this.githubToken = null;
        this.githubUser = null;
        try {
          await tauriInvoke<void>('delete_github_token');
        } catch {
          // Ignore secondary cleanup errors.
        }
        window.localStorage.removeItem(GITHUB_USER_KEY);
      }
    }
  }

  private async persistGitHubSession() {
    if (typeof window === 'undefined') return;

    if (isTauriRuntime()) {
      try {
        if (this.githubToken) {
          await tauriInvoke<void>('save_github_token', {
            accessToken: this.githubToken
          });
        } else {
          await tauriInvoke<void>('delete_github_token');
        }
      } catch (error) {
        this.addToast(this.messageOf(error), 'warning');
      }
    } else {
      if (this.githubToken) {
        window.localStorage.setItem(GITHUB_TOKEN_KEY, this.githubToken);
      } else {
        window.localStorage.removeItem(GITHUB_TOKEN_KEY);
      }
    }

    if (this.githubUser) {
      window.localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(this.githubUser));
    } else {
      window.localStorage.removeItem(GITHUB_USER_KEY);
    }
  }

  private async loadAppSettings() {
    if (!isTauriRuntime()) return;
    try {
      const settings = await tauriInvoke<AppSettingsPayload>('load_settings');
      this.updateChannel = settings.update_channel === 'beta' ? 'beta' : 'stable';
      this.autoUpdateCheck = settings.auto_update_check !== false;
    } catch (error) {
      this.addToast(this.messageOf(error), 'warning');
    }
  }

  private async persistAppSettingPatch(patch: Partial<AppSettingsPayload>) {
    if (!isTauriRuntime()) return;
    try {
      const current = await tauriInvoke<AppSettingsPayload>('load_settings');
      const payload: AppSettingsPayload = {
        ...current,
        ...patch
      };
      await tauriInvoke<void>('save_settings', { config: payload });
    } catch (error) {
      this.addToast(this.messageOf(error), 'warning');
    }
  }

  private async loadCommandShortcuts() {
    if (typeof window === 'undefined') {
      this.commandShortcuts = { ...DEFAULT_SHORTCUTS };
      return;
    }

    if (isTauriRuntime()) {
      try {
        const settings = await tauriInvoke<AppSettingsPayload>('load_settings');
        const loaded = settings.keyboard_shortcuts ?? {};
        const merged = this.normalizeShortcutMap({
          ...DEFAULT_SHORTCUTS,
          ...loaded
        });
        this.commandShortcuts = merged;
        await this.persistCommandShortcuts(merged);
        return;
      } catch (error) {
        this.addToast(this.messageOf(error), 'warning');
      }
    }

    const raw = window.localStorage.getItem(SHORTCUTS_KEY);
    if (!raw) {
      this.commandShortcuts = { ...DEFAULT_SHORTCUTS };
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<ShortcutMap>;
      this.commandShortcuts = this.normalizeShortcutMap({
        ...DEFAULT_SHORTCUTS,
        ...parsed
      });
    } catch {
      this.commandShortcuts = { ...DEFAULT_SHORTCUTS };
    }
  }

  private async persistCommandShortcuts(shortcuts: ShortcutMap) {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));

    await this.persistAppSettingPatch({ keyboard_shortcuts: shortcuts });
  }

  private normalizeShortcutMap(map: Partial<ShortcutMap>): ShortcutMap {
    const normalize = (value: string) =>
      value
        .trim()
        .replace(/\s+/g, '')
        .replace(/cmdorctrl/gi, 'CmdOrCtrl')
        .replace(/command/gi, 'Cmd')
        .replace(/control/gi, 'Ctrl')
        .replace(/option/gi, 'Alt')
        .replace(/escape/gi, 'Esc')
        .replace(/plus/gi, '+');

    return {
      open_project: normalize(map.open_project ?? DEFAULT_SHORTCUTS.open_project),
      close_project: normalize(map.close_project ?? DEFAULT_SHORTCUTS.close_project),
      next_project: normalize(map.next_project ?? DEFAULT_SHORTCUTS.next_project),
      prev_project: normalize(map.prev_project ?? DEFAULT_SHORTCUTS.prev_project),
      open_settings: normalize(map.open_settings ?? DEFAULT_SHORTCUTS.open_settings),
      switch_branches: normalize(map.switch_branches ?? DEFAULT_SHORTCUTS.switch_branches),
      switch_changes: normalize(map.switch_changes ?? DEFAULT_SHORTCUTS.switch_changes),
      switch_stash: normalize(map.switch_stash ?? DEFAULT_SHORTCUTS.switch_stash)
    };
  }

  private detectShortcutConflict(map: ShortcutMap): string | null {
    const seen = new Map<string, string>();
    for (const [command, shortcut] of Object.entries(map)) {
      if (!shortcut) {
        return `Shortcut is required for '${command}'.`;
      }
      const key = shortcut.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        return `'${shortcut}' is duplicated between '${existing}' and '${command}'.`;
      }
      seen.set(key, command);
    }
    return null;
  }

  private messageOf(error: unknown): string {
    const rawInput =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error) || 'Unknown error';
    const raw = this.sanitizeSensitive(rawInput);

    // If it's a specific internal error code, return a friendly message
    if (raw.startsWith('E_')) {
      const [prefix] = raw.split(':');
      const code = prefix?.trim();
      switch (code) {
        case 'E_REPO_EMPTY':
          return 'Repository path is empty. Pick a folder first.';
        case 'E_REPO_MISSING':
          return 'No repository selected. Open a project first.';
        case 'E_REPO_NOT_GIT':
          return 'Selected folder is not a git repository.';
        case 'E_PULL_DIRTY':
          return 'Pull blocked because you have local changes. Commit or stash first.';
        case 'E_PULL_NON_FF':
          return 'Pull blocked because branch has diverged. Rebase/merge manually.';
        case 'E_PULL_DETACHED':
          return 'Pull blocked on detached HEAD. Checkout a branch first.';
        case 'E_PULL_AUTH':
          return 'Authentication failed. Check your credentials and try again.';
        case 'E_PULL_NETWORK':
          return 'Network error while syncing with remote.';
        case 'E_PUSH_NON_FF':
          return 'Push blocked because remote is ahead. Pull/rebase first.';
        case 'E_PUSH_AUTH':
          return 'Authentication failed while pushing. Check your credentials and try again.';
        case 'E_PUSH_NETWORK':
          return 'Network error while pushing to remote.';
        case 'E_PUSH_REJECTED':
          return 'Push rejected by remote. Check branch protection or remote state.';
        case 'E_BRANCH_EMPTY':
          return 'Branch name is required.';
        case 'E_BRANCH_EXISTS':
          return 'Branch already exists.';
        case 'E_BRANCH_NOT_FOUND':
          return 'Branch not found.';
        case 'E_BRANCH_DELETE_CURRENT':
          return 'Cannot delete the currently checked-out branch.';
        case 'E_STASH_EMPTY':
          return 'No local changes to stash.';
        case 'E_STASH_APPLY_CONFLICT':
          return 'Stash apply produced conflicts. Resolve them and continue.';
        case 'E_STASH_INVALID_INDEX':
          return 'Selected stash entry no longer exists.';
        case 'E_REMOTE_INVALID':
          return 'Remote name and URL are required.';
        case 'E_REMOTE_EXISTS':
          return 'Remote already exists.';
        case 'E_HEAD_UNBORN':
          return 'Repository has no commits yet.';
        case 'E_GITHUB_CLIENT_ID_MISSING':
          return 'GitHub OAuth Client ID is missing. Set it in Settings first.';
        case 'E_GITHUB_OAUTH_DENIED':
          return 'GitHub login was denied. Please approve access and try again.';
        case 'E_GITHUB_OAUTH_EXPIRED':
          return 'GitHub login timed out. Start the login flow again.';
        case 'E_GITHUB_OAUTH_NETWORK':
          return 'Network error while connecting to GitHub OAuth.';
        case 'E_GITHUB_OAUTH_START_FAILED':
        case 'E_GITHUB_OAUTH_POLL_FAILED':
        case 'E_GITHUB_OAUTH_POLL_ERROR':
          return 'GitHub OAuth failed. Check Client ID and try again.';
        case 'E_GITHUB_USER_FETCH':
        case 'E_GITHUB_USER_PARSE':
          return 'GitHub login succeeded, but profile fetch failed.';
        case 'E_GITHUB_KEYCHAIN_WRITE':
        case 'E_GITHUB_KEYCHAIN_READ':
        case 'E_GITHUB_KEYCHAIN_DELETE':
        case 'E_GITHUB_KEYCHAIN_INIT':
          return 'Failed to access OS keychain for GitHub token.';
        case 'E_GITHUB_KEYCHAIN_UNSUPPORTED':
          return 'OS keychain integration is unavailable on this platform.';
        case 'E_GITHUB_TOKEN_EMPTY':
          return 'GitHub token is empty. Please login again.';
        case 'E_SHORTCUT_CONFLICT':
          return 'Shortcut conflict detected. Each command must use a unique shortcut.';
        case 'E_RUNTIME_LOG_DIR':
        case 'E_RUNTIME_LOG_READ':
        case 'E_RUNTIME_LOG_WRITE':
          return 'Runtime diagnostics logging failed.';
      }
    }

    if (/cannot delete current branch/i.test(raw)) {
      return 'Cannot delete the currently checked-out branch.';
    }
    if (/Failed to (find|checkout) branch/i.test(raw)) {
      return 'Branch operation failed. Verify the branch name and working tree state.';
    }
    if (/Failed to add remote/i.test(raw)) {
      return 'Failed to add remote. Check name/URL and try again.';
    }
    if (/Failed to remove remote/i.test(raw)) {
      return 'Failed to remove remote. Verify the remote exists.';
    }
    if (/Failed to rename remote/i.test(raw)) {
      return 'Failed to rename remote. Verify current and new names.';
    }
    if (/Failed to set URL for remote/i.test(raw)) {
      return 'Failed to update remote URL. Check URL format and try again.';
    }

    // Otherwise return the raw error (which now includes the string message from Rust)
    return raw;
  }

  private sanitizeSensitive(input: string): string {
    return input
      .replace(/([a-z]+:\/\/[^:@\s]+):[^@\s]+@/gi, '$1:***@')
      .replace(/([?&](?:token|access_token|password|passphrase)=)[^&\s]+/gi, '$1***')
      .replace(/\b(password|passphrase|token)\s*[:=]\s*([^\s,;]+)/gi, '$1=***');
  }

  private applyTheme(mode: ThemeMode) {
    const resolved = mode === 'system' ? this.getSystemTheme() : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeMode = mode;
  }

  private setupSystemThemeListener() {
    this.teardownSystemThemeListener();
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      this.systemThemeQuery = null;
      return;
    }
    this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof this.systemThemeQuery.addEventListener === 'function') {
      this.systemThemeQuery.addEventListener('change', this.onSystemThemeChange);
      return;
    }
    if (typeof this.systemThemeQuery.addListener === 'function') {
      this.systemThemeQuery.addListener(this.onSystemThemeChange);
    }
  }

  private teardownSystemThemeListener() {
    if (!this.systemThemeQuery) return;
    if (typeof this.systemThemeQuery.removeEventListener === 'function') {
      this.systemThemeQuery.removeEventListener('change', this.onSystemThemeChange);
    } else if (typeof this.systemThemeQuery.removeListener === 'function') {
      this.systemThemeQuery.removeListener(this.onSystemThemeChange);
    }
    this.systemThemeQuery = null;
  }

  private onSystemThemeChange = () => {
    if (this.theme === 'system') {
      this.applyTheme('system');
    }
  };

  private getSystemTheme(): 'dark' | 'light' {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private getStoredTheme(): ThemeMode {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private setStoredTheme(theme: ThemeMode) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_KEY, theme);
  }

  toggleDiffViewMode() {
    this.diffViewMode = this.diffViewMode === 'unified' ? 'split' : 'unified';
    this.setStoredDiffViewMode(this.diffViewMode);
  }

  setDiffViewMode(mode: 'unified' | 'split') {
    if (this.diffViewMode === mode) return;
    this.diffViewMode = mode;
    this.setStoredDiffViewMode(mode);
  }

  setCommitViewMode(mode: CommitViewMode) {
    if (this.commitViewMode === mode) return;
    this.commitViewMode = mode;
    this.setStoredCommitViewMode(mode);
  }

  toggleFileCollapse(commitHash: string, filePath: string) {
    const oldCollapsed = this.collapsedDiffFiles.get(commitHash) ?? new Set<string>();
    const collapsed = new Set(oldCollapsed);
    if (collapsed.has(filePath)) {
      collapsed.delete(filePath);
    } else {
      collapsed.add(filePath);
    }
    const newMap = new Map(this.collapsedDiffFiles);
    newMap.set(commitHash, collapsed);
    this.collapsedDiffFiles = newMap;
  }

  collapseAllFiles(commitHash: string, filePaths: string[]) {
    const collapsed = new Set<string>(filePaths);
    const newMap = new Map(this.collapsedDiffFiles);
    newMap.set(commitHash, collapsed);
    this.collapsedDiffFiles = newMap;
  }

  expandAllFiles(commitHash: string) {
    const newMap = new Map(this.collapsedDiffFiles);
    newMap.delete(commitHash);
    this.collapsedDiffFiles = newMap;
  }

  getCollapsedFiles(commitHash: string): Set<string> {
    return this.collapsedDiffFiles.get(commitHash) ?? new Set<string>();
  }

  getStoredDiffViewMode(): 'unified' | 'split' {
    if (typeof window === 'undefined') return 'unified';
    const stored = window.localStorage.getItem(DIFF_VIEW_MODE_KEY);
    if (stored === 'split' || stored === 'unified') {
      return stored;
    }
    return 'unified';
  }

  private setStoredDiffViewMode(mode: 'unified' | 'split') {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DIFF_VIEW_MODE_KEY, mode);
  }

  getStoredCommitViewMode(): CommitViewMode {
    if (typeof window === 'undefined') return 'flow';
    const stored = window.localStorage.getItem(COMMIT_VIEW_MODE_KEY);
    if (stored === 'flow' || stored === 'graph') {
      return stored;
    }
    return 'flow';
  }

  private setStoredCommitViewMode(mode: CommitViewMode) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COMMIT_VIEW_MODE_KEY, mode);
  }

  private getStoredDefaultRemote(): string {
    if (typeof window === 'undefined') return 'origin';
    const stored = window.localStorage.getItem(DEFAULT_REMOTE_KEY)?.trim();
    return stored || 'origin';
  }

  private setStoredDefaultRemote(remote: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DEFAULT_REMOTE_KEY, remote);
  }

  private bootstrapProjectTabs() {
    const storedPaths = this.getStoredProjectPaths();
    const deduped = Array.from(new Set(storedPaths));
    this.projectTabs = deduped.map((path) => this.createProjectTab(path));

    const currentPath = this.provider.getRepositoryPath();
    if (currentPath) {
      this.upsertProjectTab(currentPath);
      return;
    }

    this.activeProjectPath = '';
  }

  private async activateProject(path: string) {
    const normalized = path.trim();
    if (!normalized) {
      throw new Error('E_REPO_EMPTY: repository path is empty');
    }
    await this.provider.setRepositoryPath(normalized);
    this.upsertProjectTab(normalized);
    await this.reload();
  }

  private upsertProjectTab(path: string) {
    const normalized = path.trim();
    if (!normalized) return;

    this.activeProjectPath = normalized;
    const normalizedName = normalized.split('/').filter(Boolean).pop() || normalized;
    if (this.repository) {
      this.repository = {
        ...this.repository,
        name: normalizedName,
        path: normalized
      };
    }

    const existing = this.projectTabs.find((tab) => tab.path === normalized);
    if (!existing) {
      this.projectTabs = [...this.projectTabs, this.createProjectTab(normalized)];
    }
    this.persistProjectTabs();
  }

  private createProjectTab(path: string): ProjectTab {
    const name = path.split('/').filter(Boolean).pop() || path;
    return { id: path, path, name };
  }

  private getStoredProjectPaths(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(PROJECT_TABS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    } catch {
      return [];
    }
  }

  private persistProjectTabs() {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      PROJECT_TABS_KEY,
      JSON.stringify(this.projectTabs.map((tab) => tab.path))
    );
    if (this.activeProjectPath) {
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, this.activeProjectPath);
    } else {
      window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }

  private clearWorkspaceData() {
    this.repository = null;
    this.branches = [];
    this.changes = [];
    this.stashes = [];
    this.remotes = [];
    this.syncStatus = null;
    this.gitUserConfig = { name: null, email: null };
    this.commits = [];
    this.commitBranchFilter = 'all';
    this.selectedCommitHash = '';
    this.diffByCommit = {};
  }

  private async waitForIdleState() {
    while (this.loading) {
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
  }
}

export const uiState = new UIStore();
