use git2::Repository;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct Commit {
    pub hash: String,
    pub author: String,
    pub message: String,
    pub date: i64,
    pub parents: Vec<String>,
}

pub fn get_commits(
    path: &str,
    limit: usize,
    reference: Option<&str>,
) -> Result<Vec<Commit>, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| format!("Failed to set revwalk sorting: {}", e))?;

    match reference {
        Some("all") => {
            revwalk
                .push_glob("refs/heads/*")
                .map_err(|e| format!("Failed to walk all local branches: {}", e))?;
        }
        Some(reference_name) => {
            revwalk
                .push_ref(reference_name)
                .map_err(|e| format!("Failed to walk reference '{}': {}", reference_name, e))?;
        }
        None => {
            revwalk
                .push_head()
                .map_err(|e| format!("Failed to push HEAD: {}", e))?;
        }
    }

    let mut commits = Vec::new();

    for (count, oid) in revwalk.enumerate() {
        if count >= limit {
            break;
        }

        let oid = oid.map_err(|e| format!("Failed to get OID: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let author_name = match commit.author().name() {
            Some(name) => name.to_string(),
            None => match commit.author().email() {
                Some(email) => email.to_string(),
                None => "Unknown".to_string(),
            },
        };

        let message = commit.message().unwrap_or("No message").trim().to_string();

        let parents: Vec<String> = commit.parent_ids().map(|p| p.to_string()).collect();

        commits.push(Commit {
            hash: oid.to_string(),
            author: author_name,
            message,
            date: commit.time().seconds(),
            parents,
        });
    }

    Ok(commits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;

    fn create_test_repo() -> PathBuf {
        let test_dir = std::env::temp_dir().join(format!("gitlite-test-{}", uuid::Uuid::new_v4()));
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

    #[test]
    fn test_get_commits_basic() {
        let test_repo = create_test_repo();
        let commits = get_commits(test_repo.to_str().unwrap(), 10, None).unwrap();

        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, "Initial commit");
        assert_eq!(commits[0].author, "Test User");
        assert!(!commits[0].hash.is_empty());
        assert_eq!(commits[0].parents.len(), 0);

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_get_commits_with_limit() {
        let test_repo = create_test_repo();

        for i in 1..=5 {
            fs::write(test_repo.join("test.txt"), format!("content {}", i)).unwrap();
            Command::new("git")
                .args(["add", "."])
                .current_dir(&test_repo)
                .output()
                .unwrap();
            Command::new("git")
                .args(["commit", "-m", &format!("Commit {}", i)])
                .current_dir(&test_repo)
                .output()
                .unwrap();
        }

        let commits = get_commits(test_repo.to_str().unwrap(), 3, None).unwrap();
        assert_eq!(commits.len(), 3);
        assert_eq!(commits[0].message, "Commit 5");

        fs::remove_dir_all(test_repo).unwrap();
    }

    #[test]
    fn test_get_commits_invalid_path() {
        let result = get_commits("/nonexistent/path", 10, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open repository"));
    }
}
