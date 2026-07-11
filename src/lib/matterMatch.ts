/**
 * Contextual matter matching — suggests which client/matter a dictation
 * belongs to by matching transcript content against client names, matter
 * numbers, and per-matter vocabulary. Pure local string matching; no
 * content ever leaves the device.
 */

import type { Client } from "@/stores/clients";

export interface ClientSuggestion {
  clientId: string;
  score: number;
  /** What matched, for UI explanation (e.g. ["name", "vocabulary: estoppel"]). */
  matchedOn: string[];
}

/** Suggestions below this score are noise. */
export const SUGGESTION_THRESHOLD = 3;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholePhrase(text: string, phrase: string): boolean {
  const p = phrase.trim();
  if (p.length < 3) return false;
  // \b only works against word characters — a phrase ending in "." or ")"
  // (e.g. "Smith (Holdings) Ltd.") needs no trailing boundary.
  const lead = /^\w/.test(p) ? "\\b" : "";
  const tail = /\w$/.test(p) ? "\\b" : "";
  return new RegExp(`${lead}${escapeRegex(p)}${tail}`, "i").test(text);
}

/**
 * Score every candidate client against the transcript and return the best
 * one at or above the threshold, or null. `excludeClientId` skips the
 * currently-active client (suggesting it would be a no-op).
 */
export function suggestClient(
  text: string,
  clients: Client[],
  excludeClientId?: string | null
): ClientSuggestion | null {
  if (!text.trim()) return null;

  let best: ClientSuggestion | null = null;
  for (const client of clients) {
    if (client.archived || client.id === excludeClientId) continue;

    let score = 0;
    const matchedOn: string[] = [];

    if (wholePhrase(text, client.name)) {
      score += 3;
      matchedOn.push("name");
    }
    if (client.matterNumber && text.toLowerCase().includes(client.matterNumber.toLowerCase())) {
      score += 4;
      matchedOn.push(`matter #${client.matterNumber}`);
    }
    let vocabHits = 0;
    for (const term of client.vocabulary ?? []) {
      if (vocabHits >= 3) break; // cap vocab contribution
      if (wholePhrase(text, term)) {
        vocabHits++;
        matchedOn.push(`vocabulary: ${term}`);
      }
    }
    score += vocabHits;

    if (score >= SUGGESTION_THRESHOLD && (!best || score > best.score)) {
      best = { clientId: client.id, score, matchedOn };
    }
  }
  return best;
}

/**
 * When a client is already active, only surface a competing suggestion if
 * it decisively outscores the threshold — prevents chatty misfiled-session
 * warnings on incidental mentions of another client.
 */
export function suggestOverActive(
  text: string,
  clients: Client[],
  activeClientId: string
): ClientSuggestion | null {
  const s = suggestClient(text, clients, activeClientId);
  return s && s.score >= SUGGESTION_THRESHOLD * 2 ? s : null;
}
