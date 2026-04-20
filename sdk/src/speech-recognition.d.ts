/**
 * Ambient declarations for the Web Speech API.
 *
 * TypeScript's lib.dom ships the result / alternative / result-list interfaces
 * but does NOT yet declare the top-level `SpeechRecognition` constructor or
 * its events. We declare just those here — and the webkit-prefixed alias used
 * by older Safari builds — while leaving everything that lib.dom already
 * provides alone to avoid duplicate-declaration errors.
 */

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare const SpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};

declare const webkitSpeechRecognition: {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
};
