use reqwest::header::{ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const USER_PROFILE_URL: &str = "https://api.github.com/user";
const GITHUB_API_VERSION: &str = "2022-11-28";
const OAUTH_SCOPE: &str = "read:user repo";
const DEVICE_GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:device_code";
const APP_USER_AGENT: &str = "GitLite/0.1.0";
const KEYCHAIN_SERVICE: &str = "com.gitlite.app.github";
const KEYCHAIN_ACCOUNT: &str = "oauth-token";

#[derive(Serialize)]
pub struct GitHubDeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: Option<String>,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Serialize, Clone)]
pub struct GitHubUser {
    pub login: String,
    pub avatar_url: String,
    pub name: Option<String>,
}

#[derive(Serialize)]
pub struct GitHubAuthPollResult {
    pub status: String,
    pub access_token: Option<String>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub user: Option<GitHubUser>,
    pub retry_after: Option<u64>,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: Option<u64>,
}

#[derive(Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
    interval: Option<u64>,
}

#[derive(Deserialize)]
struct GitHubUserResponse {
    login: String,
    avatar_url: Option<String>,
    name: Option<String>,
}

pub async fn start_device_flow(client_id: &str) -> Result<GitHubDeviceCode, String> {
    let normalized_client_id = normalize_client_id(client_id)?;
    let client = reqwest::Client::new();

    let response = client
        .post(DEVICE_CODE_URL)
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, APP_USER_AGENT)
        .form(&[
            ("client_id", normalized_client_id.as_str()),
            ("scope", OAUTH_SCOPE),
        ])
        .send()
        .await
        .map_err(|error| format!("E_GITHUB_OAUTH_NETWORK: {}", error))?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read response body".to_string());
        return Err(format!(
            "E_GITHUB_OAUTH_START_FAILED: GitHub returned {} ({})",
            status.as_u16(),
            body
        ));
    }

    let payload: DeviceCodeResponse = response
        .json()
        .await
        .map_err(|error| format!("E_GITHUB_OAUTH_PARSE: {}", error))?;

    Ok(GitHubDeviceCode {
        device_code: payload.device_code,
        user_code: payload.user_code,
        verification_uri: payload.verification_uri,
        verification_uri_complete: payload.verification_uri_complete,
        expires_in: payload.expires_in,
        interval: payload.interval.unwrap_or(5),
    })
}

pub async fn poll_device_flow(
    client_id: &str,
    device_code: &str,
) -> Result<GitHubAuthPollResult, String> {
    let normalized_client_id = normalize_client_id(client_id)?;
    let normalized_device_code = device_code.trim();
    if normalized_device_code.is_empty() {
        return Err("E_GITHUB_OAUTH_DEVICE_CODE_EMPTY: Device code is required".to_string());
    }

    let client = reqwest::Client::new();
    let response = client
        .post(ACCESS_TOKEN_URL)
        .header(ACCEPT, "application/json")
        .header(USER_AGENT, APP_USER_AGENT)
        .form(&[
            ("client_id", normalized_client_id.as_str()),
            ("device_code", normalized_device_code),
            ("grant_type", DEVICE_GRANT_TYPE),
        ])
        .send()
        .await
        .map_err(|error| format!("E_GITHUB_OAUTH_NETWORK: {}", error))?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read response body".to_string());
        return Err(format!(
            "E_GITHUB_OAUTH_POLL_FAILED: GitHub returned {} ({})",
            status.as_u16(),
            body
        ));
    }

    let payload: AccessTokenResponse = response
        .json()
        .await
        .map_err(|error| format!("E_GITHUB_OAUTH_PARSE: {}", error))?;

    if let Some(access_token) = payload.access_token {
        let user = fetch_authenticated_user(&client, &access_token).await?;
        return Ok(GitHubAuthPollResult {
            status: "success".to_string(),
            access_token: Some(access_token),
            token_type: payload.token_type,
            scope: payload.scope,
            user: Some(user),
            retry_after: None,
        });
    }

    let Some(error_code) = payload.error else {
        return Err("E_GITHUB_OAUTH_POLL_INVALID: Missing access_token and error".to_string());
    };

    let retry_after = payload.interval;
    match error_code.as_str() {
        "authorization_pending" => Ok(GitHubAuthPollResult {
            status: "pending".to_string(),
            access_token: None,
            token_type: None,
            scope: None,
            user: None,
            retry_after,
        }),
        "slow_down" => Ok(GitHubAuthPollResult {
            status: "slow_down".to_string(),
            access_token: None,
            token_type: None,
            scope: None,
            user: None,
            retry_after,
        }),
        "expired_token" => Ok(GitHubAuthPollResult {
            status: "expired".to_string(),
            access_token: None,
            token_type: None,
            scope: None,
            user: None,
            retry_after: None,
        }),
        "access_denied" => Ok(GitHubAuthPollResult {
            status: "denied".to_string(),
            access_token: None,
            token_type: None,
            scope: None,
            user: None,
            retry_after: None,
        }),
        _ => Err(format!(
            "E_GITHUB_OAUTH_POLL_ERROR: {} ({})",
            error_code,
            payload.error_description.unwrap_or_default()
        )),
    }
}

pub async fn fetch_user(access_token: &str) -> Result<GitHubUser, String> {
    let token = access_token.trim();
    if token.is_empty() {
        return Err("E_GITHUB_TOKEN_EMPTY: Access token is required".to_string());
    }
    let client = reqwest::Client::new();
    fetch_authenticated_user(&client, token).await
}

pub fn save_token_to_keychain(access_token: &str) -> Result<(), String> {
    let token = access_token.trim();
    if token.is_empty() {
        return Err("E_GITHUB_TOKEN_EMPTY: Access token is required".to_string());
    }

    let entry = keyring_entry()?;
    entry
        .set_password(token)
        .map_err(|error| format!("E_GITHUB_KEYCHAIN_WRITE: {}", error))
}

pub fn load_token_from_keychain() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(token) => {
            if token.trim().is_empty() {
                Ok(None)
            } else {
                Ok(Some(token))
            }
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("E_GITHUB_KEYCHAIN_READ: {}", error)),
    }
}

pub fn delete_token_from_keychain() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_password() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("E_GITHUB_KEYCHAIN_DELETE: {}", error)),
    }
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
        .map_err(|error| format!("E_GITHUB_KEYCHAIN_INIT: {}", error))
}

fn normalize_client_id(client_id: &str) -> Result<String, String> {
    let normalized = client_id.trim();
    if normalized.is_empty() {
        return Err("E_GITHUB_CLIENT_ID_MISSING: GitHub OAuth Client ID is required".to_string());
    }
    Ok(normalized.to_string())
}

async fn fetch_authenticated_user(
    client: &reqwest::Client,
    access_token: &str,
) -> Result<GitHubUser, String> {
    let response = client
        .get(USER_PROFILE_URL)
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
        .header(USER_AGENT, APP_USER_AGENT)
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|error| format!("E_GITHUB_USER_FETCH: {}", error))?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read response body".to_string());
        return Err(format!(
            "E_GITHUB_USER_FETCH: GitHub returned {} ({})",
            status.as_u16(),
            body
        ));
    }

    let payload: GitHubUserResponse = response
        .json()
        .await
        .map_err(|error| format!("E_GITHUB_USER_PARSE: {}", error))?;

    Ok(GitHubUser {
        login: payload.login,
        avatar_url: payload.avatar_url.unwrap_or_default(),
        name: payload.name,
    })
}
