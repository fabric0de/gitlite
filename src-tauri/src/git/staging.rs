use git2::{ErrorCode, Repository, Status, StatusOptions};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Debug, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: String,
    pub is_staged: bool,
}

pub fn get_status(path: &str) -> Result<Vec<FileStatus>, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let mut result = Vec::new();

    for entry in statuses.iter() {
        let file_path = entry.path().ok_or("Invalid UTF-8 in path")?.to_string();
        let status = entry.status();

        // Staged changes
        if status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            let status_str = if status.contains(Status::INDEX_NEW) {
                "added"
            } else if status.contains(Status::INDEX_DELETED) {
                "deleted"
            } else if status.contains(Status::INDEX_RENAMED) {
                "renamed"
            } else {
                "modified"
            };

            result.push(FileStatus {
                path: file_path.clone(),
                status: status_str.to_string(),
                is_staged: true,
            });
        }

        // Unstaged changes (working directory)
        if status.intersects(
            Status::WT_NEW
                | Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_RENAMED
                | Status::WT_TYPECHANGE,
        ) {
            let status_str = if status.contains(Status::WT_NEW) {
                "added"
            } else if status.contains(Status::WT_DELETED) {
                "deleted"
            } else if status.contains(Status::WT_RENAMED) {
                "renamed"
            } else {
                "modified"
            };

            result.push(FileStatus {
                path: file_path,
                status: status_str.to_string(),
                is_staged: false,
            });
        }
    }

    Ok(result)
}

pub fn stage_files(path: &str, files: &[String]) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    for file in files {
        index
            .add_path(Path::new(file))
            .map_err(|e| format!("Failed to add file '{}': {}", file, e))?;
    }

    index
        .write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

pub fn unstage_files(path: &str, files: &[String]) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    let head_exists = match repo.head() {
        Ok(_) => true,
        Err(e) if e.code() == ErrorCode::UnbornBranch || e.code() == ErrorCode::NotFound => false,
        Err(e) => return Err(format!("Failed to get HEAD: {}", e)),
    };

    if !head_exists {
        // No commits yet, just remove from index to unstage
        for file in files {
            let path_obj = Path::new(file);
            index
                .remove_path(path_obj)
                .map_err(|e| format!("Failed to remove file '{}' from index: {}", file, e))?;
        }
        index
            .write()
            .map_err(|e| format!("Failed to write index: {}", e))?;
        return Ok(());
    }

    let head = repo.head().unwrap();
    let oid = head.target().ok_or("No HEAD target")?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;
    let tree = commit
        .tree()
        .map_err(|e| format!("Failed to get tree: {}", e))?;

    for file in files {
        let path_obj = Path::new(file);

        if tree.get_path(path_obj).is_ok() {
            let path_specs = [path_obj];
            repo.reset_default(Some(commit.as_object()), path_specs)
                .map_err(|e| format!("Failed to reset file '{}': {}", file, e))?;
        } else {
            index
                .remove_path(path_obj)
                .map_err(|e| format!("Failed to remove file '{}' from index: {}", file, e))?;
            index
                .write()
                .map_err(|e| format!("Failed to write index: {}", e))?;
        }
    }

    Ok(())
}

pub fn commit_changes(path: &str, message: &str, description: &str) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("E_COMMIT_EMPTY_MESSAGE: commit message is required".to_string());
    }

    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    if !has_staged_changes(&repo)? {
        return Err("E_COMMIT_NO_STAGED: no staged changes".to_string());
    }

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    let tree_id = index
        .write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    let parent_commit = match repo.head() {
        Ok(head) => Some(
            head.peel_to_commit()
                .map_err(|e| format!("Failed to peel HEAD to commit: {}", e))?,
        ),
        Err(e) if e.code() == ErrorCode::UnbornBranch || e.code() == ErrorCode::NotFound => None,
        Err(e) => return Err(format!("Failed to get HEAD: {}", e)),
    };

    let sig = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    let full_message = if description.trim().is_empty() {
        message.to_string()
    } else {
        format!("{}\n\n{}", message.trim(), description.trim())
    };

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &full_message, &tree, &parents)
        .map_err(|e| format!("Failed to commit: {}", e))?;

    Ok(oid.to_string())
}

