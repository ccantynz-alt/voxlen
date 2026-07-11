/**
 * Billing math — pure functions, no store imports.
 *
 * Legal billing convention: time is rounded UP to the firm's billing
 * increment (typically 0.1 hr = 6 minutes), with a minimum billable
 * increment per entry. Rounding up (not nearest) is the standard
 * attorney convention.
 */

import type { Client } from "@/stores/clients";

export type RoundingIncrement = 0 | 0.1 | 0.25;

export interface BillingOptions {
  /** Rounding increment in hours. 0 = no rounding. */
  incrementHours: RoundingIncrement;
  /** Minimum billable hours per entry (e.g. 0.1). */
  minimumHours: number;
}

/**
 * Convert raw seconds to billable hours, rounding UP to the increment
 * and enforcing the minimum. incrementHours = 0 disables rounding
 * (raw hours, still subject to the minimum).
 */
export function roundBillableSeconds(
  seconds: number,
  incrementHours: RoundingIncrement,
  minimumHours: number
): number {
  if (seconds <= 0) return 0;
  const rawHours = seconds / 3600;
  let hours = rawHours;
  if (incrementHours > 0) {
    // Guard against float artifacts (e.g. 0.30000000000000004 units).
    const units = Math.ceil(rawHours / incrementHours - 1e-9);
    hours = units * incrementHours;
  }
  hours = Math.max(hours, minimumHours);
  // Normalize to a sane precision (0.1/0.25 grids are exact at 4 dp).
  return Math.round(hours * 10000) / 10000;
}

export interface BillableComputation {
  /** Billable hours after rounding rules. */
  hours: number;
  /** Dollar amount = hours * rate. */
  amount: number;
  /** True when rounding/minimum changed the raw duration. */
  rounded: boolean;
}

export function computeBillableAmount(
  seconds: number,
  ratePerHour: number,
  opts: BillingOptions
): BillableComputation {
  const hours = roundBillableSeconds(seconds, opts.incrementHours, opts.minimumHours);
  const rawHours = Math.max(seconds, 0) / 3600;
  return {
    hours,
    amount: Math.round(hours * ratePerHour * 100) / 100,
    rounded: Math.abs(hours - rawHours) > 1e-9,
  };
}

export type RateSource = "client" | "default" | "none";

export interface ResolvedRate {
  rate: number;
  /** "none" means the resolution landed on $0 — drives UI warnings. */
  source: RateSource;
}

/** Resolve the effective hourly rate for a client (0 on client = use default). */
export function resolveRate(
  client: Client | undefined,
  defaultRate: number
): ResolvedRate {
  if (client && client.billableRate > 0) {
    return { rate: client.billableRate, source: "client" };
  }
  if (defaultRate > 0) {
    return { rate: defaultRate, source: "default" };
  }
  return { rate: 0, source: "none" };
}

/**
 * Draft a billing narrative from a transcript: first sentence (or line),
 * truncated. Mirrors the flywheel's privacy posture of never persisting
 * long free-text runs.
 */
export function draftNarrative(fullText: string, maxLen = 120): string {
  const text = fullText.trim();
  if (!text) return "Dictation session";
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  const sentenceMatch = firstLine.match(/^.*?[.!?](?=\s|$)/);
  let narrative = (sentenceMatch ? sentenceMatch[0] : firstLine).trim();
  if (narrative.length > maxLen) {
    narrative = `${narrative.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return narrative;
}

/** Format billable hours for display in legal convention (1 decimal place min). */
export function formatBillableHours(hours: number): string {
  return hours.toFixed(hours * 10 % 1 === 0 ? 1 : 2);
}
