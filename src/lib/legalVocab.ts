/**
 * Built-in legal vocabulary pack, merged into the STT keyterm boost when
 * Legal Mode is on. Nova-3 keyterm prompting dramatically improves
 * first-pass recognition of terms of art that general models mis-hear
 * ("estoppel" → "a stop hole", "certiorari" → "surrender rari"), so
 * lawyers get accurate transcripts without hand-curating hundreds of
 * custom vocabulary entries themselves.
 *
 * The pack is jurisdiction-aware: a common-law core shared everywhere,
 * plus courts/roles/instruments specific to the user's configured
 * jurisdiction. User-entered, client-matter, and flywheel-learned terms
 * always take priority over this pack when the keyterm cap is reached
 * (see `mergeVocabulary`).
 */

import type { AppSettings } from "@/stores/settings";

/** Deepgram Nova-3 accepts a bounded number of keyterms per request —
 *  beyond this the extra terms are ignored (and very large lists degrade
 *  boosting quality). User terms always win the budget over pack terms. */
export const KEYTERM_CAP = 100;

/** Latin and common-law terms of art shared across all jurisdictions. */
const CORE_LEGAL_TERMS: string[] = [
  // Latin terms of art
  "res ipsa loquitur",
  "res judicata",
  "estoppel",
  "certiorari",
  "voir dire",
  "habeas corpus",
  "mens rea",
  "actus reus",
  "prima facie",
  "inter alia",
  "ultra vires",
  "sub judice",
  "obiter dicta",
  "ratio decidendi",
  "stare decisis",
  "de novo",
  "ex parte",
  "in camera",
  "amicus curiae",
  "subpoena duces tecum",
  "quantum meruit",
  "caveat emptor",
  "force majeure",
  "pro rata",
  "pari passu",
  "bona fide",
  "mutatis mutandis",
  "locus standi",
  "functus officio",
  "non est factum",
  "uberrimae fidei",
  "contra proferentem",
  // Procedure and practice
  "interlocutory",
  "interrogatories",
  "affidavit",
  "deponent",
  "tortfeasor",
  "joinder",
  "misjoinder",
  "rejoinder",
  "demurrer",
  "estopped",
  "indemnitor",
  "indemnitee",
  "subrogation",
  "novation",
  "rescission",
  "severability",
  "recital",
  "testamentary",
  "intestacy",
  "codicil",
  "probate",
  "conveyancing",
  "encumbrance",
  "easement",
  "chattel",
  "bailment",
  "lien",
  "usufruct",
  "fiduciary",
  "mortgagor",
  "mortgagee",
  "lessor",
  "lessee",
  "assignor",
  "assignee",
  "garnishee",
  "adjournment",
  "arraignment",
  "recognizance",
  "injunction",
  "mandamus",
  "replevin",
  "laches",
  "tolling",
  "remittitur",
];

/** Jurisdiction-specific courts, officers, and instruments. */
const JURISDICTION_TERMS: Record<AppSettings["jurisdiction"], string[]> = {
  uk: [
    "King's Counsel",
    "solicitor-advocate",
    "barrister",
    "the Crown Court",
    "the King's Bench Division",
    "the Chancery Division",
    "Master of the Rolls",
    "CPR Part 36",
    "without prejudice save as to costs",
    "Tomlin order",
    "Part 20 claim",
    "litigant in person",
  ],
  us: [
    "Federal Rules of Civil Procedure",
    "Rule 12(b)(6)",
    "summary judgment",
    "Daubert motion",
    "Chapter 11",
    "Chapter 7",
    "the Second Circuit",
    "the Ninth Circuit",
    "SCOTUS",
    "en banc",
    "removal jurisdiction",
    "diversity jurisdiction",
  ],
  australia: [
    "the Federal Court of Australia",
    "the High Court of Australia",
    "Senior Counsel",
    "the Fair Work Commission",
    "Calderbank offer",
    "the Corporations Act",
    "ASIC",
    "unconscionable conduct",
  ],
  canada: [
    "the Supreme Court of Canada",
    "the Federal Court of Appeal",
    "the Charter",
    "King's Counsel",
    "factum",
    "examination for discovery",
    "the Divisional Court",
  ],
  nz: [
    "the High Court of New Zealand",
    "the Court of Appeal",
    "the Employment Relations Authority",
    "the Disputes Tribunal",
    "King's Counsel",
    "the Companies Act 1993",
    "the Property Law Act",
    "the Resource Management Act",
  ],
  global: [],
};

/** The full pack for a jurisdiction: shared core + local terms. */
export function legalTermsForJurisdiction(
  jurisdiction: AppSettings["jurisdiction"]
): string[] {
  return [...CORE_LEGAL_TERMS, ...(JURISDICTION_TERMS[jurisdiction] ?? [])];
}

/**
 * Merge vocabulary sources into a deduplicated keyterm list under the cap.
 * Priority order (earlier wins the budget): user custom terms, client
 * matter terms, flywheel-learned terms, then the built-in legal pack.
 * Dedupe is case-insensitive — a user-entered "Estoppel" suppresses the
 * pack's "estoppel" rather than spending two keyterm slots.
 */
export function mergeVocabulary(
  sources: string[][],
  cap: number = KEYTERM_CAP
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of sources) {
    for (const term of source) {
      const trimmed = term.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      if (out.length >= cap) return out;
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}
