import type {
  BranchInfo,
  ChangeItem,
  CommitSummary,
  DiffFile,
  RepositoryMeta,
  StashEntry
} from '../types/git';

export const MOCK_REPOSITORY: RepositoryMeta = {
  name: 'gitlite',
  path: '/Users/kimjunghyeon/my-workspace/GitLite',
  currentBranch: 'main',
  isGitRepository: true
};

export const MOCK_BRANCHES: BranchInfo[] = [
  { name: 'main', isCurrent: true, isRemote: false, targetHash: '8c0977e' },
  { name: 'feature/ui-v2-prototype-shell', isCurrent: false, isRemote: false, targetHash: '6f85307' },
  { name: 'origin/main', isCurrent: false, isRemote: true, targetHash: '8c0977e' },
  {
    name: 'origin/feature/ui-v2-prototype-shell',
    isCurrent: false,
    isRemote: true,
    targetHash: '6f85307'
  }
];

export const MOCK_CHANGES: ChangeItem[] = [
  { path: 'src/App.svelte', status: 'modified', staged: true },
  { path: 'src/lib/components/layout/AppShell.svelte', status: 'added', staged: false },
  { path: 'src/lib/components/diff/DiffTextView.svelte', status: 'modified', staged: false },
  { path: 'README.md', status: 'modified', staged: true }
];

export const MOCK_STASHES: StashEntry[] = [
  {
    index: 0,
    message: 'WIP: compact sidebar interaction polish',
    author: 'fabric0de',
    date: 1739400000000
  },
  {
    index: 1,
    message: 'Experiment: diff typography spacing',
    author: 'fabric0de',
    date: 1739300000000
  }
];

export const MOCK_COMMITS: CommitSummary[] = [
  {
    hash: 'c3d4e5f',
    author: 'developer',
    message: 'Merge branch feature/navigation',
    date: 1739511000000,
    parents: ['a1b2c3d', 'b2c3d4e']
  },
  {
    hash: 'b2c3d4e',
    author: 'developer',
    message: 'feat(ui): redesign navigation component',
    date: 1739508000000,
    parents: ['040ecb9']
  },
  {
    hash: 'a1b2c3d',
    author: 'developer',
    message: 'Merge branch feature/auth into main',
    date: 1739510000000,
    parents: ['8c0977e', 'f4e5d6c']
  },
  {
    hash: 'f4e5d6c',
    author: 'developer',
    message: 'feat(auth): add login form validation',
    date: 1739509000000,
    parents: ['6f85307']
  },
  {
    hash: '8c0977e',
    author: 'fabric0de',
    message: 'test(branch): make default branch handling CI-safe',
    date: 1739410100000,
    parents: ['6f85307']
  },
  {
    hash: '6f85307',
    author: 'fabric0de',
    message: 'ci: add release-please workflow and manifest config',
    date: 1739409000000,
    parents: ['040ecb9']
  },
  {
    hash: '040ecb9',
    author: 'fabric0de',
    message: 'chore: align repository with OSS baseline conventions',
    date: 1739407000000,
    parents: ['79aa523']
  },
  {
    hash: '79aa523',
    author: 'fabric0de',
    message: 'chore: add local commit-msg hook for conventional commits',
    date: 1739405000000,
    parents: ['c971d4e']
  }
];

export const MOCK_DIFFS: Record<string, DiffFile[]> = {
  '8c0977e': [
    {
      path: 'src-tauri/src/git/branch.rs',
      lines: [
        { kind: 'context', oldNumber: 160, newNumber: 160, text: 'fn test_delete_branch_success() {' },
        { kind: 'add', oldNumber: null, newNumber: 161, text: '    let default_branch = current_branch_name(&test_repo);' },
        { kind: 'context', oldNumber: 168, newNumber: 169, text: '    Command::new("git")' },
        { kind: 'delete', oldNumber: 170, newNumber: null, text: '        .args(["checkout", "main"])' },
        { kind: 'add', oldNumber: null, newNumber: 171, text: '        .args(["checkout", &default_branch])' }
      ]
    }
  ],
  '6f85307': [
    {
      path: '.github/workflows/release-please.yml',
      lines: [
        { kind: 'add', oldNumber: null, newNumber: 1, text: 'name: Release Please' },
        { kind: 'add', oldNumber: null, newNumber: 2, text: '' },
        { kind: 'add', oldNumber: null, newNumber: 3, text: 'on:' },
        { kind: 'add', oldNumber: null, newNumber: 4, text: '  push:' },
        { kind: 'add', oldNumber: null, newNumber: 5, text: '    branches: [main]' }
      ]
    }
  ],
  '040ecb9': [
    {
      path: '.github/dependabot.yml',
      lines: [
        { kind: 'context', oldNumber: 4, newNumber: 4, text: '  - package-ecosystem: "cargo"' },
        { kind: 'add', oldNumber: null, newNumber: 9, text: '    labels:' },
        { kind: 'add', oldNumber: null, newNumber: 10, text: '      - "dependencies"' },
        { kind: 'add', oldNumber: null, newNumber: 11, text: '      - "rust"' }
      ]
    }
  ],
  '79aa523': [
    {
      path: '.githooks/commit-msg',
      lines: [
        { kind: 'add', oldNumber: null, newNumber: 1, text: '#!/usr/bin/env sh' },
        { kind: 'add', oldNumber: null, newNumber: 2, text: 'set -eu' },
        { kind: 'add', oldNumber: null, newNumber: 3, text: '' },
        { kind: 'add', oldNumber: null, newNumber: 4, text: 'PATTERN=\'^(feat|fix|docs|refactor|test|ci|chore)...\'' }
      ]
    }
  ]
};
