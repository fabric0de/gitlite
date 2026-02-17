use git2::{BranchType, Repository};
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct Branch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub target_hash: Option<String>,
}

pub fn get_branches(path: &str) -> Result<Vec<Branch>, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head_ref = repo
        .head()
        .map(|h| h.shorthand().map(String::from))
        .ok()
        .flatten();

    let mut branches = Vec::new();

    let local_branches = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| format!("Failed to list local branches: {}", e))?;

    for branch_result in local_branches {
        let (branch, _) = branch_result.map_err(|e| format!("Failed to get branch: {}", e))?;

        if let Ok(Some(name)) = branch.name() {
            let is_current = head_ref.as_ref().is_some_and(|h| h == name);
            branches.push(Branch {
                name: name.to_string(),
                is_current,
                is_remote: false,
                target_hash: branch.get().target().map(|oid| oid.to_string()),
            });
        }
    }

    let remote_branches = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| format!("Failed to list remote branches: {}", e))?;

    for branch_result in remote_branches {
        let (branch, _) = branch_result.map_err(|e| format!("Failed to get branch: {}", e))?;

        if let Ok(Some(name)) = branch.name() {
            branches.push(Branch {
                name: name.to_string(),
                is_current: false,
                is_remote: true,
                target_hash: branch.get().target().map(|oid| oid.to_string()),
            });
        }
    }

    Ok(branches)
}

pub fn create_branch(path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to peel HEAD to commit: {}", e))?;

    repo.branch(name, &commit, false)
        .map_err(|e| format!("Failed to create branch: {}", e))?;

    Ok(())
}

pub fn delete_branch(path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let head_name = head
        .shorthand()
        .ok_or("Failed to get HEAD branch name".to_string())?;

    if head_name == name {
        return Err("E_BRANCH_DELETE_CURRENT: cannot delete current branch".to_string());
    }

    let mut branch = repo
        .find_branch(name, BranchType::Local)
        .map_err(|e| format!("Failed to find branch: {}", e))?;

    branch
        .delete()
        .map_err(|e| format!("Failed to delete branch: {}", e))?;

    Ok(())
}

pub fn checkout_branch(path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let obj = repo
        .revparse_single(&format!("refs/heads/{}", name))
        .map_err(|e| format!("Failed to find branch: {}", e))?;

    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.safe();

    repo.checkout_tree(&obj, Some(&mut checkout))
        .map_err(|e| format!("Failed to checkout tree: {}", e))?;

    repo.set_head(&format!("refs/heads/{}", name))
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    fn create_test_repo() -> PathBuf {
        let test_dir =
            std::env::temp_dir().join(format!("gitlite-branch-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&test_dir).unwrap();

        Command::new("git")
            .args(["init"])
            .current_dir(&test_dir)
            .output()
            .expect("Failed to init git repo");

        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        fs::write(test_dir.join("test.txt"), "test content").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        test_dir
    }

    fn current_branch_name(repo_path: &Path) -> String {
        get_branches(repo_path.to_str().unwrap())
            .unwrap()
            .into_iter()
            .find(|b| b.is_current && !b.is_remote)
            .map(|b| b.name)
            .expect("expected current local branch")
    }

    #[test]
    fn test_get_branches_default() {
        let test_repo = create_test_repo();
        let branches = get_branches(test_repo.to_str().unwrap()).unwrap();

        assert!(!branches.is_empty());
        let main_branch = branches
            .iter()
            .find(|b| b.name == "main" || b.name == "master");
        assert!(main_branch.is_some());
        assert!(main_branch.unwrap().is_current);
        assert!(!main_branch.unwrap().is_remote);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_get_branches_multiple() {
        let test_repo = create_test_repo();

        Command::new("git")
            .args(["checkout", "-b", "feature-1"])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        Command::new("git")
            .args(["checkout", "-b", "feature-2"])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        let branches = get_branches(test_repo.to_str().unwrap()).unwrap();
        let local_branches: Vec<_> = branches.iter().filter(|b| !b.is_remote).collect();

        assert!(local_branches.len() >= 3);

        let feature_2 = branches.iter().find(|b| b.name == "feature-2");
        assert!(feature_2.is_some());
        assert!(feature_2.unwrap().is_current);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_get_branches_invalid_path() {
        let result = get_branches("/nonexistent/path");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open repository"));
    }

    #[test]
    fn test_create_branch() {
        let test_repo = create_test_repo();

        let result = create_branch(test_repo.to_str().unwrap(), "feature-test");
        assert!(result.is_ok());

        let branches = get_branches(test_repo.to_str().unwrap()).unwrap();
        let feature_branch = branches.iter().find(|b| b.name == "feature-test");
        assert!(feature_branch.is_some());
        assert!(!feature_branch.unwrap().is_current);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_delete_branch_success() {
        let test_repo = create_test_repo();
        let default_branch = current_branch_name(&test_repo);

        Command::new("git")
            .args(["checkout", "-b", "to-delete"])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        Command::new("git")
            .args(["checkout", &default_branch])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        let result = delete_branch(test_repo.to_str().unwrap(), "to-delete");
        assert!(result.is_ok());

        let branches = get_branches(test_repo.to_str().unwrap()).unwrap();
        let deleted_branch = branches.iter().find(|b| b.name == "to-delete");
        assert!(deleted_branch.is_none());

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_delete_current_branch_fails() {
        let test_repo = create_test_repo();

        let branches = get_branches(test_repo.to_str().unwrap()).unwrap();
        let current = branches.iter().find(|b| b.is_current).unwrap();

        let result = delete_branch(test_repo.to_str().unwrap(), &current.name);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("E_BRANCH_DELETE_CURRENT"));

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_checkout_branch_success() {
        let test_repo = create_test_repo();
        let default_branch = current_branch_name(&test_repo);

        Command::new("git")
            .args(["checkout", "-b", "feature-checkout"])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        Command::new("git")
            .args(["checkout", &default_branch])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        let result = checkout_branch(test_repo.to_str().unwrap(), "feature-checkout");
        assert!(result.is_ok());

        let branches = get_branches(test_repo.to_str().unwrap()).unwrap();
        let feature_branch = branches.iter().find(|b| b.name == "feature-checkout");
        assert!(feature_branch.is_some());
        assert!(feature_branch.unwrap().is_current);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_checkout_with_uncommitted_changes_allowed_if_non_conflicting() {
        let test_repo = create_test_repo();
        let default_branch = current_branch_name(&test_repo);

        Command::new("git")
            .args(["checkout", "-b", "feature-dirty"])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        Command::new("git")
            .args(["checkout", &default_branch])
            .current_dir(&test_repo)
            .output()
            .unwrap();

        fs::write(test_repo.join("test.txt"), "modified content").unwrap();

        let result = checkout_branch(test_repo.to_str().unwrap(), "feature-dirty");
        assert!(result.is_ok());

        fs::remove_dir_all(test_repo).unwrap();
    }
}
