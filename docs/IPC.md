# IPC Contract (Tauri Commands)

This document describes the public command contract exposed from `src-tauri/src/lib.rs`.
Most commands follow `Result<..., String>`.

## 1) Repository and Settings
- `is_git_repository(path: String) -> Result<bool, String>`
- `git_init(path: String) -> Result<(), String>`
- `pick_repository_folder(app, start_dir?) -> Result<Option<String>, String>`
- `load_settings()`, `save_settings(...)`
- `load_theme()`, `save_theme(...)`
- `get_git_config(...)`, `set_git_config(...)`

## 2) Branches, Commits, Diff
- `get_branches(path)` -> `Vec<Branch>`
- `create_branch(path, name)`
- `delete_branch(path, name)`
- `checkout_branch(path, name)`
- `merge_branch(path, source_branch)`
- `get_commits(path, limit, reference?)` -> `Vec<Commit>`
- `get_commit_diff(path, commit_hash)` -> `Vec<DiffFile>`
- `cherry_pick_commit(path, commit_hash) -> String`
- `reset_current_branch(path, commit_hash, mode)`
- `create_branch_from_commit(path, name, commit_hash)`
- `checkout_commit(path, commit_hash)`
- `revert_commit(path, commit_hash) -> String`

## 3) Status, Staging, Commit
- `get_status(path)` -> `Vec<FileStatus>`
- `stage_files(path, files)`
- `unstage_files(path, files)`
- `commit_changes(path, message, description)` -> `String` (commit OID)

## 4) Remote (HTTPS)
- `list_remotes(path)` -> `Vec<RemoteInfo>`
- `add_remote(path, name, url)`
- `remove_remote(path, name)`
- `rename_remote(path, old_name, new_name)`
- `set_remote_url(path, name, new_url)`
- `fetch_remote(path, remote_name, username, password)`
- `push_remote(path, remote_name, username, password)`
- `pull_remote(path, remote_name, username, password)`
- `sync_status(path, remote_name) -> SyncStatus`

## 5) Stash
- `list_stashes(path)` -> `Vec<StashEntry>`
- `create_stash(path, message?)`
- `apply_stash(path, index)`
- `drop_stash(path, index)`

## 6) Remote (SSH)
- `detect_ssh_keys()` -> `Vec<String>`
- `fetch_ssh(path, remote_name, key_path, passphrase)`
- `push_ssh(path, remote_name, key_path, passphrase)`
- `pull_ssh(path, remote_name, key_path, passphrase)`

## 7) GitHub OAuth (Device Flow)
- `github_oauth_start(client_id) -> GitHubDeviceCode`
- `github_oauth_poll(client_id, device_code) -> GitHubAuthPollResult`
- `github_fetch_user(access_token) -> GitHubUser`
- `save_github_token(access_token) -> ()`
- `load_github_token() -> Option<String>`
- `delete_github_token() -> ()`

## 8) Runtime Diagnostics
- `get_runtime_info() -> RuntimeInfo`
- `read_runtime_logs(limit?) -> Vec<String>`

`RuntimeInfo`
- `app_version: String`
- `os: String`
- `arch: String`
- `profile: String` (`debug | release`)
- `log_file: String`

`GitHubDeviceCode`
- `device_code: String`
- `user_code: String`
- `verification_uri: String`
- `verification_uri_complete: Option<String>`
- `expires_in: u64`
- `interval: u64`

`GitHubAuthPollResult`
- `status: String` (`pending | slow_down | success | denied | expired`)
- `access_token: Option<String>`
- `token_type: Option<String>`
- `scope: Option<String>`
- `user: Option<GitHubUser>`
- `retry_after: Option<u64>`

`GitHubUser`
- `login: String`
- `avatar_url: String`
- `name: Option<String>`

## Core Data Types

### Branch
- `name: String`
- `is_current: bool`
- `is_remote: bool`
- `target_hash: Option<String>`

### Commit
- `hash: String`
- `author: String`
- `message: String`
- `date: i64`
- `parents: Vec<String>`

### FileStatus
- `path: String`
- `status: String` (`added|modified|deleted|renamed`)
- `is_staged: bool`

### DiffFile
- `path: String`
- `is_binary: bool`
- `hunks: Vec<DiffHunk>`

### StashEntry
- `index: usize`
- `message: String`
- `author: String`
- `date: i64`

### SyncStatus
- `branch: String`
- `has_upstream: bool`
- `ahead: usize`
- `behind: usize`

## Error Prefix Conventions

### Pull-related
- `E_PULL_DIRTY`: pull blocked due to uncommitted local changes
- `E_PULL_NON_FF`: pull requires merge/rebase (fast-forward only policy)
- `E_PULL_DETACHED`: detached HEAD
- `E_HEAD_UNBORN`: repository has no initial commit
- `E_PULL_AUTH`: authentication failure
- `E_PULL_NETWORK`: network/transport failure

### Stash-related
- `E_STASH_EMPTY`: no local changes to stash
- `E_STASH_INVALID_INDEX`: requested stash index does not exist
- `E_STASH_APPLY_CONFLICT`: stash apply introduced conflicts

### GitHub OAuth-related
- `E_GITHUB_CLIENT_ID_MISSING`: OAuth client id is not configured in UI
- `E_GITHUB_OAUTH_*`: device flow start/poll/network failures
- `E_GITHUB_USER_*`: token succeeded but user profile fetch/parsing failed
- `E_GITHUB_KEYCHAIN_*`: OS keychain read/write/delete failures

### Runtime diagnostics
- `E_RUNTIME_LOG_*`: runtime log initialization/read/write failures

UI consumers should parse by prefix instead of exact full-string match.
