use super::pull_policy::{apply_fast_forward, fetch_head_oid, prepare_pull_target};
use git2::{
    Cred, CredentialType, ErrorClass, ErrorCode, FetchOptions, PushOptions, RemoteCallbacks,
    Repository,
};

const E_PULL_AUTH: &str = "E_PULL_AUTH";
const E_PULL_NETWORK: &str = "E_PULL_NETWORK";
const E_PUSH_AUTH: &str = "E_PUSH_AUTH";
const E_PUSH_NETWORK: &str = "E_PUSH_NETWORK";
const E_PUSH_NON_FF: &str = "E_PUSH_NON_FF";
const E_PUSH_REJECTED: &str = "E_PUSH_REJECTED";

#[derive(serde::Serialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: Option<String>,
}

#[derive(serde::Serialize)]
pub struct SyncStatus {
    pub branch: String,
    pub has_upstream: bool,
    pub ahead: usize,
    pub behind: usize,
}

pub fn list_remotes(path: &str) -> Result<Vec<RemoteInfo>, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let remotes = repo
        .remotes()
        .map_err(|e| format!("Failed to list remotes: {}", e))?;

    let mut remote_infos = Vec::new();

    for name_str in remotes.iter().flatten() {
        let remote = repo
            .find_remote(name_str)
            .map_err(|e| format!("Failed to find remote '{}': {}", name_str, e))?;

        let url = remote.url().map(|s| s.to_string());

        remote_infos.push(RemoteInfo {
            name: name_str.to_string(),
            url,
        });
    }

    Ok(remote_infos)
}

pub fn add_remote(path: &str, name: &str, url: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.remote(name, url)
        .map_err(|e| format!("Failed to add remote '{}': {}", name, e))?;

    Ok(())
}

pub fn remove_remote(path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.remote_delete(name)
        .map_err(|e| format!("Failed to remove remote '{}': {}", name, e))?;

    Ok(())
}

pub fn rename_remote(path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let problems = repo.remote_rename(old_name, new_name).map_err(|e| {
        format!(
            "Failed to rename remote '{}' to '{}': {}",
            old_name, new_name, e
        )
    })?;

    // Log any changed refspecs but don't fail
    if !problems.is_empty() {
        eprintln!(
            "Warning: {} refspecs had to be updated during rename",
            problems.len()
        );
    }

    Ok(())
}

pub fn set_remote_url(path: &str, name: &str, new_url: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.remote_set_url(name, new_url)
        .map_err(|e| format!("Failed to set URL for remote '{}': {}", name, e))?;

    Ok(())
}

pub fn push(path: &str, remote_name: &str, username: &str, password: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let remote_name = normalize_remote_name(remote_name);

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let branch_name = head
        .shorthand()
        .ok_or("Failed to get HEAD branch name".to_string())?;
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    let mut remote = repo
        .find_remote(&remote_name)
        .map_err(|e| format!("Failed to find remote '{}': {}", remote_name, e))?;

    let provided_username = username.trim().to_string();
    let provided_password = password.to_string();
    let config = repo
        .config()
        .map_err(|e| format!("Failed to read repository config: {}", e))?;
    let mut push_status: Option<String> = None;

    let push_result = {
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(move |url, username_from_url, allowed_types| {
            resolve_https_cred(
                &config,
                Some(url),
                username_from_url,
                allowed_types,
                &provided_username,
                &provided_password,
            )
        });
        callbacks.push_update_reference(|_refname, status| {
            if let Some(status) = status {
                push_status = Some(status.to_string());
            }
            Ok(())
        });

        let mut options = PushOptions::new();
        options.remote_callbacks(callbacks);

        remote.push(&[refspec.as_str()], Some(&mut options))
    };

    if let Err(error) = push_result {
        return Err(format_push_error(error));
    }

    if let Some(status) = push_status {
        if is_non_fast_forward(&status) {
            return Err(format!(
                "{}: Push rejected: non-fast-forward. Please pull and try again.",
                E_PUSH_NON_FF
            ));
        }
        return Err(format!("{}: Push rejected: {}", E_PUSH_REJECTED, status));
    }

    Ok(())
}

