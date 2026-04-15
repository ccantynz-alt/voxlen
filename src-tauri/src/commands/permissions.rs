use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PermissionStatus {
    pub text_injection: PermissionState,
    pub clipboard: PermissionState,
    pub audio_capture: PermissionState,
    pub notifications: PermissionState,
    pub autostart: PermissionState,
    pub platform: String,
    pub is_admin: bool,
    pub missing_dependencies: Vec<String>,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PermissionState {
    pub granted: bool,
    pub name: String,
    pub description: String,
}

#[tauri::command]
pub fn check_permissions() -> Result<PermissionStatus, String> {
    let platform = get_platform();
    let is_admin = check_admin_status();
    let mut missing_deps = Vec::new();
    let mut suggestions = Vec::new();

    let text_injection = check_text_injection_permission(&mut missing_deps, &mut suggestions);
    let clipboard = check_clipboard_permission(&mut missing_deps, &mut suggestions);
    let audio_capture = check_audio_permission(&mut missing_deps, &mut suggestions);

    let notifications = PermissionState {
        granted: true,
        name: "Notifications".to_string(),
        description: "Desktop notification support".to_string(),
    };

    let autostart = PermissionState {
        granted: check_autostart_support(),
        name: "Launch at Login".to_string(),
        description: "Auto-start when you log in".to_string(),
    };

    if !is_admin {
        suggestions.push(get_admin_suggestion());
    }

    Ok(PermissionStatus {
        text_injection,
        clipboard,
        audio_capture,
        notifications,
        autostart,
        platform,
        is_admin,
        missing_dependencies: missing_deps,
        suggestions,
    })
}

#[tauri::command]
pub fn request_admin_permissions() -> Result<bool, String> {
    // Platform-specific permission request
    request_platform_permissions()
}

fn get_platform() -> String {
    if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macos".to_string()
    } else {
        "linux".to_string()
    }
}

