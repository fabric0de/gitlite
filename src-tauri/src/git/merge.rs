use git2::{AnnotatedCommit, Repository};

/// Merge a branch into the current branch
pub fn merge_branch(path: &str, source_branch: &str) -> Result<(), String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get the current HEAD
    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    head.peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

    // Find the source branch
    let source_ref = repo
        .find_branch(source_branch, git2::BranchType::Local)
        .map_err(|e| format!("Failed to find branch '{}': {}", source_branch, e))?;
    let source_ref = source_ref
        .get()
        .target()
        .ok_or(format!("Branch '{}' has no target", source_branch))?;
    let source_commit = repo.find_commit(source_ref).map_err(|e| {
        format!(
            "Failed to find commit for branch '{}': {}",
            source_branch, e
        )
    })?;

    // Create annotated commit for merge
    let annotated_commit = repo
        .find_annotated_commit(source_ref)
        .map_err(|e| format!("Failed to create annotated commit: {}", e))?;

    // Perform merge analysis
    let (merge_analysis, _merge_pref) = repo
        .merge_analysis(&[&annotated_commit])
        .map_err(|e| format!("Failed to analyze merge: {}", e))?;

    // Handle fast-forward merge
    if merge_analysis.is_fast_forward() {
        return fast_forward_merge(&repo, &head, &source_commit, source_branch);
    }

    // Handle up-to-date case
    if merge_analysis.is_up_to_date() {
        return Ok(());
    }

    // Handle normal merge
    if merge_analysis.is_normal() {
        return normal_merge(&repo, &annotated_commit);
    }

    Err("Cannot perform merge: unhandled merge analysis result".to_string())
}

fn fast_forward_merge(
    repo: &Repository,
    head: &git2::Reference,
    source_commit: &git2::Commit,
    source_branch: &str,
) -> Result<(), String> {
    // Update HEAD to point to the source commit
    let mut reference = repo
        .find_reference(head.name().ok_or("Failed to get HEAD reference name")?)
        .map_err(|e| format!("Failed to find HEAD reference: {}", e))?;

    reference
        .set_target(
            source_commit.id(),
            &format!("merge {}: Fast-forward", source_branch),
        )
        .map_err(|e| format!("Failed to update HEAD: {}", e))?;

    // Update working directory
    repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
        .map_err(|e| format!("Failed to checkout HEAD: {}", e))?;

    Ok(())
}

fn normal_merge(repo: &Repository, annotated_commit: &AnnotatedCommit) -> Result<(), String> {
    // Perform the merge
    repo.merge(&[annotated_commit], None, None)
        .map_err(|e| format!("Failed to merge: {}", e))?;

    // Check for conflicts
    let index = repo
        .index()
        .map_err(|e| format!("Failed to get repository index: {}", e))?;

    if index.has_conflicts() {
        let mut conflict_files = Vec::new();

        // Collect conflicted files
        let conflicts = index
            .conflicts()
            .map_err(|e| format!("Failed to get conflicts: {}", e))?;

        for conflict in conflicts {
            let conflict = conflict.map_err(|e| format!("Failed to read conflict: {}", e))?;
            if let Some(our) = conflict.our {
                if let Ok(path) = std::str::from_utf8(&our.path) {
                    conflict_files.push(path.to_string());
                }
            } else if let Some(their) = conflict.their {
                if let Ok(path) = std::str::from_utf8(&their.path) {
                    conflict_files.push(path.to_string());
                }
            }
        }

        // Cleanup the merge state before returning error
        repo.cleanup_state()
            .map_err(|e| format!("Failed to cleanup merge state: {}", e))?;

        return Err(format!(
            "Merge conflicts detected in {} file(s): {}",
            conflict_files.len(),
            conflict_files.join(", ")
        ));
    }

    // No conflicts - create merge commit
    let signature = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;
    let tree_id = index
        .write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;
    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    let head_commit = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

    let merge_commit = repo
        .find_commit(annotated_commit.id())
        .map_err(|e| format!("Failed to find merge commit: {}", e))?;

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &format!("Merge branch '{}'", merge_commit.id()),
        &tree,
        &[&head_commit, &merge_commit],
    )
    .map_err(|e| format!("Failed to create merge commit: {}", e))?;

    // Cleanup merge state
    repo.cleanup_state()
        .map_err(|e| format!("Failed to cleanup merge state: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use tempfile::TempDir;

    fn init_test_repo() -> (TempDir, Repository) {
        let temp_dir = TempDir::new().unwrap();
        let repo = Repository::init(temp_dir.path()).unwrap();

        // Set up basic config
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@example.com").unwrap();

        (temp_dir, repo)
    }

    fn create_commit(repo: &Repository, filename: &str, content: &str, message: &str) -> git2::Oid {
        let repo_path = repo.path().parent().unwrap();
        let file_path = repo_path.join(filename);
        fs::write(&file_path, content).unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new(filename)).unwrap();
        index.write().unwrap();

        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let signature = repo.signature().unwrap();

        let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

        let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &parents,
        )
        .unwrap()
    }

    #[test]
    fn test_merge_fast_forward() {
        let (temp_dir, repo) = init_test_repo();

        // Create initial commit on main
        create_commit(&repo, "file1.txt", "content1", "Initial commit");

        // Create feature branch
        let head_commit = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature", &head_commit, false).unwrap();

        // Checkout feature branch
        let obj = repo.revparse_single("refs/heads/feature").unwrap();
        repo.checkout_tree(&obj, None).unwrap();
        repo.set_head("refs/heads/feature").unwrap();

        // Create commit on feature
        create_commit(&repo, "file2.txt", "content2", "Feature commit");

        // Checkout main
        let obj = repo.revparse_single("refs/heads/master").unwrap();
        repo.checkout_tree(&obj, None).unwrap();
        repo.set_head("refs/heads/master").unwrap();

        // Merge feature into main (should be fast-forward)
        let result = merge_branch(temp_dir.path().to_str().unwrap(), "feature");
        assert!(
            result.is_ok(),
            "Fast-forward merge should succeed: {:?}",
            result
        );

        // Verify file2.txt exists
        let file2_path = temp_dir.path().join("file2.txt");
        assert!(file2_path.exists(), "file2.txt should exist after merge");
    }

    #[test]
    fn test_merge_conflict() {
        let (temp_dir, repo) = init_test_repo();

        // Create initial commit on main
        create_commit(&repo, "file1.txt", "content1", "Initial commit");

        // Create feature branch
        let head_commit = repo.head().unwrap().peel_to_commit().unwrap();
        repo.branch("feature", &head_commit, false).unwrap();

        // Modify file on main
        create_commit(&repo, "file1.txt", "main content", "Main change");

        // Checkout feature branch
        let obj = repo.revparse_single("refs/heads/feature").unwrap();
        repo.checkout_tree(&obj, None).unwrap();
        repo.set_head("refs/heads/feature").unwrap();

        // Modify same file on feature
        create_commit(&repo, "file1.txt", "feature content", "Feature change");

        // Checkout main
        let obj = repo.revparse_single("refs/heads/master").unwrap();
        repo.checkout_tree(&obj, None).unwrap();
        repo.set_head("refs/heads/master").unwrap();

        // Merge feature into main (should conflict)
        let result = merge_branch(temp_dir.path().to_str().unwrap(), "feature");
        assert!(result.is_err(), "Merge should fail due to conflict");
        assert!(
            result.unwrap_err().contains("Merge conflicts detected"),
            "Error message should mention conflicts"
        );
    }
}