pub fn pull(path: &str, remote_name: &str, username: &str, password: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let remote_name = normalize_remote_name(remote_name);
    fetch_remote_internal(&repo, &remote_name, username, password)?;

    let target = prepare_pull_target(&repo)?;
    let fetch_oid = fetch_head_oid(&repo)?;
    apply_fast_forward(&repo, &target.branch_ref_name, target.head_oid, fetch_oid)?;

    Ok(())
}

pub fn fetch_remote(
    path: &str,
    remote_name: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let remote_name = normalize_remote_name(remote_name);
    fetch_remote_internal(&repo, &remote_name, username, password)
}

pub fn sync_status(path: &str, remote_name: &str) -> Result<SyncStatus, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let remote_name = normalize_remote_name(remote_name);

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    if !head.is_branch() {
        return Err(format!(
            "{}: Sync status requires a checked-out local branch",
            crate::git::pull_policy::E_PULL_DETACHED
        ));
    }

    let branch = head
        .shorthand()
        .ok_or("Failed to resolve current branch name".to_string())?
        .to_string();
    let local_oid = head.target().ok_or(format!(
        "{}: Repository has no commits yet",
        crate::git::pull_policy::E_HEAD_UNBORN
    ))?;

    let remote_ref = format!("refs/remotes/{}/{}", remote_name, branch);
    let remote_target = repo
        .find_reference(&remote_ref)
        .ok()
        .and_then(|reference| reference.target());

    if let Some(remote_oid) = remote_target {
        let (ahead, behind) = repo
            .graph_ahead_behind(local_oid, remote_oid)
            .map_err(|e| format!("Failed to compute ahead/behind: {}", e))?;
        return Ok(SyncStatus {
            branch,
            has_upstream: true,
            ahead,
            behind,
        });
    }

    Ok(SyncStatus {
        branch,
        has_upstream: false,
        ahead: 0,
        behind: 0,
    })
}

fn normalize_remote_name(remote_name: &str) -> String {
    let trimmed = remote_name.trim();
    if trimmed.is_empty() {
        "origin".to_string()
    } else {
        trimmed.to_string()
    }
}

fn fetch_remote_internal(
    repo: &Repository,
    remote_name: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("Failed to find remote '{}': {}", remote_name, e))?;

    let provided_username = username.trim().to_string();
    let provided_password = password.to_string();
    let config = repo
        .config()
        .map_err(|e| format!("Failed to read repository config: {}", e))?;

    let fetch_result = {
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(move |url, username_from_url, allowed_types| {
            resolve_https_cred(
                &config,
                Some(url),
                username_from_url,
                allowed_types,
                &provided_username,
                &provided_password,
            )
        });

        let mut options = FetchOptions::new();
        options.remote_callbacks(callbacks);

        remote.fetch(&[] as &[&str], Some(&mut options), None)
    };

    if let Err(error) = fetch_result {
        return Err(format_fetch_error(error));
    }

    Ok(())
}

fn resolve_https_cred(
    config: &git2::Config,
    url: Option<&str>,
    username_from_url: Option<&str>,
    allowed_types: CredentialType,
    provided_username: &str,
    provided_password: &str,
) -> Result<Cred, git2::Error> {
    // 1) Try system credential helper first (Keychain/GCM/libsecret/etc.)
    if let Some(remote_url) = url {
        let fallback_username = if provided_username.is_empty() {
            None
        } else {
            Some(provided_username)
        };
        let helper_username = username_from_url.or(fallback_username);
        if let Ok(cred) = Cred::credential_helper(config, remote_url, helper_username) {
            return Ok(cred);
        }
    }

    // 2) Fall back to explicit username/password from UI if provided
    if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT)
        && !provided_username.is_empty()
        && !provided_password.is_empty()
    {
        return Cred::userpass_plaintext(provided_username, provided_password);
    }

    // 3) Last resort: default credential provider (platform specific)
    Cred::default()
}

