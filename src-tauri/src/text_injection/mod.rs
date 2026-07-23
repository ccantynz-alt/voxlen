use std::sync::Arc;
use parking_lot::RwLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Prevents a console window from flashing (and stealing focus) every time we
/// shell out to powershell.exe from a GUI app.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum InjectionMode {
    /// Simulate keyboard input - types text character by character into the focused app
    KeyboardSimulation,
    /// Copy to clipboard and paste - faster but may override clipboard
    ClipboardPaste,
    /// Append to internal buffer only - user manually copies
    BufferOnly,
}

pub struct TextInjector {
    pub mode: Arc<RwLock<InjectionMode>>,
}

impl TextInjector {
    pub fn new() -> Self {
        Self {
            mode: Arc::new(RwLock::new(InjectionMode::KeyboardSimulation)),
        }
    }

    pub fn inject(&self, text: &str) -> anyhow::Result<()> {
        let mode = *self.mode.read();
        match mode {
            InjectionMode::KeyboardSimulation => simulate_keyboard(text),
            InjectionMode::ClipboardPaste => clipboard_paste(text),
            InjectionMode::BufferOnly => Ok(()), // No injection, text stays in app buffer
        }
    }

    pub fn get_mode(&self) -> InjectionMode {
        *self.mode.read()
    }

    pub fn set_mode(&self, mode: InjectionMode) {
        *self.mode.write() = mode;
    }
}

pub struct InjectorState(pub Arc<RwLock<TextInjector>>);

impl InjectorState {
    pub fn new(injector: TextInjector) -> Self {
        Self(Arc::new(RwLock::new(injector)))
    }
}

/// Simulate keyboard input on macOS using CGEvent
#[cfg(target_os = "macos")]
fn simulate_keyboard(text: &str) -> anyhow::Result<()> {
    use std::process::Command;

    // Security: strip newlines entirely. In AppleScript, `key code 36` (Return)
    // acts as Enter in every app including terminals, so dictated newlines could
    // execute buffered commands. Replace them with a space so the text still
    // flows; users who need explicit line breaks can use the voice command.
    let safe_text = text.replace('\n', " ").replace('\r', "").replace('\0', "");

    // AppleScript `keystroke` silently drops non-ASCII chars. When the text
    // contains any, fall back to the clipboard path which handles Unicode.
    if safe_text.chars().any(|c| !c.is_ascii()) {
        return clipboard_paste(&safe_text);
    }

    // Escape backslash, double-quote, CR, and null so the AppleScript
    // string literal is not corrupted.
    let escaped = safe_text.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        r#"tell application "System Events" to keystroke "{}""#,
        escaped
    );
    let output = Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to simulate keyboard: {}", e))?;

    if !output.status.success() {
        return Err(anyhow::anyhow!(
            "Keyboard simulation failed: {}. Enable Accessibility for Voxlen in \
             System Settings > Privacy & Security > Accessibility.",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(())
}

/// Simulate keyboard input on Windows using SendInput
#[cfg(target_os = "windows")]
fn simulate_keyboard(text: &str) -> anyhow::Result<()> {
    use windows::Win32::UI::Input::KeyboardAndMouse::*;

    // Security: strip newlines so dictated text cannot execute commands in
    // terminals. U+000A sent via KEYEVENTF_UNICODE acts as Enter in cmd/PS/bash.
    let safe_text = text.replace('\n', " ").replace('\r', "").replace('\0', "");

    let wide: Vec<u16> = safe_text.encode_utf16().collect();
    let mut inputs = Vec::new();

    for ch in wide {
        // Key down
        let mut input_down = INPUT::default();
        input_down.r#type = INPUT_KEYBOARD;
        input_down.Anonymous.ki.wScan = ch;
        input_down.Anonymous.ki.dwFlags = KEYEVENTF_UNICODE;
        inputs.push(input_down);

        // Key up
        let mut input_up = INPUT::default();
        input_up.r#type = INPUT_KEYBOARD;
        input_up.Anonymous.ki.wScan = ch;
        input_up.Anonymous.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
        inputs.push(input_up);
    }

    let sent = unsafe {
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32)
    };
    if (sent as usize) != inputs.len() {
        return Err(anyhow::anyhow!(
            "SendInput injected only {} of {} key events (UIPI block or system error) — \
             text may be missing or truncated",
            sent,
            inputs.len()
        ));
    }

    Ok(())
}

/// Simulate keyboard input on Linux using xdotool
#[cfg(target_os = "linux")]
fn simulate_keyboard(text: &str) -> anyhow::Result<()> {
    use std::process::Command;

    // Try xdotool first, fall back to ydotool for Wayland
    let result = Command::new("xdotool")
        .arg("type")
        .arg("--clearmodifiers")
        .arg("--delay")
        .arg("12")
        .arg(text)
        .output();

    match result {
        Ok(output) if output.status.success() => Ok(()),
        _ => {
            // Fall back to ydotool for Wayland
            let output = Command::new("ydotool")
                .arg("type")
                .arg("--key-delay")
                .arg("12")
                .arg(text)
                .output()
                .map_err(|e| anyhow::anyhow!("Failed to simulate keyboard: {}", e))?;
            if !output.status.success() {
                return Err(anyhow::anyhow!(
                    "Keyboard simulation failed (xdotool and ydotool both failed): {}. \
                     Install xdotool (X11) or ydotool (Wayland).",
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }
            Ok(())
        }
    }
}

/// Copy text to clipboard and paste
fn clipboard_paste(text: &str) -> anyhow::Result<()> {
    // Save whatever text the user already had on the clipboard so we can put
    // it back after pasting, instead of destroying it.
    let saved = get_clipboard_text().unwrap_or(None);

    set_clipboard(text)?;
    trigger_paste()?;
    // After the paste lands, restore the user's prior clipboard — or clear it
    // if there was nothing to restore. Either way the dictated text does not
    // stay on the clipboard: lawyers/accountants must not have privileged
    // content sitting where other apps can read it.
    // 600ms gives the OS time to process the Ctrl+V before we touch it again.
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(600));
        match saved {
            Some(prev) if !prev.is_empty() => {
                if set_clipboard(&prev).is_err() {
                    let _ = clear_clipboard();
                }
            }
            _ => {
                let _ = clear_clipboard();
            }
        }
    });
    Ok(())
}

