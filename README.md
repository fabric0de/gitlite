# GitLite

GitLite is a desktop Git client built with Rust, Tauri, and Svelte.

## Features
- Repository/branch/commit/diff workflows
- Stage/unstage/commit operations
- Remote sync over HTTPS and SSH (`fetch`, `pull`, `push`)
- Stash management (`list`, `create`, `apply`, `drop`)
- GitHub OAuth device flow integration
- Multi-project tabs in one window
- Responsive 3-panel UI with Dark/Light/System themes

## Tech Stack
- Backend: Rust, `git2`, Tauri 2
- Frontend: Svelte 5, Vite, TailwindCSS
- Testing: Vitest, Playwright, Rust tests

## Repository Structure
- `/Users/kimjunghyeon/my-workspace/GitLite/src-tauri`: Tauri + Rust backend
- `/Users/kimjunghyeon/my-workspace/GitLite/ui`: Svelte frontend
- `/Users/kimjunghyeon/my-workspace/GitLite/docs/IPC.md`: IPC contract

## Quick Start

### Requirements
- Rust (stable)
- Node.js 20+
- pnpm

### Install
```bash
pnpm run ui:install
```

### Run UI only
```bash
pnpm run ui:dev
```

### Run Tauri app
```bash
pnpm run tauri:dev
```

## Quality Checks
```bash
pnpm run check:all
```

This runs:
- `pnpm run ui:check`
- `pnpm run ui:test`
- `pnpm run ui:e2e`
- `pnpm run tauri:check`

For large-history UI performance checks:
```bash
pnpm run ui:e2e:perf
```

## GitHub OAuth
1. Create a GitHub OAuth App for device flow.
2. Set the Client ID in GitLite Settings.
3. Complete the login flow from the app.

In Tauri runtime, OAuth tokens are stored in the OS credential store via `keyring`.

## Releases
- Conventional Commits are required for clean release notes.
- `release-please` is used for release PR/tag automation.
- Versioning follows SemVer pre-1.0 with tags like `v0.x.y`.

## Documentation
- `/Users/kimjunghyeon/my-workspace/GitLite/CONTRIBUTING.md`
- `/Users/kimjunghyeon/my-workspace/GitLite/CODE_OF_CONDUCT.md`
- `/Users/kimjunghyeon/my-workspace/GitLite/SECURITY.md`
- `/Users/kimjunghyeon/my-workspace/GitLite/docs/IPC.md`
- `/Users/kimjunghyeon/my-workspace/GitLite/docs/versioning-policy.md`
- `/Users/kimjunghyeon/my-workspace/GitLite/docs/secrets-inventory.md`

## Local Git Hooks
```bash
./scripts/setup-hooks.sh
```

## License
MIT (`LICENSE`)