#[cfg(target_os = "windows")]
fn check_admin_status() -> bool {
    // Check if running with elevated privileges
    use std::process::Command;
    Command::new("net")
        .args(["session"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn check_admin_status() -> bool {
    use std::process::Command;
    Command::new("id")
        .arg("-G")
        .output()
        .map(|o| {
            let groups = String::from_utf8_lossy(&o.stdout);
            groups.contains("80") // admin group
        })
        .unwrap_or(false)
}

#[cfg(target_os = "linux")]
fn check_admin_status() -> bool {
    use std::process::Command;
    Command::new("id")
        .arg("-Gn")
        .output()
        .map(|o| {
            let groups = String::from_utf8_lossy(&o.stdout);
            groups.contains("sudo") || groups.contains("wheel") || groups.contains("admin")
        })
        .unwrap_or(false)
}

#[cfg(target_os = "windows")]
fn check_text_injection_permission(
    _missing: &mut Vec<String>,
    suggestions: &mut Vec<String>,
) -> PermissionState {
    // On Windows, SendInput works without admin but may need UI Access
    let granted = true; // SendInput generally works
    if !granted {
        suggestions.push("Run Voxlen as Administrator for text injection to work in elevated apps".to_string());
    }
    PermissionState {
        granted,
        name: "Text Injection".to_string(),
        description: "Type text into other applications via SendInput API".to_string(),
    }
}

#[cfg(target_os = "macos")]
fn check_text_injection_permission(
    _missing: &mut Vec<String>,
    suggestions: &mut Vec<String>,
) -> PermissionState {
    use std::process::Command;
    // Check if osascript can access System Events
    let granted = Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to return name of first process"#)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !granted {
        suggestions.push(
            "Grant Accessibility access: System Settings > Privacy & Security > Accessibility > Enable Voxlen"
                .to_string(),
        );
    }

    PermissionState {
        granted,
        name: "Accessibility".to_string(),
        description: "Required for typing text into other apps via System Events".to_string(),
    }
}

#[cfg(target_os = "linux")]
fn check_text_injection_permission(
    missing: &mut Vec<String>,
    suggestions: &mut Vec<String>,
) -> PermissionState {
    use std::process::Command;

    let has_xdotool = Command::new("which")
        .arg("xdotool")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let has_ydotool = Command::new("which")
        .arg("ydotool")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let granted = has_xdotool || has_ydotool;

    if !has_xdotool && !has_ydotool {
        missing.push("xdotool or ydotool".to_string());
        suggestions.push("Install xdotool: sudo apt install xdotool (X11) or ydotool for Wayland".to_string());
    }

    PermissionState {
        granted,
        name: "Text Injection".to_string(),
        description: "Requires xdotool (X11) or ydotool (Wayland) for typing into other apps".to_string(),
    }
}

#[cfg(target_os = "windows")]
fn check_clipboard_permission(
    _missing: &mut Vec<String>,
    _suggestions: &mut Vec<String>,
) -> PermissionState {
    PermissionState {
        granted: true,
        name: "Clipboard".to_string(),
        description: "Clipboard access via system APIs".to_string(),
    }
}

#[cfg(target_os = "macos")]
fn check_clipboard_permission(
    _missing: &mut Vec<String>,
    _suggestions: &mut Vec<String>,
) -> PermissionState {
    PermissionState {
        granted: true,
        name: "Clipboard".to_string(),
        description: "Clipboard access via pbcopy/pbpaste".to_string(),
    }
}

#[cfg(target_os = "linux")]
fn check_clipboard_permission(
    missing: &mut Vec<String>,
    suggestions: &mut Vec<String>,
) -> PermissionState {
    use std::process::Command;

    let has_xclip = Command::new("which")
        .arg("xclip")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let has_xsel = Command::new("which")
        .arg("xsel")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let granted = has_xclip || has_xsel;

    if !granted {
        missing.push("xclip or xsel".to_string());
        suggestions.push("Install xclip: sudo apt install xclip".to_string());
    }

    PermissionState {
        granted,
        name: "Clipboard".to_string(),
        description: "Requires xclip or xsel for clipboard operations".to_string(),
    }
}

fn check_audio_permission(
    _missing: &mut Vec<String>,
    _suggestions: &mut Vec<String>,
) -> PermissionState {
    // Audio is handled by cpal which uses system audio APIs
    PermissionState {
        granted: true,
        name: "Microphone".to_string(),
        description: "Audio capture via system audio APIs".to_string(),
    }
}

fn check_autostart_support() -> bool {
    // Check if autostart mechanisms are available
    if cfg!(target_os = "linux") {
        // Check for ~/.config/autostart directory
        std::path::Path::new(&format!(
            "{}/.config/autostart",
            std::env::var("HOME").unwrap_or_default()
        ))
        .exists()
            || std::path::Path::new(&format!(
                "{}/.config/autostart",
                std::env::var("HOME").unwrap_or_default()
            ))
            .parent()
            .map(|p| p.exists())
            .unwrap_or(false)
    } else {
        true // Windows (registry) and macOS (LaunchAgent) always support this
    }
}

fn get_admin_suggestion() -> String {
    if cfg!(target_os = "windows") {
        "Run Voxlen as Administrator for full access to text injection in elevated apps".to_string()
    } else if cfg!(target_os = "macos") {
        "Ensure Voxlen has Accessibility permissions in System Settings > Privacy & Security".to_string()
    } else {
        "Add your user to the 'sudo' group for full system access: sudo usermod -aG sudo $USER".to_string()
    }
}

#[cfg(target_os = "windows")]
fn request_platform_permissions() -> Result<bool, String> {
    // On Windows, we can try to re-launch as admin
    Ok(true)
}

#[cfg(target_os = "macos")]
fn request_platform_permissions() -> Result<bool, String> {
    use std::process::Command;
    // Open System Preferences to Accessibility
    Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn()
        .map_err(|e| format!("Failed to open System Preferences: {}", e))?;
    Ok(true)
}

#[cfg(target_os = "linux")]
fn request_platform_permissions() -> Result<bool, String> {
    Ok(true) // Linux permissions are managed via package manager
}
