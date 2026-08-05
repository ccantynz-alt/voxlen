use std::path::PathBuf;

/// llama-cpp-sys-2 (dynamic-link) drops its DLLs into `target/{profile}/`
/// during its own build, which finishes before this script runs. Copy them
/// to a stable `dlls/` folder so the Windows bundle-resource paths in
/// `tauri.windows.conf.json` always exist — including on fresh clones and
/// debug builds (tauri_build hard-fails on missing resource paths).
#[cfg(target_os = "windows")]
fn stage_llama_dlls() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let profile = std::env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let target_dir = std::env::var("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| manifest_dir.join("target"));
    let src_dir = target_dir.join(&profile);
    let dest_dir = manifest_dir.join("dlls");
    let _ = std::fs::create_dir_all(&dest_dir);

    for name in [
        "ggml.dll",
        "ggml-base.dll",
        "ggml-cpu.dll",
        "llama.dll",
        "llama-common.dll",
    ] {
        let src = src_dir.join(name);
        let dest = dest_dir.join(name);
        if src.exists() {
            let _ = std::fs::copy(&src, &dest);
        } else if !dest.exists() && profile != "release" {
            // Dev/debug only: keep the resource path valid even if this
            // profile's DLLs are not built yet (tauri_build hard-fails on
            // missing resource paths). Never in release — a bundled 0-byte
            // DLL would break app launch.
            let _ = std::fs::File::create(&dest);
        }
        if profile == "release" {
            // Fail loudly rather than ship a bundle with a missing or 0-byte
            // (stale dev placeholder) DLL.
            let staged_len = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
            if staged_len == 0 {
                panic!(
                    "Release build: required DLL '{}' is missing or 0 bytes after staging \
                     (searched {}). Build llama-cpp-sys-2 (dynamic-link) for the release \
                     profile first, or clear stale placeholders from {}.",
                    name,
                    src_dir.display(),
                    dest_dir.display()
                );
            }
        }
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    stage_llama_dlls();
    tauri_build::build()
}
