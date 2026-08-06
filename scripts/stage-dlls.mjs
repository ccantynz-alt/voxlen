// Re-stages the llama/ggml DLLs that ship as Windows bundle resources.
// Runs as Tauri's beforeBundleCommand: AFTER the binary (and every
// dependency, including llama-cpp-sys-2) has compiled, BEFORE the bundler
// copies src-tauri/dlls/. Unlike build.rs — which runs in parallel with
// dependency compilation and may only find placeholders — at this point the
// real DLLs must exist, so a missing or 0-byte DLL fails the bundle loudly
// instead of shipping a broken installer.
import { readdirSync, statSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") process.exit(0);

const DLLS = [
  "ggml.dll",
  "ggml-base.dll",
  "ggml-cpu.dll",
  "llama.dll",
  "llama-common.dll",
];

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcTauri = join(repoRoot, "src-tauri");
const targetRoot = process.env.CARGO_TARGET_DIR ?? join(srcTauri, "target");
const triple = process.env.TAURI_ENV_TARGET_TRIPLE;

// No --target on Windows CI → target/release; keep the triple dir as a
// fallback for anyone building with an explicit --target.
const profileDirs = [
  join(targetRoot, "release"),
  ...(triple ? [join(targetRoot, triple, "release")] : []),
].filter(existsSync);

function isNonEmpty(p) {
  try {
    return statSync(p).size > 0;
  } catch {
    return false;
  }
}

function walkFind(dir, name, depth) {
  if (depth === 0) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const found = walkFind(p, name, depth - 1);
      if (found) return found;
    } else if (e.name.toLowerCase() === name.toLowerCase() && isNonEmpty(p)) {
      return p;
    }
  }
  return null;
}

function findDll(name) {
  for (const dir of profileDirs) {
    const direct = join(dir, name);
    if (isNonEmpty(direct)) return direct;
  }
  for (const dir of profileDirs) {
    const buildDir = join(dir, "build");
    let sysDirs;
    try {
      sysDirs = readdirSync(buildDir)
        .filter((n) => n.startsWith("llama-cpp-sys-2-"))
        .map((n) => join(buildDir, n));
    } catch {
      continue;
    }
    sysDirs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const d of sysDirs) {
      const found = walkFind(join(d, "out"), name, 8);
      if (found) return found;
    }
  }
  return null;
}

const destDir = join(srcTauri, "dlls");
mkdirSync(destDir, { recursive: true });

const missing = [];
for (const name of DLLS) {
  const src = findDll(name);
  if (src) {
    copyFileSync(src, join(destDir, name));
    console.log(`staged ${name} <- ${src}`);
  } else {
    missing.push(name);
  }
}

if (missing.length > 0) {
  console.error(
    `stage-dlls: missing required DLLs after compilation: ${missing.join(", ")}\n` +
      `searched: ${profileDirs.join(", ")} (+ build/llama-cpp-sys-2-*/out)\n` +
      `A bundle produced now would ship a broken installer — aborting.`
  );
  process.exit(1);
}
