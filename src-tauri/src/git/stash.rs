use git2::{Oid, Repository, StashApplyOptions, StashFlags};
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct StashEntry {
    pub index: usize,
    pub message: String,
    pub author: String,
    pub date: i64,
}

pub fn list_stashes(path: &str) -> Result<Vec<StashEntry>, String> {
    let mut repo =
        Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut raw_entries: Vec<(usize, String, Oid)> = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        raw_entries.push((index, message.to_string(), *oid));
        true
    })
    .map_err(|e| format!("Failed to list stashes: {}", e))?;

    let mut entries = Vec::with_capacity(raw_entries.len());
    for (index, message, oid) in raw_entries {
        let (author, date) = match repo.find_commit(oid) {
            Ok(commit) => (
                commit.author().name().unwrap_or("unknown").to_string(),
                commit.time().seconds(),
            ),
            Err(_) => ("unknown".to_string(), 0),
        };

        entries.push(StashEntry {
            index,
            message,
            author,
            date,
        });
    }

    Ok(entries)
}

pub fn create_stash(path: &str, message: Option<&str>) -> Result<(), String> {
    let mut repo =
        Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    let normalized_message = message.and_then(|msg| {
        let trimmed = msg.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    let final_message = normalized_message.unwrap_or_else(|| "WIP".to_string());

    repo.stash_save(
        &signature,
        final_message.as_str(),
        Some(StashFlags::INCLUDE_UNTRACKED),
    )
    .map_err(|e| {
        let lower = e.message().to_ascii_lowercase();
        if lower.contains("nothing to stash") {
            "E_STASH_EMPTY: no local changes to stash".to_string()
        } else {
            format!("Failed to create stash: {}", e)
        }
    })?;

    Ok(())
}

pub fn apply_stash(path: &str, index: usize) -> Result<(), String> {
    let mut repo =
        Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    if !stash_index_exists(&mut repo, index)? {
        return Err(format!(
            "E_STASH_INVALID_INDEX: stash {} does not exist",
            index
        ));
    }

    let mut options = StashApplyOptions::new();
    repo.stash_apply(index, Some(&mut options)).map_err(|e| {
        let lower = e.message().to_ascii_lowercase();
        if lower.contains("conflict") {
            format!("E_STASH_APPLY_CONFLICT: {}", e)
        } else {
            format!("Failed to apply stash: {}", e)
        }
    })?;

    Ok(())
}

pub fn drop_stash(path: &str, index: usize) -> Result<(), String> {
    let mut repo =
        Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    if !stash_index_exists(&mut repo, index)? {
        return Err(format!(
            "E_STASH_INVALID_INDEX: stash {} does not exist",
            index
        ));
    }

    repo.stash_drop(index)
        .map_err(|e| format!("Failed to drop stash: {}", e))?;

    Ok(())
}

fn stash_index_exists(repo: &mut Repository, index: usize) -> Result<bool, String> {
    let mut found = false;
    repo.stash_foreach(|i, _message, _oid| {
        if i == index {
            found = true;
            false
        } else {
            true
        }
    })
    .map_err(|e| format!("Failed to inspect stashes: {}", e))?;

    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    fn create_test_repo() -> PathBuf {
        let test_dir =
            std::env::temp_dir().join(format!("gitlite-stash-test-{}", uuid::Uuid::new_v4()));
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

        fs::write(test_dir.join("file.txt"), "line 1\n").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        test_dir
    }

    #[test]
    fn test_create_and_list_stash() {
        let repo = create_test_repo();

        fs::write(repo.join("file.txt"), "line 1\nline 2\n").unwrap();

        let created = create_stash(repo.to_str().unwrap(), Some("WIP: stash test"));
        assert!(created.is_ok());

        let stashes = list_stashes(repo.to_str().unwrap()).unwrap();
        assert_eq!(stashes.len(), 1);
        assert!(stashes[0].message.contains("stash test"));

        fs::remove_dir_all(repo).unwrap();
    }

    #[test]
    fn test_apply_stash_success() {
        let repo = create_test_repo();

        fs::write(repo.join("file.txt"), "line 1\nline 2\n").unwrap();
        create_stash(repo.to_str().unwrap(), Some("WIP")).unwrap();

        let after_stash = fs::read_to_string(repo.join("file.txt")).unwrap();
        assert_eq!(after_stash, "line 1\n");

        let applied = apply_stash(repo.to_str().unwrap(), 0);
        assert!(applied.is_ok());

        let after_apply = fs::read_to_string(repo.join("file.txt")).unwrap();
        assert_eq!(after_apply, "line 1\nline 2\n");

        fs::remove_dir_all(repo).unwrap();
    }

    #[test]
    fn test_drop_stash_success() {
        let repo = create_test_repo();

        fs::write(repo.join("file.txt"), "line 1\nline 2\n").unwrap();
        create_stash(repo.to_str().unwrap(), Some("drop me")).unwrap();

        let dropped = drop_stash(repo.to_str().unwrap(), 0);
        assert!(dropped.is_ok());

        let stashes = list_stashes(repo.to_str().unwrap()).unwrap();
        assert!(stashes.is_empty());

        fs::remove_dir_all(repo).unwrap();
    }

    #[test]
    fn test_create_stash_empty_fails() {
        let repo = create_test_repo();

        let result = create_stash(repo.to_str().unwrap(), Some("nothing"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("E_STASH_EMPTY"));

        fs::remove_dir_all(repo).unwrap();
    }

    #[test]
    fn test_invalid_index_fails() {
        let repo = create_test_repo();

        let apply_result = apply_stash(repo.to_str().unwrap(), 999);
        assert!(apply_result.is_err());
        assert!(apply_result.unwrap_err().contains("E_STASH_INVALID_INDEX"));

        let drop_result = drop_stash(repo.to_str().unwrap(), 999);
        assert!(drop_result.is_err());
        assert!(drop_result.unwrap_err().contains("E_STASH_INVALID_INDEX"));

        fs::remove_dir_all(repo).unwrap();
    }
}
