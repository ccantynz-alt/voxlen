export type VoxlenContext =
  | "legal_general" | "legal_contract" | "legal_case_note" | "legal_court_filing"
  | "legal_deposition" | "legal_correspondence" | "accounting_general"
  | "accounting_tax" | "accounting_audit" | "accounting_memo"
  | "accounting_correspondence" | "general";

export interface VoxlenConfig {
  /** HS256 Voxlen desktop JWT copied from the voxlen.ai dashboard. */
  voxlenKey?: string;
  /** API base override (default: https://www.voxlen.ai/api). */
  voxlenApiBase?: string;
  context?: VoxlenContext;
  vocabularyHints?: string[];
  grammarApiKey?: string;
  openaiApiKey?: string;
  grammarProvider?: "claude" | "openai";
  deepgramApiKey?: string;
  language?: string;
  writingStyle?: "professional" | "casual" | "academic" | "creative" | "technical";
  autoCorrect?: boolean;
  speakerLabels?: boolean;
  buttonPosition?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  buttonClassName?: string;
  onTranscript?: (event: DictationEvent) => void;
  onGrammarResult?: (result: GrammarResult) => void;
  onError?: (error: Error) => void;
}

export interface DictationEvent { text: string; isFinal: boolean; confidence: number; language?: string; speaker?: string; segmentIndex?: number; }
export interface GrammarResult { original: string; corrected: string; changes: GrammarChange[]; score: number; }
export interface GrammarChange { original: string; corrected: string; reason: string; category: "grammar" | "spelling" | "punctuation" | "style"; }
export interface TranscribeResponse { text: string; confidence: number; words: unknown[]; }
export interface TranslateResponse { translated: string; detected_source: string | null; target_language: string; }
export interface MeResponse { sub: string; email: string; name: string; picture: string; isAdmin: boolean; plan: string; features: string[]; }
export interface DeepgramTokenResponse { key: string; ttl: number; fallback: false; }
export type VocabularyResponse = { ok: true; name?: string; count: number } | { ok: true; stored: "local" };
