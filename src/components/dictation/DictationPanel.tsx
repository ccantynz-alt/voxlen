import { useEffect, useCallback, useRef } from "react";
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  Trash2,
  Send,
  Clock,
  FileText,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Waveform } from "./Waveform";
import { TranscriptView } from "./TranscriptView";
import { useDictationStore } from "@/stores/dictation";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { formatDuration } from "@/lib/utils";
import { processVoiceCommands, executeVoiceCommand, applyTextCommand } from "@/lib/voiceCommands";
import { useHistoryStore } from "@/stores/history";
import { useFlywheelStore } from "@/stores/flywheel";

export function DictationPanel() {
  const status = useDictationStore((s) => s.status);
  const wordCount = useDictationStore((s) => s.wordCount);
  const sessionDuration = useDictationStore((s) => s.sessionDuration);
  const inputLevel = useDictationStore((s) => s.inputLevel);
  const segments = useDictationStore((s) => s.segments);
  const setStatus = useDictationStore((s) => s.setStatus);
  const addSegment = useDictationStore((s) => s.addSegment);
  const clearSession = useDictationStore((s) => s.clearSession);
  const incrementDuration = useDictationStore((s) => s.incrementDuration);
  const setInputLevel = useDictationStore((s) => s.setInputLevel);
  const pushWaveformSample = useAudioStore((s) => s.pushWaveformSample);
  const selectedDeviceId = useAudioStore((s) => s.selectedDeviceId);
  const devices = useAudioStore((s) => s.devices);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  // Session timer
  useEffect(() => {
    if (status === "listening") {
      timerRef.current = setInterval(() => {
        incrementDuration();
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, incrementDuration]);

  const setCurrentTranscript = useDictationStore((s) => s.setCurrentTranscript);

  // Listen for audio level + transcription events from Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setup() {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        const unlistenLevel = await listen<number>("audio-level", (event) => {
          setInputLevel(event.payload);
          pushWaveformSample(event.payload);
        });

        // Final transcription results — with voice command processing
        const unlistenTranscription = await listen<{
          text: string;
          is_final: boolean;
          confidence: number;
          language?: string;
        }>("transcription", (event) => {
          const result = event.payload;
          if (result.is_final && result.text.trim()) {
            let textToAdd = result.text;

            // Process voice commands if enabled
            const voiceCommandsEnabled = useSettingsStore.getState().voiceCommandsEnabled;
            if (voiceCommandsEnabled) {
              const cmdResult = processVoiceCommands(result.text);
              if (cmdResult.matched && cmdResult.action) {
                const commandOutput = executeVoiceCommand(cmdResult.action);
                // If command produced text (punctuation, newline, etc.), apply it to remaining text
                if (cmdResult.remainingText) {
                  textToAdd = applyTextCommand(cmdResult.remainingText, commandOutput);
                } else if (commandOutput) {
                  // Pure command with output (e.g., "period" → ".")
                  // Apply to the last segment's text
                  const segments = useDictationStore.getState().segments;
                  if (segments.length > 0) {
                    const last = segments[segments.length - 1];
                    const updated = applyTextCommand(last.correctedText || last.text, commandOutput);
                    useDictationStore.getState().updateSegment(last.id, {
                      text: updated,
                      correctedText: undefined,
                    });
                  }
                  setCurrentTranscript("");
                  return; // Don't add a new segment
                } else {
                  // Command with no output and no remaining text (e.g., "stop listening", "delete that")
                  setCurrentTranscript("");
                  return;
                }
              }
            }

            const segmentId = crypto.randomUUID();
            addSegment({
              id: segmentId,
              text: textToAdd,
              timestamp: new Date(),
              confidence: result.confidence,
              language: result.language || undefined,
              isFinal: true,
              grammarApplied: false,
            });
            // Clear the partial transcript since we got a final result
            setCurrentTranscript("");

            // Auto-grammar: if enabled, polish the segment in the background
            const { grammarEnabled, autoCorrect, grammarApiKey } = useSettingsStore.getState();
            if (grammarEnabled && autoCorrect && grammarApiKey) {
              import("@tauri-apps/api/core").then(({ invoke }) => {
                const vocabList = useFlywheelStore.getState().getVocabularyList();
                invoke<{ corrected: string; changes?: Array<{ original: string; corrected: string; category?: string }> }>("correct_grammar", { text: textToAdd, customVocabulary: vocabList })
                  .then((grammarResult) => {
                    if (grammarResult.corrected !== textToAdd) {
                      useDictationStore.getState().updateSegment(segmentId, {
                        correctedText: grammarResult.corrected,
                        grammarApplied: true,
                      });
                      if (grammarResult.changes) {
                        for (const change of grammarResult.changes) {
                          useFlywheelStore.getState().recordCorrection(
                            change.original,
                            change.corrected,
                            (change.category as "grammar" | "spelling" | "punctuation" | "style") || "grammar"
                          );
                        }
                      }
                      useFlywheelStore.getState().recordCorrectionFeedback(true);
                    }
                  })
                  .catch(() => {
                    // Grammar correction failed silently — don't block dictation
                  });
              }).catch(() => {});
            }
          }
        });

        // Streaming partial results (real-time word-by-word)
        const unlistenPartial = await listen<{
          text: string;
          is_final: boolean;
          confidence: number;
        }>("streaming-partial", (event) => {
          if (!event.payload.is_final && event.payload.text) {
            setCurrentTranscript(event.payload.text);
          }
        });

        // Speech activity events
        const unlistenSpeechStarted = await listen("speech-started", () => {
          // Visual feedback that speech detected
          setStatus("listening");
        });

        const unlistenUtteranceEnd = await listen("utterance-end", () => {
          // Brief processing indicator between utterances
          setCurrentTranscript("");
        });

        unlisten = () => {
          unlistenLevel();
          unlistenTranscription();
          unlistenPartial();
          unlistenSpeechStarted();
          unlistenUtteranceEnd();
        };
      } catch {
        // Not in Tauri environment - use demo mode
      }
    }

    setup();
    return () => unlisten?.();
  }, [setInputLevel, pushWaveformSample, addSegment, setCurrentTranscript, setStatus]);

  const handleToggleDictation = useCallback(async () => {
    if (status === "idle" || status === "paused") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_dictation");
        setStatus("listening");
      } catch {
        // Demo mode
        setStatus("listening");
      }
    } else if (status === "listening") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("stop_dictation");
      } catch {
        // Demo mode
      }
      // Save session to history if there are segments
      const currentSegments = useDictationStore.getState().segments;
      const currentDuration = useDictationStore.getState().sessionDuration;
      if (currentSegments.length > 0) {
        const fullText = currentSegments.map((s) => s.correctedText || s.text).join(" ");
        const wc = fullText.split(/\s+/).filter(Boolean).length;
        const hasGrammar = currentSegments.some((s) => s.grammarApplied);
        useHistoryStore.getState().addEntry({
          id: crypto.randomUUID(),
          text: fullText,
          duration: currentDuration * 1000,
          wordCount: wc,
          language: currentSegments[0].language || "en",
          timestamp: new Date().toISOString(),
          grammarCorrected: hasGrammar,
        });

        const engine = useSettingsStore.getState().sttEngine;
        useFlywheelStore.getState().recordSession(wc, currentDuration, engine);
      }
      setStatus("idle");
    }
  }, [status, setStatus]);

  const handlePause = useCallback(async () => {
    if (status === "listening") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("pause_dictation");
      } catch {
        // Demo mode
      }
      setStatus("paused");
    } else if (status === "paused") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_dictation");
      } catch {
        // Demo mode
      }
      setStatus("listening");
    }
  }, [status, setStatus]);

  const handleInjectText = useCallback(async () => {
    const fullText = segments
      .map((s) => s.correctedText || s.text)
      .join(" ");

    if (!fullText) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("inject_text", { text: fullText });
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(fullText);
    }
  }, [segments]);

  const handleCorrectGrammar = useCallback(
    async (text: string) => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<{
          corrected: string;
          changes: Array<{
            original: string;
            corrected: string;
            reason: string;
          }>;
        }>("correct_grammar", { text });

        // Update the last segment with corrected text
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];
          useDictationStore.getState().updateSegment(lastSegment.id, {
            correctedText: result.corrected,
            grammarApplied: true,
          });
        }
      } catch {
        // Grammar correction not available
      }
    },
    [segments]
  );

  const isActive = status === "listening" || status === "processing";
  const showControls = isActive || status === "paused";

  return (
    <div className="flex flex-col h-full">
      {/* Main dictation area */}
      <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
        {/* Mic control + waveform */}
        <div className="flex flex-col items-center gap-6">
          {/* Large mic button */}
          <div className="relative">
            {isActive && (
              <div className="absolute inset-0 rounded-full dictation-pulse" />
            )}
            <button
              onClick={handleToggleDictation}
              className={cn(
                "relative z-10 flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300",
                isActive
                  ? "bg-voxlen-600 text-white shadow-lg shadow-voxlen-600/30 scale-110"
                  : "bg-surface-200 text-surface-700 hover:bg-surface-300 hover:text-surface-900 hover:scale-105"
              )}
            >
              {isActive ? (
                <Mic className="h-8 w-8" />
              ) : (
                <MicOff className="h-8 w-8" />
              )}
            </button>
          </div>

          {/* Status text */}
          <div className="text-center">
            <p className="text-sm font-medium text-surface-900">
              {status === "idle" && "Press to start dictating"}
              {status === "listening" && "Listening..."}
              {status === "processing" && "Processing speech..."}
              {status === "paused" && "Paused"}
              {status === "error" && "An error occurred"}
            </p>
            {selectedDevice && (
              <p className="text-xs text-surface-600 mt-1 flex items-center justify-center gap-1">
                <Mic className="h-3 w-3" />
                {selectedDevice.name}
                {selectedDevice.isExternal && (
                  <Badge variant="info" className="ml-1 text-[10px] py-0">
                    External
                  </Badge>
                )}
              </p>
            )}
            {!selectedDevice && (
              <p className="text-xs text-amber-400 mt-1">
                No microphone selected - go to Settings
              </p>
            )}
          </div>

          {/* Waveform */}
          <Waveform className="w-full max-w-lg" height={60} />

          {/* Control buttons */}
          {showControls && (
            <div className="flex items-center gap-2 animate-fade-in">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePause}
              >
                {status === "paused" ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
                {status === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleToggleDictation}
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </div>
          )}
        </div>

        {/* Transcript */}
        <TranscriptView
          className="flex-1"
          onCorrectGrammar={handleCorrectGrammar}
        />
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-surface-300/50 bg-surface-50/50">
        <div className="flex items-center gap-4 text-xs text-surface-600">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(sessionDuration * 1000)}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {wordCount} words
          </span>
          {inputLevel > 0 && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {Math.round(inputLevel * 100)}% level
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {segments.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={clearSession}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleInjectText}
              >
                <Send className="h-3.5 w-3.5" />
                Insert Text
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
