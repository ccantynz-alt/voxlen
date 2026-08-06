/**
 * Citation-aware formatting for Legal Mode.
 *
 * Converts dictated case citations, reporter citations, statutes, and
 * neutral citations into the correct written form for the user's
 * jurisdiction:
 *
 *   "smith v jones"                  → "Smith v. Jones"   (US, Bluebook)
 *                                    → "Smith v Jones"    (UK/AU/NZ/CA, OSCOLA/AGLC/McGill)
 *   "542 us 241"                     → "542 U.S. 241"
 *   "891 f third 1093"               → "891 F.3d 1093"
 *   "42 usc section 1983"            → "42 U.S.C. § 1983"
 *   "2020 uksc 1"                    → "[2020] UKSC 1"
 *   "section 6 of the human rights act 1998" → "Human Rights Act 1998, s 6" (UK)
 *   "section symbol 12"              → "§ 12"
 *
 * HARD RULE (same as formatLegalCurrency): anything that doesn't parse as
 * a clear citation is LEFT UNTOUCHED. A lawyer's words are never mangled
 * on a guess. All transforms are idempotent — re-running the formatter on
 * already-formatted text changes nothing.
 *
 * Jurisdiction-dependent choices:
 *   - Case-name separator: "v." (US) vs "v" (everyone else).
 *   - "section N of the act": "§ N …" (US) / "s N …" (UK/AU/NZ/CA);
 *     left untouched for "global" because no single style can be assumed.
 *   - Named-act reordering ("section 6 of the human rights act 1998")
 *     only for UK/NZ (", s 6") and AU (AGLC: " s 6").
 * Self-identifying formats (U.S. reporters, U.S.C., neutral citations,
 * year-bracket reporters, spoken symbols) are formatted in every
 * jurisdiction — there is only one correct way to write them.
 */

import type { AppSettings } from "@/stores/settings";

export type Jurisdiction = AppSettings["jurisdiction"];

// ---------------------------------------------------------------------------
// Spoken symbols
// ---------------------------------------------------------------------------

function formatSpokenSymbols(input: string): string {
  let out = input.replace(/\bsection\s+symbol\b/gi, "§");
  out = out.replace(/\bparagraph\s+symbol\b/gi, "¶");
  return out;
}

// ---------------------------------------------------------------------------
// US reporter citations
// ---------------------------------------------------------------------------

/** Spoken/typed series ordinal → Bluebook series designator. */
const SERIES: Record<string, string> = {
  "2d": "2d",
  "2nd": "2d",
  second: "2d",
  "3d": "3d",
  "3rd": "3d",
  third: "3d",
  "4th": "4th",
  fourth: "4th",
};
const SERIES_ALT = "2d|2nd|second|3d|3rd|third|4th|fourth";
const SERIES_2_3 = "2d|2nd|second|3d|3rd|third";

function seriesOf(raw: string | undefined): string | null {
  if (!raw) return null;
  return SERIES[raw.toLowerCase()] ?? null;
}

/**
 * Reporter rules. Each matches "<volume> <reporter tokens> <page>" and emits
 * the canonical Bluebook abbreviation. Patterns require BOTH a leading volume
 * number and a trailing page number, so prose like "we saw 542 US soldiers"
 * or "call us 24 7" never matches. All are idempotent: the canonical output
 * re-matches its own rule and re-emits itself unchanged.
 */
interface ReporterRule {
  re: RegExp;
  /** Build "<vol> <canonical> <page>" from the match. Return null to refuse. */
  build: (m: RegExpExecArray) => string | null;
}

