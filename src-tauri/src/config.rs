use git2::Repository;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const THEME_FILENAME: &str = "theme.txt";
const SETTINGS_FILENAME: &str = "settings.json";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub theme: String,                  // "system" | "light" | "dark"
    pub git_user_name: Option<String>,  // Git user.name
    pub git_user_email: Option<String>, // Git user.email
    pub diff_context_lines: u32,        // diff context (default 3)
    pub default_remote: String,         // default remote (default "origin")
    pub font_size: u32,                 // font size (default 13)
    pub tab_size: u32,                  // tab size (default 4)
    pub show_line_numbers: bool,        // show line numbers (default true)
    pub auto_fetch: bool,               // auto fetch (default false)
    pub max_recent_repos: u32,          // max recent repos (default 10)
    pub keyboard_shortcuts: Option<HashMap<String, String>>, // custom keyboard shortcuts
    pub language: Option<String>,       // UI language (en, ko, ja, zh, es, fr, de, pt)
    pub update_channel: String,         // update channel (stable | beta)
    pub auto_update_check: bool,        // check update on launch
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            theme: "system".to_string(),
            git_user_name: None,
            git_user_email: None,
            diff_context_lines: 3,
            default_remote: "origin".to_string(),
            font_size: 13,
            tab_size: 4,
            show_line_numbers: true,
            auto_fetch: false,
            max_recent_repos: 10,
            keyboard_shortcuts: None,
            language: None,
            update_channel: "stable".to_string(),
            auto_update_check: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitUserConfig {
    pub name: Option<String>,
    pub email: Option<String>,
}

fn get_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join(SETTINGS_FILENAME))
}

pub fn get_theme_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_dir.join(THEME_FILENAME))
}

pub fn load_theme_from_disk(theme_path: &PathBuf) -> Result<String, String> {
    match fs::read_to_string(theme_path) {
        Ok(content) => {
            let theme = content.trim();
            if theme.is_empty() {
                Ok("system".to_string())
            } else {
                Ok(theme.to_string())
            }
        }
        Err(_) => Ok("system".to_string()),
    }
}

pub fn save_theme_to_disk(theme_path: &PathBuf, theme: &str) -> Result<(), String> {
    fs::write(theme_path, theme).map_err(|e| format!("Failed to write theme: {}", e))
}

#[tauri::command]
pub async fn load_theme(app: tauri::AppHandle) -> Result<String, String> {
    let theme_path = get_theme_file_path(&app)?;
    load_theme_from_disk(&theme_path)
}

#[tauri::command]
pub async fn save_theme(theme: String, app: tauri::AppHandle) -> Result<(), String> {
    let valid_themes = ["system", "light", "dark"];
    if !valid_themes.contains(&theme.as_str()) {
        return Err(format!(
            "Invalid theme: {}. Must be one of: system, light, dark",
            theme
        ));
    }

    let theme_path = get_theme_file_path(&app)?;
    save_theme_to_disk(&theme_path, &theme)
}

#[tauri::command]
pub async fn load_settings(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let settings_path = get_settings_path(&app)?;

    match fs::read_to_string(&settings_path) {
        Ok(content) => {
            let config: AppConfig = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse settings: {}", e))?;
            Ok(config)
        }
        Err(_) => Ok(AppConfig::default()),
    }
}

#[tauri::command]
pub async fn save_settings(config: AppConfig, app: tauri::AppHandle) -> Result<(), String> {
    let settings_path = get_settings_path(&app)?;

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json).map_err(|e| format!("Failed to write settings: {}", e))
}

#[tauri::command]
pub fn get_git_config(path: String) -> Result<GitUserConfig, String> {
    let repo = Repository::open(&path).map_err(|e| e.message().to_string())?;
    let config = repo.config().map_err(|e| e.message().to_string())?;

    let name = config.get_string("user.name").ok();
    let email = config.get_string("user.email").ok();

    Ok(GitUserConfig { name, email })
}

#[tauri::command]
pub fn set_git_config(path: String, name: String, email: String) -> Result<(), String> {
    let repo = Repository::open(&path).map_err(|e| e.message().to_string())?;
    let mut config = repo.config().map_err(|e| e.message().to_string())?;

    config
        .set_str("user.name", &name)
        .map_err(|e| e.message().to_string())?;
    config
        .set_str("user.email", &email)
        .map_err(|e| e.message().to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{get_git_config, set_git_config};
    use git2::Repository;
    use std::fs;
    use std::path::PathBuf;

    fn create_temp_repo() -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("gitlite-config-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("failed to create temp dir");
        Repository::init(&dir).expect("failed to init test repo");
        dir
    }

    #[test]
    fn set_and_get_git_user_config_roundtrip() {
        let repo_dir = create_temp_repo();
        let path = repo_dir.to_string_lossy().into_owned();

        set_git_config(
            path.clone(),
            "GitLite Tester".to_string(),
            "tester@gitlite.dev".to_string(),
        )
        .expect("set_git_config should succeed");

        let config = get_git_config(path.clone()).expect("get_git_config should succeed");
        assert_eq!(config.name.as_deref(), Some("GitLite Tester"));
        assert_eq!(config.email.as_deref(), Some("tester@gitlite.dev"));

        let config_after_reopen = get_git_config(path).expect("config should persist");
        assert_eq!(config_after_reopen.name.as_deref(), Some("GitLite Tester"));
        assert_eq!(
            config_after_reopen.email.as_deref(),
            Some("tester@gitlite.dev")
        );

        fs::remove_dir_all(repo_dir).expect("failed to clean temp repo");
    }
}
