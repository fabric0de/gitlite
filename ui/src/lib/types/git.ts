export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface RepositoryMeta {
  name: string;
  path: string;
  currentBranch: string;
  isGitRepository: boolean;
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  targetHash?: string | null;
}

export interface ChangeItem {
  path: string;
  status: ChangeStatus;
  staged: boolean;
}

export interface StashEntry {
  index: number;
  message: string;
  author: string;
  date: number;
}

export interface CommitSummary {
  hash: string;
  author: string;
  message: string;
  date: number;
  parents: string[];
}

export type DiffLineKind = 'context' | 'add' | 'delete';

export interface DiffLine {
  kind: DiffLineKind;
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
}

export interface DiffFile {
  path: string;
  lines: DiffLine[];
}

export interface RemoteInfo {
  name: string;
  url: string | null;
}

export interface SyncStatus {
  branch: string;
  hasUpstream: boolean;
  ahead: number;
  behind: number;
}

export interface HttpsAuthInput {
  username: string;
  password: string;
}

export interface SshAuthInput {
  keyPath: string;
  passphrase?: string;
}

export interface GitUiError {
  code: string;
  message: string;
  actionable?: string;
}

export interface GitUserConfig {
  name: string | null;
  email: string | null;
}
