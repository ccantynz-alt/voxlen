/**
 * Self-diagnostics ("Doctor") — typed wrapper around the Rust `run_doctor`
 * command plus pure helpers for summarizing results. All checks run
 * backend-side and are content-free (no audio or transcript data touched).
 */

export type DoctorStatus = "ok" | "warn" | "fail";

/** Mirrors the Rust `DoctorCheck` struct (serialized camelCase). */
export interface DoctorCheck {
  /** Stable slug, e.g. "audio-input". */
  id: string;
  /** Human label, e.g. "Audio input". */
  name: string;
  status: DoctorStatus;
  /** What was found. */
  detail: string;
  /** Actionable next step; set on warn/fail checks. */
  fixHint: string | null;
}

/** True when running inside the Tauri shell (production desktop app). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Run the full backend diagnostics sweep. Only callable under Tauri. */
export async function runDoctor(): Promise<DoctorCheck[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return await invoke<DoctorCheck[]>("run_doctor");
}

/** The worst status across all checks ("fail" > "warn" > "ok"). */
export function worstStatus(checks: DoctorCheck[]): DoctorStatus {
  let worst: DoctorStatus = "ok";
  for (const check of checks) {
    if (check.status === "fail") return "fail";
    if (check.status === "warn") worst = "warn";
  }
  return worst;
}

/** Number of checks that are not "ok". */
export function countIssues(checks: DoctorCheck[]): number {
  return checks.filter((c) => c.status !== "ok").length;
}

/** One-line summary for the health card. */
export function summaryLine(checks: DoctorCheck[]): string {
  const issues = countIssues(checks);
  if (issues === 0) return "All systems operational";
  return `${issues} issue${issues === 1 ? "" : "s"} found`;
}
