use super::documents::{sanitize_component, write_file_atomic};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewFileInput { pub name: String, pub contents_b64: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPacketEntry { pub dir: String, pub packet_json: String, pub status_json: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewPacketList { pub packets: Vec<ReviewPacketEntry>, pub skipped_count: usize }

fn component(value: &str) -> Result<&str, String> {
    if value.is_empty() || value == "." || value == ".." || sanitize_component(value) != value
        || value.contains('/') || value.contains('\\') {
        Err("Invalid review path component".into())
    } else { Ok(value) }
}

fn review_root(root: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(root);
    if !root.is_dir() { return Err("Review shared folder does not exist or is unavailable".into()); }
    Ok(root.join("voxlen-review"))
}

fn decode(contents: &str) -> Result<Vec<u8>, String> {
    STANDARD.decode(contents).map_err(|e| format!("Invalid file contents: {e}"))
}

#[tauri::command]
pub fn create_review_packet(root: String, dir: String, files: Vec<ReviewFileInput>) -> Result<(), String> {
    component(&dir)?;
    for file in &files { component(&file.name)?; }
    let base = review_root(&root)?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let packet_dir = base.join(dir);
    fs::create_dir(&packet_dir).map_err(|e| format!("Could not create review packet: {e}"))?;
    for file in files {
        let bytes = decode(&file.contents_b64)?;
        write_file_atomic(&packet_dir.join(file.name), &bytes).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_review_packets(root: String) -> Result<ReviewPacketList, String> {
    let base = review_root(&root)?;
    if !base.exists() { return Ok(ReviewPacketList { packets: vec![], skipped_count: 0 }); }
    let mut packets = vec![];
    let mut skipped_count = 0;
    for entry in fs::read_dir(base).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_dir() { continue; }
        let path = entry.path();
        let packet = fs::read_to_string(path.join("packet.json"));
        let status = fs::read_to_string(path.join("status.json"));
        match (packet, status) {
            (Ok(packet_json), Ok(status_json))
                if serde_json::from_str::<serde_json::Value>(&packet_json).is_ok()
                    && serde_json::from_str::<serde_json::Value>(&status_json).is_ok() => {
                packets.push(ReviewPacketEntry {
                    dir: entry.file_name().to_string_lossy().into_owned(), packet_json, status_json,
                });
            }
            _ => skipped_count += 1,
        }
    }
    packets.sort_by(|a, b| b.dir.cmp(&a.dir));
    Ok(ReviewPacketList { packets, skipped_count })
}

fn file_path(root: &str, dir: &str, name: &str) -> Result<PathBuf, String> {
    component(dir)?; component(name)?;
    let path = review_root(root)?.join(dir).join(name);
    if !path.parent().is_some_and(Path::is_dir) { return Err("Review packet does not exist".into()); }
    Ok(path)
}

#[tauri::command]
pub fn read_review_file(root: String, dir: String, name: String) -> Result<String, String> {
    fs::read(file_path(&root, &dir, &name)?).map(|bytes| STANDARD.encode(bytes)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_review_file(root: String, dir: String, name: String, contents_b64: String) -> Result<(), String> {
    let path = file_path(&root, &dir, &name)?;
    write_file_atomic(&path, &decode(&contents_b64)?).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    fn root() -> PathBuf {
        let p = std::env::temp_dir().join(format!("voxlen-review-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&p).unwrap(); p
    }
    fn b64(s: &str) -> String { STANDARD.encode(s) }
    #[test] fn rejects_traversal() {
        for bad in ["..", ".", "a/b", "a\\b", ""] { assert!(component(bad).is_err()); }
    }
    #[test] fn commit_marker_filters_and_broken_json_is_skipped() {
        let root = root(); let base = root.join("voxlen-review"); fs::create_dir(&base).unwrap();
        let incomplete = base.join("incomplete"); fs::create_dir(&incomplete).unwrap(); fs::write(incomplete.join("packet.json"), "{}").unwrap();
        let broken = base.join("broken"); fs::create_dir(&broken).unwrap(); fs::write(broken.join("packet.json"), "{").unwrap(); fs::write(broken.join("status.json"), "{}").unwrap();
        let result = list_review_packets(root.to_string_lossy().into()).unwrap();
        assert!(result.packets.is_empty()); assert_eq!(result.skipped_count, 2); fs::remove_dir_all(root).unwrap();
    }
    #[test] fn overwrites_file_atomically() {
        let root = root();
        create_review_packet(root.to_string_lossy().into(), "packet".into(), vec![ReviewFileInput { name: "status.json".into(), contents_b64: b64("one") }]).unwrap();
        write_review_file(root.to_string_lossy().into(), "packet".into(), "status.json".into(), b64("two")).unwrap();
        assert_eq!(fs::read(root.join("voxlen-review/packet/status.json")).unwrap(), b"two");
        assert!(!root.join("voxlen-review/packet/status.json.voxlen-tmp").exists()); fs::remove_dir_all(root).unwrap();
    }
}