/// Read the current clipboard text, if any. Returns Ok(None) when the
/// clipboard is empty or holds non-text content.
#[cfg(target_os = "macos")]
fn get_clipboard_text() -> anyhow::Result<Option<String>> {
    use std::process::Command;

    let output = Command::new("pbpaste").output()?;
    if !output.status.success() {
        return Ok(None);
    }
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(if text.is_empty() { None } else { Some(text) })
}

#[cfg(target_os = "windows")]
fn get_clipboard_text() -> anyhow::Result<Option<String>> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::process::Command;

    // Fixed script, no user data embedded. The clipboard content is *output*
    // (base64 over stdout), never interpolated into the script, so it cannot
    // inject commands. Base64 keeps arbitrary Unicode intact across the
    // console's codepage.
    let script = "Add-Type -AssemblyName System.Windows.Forms; \
                  if ([System.Windows.Forms.Clipboard]::ContainsText()) { \
                      [Console]::Out.Write([System.Convert]::ToBase64String(\
                          [System.Text.Encoding]::UTF8.GetBytes(\
                              [System.Windows.Forms.Clipboard]::GetText()))) }";

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()?;

    if !output.status.success() {
        return Ok(None);
    }
    let b64 = String::from_utf8_lossy(&output.stdout);
    let b64 = b64.trim();
    if b64.is_empty() {
        return Ok(None);
    }
    let bytes = STANDARD.decode(b64)?;
    let text = String::from_utf8_lossy(&bytes).to_string();
    Ok(if text.is_empty() { None } else { Some(text) })
}

#[cfg(target_os = "linux")]
fn get_clipboard_text() -> anyhow::Result<Option<String>> {
    use std::process::Command;

    let output = Command::new("xclip")
        .args(["-selection", "clipboard", "-o"])
        .output()
        .or_else(|_| {
            Command::new("xsel")
                .args(["--clipboard", "--output"])
                .output()
        })?;
    if !output.status.success() {
        return Ok(None);
    }
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(if text.is_empty() { None } else { Some(text) })
}

