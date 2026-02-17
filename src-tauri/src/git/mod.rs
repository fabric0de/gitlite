mod branch;
mod commit;
mod diff;
mod history_ops;
mod merge;
mod pull_policy;
mod remote;
mod ssh;
mod staging;
mod stash;

pub use branch::{checkout_branch, create_branch, delete_branch, get_branches, Branch};
pub use commit::{get_commits, Commit};
pub use diff::{get_commit_diff, DiffFile, DiffHunk, DiffLineData};
pub use history_ops::{
    checkout_commit, cherry_pick_commit, create_branch_from_commit, reset_current_branch,
    revert_commit,
};
pub use merge::merge_branch;
pub use remote::{
    add_remote, fetch_remote, list_remotes, pull, push, remove_remote, rename_remote,
    set_remote_url, sync_status, RemoteInfo, SyncStatus,
};
pub use ssh::{detect_ssh_keys, fetch_ssh, pull_ssh, push_ssh};
pub use staging::{commit_changes, get_status, stage_files, unstage_files, FileStatus};
pub use stash::{apply_stash, create_stash, drop_stash, list_stashes, StashEntry};
