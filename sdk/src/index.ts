/**
 * Voxlen Web SDK
 *
 * Embeddable voice dictation + AI grammar correction for web applications.
 * Designed for integration with AlecRae.com Email Client and any web app.
 *
 * Usage:
 *   import { VoxlenSDK } from '@voxlen/sdk';
 *   const voxlen = new VoxlenSDK({ grammarApiKey: 'sk-ant-...' });
 *   voxlen.attachTo(document.querySelector('textarea'));
 */

export { VoxlenSDK } from "./voxlen";
export { VoxlenDictation } from "./dictation";
export { VoxlenGrammar } from "./grammar";
export type { VoxlenConfig, DictationEvent, GrammarResult } from "./types";
