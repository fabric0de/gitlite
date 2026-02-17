import type { GitDataProvider } from './gitDataProvider';
import {
  MOCK_BRANCHES,
  MOCK_CHANGES,
  MOCK_COMMITS,
  MOCK_DIFFS,
  MOCK_REPOSITORY,
  MOCK_STASHES
} from '../mocks/mockData';
import type {
  ChangeItem,
  CommitSummary,
  GitUserConfig,
  HttpsAuthInput,
  RemoteInfo,
  SshAuthInput,
  StashEntry,
  SyncStatus
} from '../types/git';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type WindowWithGitLiteE2E = Window &
  typeof globalThis & {
    __GITLITE_E2E_PICK_PATHS__?: string[];
  };

let stashes: StashEntry[] = clone(MOCK_STASHES);
let changes: ChangeItem[] = clone(MOCK_CHANGES);
let commits: CommitSummary[] = clone(MOCK_COMMITS);
let branches = clone(MOCK_BRANCHES);
let remotes: RemoteInfo[] = [{ name: 'origin', url: 'https://github.com/fabric0de/gitlite.git' }];
let gitUserConfig: GitUserConfig = { name: 'fabric0de', email: 'junghyeonkim.dev@gmail.com' };
let repoPath: string | null = null;

function syntheticHash(index: number): string {
  return `c${index.toString(16).padStart(6, '0')}`;
}

function buildLargeScenario(commitCount = 1400): {
  commits: CommitSummary[];
  branches: typeof branches;
  changes: ChangeItem[];
  stashes: StashEntry[];
  remotes: RemoteInfo[];
} {
  const baseEpoch = Math.floor(Date.now() / 1000);
  const largeCommits: CommitSummary[] = Array.from({ length: commitCount }, (_, index) => {
    const primaryParent = index + 1 < commitCount ? syntheticHash(index + 1) : null;
    const mergeParent = index % 120 === 0 && index + 18 < commitCount ? syntheticHash(index + 18) : null;
    const parents = [primaryParent, mergeParent].filter((value): value is string => !!value);

    return {
      hash: syntheticHash(index),
      author: index % 3 === 0 ? 'fabric0de' : index % 3 === 1 ? 'GitLite Bot' : 'Open Source Dev',
      message:
        index % 40 === 0
          ? `merge: stabilize lane model #${index}`
          : `perf: synthetic commit ${index}`,
      date: baseEpoch - index * 3600,
      parents
    };
  });

  const largeBranches = [
    {
      name: 'main',
      isCurrent: true,
      isRemote: false,
      targetHash: largeCommits[0]?.hash ?? null
    },
    {
      name: 'release/v1',
      isCurrent: false,
      isRemote: false,
      targetHash: largeCommits[120]?.hash ?? null
    },
    {
      name: 'feature/graph-lanes',
      isCurrent: false,
      isRemote: false,
      targetHash: largeCommits[320]?.hash ?? null
    },
    {
      name: 'feature/sync-ux',
      isCurrent: false,
      isRemote: false,
      targetHash: largeCommits[540]?.hash ?? null
    },
    {
      name: 'origin/main',
      isCurrent: false,
      isRemote: true,
      targetHash: largeCommits[0]?.hash ?? null
    },
    {
      name: 'origin/release/v1',
      isCurrent: false,
      isRemote: true,
      targetHash: largeCommits[120]?.hash ?? null
    },
    {
      name: 'origin/feature/graph-lanes',
      isCurrent: false,
      isRemote: true,
      targetHash: largeCommits[320]?.hash ?? null
    }
  ];

  return {
    commits: largeCommits,
    branches: largeBranches,
    changes: clone(MOCK_CHANGES),
    stashes: clone(MOCK_STASHES),
    remotes: [{ name: 'origin', url: 'https://github.com/fabric0de/gitlite.git' }]
  };
}

