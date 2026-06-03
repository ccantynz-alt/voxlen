/**
 * Smart formatting pass for transcribed text.
 *
 * Runs AFTER voice-command extraction and BEFORE grammar correction.
 * Converts common spoken patterns into their written form:
 *   "alice at example dot com"       → "alice@example.com"
 *   "w w w dot example dot com"      → "www.example.com"
 *   "https colon slash slash foo"    → "https://foo"
 *   "hashtag productivity"           → "#productivity"
 *   "at username alice"              → "@alice"
 *   "two one three four five six"    → "213456"  (run of spoken digits)
 *   "heading one introduction"       → "# introduction"
 *
 * All rules are pure string transforms. No external data sources —
 * privacy-safe for lawyer/accountant content. Callers can disable
 * the whole pass via the `smartFormat` setting.
 */

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  oh: "0",
};

/** Collapse runs of three or more spoken digits into a numeric string. */
function collapseDigitRuns(input: string): string {
  const words = input.split(/\s+/);
  const out: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length >= 3) {
      out.push(run.map((t) => DIGIT_WORDS[t.toLowerCase()]).join(""));
    } else {
      out.push(...run);
    }
    run = [];
  };

  for (const word of words) {
    const key = word.replace(/[.,!?;:]+$/g, "").toLowerCase();
    if (key && DIGIT_WORDS[key] !== undefined) {
      run.push(word);
    } else {
      if (run.length) flush();
      out.push(word);
    }
  }
  if (run.length) flush();
  return out.join(" ");
}

/** Email addresses spoken as "X at Y dot Z". */
function formatEmails(input: string): string {
  // word "at" between two word-ish tokens → '@'; propagate "dot" → '.' on both sides.
  const re =
    /([A-Za-z0-9._%+-]+)\s+at\s+([A-Za-z0-9-]+(?:\s+dot\s+[A-Za-z0-9-]+)+)/gi;
  return input.replace(re, (_m, local: string, domain: string) => {
    const dom = domain.replace(/\s+dot\s+/gi, ".");
    return local + "@" + dom;
  });
}

/** URLs spoken as "w w w dot foo dot com" or "https colon slash slash foo dot com". */
function formatUrls(input: string): string {
  // "w w w" / "www" → "www"
  let out = input.replace(/\bw\s+w\s+w\b/gi, "www");

  // "https colon slash slash" → "https://" (swallow trailing whitespace so
  // the next host token sits flush against the scheme).
  out = out.replace(/\b(https?)\s+colon\s+slash\s+slash\s*/gi, (_m, scheme) =>
    scheme.toLowerCase() + "://"
  );

  // "hostname dot tld" runs — hostname-ish tokens separated by "dot"
  out = out.replace(
    /\b([A-Za-z0-9-]+(?:\s+dot\s+[A-Za-z0-9-]+){1,})\b/gi,
    (m) => {
      // Avoid double-joining when we already emitted an email (contains '@').
      if (m.includes("@")) return m;
      return m.replace(/\s+dot\s+/gi, ".");
    }
  );
  return out;
}

/** Hashtags and mentions. */
function formatSocial(input: string): string {
  let out = input.replace(/\bhashtag\s+([A-Za-z0-9_]+)/gi, "#$1");
  out = out.replace(/\bat\s+username\s+([A-Za-z0-9_]+)/gi, "@$1");
  return out;
}

const LATIN_PHRASES: Record<string, string> = {
  "inter alia": "inter alia",
  "res judicata": "res judicata",
  "prima facie": "prima facie",
  "mens rea": "mens rea",
  "actus reus": "actus reus",
  "bona fide": "bona fide",
  "de facto": "de facto",
  "de jure": "de jure",
  "ex parte": "ex parte",
  "habeas corpus": "habeas corpus",
  "in camera": "in camera",
  "in limine": "in limine",
  "locus standi": "locus standi",
  "non est factum": "non est factum",
  "nunc pro tunc": "nunc pro tunc",
  "obiter dicta": "obiter dicta",
  "per curiam": "per curiam",
  "pro bono": "pro bono",
  "pro rata": "pro rata",
  "quantum meruit": "quantum meruit",
  "ratio decidendi": "ratio decidendi",
  "res ipsa loquitur": "res ipsa loquitur",
  "stare decisis": "stare decisis",
  "ultra vires": "ultra vires",
  "versus": "v.",
  "and others": "et al.",
  "and the following": "et seq.",
  "that is": "i.e.",
  "for example": "e.g.",

  // Additional Latin maxims
  "ab initio": "ab initio",
  "ad hoc": "ad hoc",
  "ad idem": "ad idem",
  "audi alteram partem": "audi alteram partem",
  "caveat emptor": "caveat emptor",
  "contra proferentem": "contra proferentem",
  "cum dividend": "cum dividend",
  "ejusdem generis": "ejusdem generis",
  "ex gratia": "ex gratia",
  "ex turpi causa": "ex turpi causa",
  "force majeure": "force majeure",
  "ibid": "ibid.",
  "id est": "i.e.",
  "in personam": "in personam",
  "in rem": "in rem",
  "inter partes": "inter partes",
  "ipso facto": "ipso facto",
  "lex fori": "lex fori",
  "lex loci": "lex loci",
  "mutatis mutandis": "mutatis mutandis",
  "nemo dat quod non habet": "nemo dat quod non habet",
  "nemo judex in sua causa": "nemo judex in sua causa",
  "novus actus interveniens": "novus actus interveniens",
  "obiter": "obiter",
  "pacta sunt servanda": "pacta sunt servanda",
  "pari passu": "pari passu",
  "per incuriam": "per incuriam",
  "per se": "per se",
  "post mortem": "post mortem",
  "prima facie evidence": "prima facie evidence",
  "rebus sic stantibus": "rebus sic stantibus",
  "res gestae": "res gestae",
  "res nullius": "res nullius",
  "respondeat superior": "respondeat superior",
  "sine die": "sine die",
  "sine qua non": "sine qua non",
  "sub judice": "sub judice",
  "sui generis": "sui generis",
  "uberrimae fidei": "uberrimae fidei",
  "volenti non fit injuria": "volenti non fit injuria",

  // Accounting terms
  "ebitda": "EBITDA",
  "ebit": "EBIT",
  "gaap": "GAAP",
  "ifrs": "IFRS",
  "frs one oh two": "FRS 102",
  "frs 102": "FRS 102",
  "hmrc": "HMRC",
  "paye": "PAYE",
  "vat": "VAT",
  "p and l": "P&L",
  "profit and loss": "P&L",
  "balance sheet": "balance sheet",
  "net present value": "NPV",
  "internal rate of return": "IRR",
  "return on investment": "ROI",
  "earnings per share": "EPS",
  "price to earnings": "P/E",
};

