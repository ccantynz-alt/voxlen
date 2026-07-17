use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub fn sanitize_component(s: &str) -> String {
    let mut value: String = s
        .chars()
        .filter(|c| !c.is_control() && !matches!(c, '<' | '>' | ':' | '/' | '\\' | '|' | '?' | '*' | '"'))
        .collect();
    value = value.trim().trim_end_matches(['.', ' ']).chars().take(80).collect();
    value = value.trim_end_matches(['.', ' ']).to_string();

    let basename = value.split('.').next().unwrap_or_default();
    let upper = basename.to_ascii_uppercase();
    let reserved = matches!(upper.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || upper.strip_prefix("COM").is_some_and(|n| matches!(n, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"))
        || upper.strip_prefix("LPT").is_some_and(|n| matches!(n, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"));
    if value.is_empty() || reserved {
        "Unfiled".to_string()
    } else {
        value
    }
}

/// Split a filename into a sanitized stem and extension so the 80-char cap in
/// `sanitize_component` can never truncate the extension off a long stem.
pub fn sanitize_filename_parts(filename: &str) -> (String, String) {
    let path = Path::new(filename);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or_default();
    let ext: String = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(16)
        .collect();
    (sanitize_component(stem), ext)
}

fn unique_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let filename = if ext.is_empty() { stem.to_string() } else { format!("{stem}.{ext}") };
    let first = dir.join(filename);
    if !first.exists() {
        return first;
    }
    for index in 2.. {
        let filename = if ext.is_empty() {
            format!("{stem} ({index})")
        } else {
            format!("{stem} ({index}).{ext}")
        };
        let candidate = dir.join(filename);
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!()
}

pub fn write_file_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("document");
    let tmp = path.with_file_name(format!("{name}.voxlen-tmp"));
    fs::write(&tmp, bytes)?;
    match fs::rename(&tmp, path) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&tmp);
            Err(error)
        }
    }
}

#[tauri::command]
pub fn save_document(
    root: String,
    subdirs: Vec<String>,
    filename: String,
    contents_b64: String,
) -> Result<String, String> {
    let root = PathBuf::from(root);
    if !root.is_dir() {
        return Err("Document root does not exist or is unavailable".to_string());
    }
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let dir = subdirs.into_iter().fold(root, |path, part| path.join(sanitize_component(&part)));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let (stem, ext) = sanitize_filename_parts(&filename);
    let final_path = unique_path(&dir, &stem, &ext);
    let bytes = STANDARD.decode(contents_b64).map_err(|e| format!("Invalid document contents: {e}"))?;
    write_file_atomic(&final_path, &bytes).map_err(|e| e.to_string())?;
    final_path.canonicalize().map_err(|e| e.to_string()).map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir() -> PathBuf {
        let id = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("voxlen-documents-{id}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sanitizes_components() {
        for (input, expected) in [
            ("Client: Smith?", "Client Smith"),
            ("  Matter.  ", "Matter"),
            ("CON", "Unfiled"),
            ("con.txt", "Unfiled"),
            ("Lpt9.notes", "Unfiled"),
            ("COM0", "COM0"),
            ("Māori 法律", "Māori 法律"),
        ] {
            assert_eq!(sanitize_component(input), expected);
        }
        assert_eq!(sanitize_component("<>:\\/|?*\"\u{7}"), "Unfiled");
    }

    #[test]
    fn long_stem_keeps_extension() {
        let long = "x".repeat(120);
        let (stem, ext) = sanitize_filename_parts(&format!("{long}.docx"));
        assert_eq!(stem.chars().count(), 80);
        assert_eq!(ext, "docx");
        assert_eq!(sanitize_filename_parts("con.docx"), ("Unfiled".to_string(), "docx".to_string()));
        assert_eq!(sanitize_filename_parts("notes"), ("notes".to_string(), String::new()));
    }

    #[test]
    fn collision_suffixes_start_at_two() {
        let dir = test_dir();
        fs::write(dir.join("Transcript.docx"), b"one").unwrap();
        fs::write(dir.join("Transcript (2).docx"), b"two").unwrap();
        assert_eq!(unique_path(&dir, "Transcript", "docx"), dir.join("Transcript (3).docx"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn atomic_write_leaves_no_temp_file() {
        let dir = test_dir();
        let path = dir.join("test.docx");
        write_file_atomic(&path, b"document").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"document");
        assert!(!dir.join("test.docx.voxlen-tmp").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn empty_component_falls_back() {
        assert_eq!(sanitize_component("   ..."), "Unfiled");
    }
}
