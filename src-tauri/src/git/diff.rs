use git2::{DiffLineType, DiffOptions, Oid, Repository};
use serde::Serialize;
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Serialize, Debug, Clone)]
pub struct DiffFile {
    pub path: String,
    pub hunks: Vec<DiffHunk>,
    pub is_binary: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DiffLineData>,
}

#[derive(Serialize, Debug, Clone)]
pub struct DiffLineData {
    pub line_type: String,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

pub fn get_commit_diff(path: &str, commit_hash: &str) -> Result<Vec<DiffFile>, String> {
    let repo = Repository::open(path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let oid = Oid::from_str(commit_hash).map_err(|e| format!("Invalid commit hash: {}", e))?;

    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    let tree = commit
        .tree()
        .map_err(|e| format!("Failed to get tree: {}", e))?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent: {}", e))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    let mut diff_opts = DiffOptions::new();
    diff_opts.context_lines(3);

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    let mut diff_files = Vec::new();
    let mut file_index_by_path: HashMap<PathBuf, usize> = HashMap::new();

    for delta in diff.deltas() {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("unknown"));
        let path_string = path.to_string_lossy().to_string();

        file_index_by_path.entry(path).or_insert_with(|| {
            let is_binary = delta.new_file().is_binary() || delta.old_file().is_binary();
            let index = diff_files.len();
            diff_files.push(DiffFile {
                path: path_string.clone(),
                hunks: Vec::new(),
                is_binary,
            });
            index
        });
    }

    let diff_files = RefCell::new(diff_files);
    let current_file_index: Cell<Option<usize>> = Cell::new(None);
    let current_hunk_index: Cell<Option<usize>> = Cell::new(None);

    diff.foreach(
        &mut |delta, _progress| {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("unknown"));
            current_file_index.set(file_index_by_path.get(&path).copied());
            current_hunk_index.set(None);
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            if let Some(file_index) = current_file_index.get() {
                let mut diff_files = diff_files.borrow_mut();
                let hunk_index = diff_files[file_index].hunks.len();
                diff_files[file_index].hunks.push(DiffHunk {
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    lines: Vec::new(),
                });
                current_hunk_index.set(Some(hunk_index));
            }
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let (Some(file_index), Some(hunk_index)) =
                (current_file_index.get(), current_hunk_index.get())
            else {
                return true;
            };

            let line_type = match line.origin_value() {
                DiffLineType::Addition | DiffLineType::AddEOFNL => "add",
                DiffLineType::Deletion | DiffLineType::DeleteEOFNL => "delete",
                DiffLineType::Context | DiffLineType::ContextEOFNL => "context",
                _ => return true,
            };

            let content = String::from_utf8_lossy(line.content())
                .trim_end_matches('\n')
                .to_string();

            diff_files.borrow_mut()[file_index].hunks[hunk_index]
                .lines
                .push(DiffLineData {
                    line_type: line_type.to_string(),
                    content,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                });

            true
        }),
    )
    .map_err(|e| format!("Failed to iterate diff: {}", e))?;

    Ok(diff_files.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;

    fn create_test_repo() -> std::path::PathBuf {
        let test_dir =
            std::env::temp_dir().join(format!("gitlite-diff-test-{}", uuid::Uuid::new_v4()));
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
    fn test_get_commit_diff_basic() {
        let test_dir = create_test_repo();

        fs::write(test_dir.join("test.txt"), "line 1\nline 2\nline 3\n").unwrap();
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

        fs::write(
            test_dir.join("test.txt"),
            "line 1\nmodified line 2\nline 3\nline 4\n",
        )
        .unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(&test_dir)
            .output()
            .unwrap();
        let output = Command::new("git")
            .args(["commit", "-m", "modify"])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        assert!(output.status.success());

        let hash_output = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&test_dir)
            .output()
            .unwrap();
        let commit_hash = String::from_utf8(hash_output.stdout)
            .unwrap()
            .trim()
            .to_string();

        let diff = get_commit_diff(test_dir.to_str().unwrap(), &commit_hash).unwrap();

        assert_eq!(diff.len(), 1);
        assert_eq!(diff[0].path, "test.txt");
        assert!(!diff[0].is_binary);
        assert!(!diff[0].hunks.is_empty());

        fs::remove_dir_all(&test_dir).ok();
    }

    #[test]
    fn test_get_commit_diff_first_commit() {
        let test_dir = create_test_repo();

        fs::write(test_dir.join("test.txt"), "initial content\n").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(&test_dir)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "first"])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        let hash_output = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(&test_dir)
            .output()
            .unwrap();
        let commit_hash = String::from_utf8(hash_output.stdout)
            .unwrap()
            .trim()
            .to_string();

        let diff = get_commit_diff(test_dir.to_str().unwrap(), &commit_hash).unwrap();

        assert_eq!(diff.len(), 1);
        assert_eq!(diff[0].path, "test.txt");

        fs::remove_dir_all(&test_dir).ok();
    }

    #[test]
    fn test_get_commit_diff_invalid_hash() {
        let test_dir = create_test_repo();

        fs::write(test_dir.join("test.txt"), "content\n").unwrap();
        Command::new("git")
            .args(["add", "."])
            .current_dir(&test_dir)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "test"])
            .current_dir(&test_dir)
            .output()
            .unwrap();

        let result = get_commit_diff(test_dir.to_str().unwrap(), "invalid_hash");
        assert!(result.is_err());

        fs::remove_dir_all(&test_dir).ok();
    }
}
