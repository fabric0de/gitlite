use git2::{build::CheckoutBuilder, Repository, ResetType};

fn ensure_branch_head(repo: &Repository) -> Result<(), String> {
    let head = repo
        .head()
        .map_err(|e| format!("E_HEAD_INVALID: failed to read HEAD: {}", e))?;
    if !head.is_branch() {
        return Err("E_HEAD_DETACHED: current HEAD is detached".to_string());
    }
    Ok(())
}

pub fn reset_current_branch(path: &str, commit_hash: &str, mode: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    ensure_branch_head(&repo)?;

    let oid = git2::Oid::from_str(commit_hash).map_err(|e| {
        format!(
            "E_RESET_BAD_HASH: invalid commit hash '{}': {}",
            commit_hash, e
        )
    })?;
    let object = repo
        .find_object(oid, None)
        .map_err(|e| format!("E_RESET_COMMIT_NOT_FOUND: {}", e))?;

    let reset_type = match mode {
        "soft" => ResetType::Soft,
        "mixed" => ResetType::Mixed,
        "hard" => ResetType::Hard,
        _ => {
            return Err(format!(
                "E_RESET_BAD_MODE: unsupported reset mode '{}'",
                mode
            ))
        }
    };

    let mut checkout = CheckoutBuilder::new();
    checkout.force();

    let checkout_opt = if matches!(reset_type, ResetType::Hard) {
        Some(&mut checkout)
    } else {
        None
    };

    repo.reset(&object, reset_type, checkout_opt)
        .map_err(|e| format!("E_RESET_FAILED: {}", e))?;

    Ok(())
}

