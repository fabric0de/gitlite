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

export interface GitDataProvider {
  kind: 'mock' | 'tauri';
  getRepositoryPath(): string | null;
  clearRepositoryPath(): Promise<void>;
  pickRepositoryPath(startDir?: string): Promise<string | null>;
  setRepositoryPath(path: string): Promise<void>;
  getRepository(): Promise<RepositoryMeta>;
  getBranches(): Promise<BranchInfo[]>;
  createBranch(name: string): Promise<void>;
  checkoutBranch(name: string): Promise<void>;
  deleteBranch(name: string): Promise<void>;
  getChanges(): Promise<ChangeItem[]>;
  stageFiles(files: string[]): Promise<void>;
  unstageFiles(files: string[]): Promise<void>;
  commitChanges(message: string, description?: string): Promise<string>;
  getStashes(): Promise<StashEntry[]>;
  createStash(message?: string): Promise<void>;
  applyStash(index: number): Promise<void>;
  dropStash(index: number): Promise<void>;
  getCommits(reference?: string): Promise<CommitSummary[]>;
  getDiffForCommit(hash: string): Promise<DiffFile[]>;
  cherryPickCommit(hash: string): Promise<string>;
  resetCurrentBranch(hash: string, mode: 'soft' | 'mixed' | 'hard'): Promise<void>;
  createBranchFromCommit(name: string, hash: string): Promise<void>;
  checkoutCommit(hash: string): Promise<void>;
  revertCommit(hash: string): Promise<string>;
  fetchRemote(remoteName: string, auth: HttpsAuthInput): Promise<void>;
  pullRemote(remoteName: string, auth: HttpsAuthInput): Promise<void>;
  pushRemote(remoteName: string, auth: HttpsAuthInput): Promise<void>;
  fetchSsh(remoteName: string, auth: SshAuthInput): Promise<void>;
  pullSsh(remoteName: string, auth: SshAuthInput): Promise<void>;
  pushSsh(remoteName: string, auth: SshAuthInput): Promise<void>;
  listRemotes(): Promise<RemoteInfo[]>;
  addRemote(name: string, url: string): Promise<void>;
  renameRemote(oldName: string, newName: string): Promise<void>;
  setRemoteUrl(name: string, url: string): Promise<void>;
  removeRemote(name: string): Promise<void>;
  getSyncStatus(remoteName: string): Promise<SyncStatus>;
  initRepository(path: string): Promise<void>;
  getGitUserConfig(): Promise<GitUserConfig>;
  setGitUserConfig(name: string, email: string): Promise<void>;
}