fn is_non_fast_forward(status: &str) -> bool {
    let status = status.to_lowercase();
    status.contains("non-fast-forward")
        || status.contains("non fast forward")
        || status.contains("fetch first")
}

fn format_push_error(error: git2::Error) -> String {
    match error.code() {
        ErrorCode::NotFastForward => format!(
            "{}: Push rejected: non-fast-forward. Please pull and try again.",
            E_PUSH_NON_FF
        ),
        ErrorCode::Auth => format!("{}: Authentication failed: {}", E_PUSH_AUTH, error),
        _ => match error.class() {
            ErrorClass::Net | ErrorClass::Http | ErrorClass::Ssh | ErrorClass::Ssl => {
                format!("{}: Network error: {}", E_PUSH_NETWORK, error)
            }
            _ => format!("{}: Failed to push: {}", E_PUSH_REJECTED, error),
        },
    }
}

fn format_fetch_error(error: git2::Error) -> String {
    match error.code() {
        ErrorCode::Auth => format!("{}: Authentication failed: {}", E_PULL_AUTH, error),
        _ => match error.class() {
            ErrorClass::Net | ErrorClass::Http | ErrorClass::Ssh | ErrorClass::Ssl => {
                format!("{}: Network error: {}", E_PULL_NETWORK, error)
            }
            _ => format!("Failed to pull: {}", error),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Repository;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    fn run_git(args: &[&str], cwd: &PathBuf) {
        let output = Command::new("git")
            .args(args)
            .current_dir(cwd)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn current_branch_name(cwd: &PathBuf) -> String {
        let output = Command::new("git")
            .args(["rev-parse", "--abbrev-ref", "HEAD"])
            .current_dir(cwd)
            .output()
            .unwrap();
        assert!(output.status.success());
        String::from_utf8(output.stdout).unwrap().trim().to_string()
    }

    fn create_test_repo() -> (PathBuf, PathBuf, PathBuf) {
        let base_dir =
            std::env::temp_dir().join(format!("gitlite-remote-test-{}", uuid::Uuid::new_v4()));
        let local_dir = base_dir.join("local");
        let remote_dir = base_dir.join("remote");

        fs::create_dir_all(&local_dir).unwrap();
        fs::create_dir_all(&remote_dir).unwrap();

        Command::new("git")
            .args(["init", "--bare"])
            .current_dir(&remote_dir)
            .output()
            .expect("Failed to init bare repo");

        run_git(&["init"], &local_dir);

        run_git(&["config", "user.name", "Test User"], &local_dir);
        run_git(&["config", "user.email", "test@example.com"], &local_dir);

        fs::write(local_dir.join("test.txt"), "test content").unwrap();
        run_git(&["add", "."], &local_dir);
        run_git(&["commit", "-m", "Initial commit"], &local_dir);
        run_git(
            &["remote", "add", "origin", remote_dir.to_str().unwrap()],
            &local_dir,
        );

        (base_dir, local_dir, remote_dir)
    }

    #[test]
    fn test_push_success() {
        let (base_dir, local_dir, remote_dir) = create_test_repo();

        let result = push(
            local_dir.to_str().unwrap(),
            "origin",
            "test-user",
            "test-pass",
        );
        assert!(result.is_ok());

        let local_repo = Repository::open(&local_dir).unwrap();
        let head = local_repo.head().unwrap();
        let branch_name = head.shorthand().unwrap().to_string();
        let local_oid = head.target().unwrap();

        let remote_repo = Repository::open(&remote_dir).unwrap();
        let remote_ref = remote_repo
            .find_reference(&format!("refs/heads/{}", branch_name))
            .unwrap();
        assert_eq!(remote_ref.target(), Some(local_oid));

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_pull_success() {
        let (base_dir, local_dir, remote_dir) = create_test_repo();

        let branch_name = Repository::open(&local_dir)
            .unwrap()
            .head()
            .unwrap()
            .shorthand()
            .unwrap()
            .to_string();

        let result = push(
            local_dir.to_str().unwrap(),
            "origin",
            "test-user",
            "test-pass",
        );
        assert!(result.is_ok());

        fs::write(local_dir.join("test.txt"), "second content").unwrap();
        run_git(&["add", "."], &local_dir);
        run_git(&["commit", "-m", "Second commit"], &local_dir);

        let result = push(
            local_dir.to_str().unwrap(),
            "origin",
            "test-user",
            "test-pass",
        );
        assert!(result.is_ok());

        run_git(&["reset", "--hard", "HEAD~1"], &local_dir);

        let result = pull(
            local_dir.to_str().unwrap(),
            "origin",
            "test-user",
            "test-pass",
        );
        assert!(result.is_ok());

        let local_repo = Repository::open(&local_dir).unwrap();
        let local_head = local_repo.head().unwrap().target().unwrap();
        let remote_repo = Repository::open(&remote_dir).unwrap();
        let remote_head = remote_repo
            .find_reference(&format!("refs/heads/{}", branch_name))
            .unwrap()
            .target()
            .unwrap();

        assert_eq!(local_head, remote_head);

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_pull_rejects_dirty_worktree() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        fs::write(local_dir.join("test.txt"), "dirty local change").unwrap();

        let result = pull(
            local_dir.to_str().unwrap(),
            "origin",
            "test-user",
            "test-pass",
        );

        assert!(result.is_err());
        let message = result.unwrap_err();
        assert!(
            message.contains(crate::git::pull_policy::E_PULL_DIRTY),
            "actual: {}",
            message
        );

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_pull_rejects_non_fast_forward() {
        let (base_dir, local_dir, remote_dir) = create_test_repo();
        let branch_name = current_branch_name(&local_dir);

        assert!(push(local_dir.to_str().unwrap(), "origin", "u", "p").is_ok());

        let other_dir = base_dir.join("other");
        run_git(
            &[
                "clone",
                remote_dir.to_str().unwrap(),
                other_dir.to_str().unwrap(),
            ],
            &base_dir,
        );
        run_git(&["config", "user.name", "Other User"], &other_dir);
        run_git(&["config", "user.email", "other@example.com"], &other_dir);
        run_git(&["checkout", &branch_name], &other_dir);
        fs::write(other_dir.join("shared.txt"), "remote line").unwrap();
        run_git(&["add", "."], &other_dir);
        run_git(&["commit", "-m", "Remote commit"], &other_dir);
        run_git(&["push", "origin", &branch_name], &other_dir);

        fs::write(local_dir.join("local-only.txt"), "local line").unwrap();
        run_git(&["add", "."], &local_dir);
        run_git(&["commit", "-m", "Local commit"], &local_dir);

        let result = pull(local_dir.to_str().unwrap(), "origin", "u", "p");
        assert!(result.is_err());
        let message = result.unwrap_err();
        assert!(
            message.contains(crate::git::pull_policy::E_PULL_NON_FF),
            "actual: {}",
            message
        );

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_pull_rejects_detached_head() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        let output = Command::new("git")
            .args(["rev-parse", "HEAD~0"])
            .current_dir(&local_dir)
            .output()
            .unwrap();
        let head_oid = String::from_utf8(output.stdout).unwrap().trim().to_string();
        run_git(&["checkout", &head_oid], &local_dir);

        let result = pull(local_dir.to_str().unwrap(), "origin", "u", "p");
        assert!(result.is_err());
        let message = result.unwrap_err();
        assert!(
            message.contains(crate::git::pull_policy::E_PULL_DETACHED),
            "actual: {}",
            message
        );

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_list_remotes() {
        let (base_dir, local_dir, remote_dir) = create_test_repo();

        Command::new("git")
            .args([
                "remote",
                "add",
                "upstream",
                "https://github.com/test/repo.git",
            ])
            .current_dir(&local_dir)
            .output()
            .unwrap();

        let result = list_remotes(local_dir.to_str().unwrap());
        assert!(result.is_ok());

        let remotes = result.unwrap();
        assert_eq!(remotes.len(), 2);

        let origin = remotes.iter().find(|r| r.name == "origin");
        assert!(origin.is_some());
        assert_eq!(
            origin.unwrap().url,
            Some(remote_dir.to_str().unwrap().to_string())
        );

        let upstream = remotes.iter().find(|r| r.name == "upstream");
        assert!(upstream.is_some());
        assert_eq!(
            upstream.unwrap().url,
            Some("https://github.com/test/repo.git".to_string())
        );

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_add_remote() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        let result = add_remote(
            local_dir.to_str().unwrap(),
            "upstream",
            "https://github.com/test/repo.git",
        );
        assert!(result.is_ok());

        let remotes = list_remotes(local_dir.to_str().unwrap()).unwrap();
        let upstream = remotes.iter().find(|r| r.name == "upstream");
        assert!(upstream.is_some());
        assert_eq!(
            upstream.unwrap().url,
            Some("https://github.com/test/repo.git".to_string())
        );

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_remove_remote() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        add_remote(
            local_dir.to_str().unwrap(),
            "upstream",
            "https://github.com/test/repo.git",
        )
        .unwrap();

        let remotes_before = list_remotes(local_dir.to_str().unwrap()).unwrap();
        assert!(remotes_before.iter().any(|r| r.name == "upstream"));

        let result = remove_remote(local_dir.to_str().unwrap(), "upstream");
        assert!(result.is_ok());

        let remotes_after = list_remotes(local_dir.to_str().unwrap()).unwrap();
        assert!(!remotes_after.iter().any(|r| r.name == "upstream"));

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_rename_remote() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        add_remote(
            local_dir.to_str().unwrap(),
            "upstream",
            "https://github.com/test/repo.git",
        )
        .unwrap();

        let result = rename_remote(local_dir.to_str().unwrap(), "upstream", "new-upstream");
        assert!(result.is_ok());

        let remotes = list_remotes(local_dir.to_str().unwrap()).unwrap();
        assert!(!remotes.iter().any(|r| r.name == "upstream"));

        let new_upstream = remotes.iter().find(|r| r.name == "new-upstream");
        assert!(new_upstream.is_some());
        assert_eq!(
            new_upstream.unwrap().url,
            Some("https://github.com/test/repo.git".to_string())
        );

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_set_remote_url() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        add_remote(
            local_dir.to_str().unwrap(),
            "upstream",
            "https://github.com/test/repo.git",
        )
        .unwrap();

        let result = set_remote_url(
            local_dir.to_str().unwrap(),
            "upstream",
            "https://github.com/test/new-repo.git",
        );
        assert!(result.is_ok());

        let remotes = list_remotes(local_dir.to_str().unwrap()).unwrap();
        let upstream = remotes.iter().find(|r| r.name == "upstream");
        assert!(upstream.is_some());
        assert_eq!(
            upstream.unwrap().url,
            Some("https://github.com/test/new-repo.git".to_string())
        );

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_sync_status_without_upstream() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        let status = sync_status(local_dir.to_str().unwrap(), "origin").unwrap();
        assert_eq!(status.branch, current_branch_name(&local_dir));
        assert!(!status.has_upstream);
        assert_eq!(status.ahead, 0);
        assert_eq!(status.behind, 0);

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_sync_status_ahead_after_local_commit() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();

        assert!(push(local_dir.to_str().unwrap(), "origin", "u", "p").is_ok());
        fs::write(local_dir.join("ahead.txt"), "ahead commit").unwrap();
        run_git(&["add", "."], &local_dir);
        run_git(&["commit", "-m", "Ahead commit"], &local_dir);

        let status = sync_status(local_dir.to_str().unwrap(), "origin").unwrap();
        assert!(status.has_upstream);
        assert_eq!(status.behind, 0);
        assert!(status.ahead >= 1);

        fs::remove_dir_all(base_dir).unwrap();
    }
}
