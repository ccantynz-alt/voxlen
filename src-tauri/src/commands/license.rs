//! License-management Tauri commands.
//!
//! Licenses are verified entirely on-device using an embedded Ed25519
//! public key. No user data leaves the machine as part of activation.

use tauri::AppHandle;

use super::settings;
use crate::license::{self, LicenseStatus, Tier};

#[tauri::command]
pub fn get_license_status() -> LicenseStatus {
    license::status(settings::current_license_key().as_deref())
}

#[tauri::command]
pub fn activate_license(app: AppHandle, key: String) -> Result<LicenseStatus, String> {
    let trimmed = key.trim().to_string();
    license::verify(&trimmed).map_err(|e| e.to_string())?;
    settings::set_license_key(&app, Some(trimmed.clone()))?;
    Ok(license::status(Some(&trimmed)))
}

#[tauri::command]
pub fn clear_license(app: AppHandle) -> Result<LicenseStatus, String> {
    settings::set_license_key(&app, None)?;
    Ok(LicenseStatus::free())
}

/// Internal helper: returns the user's current tier. Free if no valid
/// license is installed. Used by gated commands (dictation, grammar).
pub fn current_tier() -> Tier {
    license::status(settings::current_license_key().as_deref()).tier
}
