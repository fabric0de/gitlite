use super::pull_policy::{apply_fast_forward, fetch_head_oid, prepare_pull_target};
use git2::{
    Cred, CredentialType, ErrorClass, ErrorCode, FetchOptions, PushOptions, RemoteCallbacks,
    Repository,
};
use std::path::{Path, PathBuf};

const E_PULL_AUTH: &str = "E_PULL_AUTH";
const E_PULL_NETWORK: &str = "E_PULL_NETWORK";

pub fn detect_ssh_keys() -> Vec<PathBuf> {
    let mut keys = Vec::new();

    if let Some(home) = dirs::home_dir() {
        let ssh_dir = home.join(".ssh");

        let common_keys = vec!["id_ed25519", "id_rsa", "id_ecdsa"];

        for key_name in common_keys {
            let key_path = ssh_dir.join(key_name);
            if key_path.exists() {
                keys.push(key_path);
            }
        }
    }

    keys
}

pub fn push_ssh(
    path: &str,
    remote_name: &str,
    key_path: &str,
    passphrase: Option<String>,
) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let remote_name = if remote_name.trim().is_empty() {
        "origin"
    } else {
        remote_name
    };

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let branch_name = head
        .shorthand()
        .ok_or("Failed to get HEAD branch name".to_string())?;
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("Failed to find remote '{}': {}", remote_name, e))?;

    let key_path = key_path.trim().to_string();
    let passphrase_clone = passphrase.clone();

    let push_result = {
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(move |_url, username_from_url, allowed_types| {
            resolve_ssh_cred(
                username_from_url,
                allowed_types,
                &key_path,
                passphrase_clone.as_deref(),
            )
        });

        let mut options = PushOptions::new();
        options.remote_callbacks(callbacks);

        remote.push(&[refspec.as_str()], Some(&mut options))
    };

    if let Err(error) = push_result {
        return Err(format!("SSH push failed: {}", error));
    }

    Ok(())
}

pub fn pull_ssh(
    path: &str,
    remote_name: &str,
    key_path: &str,
    passphrase: Option<String>,
) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let target = prepare_pull_target(&repo)?;

    let remote_name = if remote_name.trim().is_empty() {
        "origin"
    } else {
        remote_name
    };

    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("Failed to find remote '{}': {}", remote_name, e))?;

    let key_path = key_path.trim().to_string();
    let passphrase_clone = passphrase.clone();

    let fetch_result = {
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(move |_url, username_from_url, allowed_types| {
            resolve_ssh_cred(
                username_from_url,
                allowed_types,
                &key_path,
                passphrase_clone.as_deref(),
            )
        });

        let mut options = FetchOptions::new();
        options.remote_callbacks(callbacks);

        remote.fetch(&[] as &[&str], Some(&mut options), None)
    };

    if let Err(error) = fetch_result {
        return Err(format_fetch_error(error));
    }

    let fetch_oid = fetch_head_oid(&repo)?;
    apply_fast_forward(&repo, &target.branch_ref_name, target.head_oid, fetch_oid)?;

    Ok(())
}

