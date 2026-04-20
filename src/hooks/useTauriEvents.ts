import { useEffect } from "react";
import { useAudioStore } from "@/stores/audio";
import { useDictationStore, buildSessionRecord } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { processVoiceCommands, executeVoiceCommand, applyTextCommand } from "@/lib/voiceCommands";
import { applySmartFormat } from "@/lib/smartFormat";

interface TranscriptionEvent {
  text: string;
  is_final: boolean;
  confidence: number;
  language?: string;
}

interface StreamingPartialEvent {
  text: string;
  is_final: boolean;
  confidence: number;
}

/**
 * Subscribes to all backend event streams (audio level, waveform, transcription,
 * speech lifecycle) and routes them into the Zustand stores. Also handles
 * voice-command parsing and autosaving sessions to backend.
 *
 * Gracefully no-ops when run outside a Tauri environment (browser dev).
 */
export function useTauriEvents(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function setup() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (cancelled) return;

        const unlistenLevel = await listen<number>("audio-level", (event) => {
          useAudioStore.getState().setInputLevel(event.payload);
          useDictationStore.getState().setInputLevel(event.payload);
        });

        // Backend emits an array of 64 samples; fall back to pushing a
        // single sample if the payload is numeric.
        const unlistenWaveform = await listen<number[] | number>(
          "waveform-samples",
          (event) => {
            const payload = event.payload;
            if (Array.isArray(payload)) {
              useAudioStore.getState().setWaveformData(payload);
            } else if (typeof payload === "number") {
              useAudioStore.getState().pushWaveformSample(payload);
            }
          }
        );

        const unlistenTranscription = await listen<TranscriptionEvent>(
          "transcription",
          (event) => {
            const result = event.payload;
            if (!result.is_final) return;
            const text = result.text.trim();
            if (!text) return;

            const dictation = useDictationStore.getState();
            const settings = useSettingsStore.getState();

            // Voice commands: only consume when enabled.
            if (settings.voiceCommandsEnabled) {
              const parsed = processVoiceCommands(text);
              if (parsed.matched && parsed.action) {
                // If the command had accompanying speech (e.g. "hello period"),
                // add the remainder as a segment first.
                if (parsed.remainingText) {
                  dictation.addSegment({
                    id: crypto.randomUUID(),
                    text: parsed.remainingText,
                    timestamp: new Date(),
                    confidence: result.confidence,
                    language: result.language,
                    isFinal: true,
                    grammarApplied: false,
                  });
                }

                const output = executeVoiceCommand(parsed.action);
                // For caps on/off, toggle local state.
                if (parsed.action === "caps_on") {
                  dictation.setCapsLock(true);
                } else if (parsed.action === "caps_off") {
                  dictation.setCapsLock(false);
                }

                // If the command produced output (punctuation/newline), append it to the
                // last segment so it flows naturally with the transcript.
                if (output !== null) {
                  const segs = useDictationStore.getState().segments;
                  if (segs.length > 0) {
                    const last = segs[segs.length - 1];
                    const base = last.correctedText ?? last.text;
                    const next = applyTextCommand(base, output);
                    const updates =
                      last.correctedText !== undefined
                        ? { correctedText: next }
                        : { text: next };
                    useDictationStore.getState().updateSegment(last.id, updates);
                  } else {
                    dictation.addSegment({
                      id: crypto.randomUUID(),
                      text: output,
                      timestamp: new Date(),
                      confidence: result.confidence,
                      language: result.language,
                      isFinal: true,
                      grammarApplied: false,
                    });
                  }
                }

                dictation.setCurrentTranscript("");
                return;
              }
            }

            // Regular transcription: apply smart formatting (if enabled)
            // and honour capsLock.
            const shaped = settings.smartFormat ? applySmartFormat(text) : text;
            const capsLock = useDictationStore.getState().capsLock;
            const finalText = capsLock ? shaped.toUpperCase() : shaped;

            dictation.addSegment({
              id: crypto.randomUUID(),
              text: finalText,
              timestamp: new Date(),
              confidence: result.confidence,
              language: result.language,
              isFinal: true,
              grammarApplied: false,
            });
            dictation.setCurrentTranscript("");
          }
        );

        const unlistenPartial = await listen<StreamingPartialEvent>(
          "streaming-partial",
          (event) => {
            if (!event.payload.is_final && event.payload.text) {
              useDictationStore.getState().setCurrentTranscript(event.payload.text);
            }
          }
        );

        const unlistenSpeechStarted = await listen("speech-started", () => {
          useDictationStore.getState().setStatus("listening");
        });

        const unlistenUtteranceEnd = await listen("utterance-end", () => {
          useDictationStore.getState().setCurrentTranscript("");
        });

        unlisten = () => {
          unlistenLevel();
          unlistenWaveform();
          unlistenTranscription();
          unlistenPartial();
          unlistenSpeechStarted();
          unlistenUtteranceEnd();
        };
      } catch {
        // Not running in Tauri.
      }
    }

    setup();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Autosave: when status transitions away from an active state back to idle
  // (and there are segments), persist a SessionRecord to the backend.
  useEffect(() => {
    let lastStatus = useDictationStore.getState().status;
    const unsub = useDictationStore.subscribe((state) => {
      const current = state.status;
      const wasActive = lastStatus === "listening" || lastStatus === "processing";
      const isIdle = current === "idle";
      if (wasActive && isIdle) {
        const saveTranscripts = useSettingsStore.getState().saveTranscripts;
        if (saveTranscripts) {
          const record = buildSessionRecord();
          if (record) {
            // Fire and forget; graceful fallback for non-Tauri.
            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("save_session", { session: record });
              } catch {
                // Non-Tauri environment — skip.
              }
            })();
          }
        }
      }
      lastStatus = current;
    });
    return unsub;
  }, []);
}
