use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    // Only allow web links and mail links. Passing arbitrary strings to the
    // system opener can launch local files/executables or custom URI handlers.
    let trimmed = url.trim();
    let lower = trimmed.to_ascii_lowercase();
    let allowed = lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("mailto:");
    if !allowed {
        return Err(format!(
            "Refusing to open URL with disallowed scheme: {}",
            trimmed.chars().take(64).collect::<String>()
        ));
    }
    app.shell().open(trimmed, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn minimize_to_tray(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
