/**
 * Local pre-application of flywheel-learned correction patterns.
 *
 * Patterns the user's grammar engine has fixed repeatedly (>= 3 times)
 * are applied directly on-device before any cloud call — cutting cloud
 * latency and, critically, providing correction in Privileged Mode
 * where cloud grammar is disabled entirely.
 */

import type { CorrectionPattern } from "@/stores/flywheel";

const MIN_OCCURRENCES = 3;
const MIN_LENGTH = 3;
const MAX_PATTERNS = 50;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Preserve leading-cap casing of the matched text in the replacement. */
function matchCase(replacement: string, matched: string): string {
  if (matched[0] === matched[0].toUpperCase() && replacement[0]) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function applyLearnedCorrections(
  text: string,
  patterns: CorrectionPattern[]
): { text: string; applied: number } {
  const usable = patterns
    .filter(
      (p) =>
        p.occurrences >= MIN_OCCURRENCES &&
        p.original.length >= MIN_LENGTH &&
        p.original.toLowerCase() !== p.corrected.toLowerCase() &&
        (p.category === "spelling" || p.category === "grammar")
    )
    // Longest first so "should of" wins over any shorter overlapping pattern.
    .sort((a, b) => b.original.length - a.original.length)
    .slice(0, MAX_PATTERNS);

  let out = text;
  let applied = 0;
  for (const p of usable) {
    const lead = /^\w/.test(p.original) ? "\\b" : "";
    const tail = /\w$/.test(p.original) ? "\\b" : "";
    const re = new RegExp(`${lead}${escapeRegex(p.original)}${tail}`, "gi");
    out = out.replace(re, (m) => {
      applied++;
      return matchCase(p.corrected, m);
    });
  }
  return { text: out, applied };
}