const REPORTER_RULES: ReporterRule[] = [
  // 542 U.S. 241 — "u\.?\s*s\.?" is deliberately NOT followed by an optional
  // "c": "42 usc 1983" must fall through to the statute rule instead.
  {
    re: /\b(\d{1,4})\s+u\.?\s*s\.?\s+(\d{1,4})\b/gi,
    build: (m) => `${m[1]} U.S. ${m[2]}`,
  },
  // 125 S. Ct. 2738
  {
    re: /\b(\d{1,4})\s+s\.?\s*ct\.?\s+(\d{1,4})\b/gi,
    build: (m) => `${m[1]} S. Ct. ${m[2]}`,
  },
  // 89 L. Ed. 2d 674 (series optional: "l ed 674" → "L. Ed. 674")
  {
    re: /\b(\d{1,4})\s+l\.?\s*ed\.?(?:\s*(2d|2nd|second))?\s+(\d{1,4})\b/gi,
    build: (m) => `${m[1]} L. Ed.${m[2] ? " 2d" : ""} ${m[3]}`,
  },
  // 456 F. Supp. 3d 789 (series optional; must run before the bare F rule)
  {
    re: new RegExp(
      `\\b(\\d{1,4})\\s+f\\.?\\s*supp\\.?(?:\\s*(${SERIES_2_3}))?\\s+(\\d{1,4})\\b`,
      "gi"
    ),
    build: (m) => {
      const s = m[2] ? seriesOf(m[2]) : null;
      if (m[2] && !s) return null;
      return `${m[1]} F. Supp.${s ? ` ${s}` : ""} ${m[3]}`;
    },
  },
  // 891 F.3d 1093 / "891 f third 1093" — series REQUIRED (a bare "f" is too
  // ambiguous to touch).
  {
    re: new RegExp(`\\b(\\d{1,4})\\s+f\\.?\\s*(${SERIES_ALT})\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => {
      const s = seriesOf(m[2]);
      return s ? `${m[1]} F.${s} ${m[3]}` : null;
    },
  },
  // Regional reporters — series always required.
  {
    // 300 P.3d 100
    re: new RegExp(`\\b(\\d{1,4})\\s+p\\.?\\s*(${SERIES_2_3})\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => {
      const s = seriesOf(m[2]);
      return s ? `${m[1]} P.${s} ${m[3]}` : null;
    },
  },
  {
    // 140 So. 3d 22 — note the space: "So. 3d", not "So.3d"
    re: new RegExp(`\\b(\\d{1,4})\\s+so\\.?\\s*(${SERIES_2_3})\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => {
      const s = seriesOf(m[2]);
      return s ? `${m[1]} So. ${s} ${m[3]}` : null;
    },
  },
  {
    // 12 N.E.3d 44 ("ne" / "n e" / "N.E.")
    re: new RegExp(`\\b(\\d{1,4})\\s+n\\.?\\s*e\\.?\\s*(${SERIES_2_3})\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => {
      const s = seriesOf(m[2]);
      return s ? `${m[1]} N.E.${s} ${m[3]}` : null;
    },
  },
  {
    // 77 S.W.3d 88
    re: new RegExp(`\\b(\\d{1,4})\\s+s\\.?\\s*w\\.?\\s*(${SERIES_2_3})\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => {
      const s = seriesOf(m[2]);
      return s ? `${m[1]} S.W.${s} ${m[3]}` : null;
    },
  },
  {
    // 260 S.E.2d 84
    re: new RegExp(`\\b(\\d{1,4})\\s+s\\.?\\s*e\\.?\\s*(2d|2nd|second)\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => `${m[1]} S.E.2d ${m[3]}`,
  },
  {
    // 480 N.W.2d 105
    re: new RegExp(`\\b(\\d{1,4})\\s+n\\.?\\s*w\\.?\\s*(2d|2nd|second)\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => `${m[1]} N.W.2d ${m[3]}`,
  },
  {
    // 5 A.3d 9 — "a" is an English article, so the mandatory series token AND
    // trailing page number are what make this safe ("5 a third 9" is not
    // plausible prose).
    re: new RegExp(`\\b(\\d{1,4})\\s+a\\.?\\s*(${SERIES_2_3})\\s+(\\d{1,4})\\b`, "gi"),
    build: (m) => {
      const s = seriesOf(m[2]);
      return s ? `${m[1]} A.${s} ${m[3]}` : null;
    },
  },
];

function formatUsReporters(input: string): string {
  let out = input;
  for (const rule of REPORTER_RULES) {
    out = out.replace(rule.re, (match: string, ...groups: unknown[]) => {
      // Rebuild a positional match array (trailing offset/source args are
      // simply never read by the builders).
      const m = [match, ...groups] as unknown as RegExpExecArray;
      return rule.build(m) ?? match;
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pincites — only ever attached to an already-canonical reporter citation,
// so this can never touch prose like "we met at 245".
// ---------------------------------------------------------------------------

const CANONICAL_REPORTER =
  "U\\.S\\.|S\\. Ct\\.|L\\. Ed\\.(?: 2d)?|F\\. Supp\\.(?: 2d| 3d)?|F\\.(?:2d|3d|4th)|P\\.(?:2d|3d)|So\\. (?:2d|3d)|N\\.E\\.(?:2d|3d)|S\\.W\\.(?:2d|3d)|S\\.E\\.2d|N\\.W\\.2d";

const PINCITE_RE = new RegExp(
  `((?:${CANONICAL_REPORTER}) \\d{1,4}),?\\s+at\\s+(?:page\\s+)?(\\d{1,4})\\b`,
  "g" // case-sensitive: canonical abbreviations only
);

function formatPincites(input: string): string {
  // Bluebook full-cite pincite: "542 U.S. 241 at page 245" → "542 U.S. 241, 245"
  return input.replace(PINCITE_RE, "$1, $2");
}

// ---------------------------------------------------------------------------
// Statutes
// ---------------------------------------------------------------------------

const TITLE_CASE_SMALL = new Set(["of", "and", "the", "for", "to", "in", "on", "at", "by"]);

function titleCaseActName(name: string): string {
  return name
    .split(/\s+/)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && TITLE_CASE_SMALL.has(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** "§" (US) / "s" (UK/AU/NZ/CA); undefined = leave untouched (global). */
const SECTION_ABBREV: Partial<Record<Jurisdiction, string>> = {
  us: "§",
  uk: "s",
  nz: "s",
  australia: "s",
  canada: "s",
};

/** Jurisdictions whose style reorders "section N of the X Act YYYY". */
const NAMED_ACT_STYLE: Partial<Record<Jurisdiction, (act: string, sec: string) => string>> = {
  uk: (act, sec) => `${act}, s ${sec}`, // OSCOLA
  nz: (act, sec) => `${act}, s ${sec}`,
  australia: (act, sec) => `${act} s ${sec}`, // AGLC — no comma
};

function formatStatutes(input: string, jurisdiction: Jurisdiction): string {
  let out = input;

  // "42 usc section 1983" / "42 u.s.c. 1983" / "42 U.S.C. § 1983" (idempotent)
  out = out.replace(
    /\b(\d{1,3})\s+u\.?\s*s\.?\s*c\.?\s+(?:section\s+|§\s*)?(\d+[a-z]{0,2}(?:\([a-z0-9]{1,4}\))*)\b/gi,
    (_m, title: string, sec: string) => `${title} U.S.C. § ${sec}`
  );

  // "title 11 of the united states code" → "11 U.S.C."
  out = out.replace(
    /\btitle\s+(\d{1,3})\s+of\s+the\s+united\s+states\s+code\b/gi,
    (_m, title: string) => `${title} U.S.C.`
  );

  // Named act with year: "section 6 of the human rights act 1998"
  //   UK/NZ → "Human Rights Act 1998, s 6"   AU → "Human Rights Act 1998 s 6"
  const namedStyle = NAMED_ACT_STYLE[jurisdiction];
  if (namedStyle) {
    out = out.replace(
      /\bsection\s+(\d+[A-Za-z]{0,2}(?:\(\d+\))*)\s+of\s+the\s+((?:[A-Za-z][A-Za-z'’-]*\s+){1,7}act)\s+((?:1[89]|20)\d{2})\b/gi,
      (_m, sec: string, actName: string, year: string) =>
        namedStyle(`${titleCaseActName(actName)} ${year}`, sec)
    );
  }

  // Generic "section 12 of the act" — only when the statutory context is
  // explicit ("of the/this/that act"). Global: no style can be assumed, so
  // it is left untouched.
  const abbrev = SECTION_ABBREV[jurisdiction];
  if (abbrev) {
    out = out.replace(
      /\bsection\s+(\d+[A-Za-z]{0,2}(?:\(\d+\))*)\s+of\s+(the|this|that)\s+act\b/gi,
      (_m, sec: string, det: string) => `${abbrev} ${sec} of ${det} act`
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Neutral citations and year-bracket reporters (UK/AU/NZ)
// ---------------------------------------------------------------------------

/** Court codes are self-identifying — spoken lowercase, written canonical. */
const NEUTRAL_COURTS: Array<[spoken: string, canonical: string]> = [
  ["ewca\\s+civ", "EWCA Civ"],
  ["ewca\\s+crim", "EWCA Crim"],
  ["fcafc", "FCAFC"],
  ["uksc", "UKSC"],
  ["ukhl", "UKHL"],
  ["ukpc", "UKPC"],
  ["ewhc", "EWHC"],
  ["hca", "HCA"],
  ["fca", "FCA"],
  ["nzsc", "NZSC"],
  ["nzca", "NZCA"],
  ["nzhc", "NZHC"],
];

const NEUTRAL_RE = new RegExp(
  `\\[?\\b((?:19|20)\\d{2})\\]?\\s+(${NEUTRAL_COURTS.map(([s]) => s).join("|")})\\s+(\\d{1,5})\\b`,
  "gi"
);

const BRACKET_REPORTERS: Array<[spoken: string, canonical: string]> = [
  ["all\\s+er", "All ER"],
  ["nzlr", "NZLR"],
  ["wlr", "WLR"],
  ["clr", "CLR"],
  ["ac", "AC"],
  ["qb", "QB"],
  ["kb", "KB"],
  ["ch", "Ch"],
  ["fam", "Fam"],
];

const BRACKET_REPORTER_RE = new RegExp(
  `\\[?\\b((?:19|20)\\d{2})\\]?\\s+(?:(\\d{1,2})\\s+)?(${BRACKET_REPORTERS.map(([s]) => s).join(
    "|"
  )})\\s+(\\d{1,4})\\b`,
  "gi"
);

function canonicalFrom(
  table: Array<[string, string]>,
  spoken: string
): string | null {
  const norm = spoken.toLowerCase().replace(/\s+/g, " ");
  for (const [pat, canonical] of table) {
    if (new RegExp(`^${pat}$`, "i").test(norm)) return canonical;
  }
  return null;
}

function formatNeutralCitations(input: string): string {
  let out = input.replace(NEUTRAL_RE, (m, year: string, court: string, num: string) => {
    const canonical = canonicalFrom(NEUTRAL_COURTS, court);
    return canonical ? `[${year}] ${canonical} ${num}` : m;
  });
  out = out.replace(
    BRACKET_REPORTER_RE,
    (m, year: string, vol: string | undefined, rep: string, page: string) => {
      const canonical = canonicalFrom(BRACKET_REPORTERS, rep);
      if (!canonical) return m;
      return `[${year}] ${vol ? `${vol} ` : ""}${canonical} ${page}`;
    }
  );
  return out;
}

// ---------------------------------------------------------------------------
// Case names — "smith v jones" / "smith vee jones" / "smith versus jones"
// ---------------------------------------------------------------------------

/** Words that can never be a one-word lowercase party. Keeps "the risk
 *  versus the reward", "chapter v", "appendix v contains" etc. untouched. */
const PARTY_STOP = new Set([
  "the", "a", "an", "and", "or", "but", "nor", "of", "in", "on", "at", "to",
  "for", "by", "with", "from", "as", "if", "then", "than", "so", "such",
  "said", "also", "not", "no", "yes",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does",
  "did", "done", "have", "has", "had", "having", "will", "would", "can",
  "could", "shall", "should", "may", "might", "must",
  "it", "its", "he", "she", "him", "her", "his", "hers", "we", "us", "our",
  "ours", "they", "them", "their", "theirs", "you", "your", "yours", "i",
  "me", "my", "mine", "this", "that", "these", "those", "there", "here",
  "who", "whom", "whose", "which", "what", "when", "where", "why", "how",
  "all", "any", "some", "each", "either", "neither", "both", "few", "many",
  "much", "more", "most", "other", "another",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten",
  "dollar", "dollars", "pound", "pounds", "euro", "euros", "cent", "cents",
  "percent",
  "versus", "vee", "vs", "v",
  "page", "pages", "paragraph", "section", "subsection", "clause", "article",
  "chapter", "part", "schedule", "appendix", "annex", "annexure", "exhibit",
  "volume", "book", "title", "division", "item", "act", "code", "case",
  "court",
]);

/** Lowercase connectors allowed INSIDE a capitalized party name
 *  ("Board of Education", "Brown and Williamson"). */
const PARTY_INTERNAL = new Set(["of", "and", "the", "for"]);

const PARTY_WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;
const MAX_PARTY_WORDS = 6;

interface PartySpan {
  start: number;
  end: number;
  text: string;
  /** true when the party came from an already-capitalized run in the input. */
  cap: boolean;
}

function isCapitalized(w: string): boolean {
  return /^[A-Z]/.test(w);
}

function capitalizeWord(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function formatPartyWords(words: string[]): string {
  return words
    .map((w, i) =>
      i > 0 && PARTY_INTERNAL.has(w.toLowerCase()) ? w.toLowerCase() : capitalizeWord(w)
    )
    .join(" ");
}

/** The party immediately BEFORE the connector, or null if none parses. */
function scanPartyLeft(text: string, connStart: number): PartySpan | null {
  const before = text.slice(0, connStart);
  const run = before.match(/([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*)\s*$/);
  if (!run || run.index === undefined) return null;
  const toks = Array.from(run[1].matchAll(PARTY_WORD_RE));
  if (toks.length === 0) return null;

  const words: string[] = [];
  let firstIdx = toks.length - 1;
  const last = toks[toks.length - 1][0];
  let cap = false;

  if (isCapitalized(last)) {
    cap = true;
    let i = toks.length - 1;
    while (i >= 0 && words.length < MAX_PARTY_WORDS) {
      const w = toks[i][0];
      if (isCapitalized(w)) {
        words.unshift(w);
        firstIdx = i;
        i--;
      } else if (PARTY_INTERNAL.has(w.toLowerCase()) && i > 0 && isCapitalized(toks[i - 1][0])) {
        words.unshift(w);
        firstIdx = i;
        i--;
      } else {
        break;
      }
    }
  } else {
    const lower = last.toLowerCase();
    if (last.length < 2 || PARTY_STOP.has(lower)) return null;
    if (
      lower === "states" &&
      toks.length >= 2 &&
      toks[toks.length - 2][0].toLowerCase() === "united"
    ) {
      firstIdx = toks.length - 2;
      words.push(toks[firstIdx][0], last);
    } else {
      words.push(last);
    }
  }
  if (words.length === 0) return null;

  const lastTok = toks[toks.length - 1];
  return {
    start: run.index + (toks[firstIdx].index ?? 0),
    end: run.index + (lastTok.index ?? 0) + lastTok[0].length,
    text: formatPartyWords(words),
    cap,
  };
}

/** The party immediately AFTER the connector, or null if none parses. */
function scanPartyRight(text: string, connEnd: number): PartySpan | null {
  const after = text.slice(connEnd);
  const m = after.match(/^(\s+)([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*)/);
  if (!m) return null;
  const base = connEnd + m[1].length;
  const toks = Array.from(m[2].matchAll(PARTY_WORD_RE));
  if (toks.length === 0) return null;

  const words: string[] = [];
  let lastIdx = 0;
  const first = toks[0][0];
  let cap = false;

  if (isCapitalized(first)) {
    cap = true;
    let i = 0;
    while (i < toks.length && words.length < MAX_PARTY_WORDS) {
      const w = toks[i][0];
      if (isCapitalized(w)) {
        words.push(w);
        lastIdx = i;
        i++;
      } else if (
        PARTY_INTERNAL.has(w.toLowerCase()) &&
        i + 1 < toks.length &&
        isCapitalized(toks[i + 1][0])
      ) {
        words.push(w);
        lastIdx = i;
        i++;
      } else {
        break;
      }
    }
  } else {
    const lower = first.toLowerCase();
    if (first.length < 2 || PARTY_STOP.has(lower)) return null;
    if (lower === "united" && toks.length >= 2 && toks[1][0].toLowerCase() === "states") {
      words.push(first, toks[1][0]);
      lastIdx = 1;
    } else {
      words.push(first);
    }
  }
  if (words.length === 0) return null;

  const lastTok = toks[lastIdx];
  return {
    start: base + (toks[0].index ?? 0),
    end: base + (lastTok.index ?? 0) + lastTok[0].length,
    text: formatPartyWords(words),
    cap,
  };
}

/**
 * "versus" appears in ordinary prose, so it only becomes a case-name
 * connector when the pattern is clearly a case name: bounded by sentence
 * context (start of text / after sentence punctuation), preceded by a
 * citation cue ("in", "see", "case of", …), or with both parties already
 * capitalized in the input. Everything else is left untouched.
 */
function versusContextOk(text: string, partyStart: number): boolean {
  const prefix = text.slice(0, partyStart);
  if (/^\s*$/.test(prefix)) return true;
  if (/[.!?;:\n]\s*$/.test(prefix)) return true;
  if (/\b(?:in|see|cf|re|case\s+of|matter\s+of)\s+$/i.test(prefix)) return true;
  return false;
}

const CONNECTOR_RE = /\b(vee|versus|vs|v)\b\.?/gi;

function formatCaseNames(input: string, jurisdiction: Jurisdiction): string {
  const sep = jurisdiction === "us" ? "v." : "v";
  let out = "";
  let cursor = 0;
  CONNECTOR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CONNECTOR_RE.exec(input)) !== null) {
    if (m.index < cursor) continue;
    const raw = m[1];
    const kind = raw.toLowerCase();
    // A bare capital "V" without a period is far more likely a roman numeral
    // ("Title V funding", "Article V") than a dictated connector — skip.
    if (raw === "V" && !m[0].endsWith(".")) continue;

    const left = scanPartyLeft(input, m.index);
    if (!left) continue;
    const right = scanPartyRight(input, m.index + m[0].length);
    if (!right) continue;
    if (kind === "versus" && !(left.cap && right.cap) && !versusContextOk(input, left.start)) {
      continue;
    }

    out += input.slice(cursor, left.start) + `${left.text} ${sep} ${right.text}`;
    cursor = right.end;
    CONNECTOR_RE.lastIndex = right.end;
  }
  return out + input.slice(cursor);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format dictated citations for the given jurisdiction. Pure, idempotent,
 * and conservative: text that is not clearly a citation is returned
 * verbatim. Intended to run inside the legal-mode smart-format pass, before
 * legal-phrase and currency formatting.
 */
export function formatCitations(text: string, jurisdiction: Jurisdiction): string {
  if (!text) return text;
  let out = text;
  out = formatSpokenSymbols(out);
  out = formatUsReporters(out);
  out = formatPincites(out);
  out = formatStatutes(out, jurisdiction);
  out = formatNeutralCitations(out);
  out = formatCaseNames(out, jurisdiction);
  return out;
}
