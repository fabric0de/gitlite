use serde::Serialize;
use std::backtrace::Backtrace;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const RUNTIME_LOG_FILE: &str = "runtime.log";
static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

#[derive(Serialize)]
pub struct RuntimeInfo {
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub profile: String,
    pub log_file: String,
}

pub fn init_runtime(app: &tauri::AppHandle) -> Result<(), String> {
    let log_path = ensure_log_path(app)?;
    let _ = LOG_PATH.set(log_path.clone());

    append_log_line(
        &log_path,
        &format!(
            "startup version={} os={} arch={} profile={}",
            app.package_info().version,
            std::env::consts::OS,
            std::env::consts::ARCH,
            if cfg!(debug_assertions) {
                "debug"
            } else {
                "release"
            }
        ),
    )?;

    install_panic_hook(log_path);
    Ok(())
}

pub fn get_runtime_info(app: &tauri::AppHandle) -> Result<RuntimeInfo, String> {
    let log_path = ensure_log_path(app)?;
    Ok(RuntimeInfo {
        app_version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
        log_file: log_path.to_string_lossy().into_owned(),
    })
}

pub fn read_runtime_logs(app: &tauri::AppHandle, limit: usize) -> Result<Vec<String>, String> {
    let log_path = ensure_log_path(app)?;
    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&log_path)
        .map_err(|error| format!("E_RUNTIME_LOG_READ: Failed to read runtime log: {}", error))?;
    let mut lines: Vec<String> = raw.lines().map(|line| line.to_string()).collect();
    if lines.len() > limit {
        lines = lines.split_off(lines.len().saturating_sub(limit));
    }
    Ok(lines)
}

pub fn append_runtime_log(message: &str) {
    if let Some(path) = LOG_PATH.get() {
        let _ = append_log_line(path, message);
    }
}

fn install_panic_hook(log_path: PathBuf) {
    std::panic::set_hook(Box::new(move |panic_info| {
        let payload = if let Some(message) = panic_info.payload().downcast_ref::<&str>() {
            (*message).to_string()
        } else if let Some(message) = panic_info.payload().downcast_ref::<String>() {
            message.clone()
        } else {
            "unknown panic payload".to_string()
        };

        let location = panic_info
            .location()
            .map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column()))
            .unwrap_or_else(|| "unknown location".to_string());
        let backtrace = Backtrace::force_capture();

        let _ = append_log_line(
            &log_path,
            &format!(
                "panic location={} payload={} backtrace={}",
                location, payload, backtrace
            ),
        );
    }));
}

fn ensure_log_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| {
        format!(
            "E_RUNTIME_LOG_DIR: Failed to resolve app data dir: {}",
            error
        )
    })?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("E_RUNTIME_LOG_DIR: Failed to create log dir: {}", error))?;

    Ok(app_data_dir.join(RUNTIME_LOG_FILE))
}

fn append_log_line(log_path: &PathBuf, message: &str) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map_err(|error| format!("E_RUNTIME_LOG_WRITE: Failed to open runtime log: {}", error))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    writeln!(file, "[{}] {}", now, message).map_err(|error| {
        format!(
            "E_RUNTIME_LOG_WRITE: Failed to write runtime log: {}",
            error
        )
    })
}
