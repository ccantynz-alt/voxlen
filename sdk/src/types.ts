export interface VoxlenConfig {
  /** Anthropic API key for AI grammar correction (Claude Haiku) */
  grammarApiKey?: string;
  /** OpenAI API key — used if grammarProvider is 'openai' */
  openaiApiKey?: string;
  /** Which AI provider to use for grammar: 'claude' (default) or 'openai' */
  grammarProvider?: "claude" | "openai";
  /** Deepgram API key — enables premium STT accuracy. Without it, falls back to Web Speech API. */
  deepgramApiKey?: string;
  /** BCP-47 language code (default: 'en-US') */
  language?: string;
  /** Writing style for grammar correction */
  writingStyle?: "professional" | "casual" | "academic" | "creative" | "technical";
  /** Auto-correct grammar after each utterance */
  autoCorrect?: boolean;
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
