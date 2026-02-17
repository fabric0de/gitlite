mod config;
pub mod git;
mod github_auth;
mod runtime;

use config::{
    get_git_config, load_settings, load_theme, save_settings, save_theme, set_git_config,
};
use git::{Branch, Commit, DiffFile, FileStatus, RemoteInfo, StashEntry, SyncStatus};
use github_auth::{GitHubAuthPollResult, GitHubDeviceCode, GitHubUser};
use runtime::RuntimeInfo;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_commits(
    path: String,
    limit: usize,
    reference: Option<String>,
) -> Result<Vec<Commit>, String> {
    git::get_commits(&path, limit, reference.as_deref())
}

#[tauri::command]
async fn get_branches(path: String) -> Result<Vec<Branch>, String> {
    git::get_branches(&path)
}

#[tauri::command]
async fn create_branch(path: String, name: String) -> Result<(), String> {
    git::create_branch(&path, &name)
}

#[tauri::command]
async fn delete_branch(path: String, name: String) -> Result<(), String> {
    git::delete_branch(&path, &name)
}

#[tauri::command]
async fn checkout_branch(path: String, name: String) -> Result<(), String> {
    git::checkout_branch(&path, &name)
}

#[tauri::command]
async fn get_commit_diff(path: String, commit_hash: String) -> Result<Vec<DiffFile>, String> {
    git::get_commit_diff(&path, &commit_hash)
}

#[tauri::command]
async fn get_status(path: String) -> Result<Vec<FileStatus>, String> {
    git::get_status(&path)
}

#[tauri::command]
async fn stage_files(path: String, files: Vec<String>) -> Result<(), String> {
    git::stage_files(&path, &files)
}

#[tauri::command]
async fn unstage_files(path: String, files: Vec<String>) -> Result<(), String> {
    git::unstage_files(&path, &files)
}

#[tauri::command]
async fn commit_changes(
    path: String,
    message: String,
    description: String,
) -> Result<String, String> {
    git::commit_changes(&path, &message, &description)
}

#[tauri::command]
async fn list_stashes(path: String) -> Result<Vec<StashEntry>, String> {
    git::list_stashes(&path)
}

#[tauri::command]
async fn create_stash(path: String, message: Option<String>) -> Result<(), String> {
    git::create_stash(&path, message.as_deref())
}

#[tauri::command]
async fn apply_stash(path: String, index: usize) -> Result<(), String> {
    git::apply_stash(&path, index)
}

#[tauri::command]
async fn drop_stash(path: String, index: usize) -> Result<(), String> {
    git::drop_stash(&path, index)
}

#[tauri::command]
async fn push_remote(
    path: String,
    remote_name: String,
    username: String,
    password: String,
) -> Result<(), String> {
    git::push(&path, &remote_name, &username, &password)
}

#[tauri::command]
async fn pull_remote(
    path: String,
    remote_name: String,
    username: String,
    password: String,
) -> Result<(), String> {
    git::pull(&path, &remote_name, &username, &password)
}

#[tauri::command]
async fn fetch_remote(
    path: String,
    remote_name: String,
    username: String,
    password: String,
) -> Result<(), String> {
    git::fetch_remote(&path, &remote_name, &username, &password)
}

#[tauri::command]
async fn merge_branch(path: String, source_branch: String) -> Result<(), String> {
    git::merge_branch(&path, &source_branch)
}

#[tauri::command]
async fn cherry_pick_commit(path: String, commit_hash: String) -> Result<String, String> {
    git::cherry_pick_commit(&path, &commit_hash)
}

#[tauri::command]
async fn reset_current_branch(
    path: String,
    commit_hash: String,
    mode: String,
) -> Result<(), String> {
    git::reset_current_branch(&path, &commit_hash, &mode)
}

#[tauri::command]
async fn create_branch_from_commit(
    path: String,
    name: String,
    commit_hash: String,
) -> Result<(), String> {
    git::create_branch_from_commit(&path, &name, &commit_hash)
}

#[tauri::command]
async fn checkout_commit(path: String, commit_hash: String) -> Result<(), String> {
    git::checkout_commit(&path, &commit_hash)
}

#[tauri::command]
async fn revert_commit(path: String, commit_hash: String) -> Result<String, String> {
    git::revert_commit(&path, &commit_hash)
}

#[tauri::command]
async fn detect_ssh_keys() -> Result<Vec<String>, String> {
    let keys = git::detect_ssh_keys();
    Ok(keys.iter().map(|p| p.display().to_string()).collect())
}

#[tauri::command]
async fn push_ssh(
    path: String,
    remote_name: String,
    key_path: String,
    passphrase: Option<String>,
) -> Result<(), String> {
    git::push_ssh(&path, &remote_name, &key_path, passphrase)
}

