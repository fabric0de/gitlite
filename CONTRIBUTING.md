# Contributing

Thanks for your interest in contributing to GitLite.

## Code of Conduct
By participating, you agree to follow `CODE_OF_CONDUCT.md`.

## How to contribute
- Open an issue before large or potentially breaking changes.
- Keep pull requests focused and reviewable.
- Include tests/docs updates when behavior changes.

## Development setup
Backend checks:

```bash
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test -q
```

UI checks:

```bash
cd ui
pnpm install
pnpm check
pnpm vitest
pnpm test:e2e
```

Root shortcuts:

```bash
pnpm run ui:install
pnpm run ui:check
pnpm run ui:test
pnpm run ui:e2e
```

UI note:
- Tauri runtime uses live IPC provider by default (`ui/src/lib/services/tauriGitProvider.ts`).
- Mock provider (`ui/src/lib/services/mockGitProvider.ts`) is used for tests and browser-only preview.
- Keep UI changes provider-driven so provider wiring can be swapped without UI rewrites.

## Commit message convention
This project uses **Conventional Commits**.

Format:
```text
<type>(optional scope): <short summary>
```

Examples:
- `fix(pull): block pull on dirty worktree`
- `feat(remote): add rename remote command`
- `docs(ipc): clarify pull error prefixes`
- `ci: enforce clippy strict mode`

Recommended types:
- `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `chore`

Release note tip:
- Prefer `feat` and `fix` for user-facing changes, because they are used by automated release note generation.
- Version tags follow `v0.x.y` during pre-1.0 (see `docs/versioning-policy.md`).

## Local commit hook (recommended)
Enable the repository hook so commit messages are validated locally.

```bash
./scripts/setup-hooks.sh
```

The `commit-msg` hook validates the first line with:

```text
<type>(optional scope): <short summary>
```

Examples:
- `feat(staging): add partial stage command`
- `fix(ssh): return explicit auth failure prefix`

You can verify hook setup with:

```bash
git config --get core.hooksPath
```

## Pull request title convention
PR titles should also follow Conventional Commits.

Examples:
- `fix(diff): avoid moved path in map entry logic`
- `ci: install linux system dependencies for tauri`

## Pull request checklist
- Explain **why** the change is needed.
- Summarize **what** changed.
- Include validation output.
- Note compatibility impact and risks.

## Issue templates
Use the GitHub issue templates:
- Bug report
- Feature request
- UI proposal

## Repository standards
- Code ownership: `.github/CODEOWNERS`
- Editor defaults: `.editorconfig`
- Dependency updates: `.github/dependabot.yml`
