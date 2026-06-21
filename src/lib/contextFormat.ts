/**
 * Context-aware transcript formatting for the 11 Voxlen API context types.
 * Each context applies different structural rules to raw transcript text.
 * Runs after smartFormat and before grammar correction.
 */

export type VoxlenContext =
  | "legal_general"
  | "legal_contract"
  | "legal_case_note"
  | "legal_court_filing"
  | "legal_deposition"
  | "legal_correspondence"
  | "accounting_general"
  | "accounting_tax"
  | "accounting_audit"
  | "accounting_memo"
  | "accounting_correspondence"
  | "general";

export interface ContextFormatOptions {
  context: VoxlenContext;
  speakerLabel?: string;
}

// ── Legal contract: capitalise defined terms in quotes, preserve clause numbering ──
function formatLegalContract(text: string): string {
  // "the company" → "the Company" when preceded by means/means
  let out = text.replace(/\b(means|meaning|referred to as)\s+"([^"]+)"/gi,
    (_m, verb, term) => `${verb} "${toTitleCase(term)}"`);
  // Clause numbering patterns: "clause one point two" → "Clause 1.2"
  out = out.replace(/\bclause\s+(\w+)\s+point\s+(\w+)\b/gi,
    (_, a, b) => `Clause ${wordToNum(a)}.${wordToNum(b)}`);
  out = out.replace(/\bsection\s+(\w+)\s+point\s+(\w+)\b/gi,
    (_, a, b) => `Section ${wordToNum(a)}.${wordToNum(b)}`);
  out = out.replace(/\bschedule\s+(\w+)\b/gi,
    (_, n) => `Schedule ${wordToNum(n)}`);
  return out;
}

// ── Legal case note: prepend date/time heading, attendance note structure ──
function formatLegalCaseNote(text: string): string {
  let out = text;
  // "attendance note" / "file note" / "telephone note" spoken at start → formal heading
  out = out.replace(/^attendance note[:\s]*/i, "ATTENDANCE NOTE\n\n");
  out = out.replace(/^file note[:\s]*/i, "FILE NOTE\n\n");
  out = out.replace(/^telephone note[:\s]*/i, "TELEPHONE NOTE\n\n");
  out = out.replace(/^telephone attendance[:\s]*/i, "TELEPHONE ATTENDANCE\n\n");
  out = out.replace(/^meeting note[:\s]*/i, "MEETING NOTE\n\n");
  out = out.replace(/^conference note[:\s]*/i, "CONFERENCE NOTE\n\n");
  // "matter number X" / "ref X" → Matter No: X
  out = out.replace(/\bmatter (number|no|ref)[:\s]+(\S+)/gi, "Matter No: $2");
  out = out.replace(/\bclient ref[:\s]+(\S+)/gi, "Client Ref: $1");
  // "action point" → ACTION POINT:
  out = out.replace(/\baction point[s]?[:\s]*/gi, "ACTION POINT: ");
  return out;
}

// ── Legal court filing: ALL CAPS headings, formal citation formatting ──
function formatLegalCourtFiling(text: string): string {
  let out = text;
  // "in the" + court name → uppercase
  out = out.replace(
    /\bin the\s+(high court|supreme court|court of appeal|court of session|sheriff court|district court|family court|magistrates court|county court|employment tribunal|upper tribunal|first-tier tribunal|crown court|privy council)[,\s]/gi,
    (_m, court) => `IN THE ${court.toUpperCase()},`
  );
  // Case citation spoken: "Smith versus Jones" → "Smith v Jones"
  out = out.replace(/\b(\w+)\s+versus\s+(\w+)\b/gi, "$1 v $2");
  // "plaintiff" / "defendant" always capitalised in headings context
  out = out.replace(/\b(plaintiff|defendant|appellant|respondent|applicant)\b/gi,
    (w) => toTitleCase(w));
  return out;
}

