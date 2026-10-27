import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Signed auto-update flow (tauri-plugin-updater).
 * The manifest lives at the GitHub release asset `latest.json`; packages are
 * verified against the public key baked into tauri.conf.json before install.
 */

export type UpdateProgress = {
  downloaded: number;
  total: number | undefined;
};

/** Returns the pending update, or null when already on the latest version. */
export async function checkForUpdate(): Promise<Update | null> {
  return await check();
}

/**
 * Download, verify, install, then restart the app. Rejects if the signature
 * check or install fails — the caller should surface that to the user.
 */
export async function installUpdate(
  update: Update,
  onProgress?: (p: UpdateProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | undefined;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? undefined;
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress?.({ downloaded, total });
        break;
      case "Finished":
        onProgress?.({ downloaded: total ?? downloaded, total });
        break;
    }
  });
  await relaunch();
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
