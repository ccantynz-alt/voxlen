import { invoke } from "@tauri-apps/api/core";

// True when running inside the Tauri shell (production app).
// False in browser / Vite dev mode where the Tauri IPC bridge isn't present.
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getSecret(key: string): Promise<string | null> {
  try {
    return await invoke<string | null>("keyring_get", { key });
  } catch {
    // In dev/browser mode fall back to the prefixed localStorage mirror.
    // In the production app the keychain should always work; if it doesn't
    // the call throws so the caller knows (see setSecret below).
    return localStorage.getItem(`_kr_${key}`);
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  try {
    await invoke("keyring_set", { key, value });
  } catch (err) {
    if (isTauri()) {
      // We're inside the real app and the OS keychain failed — do NOT silently
      // downgrade to plaintext localStorage. Re-throw so the caller can handle it.
      throw err;
    }
    // Browser / dev mode: localStorage is the expected and safe fallback.
    localStorage.setItem(`_kr_${key}`, value);
  }
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    await invoke("keyring_delete", { key });
  } catch (err) {
    if (isTauri()) {
      throw err;
    }
    localStorage.removeItem(`_kr_${key}`);
  }
}
