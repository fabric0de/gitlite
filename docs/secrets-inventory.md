# Secrets Inventory

This file lists secrets/variables needed when the GitHub repository is created.

## 1) Required for current CI/release flow

### GitHub Actions permissions (repository setting)
- `GITHUB_TOKEN` default permission: recommend `Read and write` for release automation.
- Allow Actions to create pull requests: required for release-please PR creation.

### Optional, but recommended immediately
- `CODE_SIGN_MACOS_*` (for signed macOS artifacts; names depend on chosen signing workflow)
- `CODE_SIGN_WINDOWS_*` (for signed Windows artifacts; names depend on chosen signing workflow)

## 2) Required for runtime app features

### GitHub OAuth App
- `GitHub OAuth Client ID` is entered by user in app Settings.
- Current implementation uses Device Flow and user-provided Client ID.
- Access tokens are stored in OS credential store (`keyring`) in Tauri runtime.

## 3) Recommended future additions

- Crash report endpoint DSN/token (if crash upload is introduced)
- Artifact notarization credentials (if macOS notarization pipeline is introduced)
- Publishing token for package/distribution channel (if auto-publish is introduced)

## Notes
- Do not commit private secrets into repository files.
- Keep this file as inventory only (names/usage), not secret values.