#[tauri::command]
async fn pull_ssh(
    path: String,
    remote_name: String,
    key_path: String,
    passphrase: Option<String>,
) -> Result<(), String> {
    git::pull_ssh(&path, &remote_name, &key_path, passphrase)
}

#[tauri::command]
async fn fetch_ssh(
    path: String,
    remote_name: String,
    key_path: String,
    passphrase: Option<String>,
) -> Result<(), String> {
    git::fetch_ssh(&path, &remote_name, &key_path, passphrase)
}

#[tauri::command]
async fn list_remotes(path: String) -> Result<Vec<RemoteInfo>, String> {
    git::list_remotes(&path)
}

#[tauri::command]
async fn add_remote(path: String, name: String, url: String) -> Result<(), String> {
    git::add_remote(&path, &name, &url)
}

#[tauri::command]
async fn remove_remote(path: String, name: String) -> Result<(), String> {
    git::remove_remote(&path, &name)
}

#[tauri::command]
async fn rename_remote(path: String, old_name: String, new_name: String) -> Result<(), String> {
    git::rename_remote(&path, &old_name, &new_name)
}

#[tauri::command]
async fn set_remote_url(path: String, name: String, new_url: String) -> Result<(), String> {
    git::set_remote_url(&path, &name, &new_url)
}

#[tauri::command]
async fn sync_status(path: String, remote_name: String) -> Result<SyncStatus, String> {
    git::sync_status(&path, &remote_name)
}

#[tauri::command]
fn is_git_repository(path: String) -> Result<bool, String> {
    match git2::Repository::open(&path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn git_init(path: String) -> Result<(), String> {
    git2::Repository::init(&path).map_err(|e| e.message().to_string())?;
    Ok(())
}

#[tauri::command]
async fn pick_repository_folder(
    app: tauri::AppHandle,
    start_dir: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().set_title("Open Git Repository");

    if let Some(initial) = start_dir.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_owned())
        }
    }) {
        dialog = dialog.set_directory(initial);
    }

    let Some(folder) = dialog.blocking_pick_folder() else {
        return Ok(None);
    };

    let path = folder
        .into_path()
        .map_err(|error| format!("E_REPO_PICKER_PATH: {}", error))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
async fn github_oauth_start(client_id: String) -> Result<GitHubDeviceCode, String> {
    github_auth::start_device_flow(&client_id).await
}

#[tauri::command]
async fn github_oauth_poll(
    client_id: String,
    device_code: String,
) -> Result<GitHubAuthPollResult, String> {
    github_auth::poll_device_flow(&client_id, &device_code).await
}

#[tauri::command]
async fn github_fetch_user(access_token: String) -> Result<GitHubUser, String> {
    github_auth::fetch_user(&access_token).await
}

#[tauri::command]
fn save_github_token(access_token: String) -> Result<(), String> {
    github_auth::save_token_to_keychain(&access_token)
}

#[tauri::command]
fn load_github_token() -> Result<Option<String>, String> {
    github_auth::load_token_from_keychain()
}

#[tauri::command]
fn delete_github_token() -> Result<(), String> {
    github_auth::delete_token_from_keychain()
}

#[tauri::command]
fn get_runtime_info(app: tauri::AppHandle) -> Result<RuntimeInfo, String> {
    runtime::get_runtime_info(&app)
}

#[tauri::command]
fn read_runtime_logs(app: tauri::AppHandle, limit: Option<usize>) -> Result<Vec<String>, String> {
    runtime::read_runtime_logs(&app, limit.unwrap_or(200))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(error) = runtime::init_runtime(app.handle()) {
                eprintln!("runtime initialization failed: {}", error);
            } else {
                runtime::append_runtime_log("runtime initialized");
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_theme,
            save_theme,
            load_settings,
            save_settings,
            get_git_config,
            set_git_config,
            get_commits,
            get_branches,
            create_branch,
            delete_branch,
            checkout_branch,
            get_commit_diff,
            get_status,
            stage_files,
            unstage_files,
            commit_changes,
            list_stashes,
            create_stash,
            apply_stash,
            drop_stash,
            push_remote,
            pull_remote,
            fetch_remote,
            merge_branch,
            cherry_pick_commit,
            reset_current_branch,
            create_branch_from_commit,
            checkout_commit,
            revert_commit,
            detect_ssh_keys,
            push_ssh,
            pull_ssh,
            fetch_ssh,
            list_remotes,
            add_remote,
            remove_remote,
            rename_remote,
            set_remote_url,
            sync_status,
            is_git_repository,
            git_init,
            pick_repository_folder,
            github_oauth_start,
            github_oauth_poll,
            github_fetch_user,
            save_github_token,
            load_github_token,
            delete_github_token,
            get_runtime_info,
            read_runtime_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