// ── Legal deposition: Q&A formatting with speaker labels ──
function formatLegalDeposition(text: string, speakerLabel?: string): string {
  if (!speakerLabel) return text;
  const role = speakerLabel.toLowerCase().includes("examiner") ||
    speakerLabel.toLowerCase().includes("counsel") ||
    speakerLabel.toLowerCase().includes("lawyer") ? "Q" : "A";
  return `${role}. ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

// ── Accounting tax: numbers, percentages, IRD/ATO/HMRC refs ──
function formatAccountingTax(text: string): string {
  let out = text;
  // Tax rates: "thirty percent" → "30%"
  out = out.replace(/\b([\w\s]+)\s+percent\b/gi, (match, amount) => {
    const n = wordsToNumber(amount.trim());
    return n !== null ? `${n}%` : match;
  });
  // Tax year: "tax year 2024 25" → "tax year 2024/25" (STT engines output digits)
  out = out.replace(/\btax year\s+(\d{4})[\s\/\\-]+(\d{2,4})\b/gi,
    (_, y1, y2) => `tax year ${y1}/${y2.slice(-2)}`);
  // IRD/ATO/HMRC reference numbers
  out = out.replace(/\b(ird|ato|hmrc)\s+number\s+([\d\s]+)/gi,
    (_, org, num) => `${org.toUpperCase()} ${num.replace(/\s/g, "")}`);
  // GST/VAT
  out = out.replace(/\bgst\b/gi, "GST");
  out = out.replace(/\bvat\b/gi, "VAT");
  out = out.replace(/\bpaye\b/gi, "PAYE");
  out = out.replace(/\babn\b/gi, "ABN");
  out = out.replace(/\btfn\b/gi, "TFN");
  out = out.replace(/\bnzbn\b/gi, "NZBN");
  return out;
}

// ── Accounting audit: numbered findings, formal structure ──
function formatAccountingAudit(text: string): string {
  let out = text;
  // "finding one" / "finding number one" → "Finding 1:"
  out = out.replace(/\bfinding(?:\s+number)?\s+(\w+)\b/gi,
    (_, n) => `Finding ${wordToNum(n)}:`);
  // "recommendation one" → "Recommendation 1:"
  out = out.replace(/\brecommendation(?:\s+number)?\s+(\w+)\b/gi,
    (_, n) => `Recommendation ${wordToNum(n)}:`);
  // Material weaknesses / significant deficiencies
  out = out.replace(/\bmaterial weakness\b/gi, "Material Weakness");
  out = out.replace(/\bsignificant deficiency\b/gi, "Significant Deficiency");
  return out;
}

// ── Accounting memo: formal memo structure ──
function formatAccountingMemo(text: string): string {
  let out = text;
  // Memo headers spoken
  out = out.replace(/^memorandum[:\s]*/i, "MEMORANDUM\n\n");
  out = out.replace(/^(to|from|re|subject|date)[:\s]+/gim,
    (_m) => _m.toUpperCase());
  return out;
}

// ── Legal/accounting correspondence ──
function formatCorrespondence(text: string): string {
  let out = text;
  // "dear mr/ms/mrs" → preserve case properly
  out = out.replace(/\bdear\s+(mr|ms|mrs|dr|prof)[\s\.]+(\w+)/gi,
    (_, title, name) => `Dear ${toTitleCase(title)}. ${toTitleCase(name)}`);
  // "yours sincerely / yours faithfully" → preserve as closing
  out = out.replace(/\byours sincerely\b/gi, "Yours sincerely,");
  out = out.replace(/\byours faithfully\b/gi, "Yours faithfully,");
  out = out.replace(/\bkind regards\b/gi, "Kind regards,");
  return out;
}

// ── Apply context formatting ──
export function applyContextFormat(text: string, opts: ContextFormatOptions): string {
  const { context, speakerLabel } = opts;
  let out = text;

  switch (context) {
    case "legal_contract":
      out = formatLegalContract(out);
      break;
    case "legal_case_note":
      out = formatLegalCaseNote(out);
      break;
    case "legal_court_filing":
      out = formatLegalCourtFiling(out);
      break;
    case "legal_deposition":
      out = formatLegalDeposition(out, speakerLabel);
      break;
    case "legal_correspondence":
    case "accounting_correspondence":
      out = formatCorrespondence(out);
      break;
    case "accounting_tax":
      out = formatAccountingTax(out);
      break;
    case "accounting_audit":
      out = formatAccountingAudit(out);
      break;
    case "accounting_memo":
      out = formatAccountingMemo(out);
      break;
    case "legal_general":
    case "accounting_general":
    case "general":
    default:
      break;
  }

  return out;
}

export function getContextLabel(context: VoxlenContext): string {
  const labels: Record<VoxlenContext, string> = {
    legal_general: "Legal — General",
    legal_contract: "Legal — Contract",
    legal_case_note: "Legal — Case Note",
    legal_court_filing: "Legal — Court Filing",
    legal_deposition: "Legal — Deposition",
    legal_correspondence: "Legal — Correspondence",
    accounting_general: "Accounting — General",
    accounting_tax: "Accounting — Tax",
    accounting_audit: "Accounting — Audit",
    accounting_memo: "Accounting — Memo",
    accounting_correspondence: "Accounting — Correspondence",
    general: "General",
  };
  return labels[context];
}

export function isLegalContext(context: VoxlenContext): boolean {
  return context.startsWith("legal_");
}

export function isAccountingContext(context: VoxlenContext): boolean {
  return context.startsWith("accounting_");
}

// ── Helpers ──

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function wordToNum(word: string): string {
  const n = NUM_WORDS[word.toLowerCase()];
  return n !== undefined ? String(n) : word;
}

function wordsToNumber(text: string): number | null {
  const lower = text.toLowerCase().trim();
  if (/^\d+$/.test(lower)) return parseInt(lower, 10);
  const direct = NUM_WORDS[lower];
  if (direct !== undefined) return direct;
  return null;
}
