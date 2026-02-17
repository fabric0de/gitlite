use git2::{Oid, Repository, Status, StatusOptions};

pub const E_PULL_DIRTY: &str = "E_PULL_DIRTY";
pub const E_PULL_NON_FF: &str = "E_PULL_NON_FF";
pub const E_PULL_DETACHED: &str = "E_PULL_DETACHED";
pub const E_HEAD_UNBORN: &str = "E_HEAD_UNBORN";

pub struct PullTarget {
    pub branch_ref_name: String,
    pub head_oid: Oid,
}

pub fn prepare_pull_target(repo: &Repository) -> Result<PullTarget, String> {
    ensure_clean_worktree(repo)?;

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    if !head.is_branch() {
        return Err(format!(
            "{}: Pull requires a checked-out local branch",
            E_PULL_DETACHED
        ));
    }

    let branch_ref_name = head
        .name()
        .ok_or_else(|| format!("{}: HEAD reference is missing", E_PULL_DETACHED))?
        .to_string();
    let head_oid = head
        .target()
        .ok_or_else(|| format!("{}: Repository has no commits yet", E_HEAD_UNBORN))?;

    Ok(PullTarget {
        branch_ref_name,
        head_oid,
    })
}

pub fn fetch_head_oid(repo: &Repository) -> Result<Oid, String> {
    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| format!("Failed to find FETCH_HEAD: {}", e))?;
    fetch_head
        .target()
        .ok_or("FETCH_HEAD has no target".to_string())
}

pub fn apply_fast_forward(
    repo: &Repository,
    branch_ref_name: &str,
    head_oid: Oid,
    fetch_oid: Oid,
) -> Result<(), String> {
    if fetch_oid == head_oid {
        return Ok(());
    }

    let is_fast_forward = repo
        .graph_descendant_of(fetch_oid, head_oid)
        .map_err(|e| format!("Failed to check fast-forward: {}", e))?;
    if !is_fast_forward {
        return Err(format!(
            "{}: Pull requires merge/rebase - fast-forward only",
            E_PULL_NON_FF
        ));
    }

    let mut branch_ref = repo
        .find_reference(branch_ref_name)
        .map_err(|e| format!("Failed to find branch reference: {}", e))?;
    branch_ref
        .set_target(fetch_oid, "pull: Fast-forward")
        .map_err(|e| format!("Failed to update branch: {}", e))?;

    repo.set_head(branch_ref_name)
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;
    repo.checkout_head(None)
        .map_err(|e| format!("Failed to checkout HEAD: {}", e))?;

    Ok(())
}

fn ensure_clean_worktree(repo: &Repository) -> Result<(), String> {
    let mut options = StatusOptions::new();
    options.include_untracked(true);
    options.include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut options))
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let has_changes = statuses.iter().any(|entry| {
        let s = entry.status();
        s.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE
                | Status::WT_NEW
                | Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_RENAMED
                | Status::WT_TYPECHANGE,
        )
    });

    if has_changes {
        return Err(format!(
            "{}: Pull blocked because working tree has uncommitted changes",
            E_PULL_DIRTY
        ));
    }

    Ok(())
}
