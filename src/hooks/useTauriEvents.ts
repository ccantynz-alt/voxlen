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
import { computeBillableAmount, resolveRate, draftNarrative } from "@/lib/billing";
import { collectVocabulary } from "@/lib/vocab";
import { applyLearnedCorrections } from "@/lib/localCorrections";
import type { VoxlenContext } from "@/lib/contextFormat";
import { useClauseStore } from "@/stores/clauses";
import { autoSaveSessionDocument, autoDocFailureMessage } from "@/lib/autoDoc";

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

// Serial queue for post-processing — ensures utterances are injected in the
// order they were spoken, even when grammar/translation calls take different
// amounts of time.
let _postQueue = Promise.resolve();

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
            // While paused, drop incoming transcripts entirely — the backend
            // streaming path doesn't gate on pause yet, and appending/injecting
            // text while the UI says "Paused" is a privacy failure.
            if (useDictationStore.getState().status === "paused") return;
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
                  const vcSettings = useSettingsStore.getState();
                  const note = parsed.remainingText || "";
                  const { activeClientId: vcClientId, clients: vcClients, addEntry: vcAddEntry } = useClientsStore.getState();
                  const vcClient = vcClients.find((c) => c.id === vcClientId);
                  const { rate } = resolveRate(vcClient, vcSettings.billableRatePerHour);
                  const billing = computeBillableAmount(minutes * 60, rate, {
                    incrementHours: vcSettings.billingRoundingIncrement,
                    minimumHours: vcSettings.billingMinimumHours,
                  });
                  // Explicit voice command = attorney intent → approved, not draft.
                  vcAddEntry({
                    clientId: vcClient?.id ?? "",
                    date: Date.now(),
                    durationSeconds: minutes * 60,
                    wordCount: 0,
                    billableAmount: billing.amount,
                    rateAtTime: rate,
                    note: note.slice(0, 120) || undefined,
                    status: "approved",
                    source: "voice-command",
                  });
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
            // Pre-apply flywheel-learned correction patterns on-device —
            // instant, free, and the only correction path in Privileged
            // Mode where cloud grammar never runs.
            const withLearned = settings.applyLearnedCorrections
              ? applyLearnedCorrections(
                  withContext,
                  useFlywheelStore.getState().getTopCorrectionPatterns(50)
                ).text
              : withContext;
            const finalText = capsLock ? withLearned.toUpperCase() : withLearned;

            // Clause library voice triggers — gated on the voice-commands
            // setting: with it off, a sentence merely containing a trigger
            // phrase must not be swallowed and replaced by a clause.
            const { findByTrigger, findTemplateByTrigger, markUsed } = useClauseStore.getState();
            const matchedClause = settings.voiceCommandsEnabled ? findByTrigger(finalText) : undefined;
            const matchedTemplate = settings.voiceCommandsEnabled ? findTemplateByTrigger(finalText) : undefined;
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

            // Post-processing pipeline — appended to a serial queue so multiple
            // rapid utterances are always injected in the order they were spoken,
            // even when grammar/translation calls take different amounts of time.
            const grammarEnabled = settings.grammarEnabled;
            const translationEnabled =
              settings.translationEnabled &&
              settings.translationTargetLanguage &&
              settings.translationTargetLanguage !== (result.language ?? "");

            // Capture values used inside the async closure before any state changes.
            const capturedFinalText = finalText;
            const capturedSegmentId = segmentId;
            const capturedAutoInject = autoInject;

            _postQueue = _postQueue.then(async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                let processedText = capturedFinalText;

                // Step 1: grammar correction
                if (grammarEnabled) {
                  try {
                    const { activeClientId: acid, clients: acls } = useClientsStore.getState();
                    const activeClientForAuto = acls.find((c) => c.id === acid);
                    const mergedVocab = collectVocabulary();
                    const matterContextAuto = buildMatterContext(activeClientForAuto) || undefined;
                    const grammarResult = await invoke<{ corrected: string; changes: Array<{ original: string; corrected: string; reason: string; category: string }>; score: number }>(
                      "correct_grammar",
                      {
                        text: capturedFinalText,
                        customVocabulary: mergedVocab.length > 0 ? mergedVocab : undefined,
                        matterContext: matterContextAuto,
                        learnedPatterns: useFlywheelStore.getState().getTopCorrectionPatterns(50),
                      }
                    );
                    if (grammarResult?.corrected) {
                      processedText = grammarResult.corrected;
                      useDictationStore.getState().updateSegment(capturedSegmentId, {
                        correctedText: grammarResult.corrected,
                        grammarApplied: true,
                      });
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
                  } catch (err) {
                    // Surface actionable errors — rate limits and auth failures need user action.
                    const msg = err instanceof Error ? err.message : String(err);
                    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
                      toast("Grammar AI rate limited — transcript saved without corrections", "info", 4000);
                    } else if (msg.includes("No grammar AI key") || msg.includes("401") || msg.includes("403")) {
                      toast("Grammar AI not configured — add an API key in Settings › Account", "info", 5000);
                    }
                    // Other failures (network, timeout): silently continue with raw text.
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
                      useDictationStore.getState().updateSegment(capturedSegmentId, {
                        translatedText: translation.translated,
                        translatedToLanguage: settings.translationTargetLanguage,
                      });
                    }
                  } catch {
                    // Translation failure — leave segment as-is.
                  }
                }

                // Step 3: inject into the focused app. A trailing space keeps
                // consecutive utterances from running together ("…meeting.Then")
                // — matching the voice-command and manual-insert paths.
                if (capturedAutoInject) {
                  try {
                    await invoke("inject_text", { text: processedText + " " });
                  } catch {
                    // Injection failure (e.g. Accessibility permissions not granted on macOS).
                  }
                }
              } catch {
                // Non-Tauri environment — skip.
              }
            });
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
          // Deepgram VAD fires on any speech — it must not silently un-pause.
          const status = useDictationStore.getState().status;
          if (status !== "paused" && status !== "idle") {
            useDictationStore.getState().setStatus("listening");
          }
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

        // Microphone auto-recovery lifecycle (stream error / unplug / mute
        // toggle detected by the Rust capture watchdog). Raw "audio-stream-error"
        // and "audio-device-lost" events are intentionally not toasted here —
        // they always precede an "audio-recovery-attempt" and toasting both
        // would just double up the same notification.
        const unlistenRecoveryAttempt = await listen("audio-recovery-attempt", () => {
          toast("Microphone signal lost — reconnecting…", "info", 3000);
        });

        const unlistenRecoveryResult = await listen<{ ok: boolean; device?: string; error?: string }>(
          "audio-recovery-result",
          (event) => {
            const { ok, device, error } = event.payload;
            if (ok) {
              toast(device ? `Microphone reconnected — using ${device}` : "Microphone reconnected", "success", 4000);
              useAudioStore.getState().setActiveDeviceName(device ?? null);
            } else {
              toast(`Reconnect failed${error ? `: ${error}` : ""} — retrying…`, "error", 4000);
            }
          }
        );

        const unlistenRecoveryGiveup = await listen("audio-recovery-giveup", () => {
          toast(
            "Microphone unavailable — check the connection/power and press the mic button to retry.",
            "error",
            8000
          );
        });

        // When the backend streaming session gives up (retries exhausted or user
        // stopped dictation and the WebSocket finally closed), reset UI to idle so
        // the microphone button is re-enabled. Without this the UI can get stuck
        // showing "Listening." with no audio being transcribed.
        // EXCEPTION: in Always-Ready mode the gate closes a session after
        // every silence hangover — that disconnect is routine, not terminal.
        const unlistenDisconnected = await listen("streaming-disconnected", () => {
          if (useDictationStore.getState().alwaysReadyPhase !== "off") return;
          const s = useDictationStore.getState().status;
          if (s === "listening" || s === "processing" || s === "paused") {
            useDictationStore.getState().setStatus("idle");
          }
        });

        // Always-Ready gate lifecycle. While armed/streaming the mic is
        // conceptually hot, so keep status out of "idle" (which would
        // re-enable the start button and fight the supervisor).
        const unlistenAlwaysReadyState = await listen<string>("always-ready-state", (event) => {
          const phase = event.payload as "off" | "armed" | "streaming" | "error";
          const dictation = useDictationStore.getState();
          dictation.setAlwaysReadyPhase(phase);
          if (phase === "armed" || phase === "streaming") {
            if (dictation.status === "idle" || dictation.status === "error") {
              dictation.setStatus("listening");
            }
          } else if (phase === "off") {
            if (dictation.status === "listening" || dictation.status === "processing") {
              dictation.setStatus("idle");
            }
          }
        });

        // Tray checkbox toggled — route through the normal setting update so
        // persistence and backend arming happen via the single path.
        const unlistenAlwaysReadyToggle = await listen<boolean>("always-ready-toggle", (event) => {
          useSettingsStore.getState().updateSetting("alwaysReadyMode", !!event.payload);
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
          unlistenRecoveryAttempt();
          unlistenRecoveryResult();
          unlistenRecoveryGiveup();
          unlistenDisconnected();
          unlistenAlwaysReadyState();
          unlistenAlwaysReadyToggle();
        };

        // Hydrate the gate phase — the backend may have armed Always-Ready
        // from the persisted setting before this webview finished loading.
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const armed = await invoke<boolean>("get_always_ready_state");
          if (armed) {
            const dictation = useDictationStore.getState();
            dictation.setAlwaysReadyPhase("armed");
            if (dictation.status === "idle") dictation.setStatus("listening");
          }
        } catch {
          // Command unavailable (tests / old backend).
        }
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
    // Dedupe by session identity, not by transcript text — text-equality
    // dedupe silently dropped the history entry, flywheel session, AND the
    // client billable entry whenever a later session dictated identical text.
    let lastSavedSessionKey: string | null = null;
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
          const sessionKey = dictState.sessionStartedAtMs !== null
            ? String(dictState.sessionStartedAtMs)
            : `text:${fullText}`;
          const alreadySaved = sessionKey === lastSavedSessionKey;
          if (!alreadySaved) {
            lastSavedSessionKey = sessionKey;
            const record = buildSessionRecord();
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

            // Auto-draft a billable time entry for attorney review — never
            // silently approved. Sessions under 30s are noise, not billable work.
            if (settings.autoTimeCapture && dictState.sessionDuration >= 30) {
              const { clients, addEntry, activeClientId } = useClientsStore.getState();
              // record is non-null here (segments exist), but fall back to the
              // active client so a null record can't silently drop the client rate.
              const client = clients.find((c) => c.id === (record?.client_id ?? activeClientId));
              const { rate } = resolveRate(client, settings.billableRatePerHour);
              const billing = computeBillableAmount(dictState.sessionDuration, rate, {
                incrementHours: settings.billingRoundingIncrement,
                minimumHours: settings.billingMinimumHours,
              });
              const entryId = addEntry({
                clientId: client?.id ?? "",
                date: dictState.sessionStartedAtMs ?? Date.now(),
                durationSeconds: dictState.sessionDuration,
                wordCount: wc,
                billableAmount: billing.amount,
                rateAtTime: rate,
                note: draftNarrative(fullText),
                status: "draft",
                source: "session",
              });
              if (entryId) {
                useDictationStore.getState().setLastDraftEntryId(entryId);
              }
            }

            if (record && settings.saveTranscripts) {
              void (async () => {
                try {
                  const { invoke } = await import("@tauri-apps/api/core");
                  await invoke("save_session", { session: record });
                } catch {
                  // Non-Tauri environment — skip.
                }
              })();
            }

            if (record && settings.autoDocEnabled && settings.autoDocRootPath) {
              void autoSaveSessionDocument(record).then(
                (path) => toast(`Document saved — ${path}`, "success", 5000),
                (error) => toast(autoDocFailureMessage(error), "error", 5000),
              );
            }
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
