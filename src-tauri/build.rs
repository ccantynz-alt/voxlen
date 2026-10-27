use std::path::PathBuf;

/// llama-cpp-sys-2 (dynamic-link) produces ggml/llama DLLs during its own
/// build. Cargo runs THIS build script in parallel with dependency
/// compilation, so on a cold build those DLLs may not exist anywhere yet —
/// this script therefore only best-effort stages what it can find and
/// otherwise creates 0-byte placeholders so tauri_build's resource-path
/// validation passes. The REAL enforcement happens after compilation in
/// `scripts/stage-dlls.mjs` (beforeBundleCommand), which re-stages the built
/// DLLs and hard-fails the bundle if any are missing or empty.
#[cfg(target_os = "windows")]
fn stage_llama_dlls() {
    use std::path::Path;

    fn is_nonempty(p: &Path) -> bool {
        std::fs::metadata(p).map(|m| m.len() > 0).unwrap_or(false)
    }

    fn walk_find(dir: &Path, name: &str, depth: u32) -> Option<PathBuf> {
        if depth == 0 {
            return None;
        }
        for e in std::fs::read_dir(dir).ok()?.flatten() {
            let p = e.path();
            if p.is_dir() {
                if let Some(f) = walk_find(&p, name, depth - 1) {
                    return Some(f);
                }
            } else if p
                .file_name()
                .is_some_and(|n| n.eq_ignore_ascii_case(name))
                && is_nonempty(&p)
            {
                return Some(p);
            }
        }
        None
    }

    fn find_real_dll(src_dir: &Path, name: &str) -> Option<PathBuf> {
        let direct = src_dir.join(name);
        if is_nonempty(&direct) {
            return Some(direct);
        }
        // Newest llama-cpp-sys-2 build dir first, in case stale ones linger
        let mut sys_dirs: Vec<PathBuf> = std::fs::read_dir(src_dir.join("build"))
            .ok()?
            .flatten()
            .map(|e| e.path())
            .filter(|p| {
                p.is_dir()
                    && p.file_name()
                        .is_some_and(|n| n.to_string_lossy().starts_with("llama-cpp-sys-2-"))
            })
            .collect();
        sys_dirs.sort_by_key(|p| {
            std::cmp::Reverse(
                std::fs::metadata(p)
                    .and_then(|m| m.modified())
                    .ok(),
            )
        });
        sys_dirs
            .iter()
            .find_map(|d| walk_find(&d.join("out"), name, 8))
    }

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
        let dest = dest_dir.join(name);
        if let Some(src) = find_real_dll(&src_dir, name) {
            let _ = std::fs::copy(&src, &dest);
        }
        if is_nonempty(&dest) {
            continue;
        }
        // Placeholder keeps tauri_build's resource validation happy; the
        // bundle-time script replaces it with the real DLL or fails loudly.
        println!(
            "cargo:warning=Staging 0-byte placeholder for {name} (not built yet; bundle step re-stages)"
        );
        let _ = std::fs::File::create(&dest);
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    stage_llama_dlls();
    tauri_build::build()
}
