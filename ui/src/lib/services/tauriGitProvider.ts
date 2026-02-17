import type { GitDataProvider } from './gitDataProvider';
import { tauriInvoke } from './tauriBridge';
import type {
  BranchInfo,
  ChangeItem,
  CommitSummary,
  DiffFile,
  DiffLine,
  GitUserConfig,
  HttpsAuthInput,
  RemoteInfo,
  RepositoryMeta,
  SshAuthInput,
  StashEntry,
  SyncStatus
} from '../types/git';

interface RawBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  target_hash?: string | null;
}

interface RawStatus {
  path: string;
  status: string;
  is_staged: boolean;
}

interface RawCommit {
  hash: string;
  author: string;
  message: string;
  date: number;
  parents: string[];
}

interface RawDiffLine {
  line_type: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

interface RawDiffHunk {
  lines: RawDiffLine[];
}

interface RawDiffFile {
  path: string;
  hunks: RawDiffHunk[];
}

interface RawStashEntry {
  index: number;
  message: string;
  author: string;
  date: number;
}

interface RawRemoteInfo {
  name: string;
  url: string | null;
}

interface RawSyncStatus {
  branch: string;
  has_upstream: boolean;
  ahead: number;
  behind: number;
}

const REPO_KEY = 'gitlite.repoPath';

function getPersistedRepoPath(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REPO_KEY);
}

function setPersistedRepoPath(path: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REPO_KEY, path);
}

function clearPersistedRepoPath(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REPO_KEY);
}

function toBranch(raw: RawBranch): BranchInfo {
  return {
    name: raw.name,
    isCurrent: raw.is_current,
    isRemote: raw.is_remote,
    targetHash: raw.target_hash ?? null
  };
}

function toStatus(raw: RawStatus): ChangeItem {
  const normalized = raw.status as ChangeItem['status'];
  return {
    path: raw.path,
    status: normalized,
    staged: raw.is_staged
  };
}

function toDiffLine(raw: RawDiffLine): DiffLine {
  return {
    kind: raw.line_type as DiffLine['kind'],
    oldNumber: raw.old_lineno,
    newNumber: raw.new_lineno,
    text: raw.content
  };
}

function flattenDiff(rawFiles: RawDiffFile[]): DiffFile[] {
  return rawFiles.map((rawFile) => ({
    path: rawFile.path,
    lines: rawFile.hunks.flatMap((hunk) => hunk.lines.map(toDiffLine))
  }));
}

function toSyncStatus(raw: RawSyncStatus): SyncStatus {
  return {
    branch: raw.branch,
    hasUpstream: raw.has_upstream,
    ahead: raw.ahead,
    behind: raw.behind
  };
}

async function checkGitRepository(path: string): Promise<boolean> {
  return tauriInvoke<boolean>('is_git_repository', { path });
}

export class TauriGitProvider implements GitDataProvider {
  kind: 'tauri' = 'tauri';
  private repoPath: string | null = getPersistedRepoPath();
  private isGitRepository = false;

  getRepositoryPath(): string | null {
    return this.repoPath;
  }

  async clearRepositoryPath(): Promise<void> {
    this.repoPath = null;
    this.isGitRepository = false;
    clearPersistedRepoPath();
  }

  async pickRepositoryPath(startDir?: string): Promise<string | null> {
    const picked = await tauriInvoke<string | null>('pick_repository_folder', {
      startDir: startDir?.trim() ? startDir : null
    });
    return picked?.trim() ? picked : null;
  }

  async setRepositoryPath(path: string): Promise<void> {
    const trimmed = path.trim();
    if (!trimmed) {
      throw new Error('E_REPO_EMPTY: repository path is empty');
    }

    this.isGitRepository = await checkGitRepository(trimmed);
    this.repoPath = trimmed;
    setPersistedRepoPath(trimmed);
  }