function resolveLargeCommitCount(path: string): number | null {
  const normalized = path.toLowerCase();
  if (normalized.includes('gitlite-large')) return 1400;
  if (normalized.includes('gitlite-5k')) return 5000;
  if (normalized.includes('gitlite-10k')) return 10_000;
  if (normalized.includes('gitlite-20k')) return 20_000;
  return null;
}

function resetScenario(path: string) {
  const commitCount = resolveLargeCommitCount(path);
  if (commitCount) {
    const large = buildLargeScenario(commitCount);
    commits = large.commits;
    branches = large.branches;
    changes = large.changes;
    stashes = large.stashes;
    remotes = large.remotes;
    return;
  }

  stashes = clone(MOCK_STASHES);
  changes = clone(MOCK_CHANGES);
  commits = clone(MOCK_COMMITS);
  branches = clone(MOCK_BRANCHES);
  remotes = [{ name: 'origin', url: 'https://github.com/fabric0de/gitlite.git' }];
}

function currentBranchName(): string {
  return branches.find((branch) => !branch.isRemote && branch.isCurrent)?.name ?? 'main';
}

function currentSyncStatus(): SyncStatus {
  return {
    branch: currentBranchName(),
    hasUpstream: remotes.length > 0,
    ahead: 0,
    behind: 0
  };
}

function normalizeStashes(next: StashEntry[]): StashEntry[] {
  return next.map((stash, index) => ({ ...stash, index }));
}

function localBranchExists(name: string): boolean {
  return branches.some((branch) => !branch.isRemote && branch.name === name);
}

function updateCurrentBranchTarget(hash: string) {
  branches = branches.map((branch) =>
    !branch.isRemote && branch.isCurrent ? { ...branch, targetHash: hash } : branch
  );
}