pub fn cherry_pick_commit(path: &str, commit_hash: &str) -> Result<String, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    ensure_branch_head(&repo)?;

    let oid = git2::Oid::from_str(commit_hash).map_err(|e| {
        format!(
            "E_CHERRYPICK_BAD_HASH: invalid commit hash '{}': {}",
            commit_hash, e
        )
    })?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("E_CHERRYPICK_COMMIT_NOT_FOUND: {}", e))?;

    if commit.parent_count() > 1 {
        return Err(
            "E_CHERRYPICK_MERGE_COMMIT: merge commit cherry-pick is not supported".to_string(),
        );
    }

    repo.cherrypick(&commit, None)
        .map_err(|e| format!("E_CHERRYPICK_FAILED: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("E_CHERRYPICK_INDEX: {}", e))?;
    if index.has_conflicts() {
        repo.cleanup_state()
            .map_err(|e| format!("E_CHERRYPICK_CONFLICT_CLEANUP: {}", e))?;
        return Err("E_CHERRYPICK_CONFLICT: conflicts detected during cherry-pick".to_string());
    }

    let tree_id = index
        .write_tree()
        .map_err(|e| format!("E_CHERRYPICK_WRITE_TREE: {}", e))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| format!("E_CHERRYPICK_TREE: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| format!("E_CHERRYPICK_SIGNATURE: {}", e))?;
    let head_commit = repo
        .head()
        .map_err(|e| format!("E_CHERRYPICK_HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("E_CHERRYPICK_HEAD_COMMIT: {}", e))?;

    let message = commit.message().unwrap_or("Cherry-pick commit").trim();
    let new_oid = repo
        .commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[&head_commit],
        )
        .map_err(|e| format!("E_CHERRYPICK_COMMIT: {}", e))?;

    repo.checkout_head(Some(CheckoutBuilder::new().safe()))
        .map_err(|e| format!("E_CHERRYPICK_CHECKOUT: {}", e))?;
    repo.cleanup_state()
        .map_err(|e| format!("E_CHERRYPICK_CLEANUP: {}", e))?;

    Ok(new_oid.to_string())
}

pub fn create_branch_from_commit(path: &str, name: &str, commit_hash: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    if name.trim().is_empty() {
        return Err("E_BRANCH_EMPTY: branch name is required".to_string());
    }

    let oid = git2::Oid::from_str(commit_hash).map_err(|e| {
        format!(
            "E_BRANCH_BAD_HASH: invalid commit hash '{}': {}",
            commit_hash, e
        )
    })?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("E_BRANCH_COMMIT_NOT_FOUND: {}", e))?;

    repo.branch(name.trim(), &commit, false)
        .map_err(|e| format!("E_BRANCH_CREATE_FAILED: {}", e))?;
    Ok(())
}

pub fn checkout_commit(path: &str, commit_hash: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let oid = git2::Oid::from_str(commit_hash).map_err(|e| {
        format!(
            "E_CHECKOUT_BAD_HASH: invalid commit hash '{}': {}",
            commit_hash, e
        )
    })?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("E_CHECKOUT_COMMIT_NOT_FOUND: {}", e))?;

    let mut checkout = CheckoutBuilder::new();
    checkout.safe();
    repo.checkout_tree(commit.as_object(), Some(&mut checkout))
        .map_err(|e| format!("E_CHECKOUT_FAILED: {}", e))?;
    repo.set_head_detached(oid)
        .map_err(|e| format!("E_CHECKOUT_DETACHED_FAILED: {}", e))?;
    Ok(())
}

pub fn revert_commit(path: &str, commit_hash: &str) -> Result<String, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;
    ensure_branch_head(&repo)?;

    let oid = git2::Oid::from_str(commit_hash).map_err(|e| {
        format!(
            "E_REVERT_BAD_HASH: invalid commit hash '{}': {}",
            commit_hash, e
        )
    })?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("E_REVERT_COMMIT_NOT_FOUND: {}", e))?;

    if commit.parent_count() > 1 {
        return Err("E_REVERT_MERGE_COMMIT: merge commit revert is not supported".to_string());
    }

    repo.revert(&commit, None)
        .map_err(|e| format!("E_REVERT_FAILED: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("E_REVERT_INDEX: {}", e))?;
    if index.has_conflicts() {
        repo.cleanup_state()
            .map_err(|e| format!("E_REVERT_CONFLICT_CLEANUP: {}", e))?;
        return Err("E_REVERT_CONFLICT: conflicts detected during revert".to_string());
    }

    let tree_id = index
        .write_tree()
        .map_err(|e| format!("E_REVERT_WRITE_TREE: {}", e))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| format!("E_REVERT_TREE: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| format!("E_REVERT_SIGNATURE: {}", e))?;
    let head_commit = repo
        .head()
        .map_err(|e| format!("E_REVERT_HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("E_REVERT_HEAD_COMMIT: {}", e))?;

    let message = format!("Revert \"{}\"", commit.message().unwrap_or("commit"));
    let new_oid = repo
        .commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            &[&head_commit],
        )
        .map_err(|e| format!("E_REVERT_COMMIT: {}", e))?;

    repo.checkout_head(Some(CheckoutBuilder::new().safe()))
        .map_err(|e| format!("E_REVERT_CHECKOUT: {}", e))?;
    repo.cleanup_state()
        .map_err(|e| format!("E_REVERT_CLEANUP: {}", e))?;
    Ok(new_oid.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    fn run_git(repo: &PathBuf, args: &[&str]) {
        let out = Command::new("git")
            .args(args)
            .current_dir(repo)
            .output()
            .expect("failed to execute git command");
        assert!(
            out.status.success(),
            "git command failed: git {:?}\nstdout: {}\nstderr: {}",
            args,
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
    }

    fn default_branch(repo: &PathBuf) -> String {
        let output = Command::new("git")
            .args(["symbolic-ref", "--short", "HEAD"])
            .current_dir(repo)
            .output()
            .expect("failed to inspect HEAD branch");
        assert!(output.status.success());
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }

    fn setup_repo() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gitlite-history-op-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        run_git(&dir, &["init"]);
        run_git(&dir, &["config", "user.name", "Test User"]);
        run_git(&dir, &["config", "user.email", "test@example.com"]);

        fs::write(dir.join("a.txt"), "v1\n").unwrap();
        run_git(&dir, &["add", "."]);
        run_git(&dir, &["commit", "-m", "Initial"]);
        dir
    }

    #[test]
    fn test_reset_current_branch_hard() {
        let repo = setup_repo();
        let base_branch = default_branch(&repo);

        fs::write(repo.join("a.txt"), "v2\n").unwrap();
        run_git(&repo, &["add", "."]);
        run_git(&repo, &["commit", "-m", "Second"]);
        let second = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let second_hash = String::from_utf8_lossy(&second.stdout).trim().to_string();

        fs::write(repo.join("a.txt"), "v3\n").unwrap();
        run_git(&repo, &["add", "."]);
        run_git(&repo, &["commit", "-m", "Third"]);

        let result = reset_current_branch(repo.to_str().unwrap(), &second_hash, "hard");
        assert!(result.is_ok());

        let head = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let head_hash = String::from_utf8_lossy(&head.stdout).trim().to_string();
        assert_eq!(head_hash, second_hash);

        let branch = default_branch(&repo);
        assert_eq!(branch, base_branch);
        fs::remove_dir_all(repo).unwrap();
    }

    #[test]
    fn test_cherry_pick_commit() {
        let repo = setup_repo();
        let base_branch = default_branch(&repo);

        run_git(&repo, &["checkout", "-b", "feature/cherry"]);
        fs::write(repo.join("feature.txt"), "feature change\n").unwrap();
        run_git(&repo, &["add", "."]);
        run_git(&repo, &["commit", "-m", "Feature commit"]);

        let feature_head = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let feature_hash = String::from_utf8_lossy(&feature_head.stdout)
            .trim()
            .to_string();

        run_git(&repo, &["checkout", &base_branch]);

        let result = cherry_pick_commit(repo.to_str().unwrap(), &feature_hash);
        assert!(result.is_ok());

        let log = Command::new("git")
            .args(["log", "--oneline", "-1"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let last = String::from_utf8_lossy(&log.stdout).to_string();
        assert!(last.contains("Feature commit"));
        assert!(repo.join("feature.txt").exists());

        fs::remove_dir_all(repo).unwrap();
    }

    #[test]
    fn test_checkout_commit_detached() {
        let repo = setup_repo();
        fs::write(repo.join("b.txt"), "v2\n").unwrap();
        run_git(&repo, &["add", "."]);
        run_git(&repo, &["commit", "-m", "Second"]);

        let first = Command::new("git")
            .args(["rev-parse", "HEAD~1"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let first_hash = String::from_utf8_lossy(&first.stdout).trim().to_string();

        let result = checkout_commit(repo.to_str().unwrap(), &first_hash);
        assert!(result.is_ok());

        let head_state = Command::new("git")
            .args(["symbolic-ref", "--short", "-q", "HEAD"])
            .current_dir(&repo)
            .output()
            .unwrap();
        assert!(
            String::from_utf8_lossy(&head_state.stdout)
                .trim()
                .is_empty(),
            "HEAD should be detached"
        );
        fs::remove_dir_all(repo).unwrap();
    }

    #[test]
    fn test_create_branch_from_commit() {
        let repo = setup_repo();
        let head = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&repo)
            .output()
            .unwrap();
        let hash = String::from_utf8_lossy(&head.stdout).trim().to_string();

        let result =
            create_branch_from_commit(repo.to_str().unwrap(), "feature/from-commit", &hash);
        assert!(result.is_ok());

        let show = Command::new("git")
            .args(["show-ref", "--verify", "refs/heads/feature/from-commit"])
            .current_dir(&repo)
            .output()
            .unwrap();
        assert!(show.status.success());
        fs::remove_dir_all(repo).unwrap();
    }
}
