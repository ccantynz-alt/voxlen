use std::sync::Arc;
use parking_lot::RwLock;

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
    Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to simulate keyboard: {}", e))?;

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
    if sent == 0 && !inputs.is_empty() {
        return Err(anyhow::anyhow!(
            "SendInput failed (UIPI block or system error) — text not injected"
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
            Command::new("ydotool")
                .arg("type")
                .arg("--key-delay")
                .arg("12")
                .arg(text)
                .output()
                .map_err(|e| anyhow::anyhow!("Failed to simulate keyboard: {}", e))?;
            Ok(())
        }
    }
}

/// Copy text to clipboard and paste
fn clipboard_paste(text: &str) -> anyhow::Result<()> {
    set_clipboard(text)?;
    trigger_paste()?;
    // Clear clipboard after paste — lawyers/accountants must not have privileged
    // content sitting in the clipboard where other apps can read it.
    // 600ms gives the OS time to process the Ctrl+V before we wipe.
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(600));
        let _ = clear_clipboard();
    });
    Ok(())
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
    use std::process::Command;

    // `cmd /C clip` reads stdin with the OEM code page (CP437/CP1252), corrupting
    // non-ASCII characters. Use PowerShell's .NET clipboard API which handles UTF-16
    // correctly on all Windows locales.
    let escaped = text.replace('\'', "''"); // escape single quotes for PS here-string
    let ps_script = format!(
        "[System.Windows.Forms.Clipboard]::SetText(@'\n{}\n'@)",
        escaped
    );
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &format!("Add-Type -AssemblyName System.Windows.Forms; {}", ps_script),
        ])
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

    Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to keystroke "v" using command down"#)
        .output()?;
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
