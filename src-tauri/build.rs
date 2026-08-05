use std::path::PathBuf;

/// llama-cpp-sys-2 (dynamic-link) produces ggml/llama DLLs during its own
/// build. Depending on cache state they may sit in `target/{profile}/` or only
/// in the sys crate's cmake out dir (`target/{profile}/build/llama-cpp-sys-2-*/out/**`).
/// Copy them to a stable `dlls/` folder so the Windows bundle-resource paths in
/// `tauri.windows.conf.json` always exist. tauri_build also copies these
/// resources next to dev/test binaries, so a 0-byte placeholder here makes any
/// test exe that links llama.dll die with STATUS_INVALID_FILE_FOR_SECTION —
/// placeholders are a last resort and never allowed in release.
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
        if profile == "release" {
            // Fail loudly rather than ship an installer whose bundled DLL is
            // missing or a 0-byte stale placeholder — that breaks app launch.
            panic!(
                "Release build: required DLL '{}' was not found (searched {} and \
                 {}\\build\\llama-cpp-sys-2-*\\out). Build llama-cpp-sys-2 \
                 (dynamic-link) first, or clear stale placeholders from {}.",
                name,
                src_dir.display(),
                src_dir.display(),
                dest_dir.display()
            );
        }
        // Dev/debug only: keep the resource path valid so tauri_build doesn't
        // hard-fail; note that running tests that load llama with a placeholder
        // staged will fail until the real DLLs are built.
        println!(
            "cargo:warning=Staging 0-byte placeholder for {name} (real DLL not built yet)"
        );
        let _ = std::fs::File::create(&dest);
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    stage_llama_dlls();
    tauri_build::build()
}