  async getRepository(): Promise<RepositoryMeta> {
    if (!this.repoPath) {
      return {
        name: 'No repository selected',
        path: '',
        currentBranch: '-',
        isGitRepository: false
      };
    }

    const isGitRepository = await checkGitRepository(this.repoPath);
    this.isGitRepository = isGitRepository;
    const branches = isGitRepository ? await this.getBranches() : [];
    const currentBranch = isGitRepository
      ? branches.find((branch) => branch.isCurrent && !branch.isRemote)?.name || '-'
      : 'Not a git repository';
    const repositoryName = this.repoPath.split('/').filter(Boolean).pop() || this.repoPath;

    return {
      name: repositoryName,
      path: this.repoPath,
      currentBranch,
      isGitRepository
    };
  }

  async getBranches(): Promise<BranchInfo[]> {
    if (!this.repoPath || !this.isGitRepository) return [];
    const raw = await tauriInvoke<RawBranch[]>('get_branches', { path: this.repoPath });
    return raw.map(toBranch);
  }

  async createBranch(name: string): Promise<void> {
    this.ensureGitRepository();
    const normalized = name.trim();
    if (!normalized) {
      throw new Error('E_BRANCH_EMPTY: branch name is required');
    }
    return tauriInvoke<void>('create_branch', { path: this.repoPath!, name: normalized });
  }

  async checkoutBranch(name: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('checkout_branch', { path: this.repoPath!, name });
  }

  async deleteBranch(name: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('delete_branch', { path: this.repoPath!, name });
  }

  async getChanges(): Promise<ChangeItem[]> {
    if (!this.repoPath || !this.isGitRepository) return [];
    const raw = await tauriInvoke<RawStatus[]>('get_status', { path: this.repoPath });
    return raw.map(toStatus);
  }

  async stageFiles(files: string[]): Promise<void> {
    this.ensureGitRepository();
    if (files.length === 0) return;
    await tauriInvoke<void>('stage_files', { path: this.repoPath!, files });
  }

  async unstageFiles(files: string[]): Promise<void> {
    this.ensureGitRepository();
    if (files.length === 0) return;
    await tauriInvoke<void>('unstage_files', { path: this.repoPath!, files });
  }

  async commitChanges(message: string, description = ''): Promise<string> {
    this.ensureGitRepository();
    return tauriInvoke<string>('commit_changes', {
      path: this.repoPath!,
      message,
      description
    });
  }

  async getStashes(): Promise<StashEntry[]> {
    if (!this.repoPath || !this.isGitRepository) return [];
    return tauriInvoke<RawStashEntry[]>('list_stashes', { path: this.repoPath! });
  }

  async createStash(message?: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('create_stash', {
      path: this.repoPath!,
      message: message?.trim() ? message : null
    });
  }