function formatLegalPhrases(input: string): string {
  let out = input;
  // Protect known Latin and legal abbreviations from further transforms
  for (const [spoken, written] of Object.entries(LATIN_PHRASES)) {
    const re = new RegExp(`\\b${spoken}\\b`, "gi");
    out = out.replace(re, written);
  }
  return out;
}

const CURRENCY_SPOKEN: Record<string, string> = {
  "pounds sterling": "GBP",
  "australian dollars": "AUD",
  "us dollars": "USD",
  "euro": "EUR",
  "euros": "EUR",
  "new zealand dollars": "NZD",
  "canadian dollars": "CAD",
};
// Keep reference to satisfy lint
void CURRENCY_SPOKEN;

function formatLegalCurrency(input: string): string {
  let out = input;
  // "fifty thousand pounds sterling" → "£50,000"
  // Simple spoken amount patterns
  const amountRe = /\b(\w[\w\s]*?)\s+(pounds sterling|australian dollars|us dollars|euros?|new zealand dollars|canadian dollars)\b/gi;
  out = out.replace(amountRe, (_, amount, currency) => {
    const symbol = ({ "pounds sterling": "£", "australian dollars": "A$", "us dollars": "$", "euro": "€", "euros": "€", "new zealand dollars": "NZ$", "canadian dollars": "C$" } as Record<string, string>)[currency.toLowerCase()] ?? currency;
    return symbol + amount.trim();
  });
  return out;
}

/** Markdown-ish dictation commands. Triggered only at the start of a segment. */
function formatMarkdown(input: string): string {
  const trimmed = input.trimStart();
  const leading = input.slice(0, input.length - trimmed.length);

  const pairs: Array<[RegExp, string]> = [
    [/^heading\s+one[:\-]?\s+/i, "# "],
    [/^heading\s+two[:\-]?\s+/i, "## "],
    [/^heading\s+three[:\-]?\s+/i, "### "],
    [/^heading\s+four[:\-]?\s+/i, "#### "],
    [/^bullet\s+point\s+/i, "- "],
    [/^bullet\s+/i, "- "],
    [/^numbered\s+item\s+/i, "1. "],
    [/^block\s*quote\s+/i, "> "],
  ];

  for (const [re, rep] of pairs) {
    if (re.test(trimmed)) {
      return leading + trimmed.replace(re, rep);
    }
  }

  // Inline wrappers anywhere in the string.
  let out = input;
  out = out.replace(
    /\bbold\s+(.+?)\s+end\s+bold\b/gi,
    (_m, inner: string) => "**" + inner.trim() + "**"
  );
  out = out.replace(
    /\bitalic\s+(.+?)\s+end\s+italic\b/gi,
    (_m, inner: string) => "*" + inner.trim() + "*"
  );
  out = out.replace(
    /\bcode\s+(.+?)\s+end\s+code\b/gi,
    (_m, inner: string) => "`" + inner.trim() + "`"
  );
  return out;
}

export interface SmartFormatOptions {
  emails?: boolean;
  urls?: boolean;
  social?: boolean;
  markdown?: boolean;
  digitRuns?: boolean;
  legalPhrases?: boolean; // opt-in — only when legal mode active
  legalCurrency?: boolean;
}

const defaultOptions: Required<SmartFormatOptions> = {
  emails: true,
  urls: true,
  social: true,
  markdown: true,
  digitRuns: true,
  legalPhrases: false,
  legalCurrency: false,
};

export function applySmartFormat(
  input: string,
  opts: SmartFormatOptions = {}
): string {
  const o = { ...defaultOptions, ...opts };
  if (!input) return input;
  let out = input;
  if (o.markdown) out = formatMarkdown(out);
  if (o.digitRuns) out = collapseDigitRuns(out);
  if (o.emails) out = formatEmails(out);
  if (o.urls) out = formatUrls(out);
  if (o.social) out = formatSocial(out);
  if (o.legalPhrases) out = formatLegalPhrases(out);
  if (o.legalCurrency) out = formatLegalCurrency(out);
  return out;
}
