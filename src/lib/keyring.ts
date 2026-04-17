import { invoke } from "@tauri-apps/api/core";

export async function getSecret(key: string): Promise<string | null> {
  try {
    return await invoke<string | null>("keyring_get", { key });
  } catch {
    return localStorage.getItem(`_kr_${key}`);
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  try {
    await invoke("keyring_set", { key, value });
  } catch {
    localStorage.setItem(`_kr_${key}`, value);
  }
}

export async function deleteSecret(key: string): Promise<void> {
  try {
    await invoke("keyring_delete", { key });
  } catch {
    localStorage.removeItem(`_kr_${key}`);
  }
}