fn has_staged_changes(repo: &Repository) -> Result<bool, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    Ok(statuses.iter().any(|entry| {
        let status = entry.status();
        status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        )
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    fn create_test_repo() -> PathBuf {
        let test_dir =
            std::env::temp_dir().join(format!("gitlite-staging-test-{}", uuid::Uuid::new_v4()));
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

        fs::write(test_dir.join("initial.txt"), "initial content").unwrap();
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

    fn create_unborn_repo() -> PathBuf {
        let test_dir =
            std::env::temp_dir().join(format!("gitlite-staging-unborn-{}", uuid::Uuid::new_v4()));
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

        test_dir
    }

    #[test]
    fn test_get_status_clean() {
        let test_repo = create_test_repo();
        let status = get_status(test_repo.to_str().unwrap()).unwrap();

        assert_eq!(status.len(), 0);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_get_status_with_unstaged_changes() {
        let test_repo = create_test_repo();

        fs::write(test_repo.join("modified.txt"), "new content").unwrap();
        fs::write(test_repo.join("new.txt"), "new file").unwrap();

        let status = get_status(test_repo.to_str().unwrap()).unwrap();

        assert!(status.len() >= 2);
        assert!(status
            .iter()
            .any(|s| s.path == "modified.txt" && !s.is_staged));
        assert!(status.iter().any(|s| s.path == "new.txt" && !s.is_staged));

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_unstage_files() {
        let test_repo = create_test_repo();

        fs::write(test_repo.join("test.txt"), "test content").unwrap();
        stage_files(test_repo.to_str().unwrap(), &[String::from("test.txt")]).unwrap();

        let result = unstage_files(test_repo.to_str().unwrap(), &[String::from("test.txt")]);
        if let Err(ref e) = result {
            eprintln!("Unstage error: {}", e);
        }
        assert!(result.is_ok());

        let status = get_status(test_repo.to_str().unwrap()).unwrap();
        assert!(status.iter().any(|s| s.path == "test.txt" && !s.is_staged));

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_commit_changes_success() {
        let test_repo = create_test_repo();

        fs::write(test_repo.join("test.txt"), "test content").unwrap();
        stage_files(test_repo.to_str().unwrap(), &[String::from("test.txt")]).unwrap();

        let result = commit_changes(
            test_repo.to_str().unwrap(),
            "Test commit",
            "Test description",
        );
        assert!(result.is_ok());

        let oid = result.unwrap();
        assert!(!oid.is_empty());

        let status = get_status(test_repo.to_str().unwrap()).unwrap();
        assert_eq!(status.len(), 0);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_commit_changes_empty_message_fails() {
        let test_repo = create_test_repo();

        fs::write(test_repo.join("test.txt"), "test content").unwrap();
        stage_files(test_repo.to_str().unwrap(), &[String::from("test.txt")]).unwrap();

        let result = commit_changes(test_repo.to_str().unwrap(), "", "");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("E_COMMIT_EMPTY_MESSAGE"));

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_commit_changes_without_description() {
        let test_repo = create_test_repo();

        fs::write(test_repo.join("test.txt"), "test content").unwrap();
        stage_files(test_repo.to_str().unwrap(), &[String::from("test.txt")]).unwrap();

        let result = commit_changes(test_repo.to_str().unwrap(), "Test commit", "");
        assert!(result.is_ok());

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_get_status_invalid_path() {
        let result = get_status("/nonexistent/path");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open repository"));
    }

    #[test]
    fn test_commit_changes_initial_commit_on_unborn_head() {
        let test_repo = create_unborn_repo();

        fs::write(test_repo.join("first.txt"), "initial content").unwrap();
        stage_files(test_repo.to_str().unwrap(), &[String::from("first.txt")]).unwrap();

        let result = commit_changes(test_repo.to_str().unwrap(), "Initial commit", "");
        assert!(result.is_ok());

        let oid = result.unwrap();
        assert!(!oid.is_empty());

        let status = get_status(test_repo.to_str().unwrap()).unwrap();
        assert_eq!(status.len(), 0);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_commit_changes_fails_when_nothing_staged() {
        let test_repo = create_test_repo();

        let result = commit_changes(test_repo.to_str().unwrap(), "No changes", "");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("E_COMMIT_NO_STAGED"));

        fs::remove_dir_all(test_repo).unwrap();
    }
}