#[cfg(target_os = "macos")]
fn set_clipboard(text: &str) -> anyhow::Result<()> {
    use std::process::Command;

    let mut child = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()?;

    if let Some(stdin) = child.stdin.as_mut() {
        use std::io::Write;
        stdin.write_all(text.as_bytes())?;
    }
    child.wait()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn set_clipboard(text: &str) -> anyhow::Result<()> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::process::Command;

    // Base64-encode the text so no user content appears in the PowerShell script.
    // Base64 output is [A-Za-z0-9+/=] — no PowerShell metacharacters, cannot
    // break out of a single-quoted string literal, cannot inject commands.
    let b64 = STANDARD.encode(text.as_bytes());

    // The script is a fixed template; b64 is a safe literal embedded in '...'
    // (PS single-quoted string — no interpolation, no special characters).
    let script = format!(
        "Add-Type -AssemblyName System.Windows.Forms; \
         [System.Windows.Forms.Clipboard]::SetText(\
             [System.Text.Encoding]::UTF8.GetString(\
                 [System.Convert]::FromBase64String('{}')))",
        b64
    );

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to set clipboard via PowerShell: {}", e))?;

    if !output.status.success() {
        return Err(anyhow::anyhow!(
            "PowerShell clipboard set failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn set_clipboard(text: &str) -> anyhow::Result<()> {
    use std::process::Command;

    let result = Command::new("xclip")
        .args(["-selection", "clipboard"])
        .stdin(std::process::Stdio::piped())
        .spawn();

    match result {
        Ok(mut child) => {
            if let Some(stdin) = child.stdin.as_mut() {
                use std::io::Write;
                stdin.write_all(text.as_bytes())?;
            }
            child.wait()?;
        }
        Err(_) => {
            // Fall back to xsel
            let mut child = Command::new("xsel")
                .args(["--clipboard", "--input"])
                .stdin(std::process::Stdio::piped())
                .spawn()?;
            if let Some(stdin) = child.stdin.as_mut() {
                use std::io::Write;
                stdin.write_all(text.as_bytes())?;
            }
            child.wait()?;
        }
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn trigger_paste() -> anyhow::Result<()> {
    use std::process::Command;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to keystroke "v" using command down"#)
        .output()?;
    if !output.status.success() {
        return Err(anyhow::anyhow!(
            "Paste keystroke failed: {}. Enable Accessibility for Voxlen in \
             System Settings > Privacy & Security > Accessibility.",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn trigger_paste() -> anyhow::Result<()> {
    use windows::Win32::UI::Input::KeyboardAndMouse::*;

    let inputs = vec![
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_CONTROL,
                    ..Default::default()
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_V,
                    ..Default::default()
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_V,
                    dwFlags: KEYEVENTF_KEYUP,
                    ..Default::default()
                },
            },
        },
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_CONTROL,
                    dwFlags: KEYEVENTF_KEYUP,
                    ..Default::default()
                },
            },
        },
    ];

    unsafe {
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn trigger_paste() -> anyhow::Result<()> {
    use std::process::Command;

    let _ = Command::new("xdotool")
        .args(["key", "ctrl+v"])
        .output();
    Ok(())
}

#[cfg(target_os = "macos")]
fn clear_clipboard() -> anyhow::Result<()> {
    use std::process::Command;
    // Pipe empty stdin into pbcopy to overwrite clipboard with empty string
    let mut child = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()?;
    child.wait()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_clipboard() -> anyhow::Result<()> {
    use std::process::Command;
    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear()",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn clear_clipboard() -> anyhow::Result<()> {
    use std::process::Command;
    // Try xclip, then xsel
    let _ = Command::new("xclip")
        .args(["-selection", "clipboard"])
        .stdin(std::process::Stdio::piped())
        .spawn();
    let _ = Command::new("xsel").args(["--clipboard", "--delete"]).output();
    Ok(())
}
