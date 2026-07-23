/** Voxlen Web SDK — voice dictation and grammar correction for web apps. */
export { VoxlenSDK } from "./voxlen";
export { VoxlenDictation } from "./dictation";
export { VoxlenGrammar } from "./grammar";
export { VoxlenApiClient } from "./api-client";
export type { AudioInput } from "./api-client";
export type {
  VoxlenConfig, DictationEvent, GrammarResult, GrammarChange, VoxlenContext,
  TranscribeResponse, TranslateResponse, MeResponse, DeepgramTokenResponse,
  VocabularyResponse,
} from "./types";