pub fn fetch_ssh(
    path: &str,
    remote_name: &str,
    key_path: &str,
    passphrase: Option<String>,
) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    let remote_name = if remote_name.trim().is_empty() {
        "origin"
    } else {
        remote_name
    };

    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("Failed to find remote '{}': {}", remote_name, e))?;

    let key_path = key_path.trim().to_string();
    let passphrase_clone = passphrase.clone();

    let fetch_result = {
        let mut callbacks = RemoteCallbacks::new();
        callbacks.credentials(move |_url, username_from_url, allowed_types| {
            resolve_ssh_cred(
                username_from_url,
                allowed_types,
                &key_path,
                passphrase_clone.as_deref(),
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

fn resolve_ssh_cred(
    username_from_url: Option<&str>,
    allowed_types: CredentialType,
    key_path: &str,
    passphrase: Option<&str>,
) -> Result<Cred, git2::Error> {
    let username = username_from_url.unwrap_or("git");

    // Preferred path for non-interactive auth: SSH agent
    if allowed_types.contains(CredentialType::SSH_KEY)
        || allowed_types.contains(CredentialType::SSH_MEMORY)
    {
        if let Ok(cred) = Cred::ssh_key_from_agent(username) {
            return Ok(cred);
        }
    }

    // Fallback: explicit key path if provided
    if !key_path.is_empty() && Path::new(key_path).exists() {
        return Cred::ssh_key(username, None, Path::new(key_path), passphrase);
    }

    // Last resort platform default
    Cred::default()
}

fn format_fetch_error(error: git2::Error) -> String {
    match error.code() {
        ErrorCode::Auth => format!("{}: Authentication failed: {}", E_PULL_AUTH, error),
        _ => match error.class() {
            ErrorClass::Net | ErrorClass::Http | ErrorClass::Ssh | ErrorClass::Ssl => {
                format!("{}: Network error: {}", E_PULL_NETWORK, error)
            }
            _ => format!("SSH fetch failed: {}", error),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
            std::env::temp_dir().join(format!("gitlite-ssh-test-{}", uuid::Uuid::new_v4()));
        let local_dir = base_dir.join("local");
        let remote_dir = base_dir.join("remote");

        fs::create_dir_all(&local_dir).unwrap();
        fs::create_dir_all(&remote_dir).unwrap();

        run_git(&["init", "--bare"], &remote_dir);
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
    fn test_detect_ssh_keys() {
        let keys = detect_ssh_keys();
        println!("Detected SSH keys: {:?}", keys);
    }

    #[test]
    fn test_ssh_key_format() {
        let test_key = "/home/user/.ssh/id_ed25519";
        assert!(test_key.ends_with("id_ed25519"));
    }

    #[test]
    fn test_pull_ssh_success_fast_forward() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();
        let dummy_key = "/tmp/nonexistent-ssh-key";

        assert!(push_ssh(local_dir.to_str().unwrap(), "origin", dummy_key, None).is_ok());

        fs::write(local_dir.join("test.txt"), "second content").unwrap();
        run_git(&["add", "."], &local_dir);
        run_git(&["commit", "-m", "Second commit"], &local_dir);
        assert!(push_ssh(local_dir.to_str().unwrap(), "origin", dummy_key, None).is_ok());

        run_git(&["reset", "--hard", "HEAD~1"], &local_dir);

        let result = pull_ssh(local_dir.to_str().unwrap(), "origin", dummy_key, None);
        assert!(result.is_ok());

        fs::remove_dir_all(base_dir).unwrap();
    }

    #[test]
    fn test_pull_ssh_rejects_dirty_worktree() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();
        let dummy_key = "/tmp/nonexistent-ssh-key";

        fs::write(local_dir.join("test.txt"), "dirty local change").unwrap();

        let result = pull_ssh(local_dir.to_str().unwrap(), "origin", dummy_key, None);
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
    fn test_pull_ssh_rejects_non_fast_forward() {
        let (base_dir, local_dir, remote_dir) = create_test_repo();
        let dummy_key = "/tmp/nonexistent-ssh-key";
        let branch_name = current_branch_name(&local_dir);

        assert!(push_ssh(local_dir.to_str().unwrap(), "origin", dummy_key, None).is_ok());

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

        fs::write(other_dir.join("remote.txt"), "remote change").unwrap();
        run_git(&["add", "."], &other_dir);
        run_git(&["commit", "-m", "Remote commit"], &other_dir);
        run_git(&["push", "origin", &branch_name], &other_dir);

        fs::write(local_dir.join("local.txt"), "local change").unwrap();
        run_git(&["add", "."], &local_dir);
        run_git(&["commit", "-m", "Local commit"], &local_dir);

        let result = pull_ssh(local_dir.to_str().unwrap(), "origin", dummy_key, None);
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
    fn test_pull_ssh_rejects_detached_head() {
        let (base_dir, local_dir, _remote_dir) = create_test_repo();
        let dummy_key = "/tmp/nonexistent-ssh-key";

        let output = Command::new("git")
            .args(["rev-parse", "HEAD~0"])
            .current_dir(&local_dir)
            .output()
            .unwrap();
        let head_oid = String::from_utf8(output.stdout).unwrap().trim().to_string();
        run_git(&["checkout", &head_oid], &local_dir);

        let result = pull_ssh(local_dir.to_str().unwrap(), "origin", dummy_key, None);
        assert!(result.is_err());
        let message = result.unwrap_err();
        assert!(
            message.contains(crate::git::pull_policy::E_PULL_DETACHED),
            "actual: {}",
            message
        );

        fs::remove_dir_all(base_dir).unwrap();
    }
}
