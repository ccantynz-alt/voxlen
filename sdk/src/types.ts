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

export interface VoxlenConfig {
  /** Voxlen platform API key — routes through api.voxlen.com (preferred) */
  voxlenApiKey?: string;
  /** Voxlen API base URL override (default: https://api.voxlen.com/v1) */
  voxlenApiBase?: string;
  /** Tenant ID for usage reporting (e.g. your firm or organisation ID) */
  tenantId?: string;
  /** Context tells Voxlen how to format the transcript */
  context?: VoxlenContext;
  /** Vocabulary hints: case names, client names, unusual terms */
  vocabularyHints?: string[];

  /** Anthropic API key for direct grammar correction (Claude Sonnet) */
  grammarApiKey?: string;
  /** OpenAI API key — used if grammarProvider is 'openai' */
  openaiApiKey?: string;
  /** Which AI provider to use for grammar: 'claude' (default) or 'openai' */
  grammarProvider?: "claude" | "openai";
  /** Deepgram API key — direct streaming fallback when no voxlenApiKey */
  deepgramApiKey?: string;
  /** BCP-47 language code (default: 'en-US') */
  language?: string;
  /** Writing style for grammar correction */
  writingStyle?: "professional" | "casual" | "academic" | "creative" | "technical";
  /** Auto-correct grammar after each utterance */
  autoCorrect?: boolean;
  /** Enable speaker diarisation (deposition mode) */
  speakerLabels?: boolean;
  /** Position of the floating mic button relative to the target element */
  buttonPosition?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  /** Custom CSS class for the mic button */
  buttonClassName?: string;
  /** Callback when transcription text is received */
  onTranscript?: (event: DictationEvent) => void;
  /** Callback when grammar correction completes */
  onGrammarResult?: (result: GrammarResult) => void;
  /** Callback on errors */
  onError?: (error: Error) => void;
}

export interface DictationEvent {
  text: string;
  isFinal: boolean;
  confidence: number;
  language?: string;
  speaker?: string;
  segmentIndex?: number;
}

export interface GrammarResult {
  original: string;
  corrected: string;
  changes: GrammarChange[];
  score: number;
}

export interface GrammarChange {
  original: string;
  corrected: string;
  reason: string;
  category: "grammar" | "spelling" | "punctuation" | "style";
}

export interface VocabularyList {
  id: string;
  name: string;
  terms: string[];
  context?: string;
  created_at: string;
  updated_at: string;
}

export interface TranscribeResponse {
  id: string;
  status: "completed" | "processing" | "failed";
  transcript: string;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: string;
  }>;
  context: string;
  language: string;
  duration_seconds: number;
  word_count: number;
  created_at: string;
  usage: {
    audio_seconds: number;
    billable_units: number;
  };
}

export interface AsyncTranscribeResponse {
  id: string;
  status: "processing";
  estimated_seconds: number;
}