export const mockGitProvider: GitDataProvider = {
  kind: 'mock',

  getRepositoryPath() {
    return repoPath;
  },

  async clearRepositoryPath() {
    repoPath = null;
  },

  async pickRepositoryPath(startDir?: string) {
    if (typeof window === 'undefined') return null;
    const e2eWindow = window as WindowWithGitLiteE2E;
    const queuedPaths = e2eWindow.__GITLITE_E2E_PICK_PATHS__;
    if (Array.isArray(queuedPaths) && queuedPaths.length > 0) {
      const nextPath = queuedPaths.pop()?.trim();
      return nextPath || null;
    }
    const initial = startDir?.trim() || repoPath || '';
    const picked = window.prompt('Select git repository path', initial);
    const trimmed = picked?.trim() || '';
    return trimmed || null;
  },

  async setRepositoryPath(path: string) {
    const trimmed = path.trim();
    if (!trimmed) {
      throw new Error('E_REPO_EMPTY: repository path is empty');
    }
    resetScenario(trimmed);
    repoPath = trimmed;
  },

  async getRepository() {
    if (!repoPath) {
      return {
        name: 'No repository selected',
        path: '',
        currentBranch: '-',
        isGitRepository: false
      };
    }
    const currentBranch = branches.find((branch) => !branch.isRemote && branch.isCurrent)?.name ?? '-';
    const name = repoPath.split('/').filter(Boolean).pop() || repoPath;
    return {
      ...clone(MOCK_REPOSITORY),
      name,
      path: repoPath,
      currentBranch,
      isGitRepository: true
    };
  },

  async getBranches() {
    if (!repoPath) return [];
    return clone(branches);
  },

  async createBranch(name: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const normalized = name.trim();
    if (!normalized) {
      throw new Error('E_BRANCH_EMPTY: branch name is required');
    }
    if (localBranchExists(normalized)) {
      throw new Error(`E_BRANCH_EXISTS: ${normalized}`);
    }

    branches = [
      ...branches,
      {
        name: normalized,
        isCurrent: false,
        isRemote: false,
        targetHash: commits[0]?.hash ?? null
      }
    ];
  },

  async checkoutBranch(name: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    if (!localBranchExists(name)) {
      throw new Error(`E_BRANCH_NOT_FOUND: ${name}`);
    }

    branches = branches.map((branch) =>
      !branch.isRemote
        ? {
            ...branch,
            isCurrent: branch.name === name
          }
        : branch
    );
  },

  async deleteBranch(name: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const branch = branches.find((item) => !item.isRemote && item.name === name);
    if (!branch) {
      throw new Error(`E_BRANCH_NOT_FOUND: ${name}`);
    }
    if (branch.isCurrent) {
      throw new Error('E_BRANCH_DELETE_CURRENT: cannot delete current branch');
    }

    branches = branches.filter((item) => item.isRemote || item.name !== name);
  },

  async getChanges() {
    if (!repoPath) return [];
    return clone(changes);
  },

  async stageFiles(files: string[]) {
    if (!repoPath || files.length === 0) return;
    const fileSet = new Set(files);
    changes = changes.map((change) => (fileSet.has(change.path) ? { ...change, staged: true } : change));
  },

  async unstageFiles(files: string[]) {
    if (!repoPath || files.length === 0) return;
    const fileSet = new Set(files);
    changes = changes.map((change) => (fileSet.has(change.path) ? { ...change, staged: false } : change));
  },

  async commitChanges(message: string, _description?: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const normalized = message.trim();
    if (!normalized) {
      throw new Error('E_COMMIT_EMPTY_MESSAGE: commit message is required');
    }

    if (!changes.some((change) => change.staged)) {
      throw new Error('E_COMMIT_NO_STAGED: no staged changes');
    }

    const hash = Math.random().toString(16).slice(2, 9);
    const newCommit: CommitSummary = {
      hash,
      author: 'fabric0de',
      message: normalized,
      date: Date.now(),
      parents: commits.length > 0 ? [commits[0].hash] : []
    };
    commits = [newCommit, ...commits];
    updateCurrentBranchTarget(hash);
    changes = changes.filter((change) => !change.staged);
    return hash;
  },

  async getStashes() {
    if (!repoPath) return [];
    return clone(stashes);
  },

  async createStash(message?: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const now = Date.now();
    stashes = normalizeStashes([
      {
        index: 0,
        message: message?.trim() || 'WIP: temporary snapshot from prototype UI',
        author: 'fabric0de',
        date: now
      },
      ...stashes
    ]);
  },

  async applyStash(index: number) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const exists = stashes.some((stash) => stash.index === index);
    if (!exists) {
      throw new Error(`E_STASH_INVALID_INDEX: ${index}`);
    }
  },

  async dropStash(index: number) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    stashes = normalizeStashes(stashes.filter((stash) => stash.index !== index));
  },

  async getCommits(_reference?: string) {
    if (!repoPath) return [];
    return clone(commits);
  },

  async getDiffForCommit(hash: string) {
    if (!repoPath) return [];
    return clone(MOCK_DIFFS[hash] || []);
  },

  async cherryPickCommit(hash: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }

    const target = commits.find((commit) => commit.hash === hash);
    if (!target) {
      throw new Error(`E_CHERRYPICK_COMMIT_NOT_FOUND: ${hash}`);
    }

    const newHash = Math.random().toString(16).slice(2, 9);
    const newCommit: CommitSummary = {
      hash: newHash,
      author: 'fabric0de',
      message: target.message,
      date: Date.now(),
      parents: commits.length > 0 ? [commits[0].hash] : []
    };
    commits = [newCommit, ...commits];
    updateCurrentBranchTarget(newHash);
    return newHash;
  },

  async resetCurrentBranch(hash: string, _mode: 'soft' | 'mixed' | 'hard') {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const targetIndex = commits.findIndex((commit) => commit.hash === hash);
    if (targetIndex < 0) {
      throw new Error(`E_RESET_COMMIT_NOT_FOUND: ${hash}`);
    }
    commits = commits.slice(targetIndex);
    updateCurrentBranchTarget(commits[0]?.hash ?? hash);
  },

  async createBranchFromCommit(name: string, hash: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const normalized = name.trim();
    if (!normalized) {
      throw new Error('E_BRANCH_EMPTY: branch name is required');
    }
    if (localBranchExists(normalized)) {
      throw new Error(`E_BRANCH_EXISTS: ${normalized}`);
    }
    branches = [
      ...branches,
      {
        name: normalized,
        isCurrent: false,
        isRemote: false,
        targetHash: hash
      }
    ];
  },

  async checkoutCommit(hash: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const target = commits.find((commit) => commit.hash === hash);
    if (!target) {
      throw new Error(`E_CHECKOUT_COMMIT_NOT_FOUND: ${hash}`);
    }
    branches = branches.map((branch) => (!branch.isRemote ? { ...branch, isCurrent: false } : branch));
  },

  async revertCommit(hash: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const target = commits.find((commit) => commit.hash === hash);
    if (!target) {
      throw new Error(`E_REVERT_COMMIT_NOT_FOUND: ${hash}`);
    }
    const newHash = Math.random().toString(16).slice(2, 9);
    const newCommit: CommitSummary = {
      hash: newHash,
      author: 'fabric0de',
      message: `Revert "${target.message}"`,
      date: Date.now(),
      parents: commits.length > 0 ? [commits[0].hash] : []
    };
    commits = [newCommit, ...commits];
    updateCurrentBranchTarget(newHash);
    return newHash;
  },

  async fetchRemote(_remoteName: string, _auth: HttpsAuthInput) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
  },

  async pullRemote(_remoteName: string, _auth: HttpsAuthInput) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
  },

  async pushRemote(_remoteName: string, _auth: HttpsAuthInput) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
  },

  async fetchSsh(_remoteName: string, _auth: SshAuthInput) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
  },

  async pullSsh(_remoteName: string, _auth: SshAuthInput) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
  },

  async pushSsh(_remoteName: string, _auth: SshAuthInput) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
  },

  async listRemotes() {
    if (!repoPath) return [];
    return clone(remotes);
  },

  async addRemote(name: string, url: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const normalizedName = name.trim();
    const normalizedUrl = url.trim();
    if (!normalizedName || !normalizedUrl) {
      throw new Error('E_REMOTE_INVALID: remote name and url are required');
    }
    if (remotes.some((remote) => remote.name === normalizedName)) {
      throw new Error(`E_REMOTE_EXISTS: ${normalizedName}`);
    }
    remotes = [...remotes, { name: normalizedName, url: normalizedUrl }];
  },

  async renameRemote(oldName: string, newName: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const oldNormalized = oldName.trim();
    const newNormalized = newName.trim();
    if (!oldNormalized || !newNormalized) {
      throw new Error('E_REMOTE_INVALID: remote name is required');
    }
    remotes = remotes.map((remote) =>
      remote.name === oldNormalized ? { ...remote, name: newNormalized } : remote
    );
  },

  async setRemoteUrl(name: string, url: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    const normalizedName = name.trim();
    const normalizedUrl = url.trim();
    if (!normalizedName || !normalizedUrl) {
      throw new Error('E_REMOTE_INVALID: remote name and url are required');
    }
    remotes = remotes.map((remote) =>
      remote.name === normalizedName ? { ...remote, url: normalizedUrl } : remote
    );
  },

  async removeRemote(name: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    remotes = remotes.filter((remote) => remote.name !== name.trim());
  },

  async getSyncStatus(_remoteName: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    return currentSyncStatus();
  },

  async initRepository(path: string) {
    const normalized = path.trim();
    if (!normalized) {
      throw new Error('E_REPO_EMPTY: repository path is empty');
    }
    repoPath = normalized;
  },

  async getGitUserConfig() {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    return clone(gitUserConfig);
  },

  async setGitUserConfig(name: string, email: string) {
    if (!repoPath) {
      throw new Error('E_REPO_MISSING: repository path is not set');
    }
    gitUserConfig = {
      name: name.trim() || null,
      email: email.trim() || null
    };
  }
};