  async applyStash(index: number): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('apply_stash', { path: this.repoPath!, index });
  }

  async dropStash(index: number): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('drop_stash', { path: this.repoPath!, index });
  }

  async getCommits(reference?: string): Promise<CommitSummary[]> {
    if (!this.repoPath || !this.isGitRepository) return [];
    const raw = await tauriInvoke<RawCommit[]>('get_commits', {
      path: this.repoPath!,
      limit: 200,
      reference: reference ?? null
    });
    return raw;
  }

  async getDiffForCommit(hash: string): Promise<DiffFile[]> {
    if (!this.repoPath || !this.isGitRepository) return [];
    const raw = await tauriInvoke<RawDiffFile[]>('get_commit_diff', {
      path: this.repoPath!,
      commitHash: hash
    });
    return flattenDiff(raw);
  }

  async cherryPickCommit(hash: string): Promise<string> {
    this.ensureGitRepository();
    return tauriInvoke<string>('cherry_pick_commit', { path: this.repoPath!, commitHash: hash });
  }

  async resetCurrentBranch(hash: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('reset_current_branch', {
      path: this.repoPath!,
      commitHash: hash,
      mode
    });
  }

  async createBranchFromCommit(name: string, hash: string): Promise<void> {
    this.ensureGitRepository();
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('E_BRANCH_EMPTY: branch name is required');
    }
    return tauriInvoke<void>('create_branch_from_commit', {
      path: this.repoPath!,
      name: trimmed,
      commitHash: hash
    });
  }

  async checkoutCommit(hash: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('checkout_commit', {
      path: this.repoPath!,
      commitHash: hash
    });
  }

  async revertCommit(hash: string): Promise<string> {
    this.ensureGitRepository();
    return tauriInvoke<string>('revert_commit', {
      path: this.repoPath!,
      commitHash: hash
    });
  }

  async fetchRemote(remoteName: string, auth: HttpsAuthInput): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('fetch_remote', {
      path: this.repoPath!,
      remoteName,
      username: auth.username,
      password: auth.password
    });
  }

  async pullRemote(remoteName: string, auth: HttpsAuthInput): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('pull_remote', {
      path: this.repoPath!,
      remoteName,
      username: auth.username,
      password: auth.password
    });
  }

  async pushRemote(remoteName: string, auth: HttpsAuthInput): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('push_remote', {
      path: this.repoPath!,
      remoteName,
      username: auth.username,
      password: auth.password
    });
  }

  async fetchSsh(remoteName: string, auth: SshAuthInput): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('fetch_ssh', {
      path: this.repoPath!,
      remoteName,
      keyPath: auth.keyPath,
      passphrase: auth.passphrase ?? null
    });
  }

  async pullSsh(remoteName: string, auth: SshAuthInput): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('pull_ssh', {
      path: this.repoPath!,
      remoteName,
      keyPath: auth.keyPath,
      passphrase: auth.passphrase ?? null
    });
  }

  async pushSsh(remoteName: string, auth: SshAuthInput): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('push_ssh', {
      path: this.repoPath!,
      remoteName,
      keyPath: auth.keyPath,
      passphrase: auth.passphrase ?? null
    });
  }

  async listRemotes(): Promise<RemoteInfo[]> {
    if (!this.repoPath || !this.isGitRepository) return [];
    return tauriInvoke<RawRemoteInfo[]>('list_remotes', { path: this.repoPath! });
  }

  async addRemote(name: string, url: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('add_remote', {
      path: this.repoPath!,
      name: name.trim(),
      url: url.trim()
    });
  }

  async renameRemote(oldName: string, newName: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('rename_remote', {
      path: this.repoPath!,
      oldName: oldName.trim(),
      newName: newName.trim()
    });
  }

  async setRemoteUrl(name: string, url: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('set_remote_url', {
      path: this.repoPath!,
      name: name.trim(),
      newUrl: url.trim()
    });
  }

  async removeRemote(name: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('remove_remote', {
      path: this.repoPath!,
      name: name.trim()
    });
  }

  async getSyncStatus(remoteName: string): Promise<SyncStatus> {
    this.ensureGitRepository();
    const raw = await tauriInvoke<RawSyncStatus>('sync_status', {
      path: this.repoPath!,
      remoteName
    });
    return toSyncStatus(raw);
  }

  async initRepository(path: string): Promise<void> {
    const target = path.trim() || this.repoPath;
    if (!target) {
      throw new Error('E_REPO_EMPTY: repository path is empty');
    }
    await tauriInvoke<void>('git_init', { path: target });
    this.repoPath = target;
    this.isGitRepository = true;
    setPersistedRepoPath(target);
  }

  async getGitUserConfig(): Promise<GitUserConfig> {
    this.ensureGitRepository();
    const raw = await tauriInvoke<{ name?: string | null; email?: string | null }>('get_git_config', {
      path: this.repoPath!
    });
    return {
      name: raw.name ?? null,
      email: raw.email ?? null
    };
  }

  async setGitUserConfig(name: string, email: string): Promise<void> {
    this.ensureGitRepository();
    return tauriInvoke<void>('set_git_config', {
      path: this.repoPath!,
      name,
      email
    });
  }

  private ensureGitRepository(): void {
    if (!this.repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    if (!this.isGitRepository) {
      throw new Error('E_REPO_NOT_GIT: selected folder is not a git repository');
    }
  }
}
