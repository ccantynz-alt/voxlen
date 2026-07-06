/**
 * Voxlen Web SDK
 *
 * Embeddable voice dictation + AI grammar correction for web applications.
 * Designed for integration with AlecRae.com Email Client and any web app.
 *
 * Recommended usage — Voxlen platform key (provider keys never touch the browser):
 *
 *   import { VoxlenSDK } from '@voxlen/sdk';
 *   const voxlen = new VoxlenSDK({ voxlenApiKey: 'vx_...' });
 *   voxlen.attachTo(document.querySelector('textarea'));
 *
 * Note: Voxlen-API mode talks to the api.voxlen.com backend, which is
 * currently in development. Until it ships, requests in this mode will fail.
 *
 * Trusted-environment ONLY — direct provider keys:
 *
 *   // Internal tools / local prototypes only. Any provider key passed here
 *   // (grammarApiKey, openaiApiKey, deepgramApiKey) is shipped to the browser
 *   // and is readable by every visitor to the page. Never use on a public site.
 *   const voxlen = new VoxlenSDK({ deepgramApiKey: '...', grammarApiKey: 'sk-ant-...' });
 *
 * With no keys at all, dictation falls back to the free browser Web Speech API.
 * See README.md for the full API surface and security guidance.
 */

export { VoxlenSDK } from "./voxlen";
export { VoxlenDictation } from "./dictation";
export { VoxlenGrammar } from "./grammar";
export { VoxlenApiClient } from "./api-client";
export type { VoxlenConfig, DictationEvent, GrammarResult } from "./types";
export type { VoxlenContext, TranscribeResponse, AsyncTranscribeResponse, VocabularyList } from "./types";
