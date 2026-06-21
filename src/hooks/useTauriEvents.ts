import { useEffect } from "react";
import { useAudioStore } from "@/stores/audio";
import { useDictationStore, buildSessionRecord } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { toast } from "@/components/ui/Toast";
import { processVoiceCommands, executeVoiceCommand, applyTextCommand } from "@/lib/voiceCommands";
import { useFlywheelStore } from "@/stores/flywheel";
import { useHistoryStore } from "@/stores/history";
import { useClientsStore, buildMatterContext } from "@/stores/clients";
import { applySmartFormat } from "@/lib/smartFormat";
import { applyContextFormat } from "@/lib/contextFormat";
import type { VoxlenContext } from "@/lib/contextFormat";
import { useClauseStore } from "@/stores/clauses";

interface TranscriptionEvent {
  text: string;
  is_final: boolean;
  confidence: number;
  language?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word: string;
    speaker?: number;
  }>;
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
            const autoInject = settings.injectionMode !== "buffer";
            const injectQueue: string[] = [];

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
                    words: result.words?.map(w => ({
                      word: w.word,
                      start: w.start,
                      end: w.end,
                      confidence: w.confidence,
                      punctuatedWord: w.punctuated_word,
                      speaker: w.speaker,
                    })),
                    speakerLabel: (() => {
                      const sw = result.words?.find(w => w.speaker !== undefined);
                      return sw !== undefined ? `Speaker ${sw.speaker! + 1}` : undefined;
                    })(),
                  });
                  if (autoInject) injectQueue.push(parsed.remainingText + " ");
                }

                const output = executeVoiceCommand(parsed.action);

                // Billable time voice commands
                if (typeof output === "string" && output.startsWith("__LOG_TIME")) {
                  const minuteMap: Record<string, number> = {
                    "__LOG_TIME_6__": 6,
                    "__LOG_TIME_15__": 15,
                    "__LOG_TIME_30__": 30,
                    "__LOG_TIME_45__": 45,
                    "__LOG_TIME_60__": 60,
                    "__LOG_TIME_120__": 120,
                    "__LOG_TIME__": 30, // default
                  };
                  const minutes = minuteMap[output] ?? 30;
                  const { logTime } = useFlywheelStore.getState();
                  const { billableRatePerHour } = useSettingsStore.getState() as { billableRatePerHour?: number };
                  const note = parsed.remainingText || "";
                  logTime(minutes, "", note, billableRatePerHour ?? 0);
                  // Also log to active client so it appears in billing dashboard
                  const { activeClientId: vcClientId, clients: vcClients, addEntry: vcAddEntry } = useClientsStore.getState();
                  if (vcClientId) {
                    const vcClient = vcClients.find((c) => c.id === vcClientId);
                    if (vcClient) {
                      const rate = vcClient.billableRate > 0 ? vcClient.billableRate : (billableRatePerHour ?? 0);
                      vcAddEntry({
                        clientId: vcClientId,
                        date: Date.now(),
                        durationSeconds: minutes * 60,
                        wordCount: 0,
                        billableAmount: (minutes / 60) * rate,
                        rateAtTime: rate,
                        note,
                      });
                    }
                  }
                  dictation.setCurrentTranscript("");
                  return;
                }

                // Review uncertain words — count and toast
                if (parsed.action === "review_uncertain") {
                  const segs = useDictationStore.getState().segments;
                  const count = segs.flatMap((s) => (s.words ?? []).filter((w) => w.confidence < 0.75)).length;
                  toast(
                    count > 0
                      ? `${count} uncertain word${count !== 1 ? "s" : ""} highlighted in transcript`
                      : "No uncertain words in transcript",
                    "info",
                    count > 0 ? 4000 : 3000
                  );
                  dictation.setCurrentTranscript("");
                  return;
                }

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
                  if (autoInject && !output.startsWith("__LOG_TIME")) {
                    injectQueue.push(output);
                  }
                }

                if (autoInject && injectQueue.length > 0) {
                  const textToInject = injectQueue.join("");
                  (async () => {
                    try {
                      const { invoke } = await import("@tauri-apps/api/core");
                      await invoke("inject_text", { text: textToInject });
                    } catch {
                      // Non-Tauri or injection unavailable.
                    }
                  })();
                }

                dictation.setCurrentTranscript("");
                return;
              }
            }

            // Regular transcription: apply smart formatting (if enabled)
            // and honour capsLock.
            const shaped = settings.smartFormat
              ? applySmartFormat(text, {
                  legalPhrases: settings.legalMode,
                  legalCurrency: settings.legalMode,
                })
              : text;
            const capsLock = useDictationStore.getState().capsLock;
            // Context-aware formatting
            const speakerLabelForContext = (() => {
              const sw = result.words?.find((w) => w.speaker !== undefined);
              return sw !== undefined ? `Speaker ${sw.speaker! + 1}` : undefined;
            })();
            const withContext = settings.voxlenContext && settings.voxlenContext !== "general"
              ? applyContextFormat(shaped, {
                  context: settings.voxlenContext as VoxlenContext,
                  speakerLabel: speakerLabelForContext,
                })
              : shaped;
            const finalText = capsLock ? withContext.toUpperCase() : withContext;

            // Clause library voice triggers
            const { findByTrigger, findTemplateByTrigger, markUsed } = useClauseStore.getState();
            const matchedClause = findByTrigger(finalText);
            const matchedTemplate = findTemplateByTrigger(finalText);
            if (matchedClause) {
              markUsed(matchedClause.id);
              dictation.addSegment({
                id: crypto.randomUUID(),
                text: matchedClause.text,
                timestamp: new Date(),
                confidence: 1.0,
                language: result.language,
                isFinal: true,
                grammarApplied: false,
              });
              dictation.setCurrentTranscript("");
              if (autoInject) {
                const clauseText = matchedClause.text;
                (async () => {
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("inject_text", { text: clauseText });
                  } catch { /* Non-Tauri. */ }
                })();
              }
              return;
            }
            if (matchedTemplate) {
              const templateText = matchedTemplate.sections.map((s: string) => `${s.toUpperCase()}\n\n`).join("\n");
              dictation.addSegment({
                id: crypto.randomUUID(),
                text: templateText,
                timestamp: new Date(),
                confidence: 1.0,
                language: result.language,
                isFinal: true,
                grammarApplied: false,
              });
              dictation.setCurrentTranscript("");
              if (autoInject) {
                (async () => {
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("inject_text", { text: templateText });
                  } catch { /* Non-Tauri. */ }
                })();
              }
              return;
            }

            const segmentId = crypto.randomUUID();
            dictation.addSegment({
              id: segmentId,
              text: finalText,
              timestamp: new Date(),
              confidence: result.confidence,
              language: result.language,
              isFinal: true,
              grammarApplied: false,
              words: result.words?.map(w => ({
                word: w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
                punctuatedWord: w.punctuated_word,
                speaker: w.speaker,
              })),
              speakerLabel: result.words?.find(w => w.speaker !== undefined)
                ? `Speaker ${(result.words!.find(w => w.speaker !== undefined)!.speaker! + 1)}`
                : undefined,
            });
            dictation.setCurrentTranscript("");

            // Post-processing pipeline (runs async so it doesn't block the UI):
            // 1. Grammar correction (if enabled)
            // 2. Translation (if enabled, runs on grammar-corrected text)
            // 3. Auto-inject into the currently focused app (unless injectionMode is "buffer")
            const grammarEnabled = settings.grammarEnabled;
            const translationEnabled =
              settings.translationEnabled &&
              settings.translationTargetLanguage &&
              settings.translationTargetLanguage !== (result.language ?? "");

            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                let processedText = finalText;

                // Step 1: grammar correction
                if (grammarEnabled) {
                  try {
                    const flyVocab = useFlywheelStore.getState().vocabulary
                      .filter((v) => v.frequency >= 2)
                      .map((v) => v.word);
                    const { activeClientId: acid, clients: acls } = useClientsStore.getState();
                    const activeClientForAuto = acls.find((c) => c.id === acid);
                    const clientVocabAuto = activeClientForAuto?.vocabulary ?? [];
                    const mergedVocab = Array.from(new Set([...flyVocab, ...clientVocabAuto, ...settings.customVocabulary]));
                    const matterContextAuto = buildMatterContext(activeClientForAuto) || undefined;
                    const grammarResult = await invoke<{ corrected: string; changes: Array<{ original: string; corrected: string; reason: string; category: string }>; score: number }>(
                      "correct_grammar",
                      {
                        text: finalText,
                        customVocabulary: mergedVocab.length > 0 ? mergedVocab : undefined,
                        matterContext: matterContextAuto,
                      }
                    );
                    if (grammarResult?.corrected) {
                      processedText = grammarResult.corrected;
                      useDictationStore.getState().updateSegment(segmentId, {
                        correctedText: grammarResult.corrected,
                        grammarApplied: true,
                      });
                      // Feed corrections back into flywheel
                      if (grammarResult.changes?.length) {
                        const fw = useFlywheelStore.getState();
                        for (const c of grammarResult.changes) {
                          if (c.original && c.corrected && c.original !== c.corrected) {
                            fw.recordCorrection(
                              c.original,
                              c.corrected,
                              (c.category as "grammar" | "spelling" | "punctuation" | "style") ?? "grammar"
                            );
                          }
                        }
                        fw.recordCorrectionFeedback(true);
                      }
                    }
                  } catch {
                    // Grammar unavailable (no API key etc.) — continue with raw text.
                  }
                }

                // Step 2: translation (on grammar-corrected or raw text)
                if (translationEnabled) {
                  try {
                    const translation = await invoke<{ translated: string }>(
                      "translate_text",
                      {
                        text: processedText,
                        targetLanguage: settings.translationTargetLanguage,
                      }
                    );
                    if (translation?.translated) {
                      processedText = translation.translated;
                      useDictationStore.getState().updateSegment(segmentId, {
                        translatedText: translation.translated,
                        translatedToLanguage: settings.translationTargetLanguage,
                      });
                    }
                  } catch {
                    // Translation failure — leave segment as-is.
                  }
                }

                // Step 3: inject into the focused app
                if (autoInject) {
                  try {
                    await invoke("inject_text", { text: processedText });
                  } catch {
                    // Injection failure (e.g. Accessibility permissions not granted on macOS).
                    // Text is still visible in the Voxlen panel for manual copy.
                  }
                }
              } catch {
                // Non-Tauri environment — skip.
              }
            })();
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

        const unlistenTranscriptionError = await listen<string>("transcription-error", (event) => {
          const msg = event.payload;
          useDictationStore.getState().setStatus("error");
          useDictationStore.getState().setError(msg);
          toast(msg.length > 80 ? msg.slice(0, 80) + "…" : msg, "error", 6000);
        });

        const unlistenReconnecting = await listen<number>("streaming-reconnecting", (event) => {
          toast(`Reconnecting to transcription service… (attempt ${event.payload})`, "info", 3000);
        });

        unlisten = () => {
          unlistenLevel();
          unlistenWaveform();
          unlistenTranscription();
          unlistenPartial();
          unlistenSpeechStarted();
          unlistenUtteranceEnd();
          unlistenTranscriptionError();
          unlistenReconnecting();
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
        const dictState = useDictationStore.getState();
        const settings = useSettingsStore.getState();
        const segments = dictState.segments;

        // Save to in-memory history store (always, so UI reflects it immediately)
        if (segments.length > 0) {
          const fullText = segments.map((s) => s.correctedText || s.text).join(" ");
          const wc = fullText.split(/\s+/).filter(Boolean).length;
          const hasGrammar = segments.some((s) => s.grammarApplied);
          const alreadyInHistory = useHistoryStore.getState().entries.some(
            (e) => e.text === fullText
          );
          if (!alreadyInHistory) {
            useHistoryStore.getState().addEntry({
              id: crypto.randomUUID(),
              text: fullText,
              duration: dictState.sessionDuration * 1000,
              wordCount: wc,
              language: segments[0].language || "en",
              timestamp: new Date().toISOString(),
              grammarCorrected: hasGrammar,
            });

            // Record flywheel session
            const engine = settings.sttEngine;
            useFlywheelStore.getState().recordSession(wc, dictState.sessionDuration, engine);

            // Record billable entry for active client
            const { activeClientId, clients, addEntry } = useClientsStore.getState();
            if (activeClientId) {
              const client = clients.find((c) => c.id === activeClientId);
              if (client) {
                const rate = client.billableRate > 0
                  ? client.billableRate
                  : (settings.billableRatePerHour ?? 350);
                const billable = (dictState.sessionDuration / 3600) * rate;
                addEntry({
                  clientId: activeClientId,
                  date: Date.now(),
                  durationSeconds: dictState.sessionDuration,
                  wordCount: wc,
                  billableAmount: billable,
                  rateAtTime: rate,
                });
              }
            }
          }
        }

        if (settings.saveTranscripts) {
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

        // Session summary toast
        if (segments.length > 0) {
          const wc = segments.reduce(
            (n, s) => n + (s.correctedText || s.text).split(/\s+/).filter(Boolean).length,
            0
          );
          const corrected = segments.filter((s) => s.grammarApplied).length;
          const mins = Math.floor(useDictationStore.getState().sessionDuration / 60);
          const secs = useDictationStore.getState().sessionDuration % 60;
          const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          const parts = [`${wc} word${wc !== 1 ? "s" : ""}`, duration];
          if (corrected > 0) parts.push(`${corrected} correction${corrected !== 1 ? "s" : ""}`);
          toast(`Session saved — ${parts.join(" · ")}`, "success", 4000);
        }
      }
      lastStatus = current;
    });
    return unsub;
  }, []);
}
