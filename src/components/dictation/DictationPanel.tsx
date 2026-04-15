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
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Waveform } from "./Waveform";
import { TranscriptView } from "./TranscriptView";
import { useDictationStore, buildSessionRecord } from "@/stores/dictation";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { formatDuration } from "@/lib/utils";

export function DictationPanel() {
  const status = useDictationStore((s) => s.status);
  const wordCount = useDictationStore((s) => s.wordCount);
  const sessionDuration = useDictationStore((s) => s.sessionDuration);
  const inputLevel = useDictationStore((s) => s.inputLevel);
  const segments = useDictationStore((s) => s.segments);
  const capsLock = useDictationStore((s) => s.capsLock);
  const setStatus = useDictationStore((s) => s.setStatus);
  const clearSession = useDictationStore((s) => s.clearSession);
  const incrementDuration = useDictationStore((s) => s.incrementDuration);
  const selectedDeviceId = useAudioStore((s) => s.selectedDeviceId);
  const devices = useAudioStore((s) => s.devices);
  const shortcutToggle = useSettingsStore((s) => s.shortcutToggle);
  const showWaveform = useSettingsStore((s) => s.showWaveform);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  // Session timer
  useEffect(() => {
    if (status === "listening") {
      if (!sessionStartRef.current) {
        sessionStartRef.current = new Date();
      }
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

  const handleToggleDictation = useCallback(async () => {
    if (status === "idle" || status === "paused") {
      sessionStartRef.current = new Date();
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_dictation");
        setStatus("listening");
      } catch {
        setStatus("listening");
      }
    } else if (status === "listening") {
      // Capture session BEFORE status flip so autosave in useTauriEvents
      // has a consistent view. The autosave subscription handles save_session.
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("stop_dictation");
      } catch {
        // Demo mode
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
      try {
        await navigator.clipboard.writeText(fullText);
      } catch {
        // Ignore
      }
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

  const handleClearSession = useCallback(async () => {
    // Before clearing, persist the session (if any) so it lands in history.
    const record = buildSessionRecord();
    if (record) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_session", { session: record });
      } catch {
        // Non-Tauri — skip.
      }
    }
    clearSession();
  }, [clearSession]);

  const isActive = status === "listening" || status === "processing";
  const showControls = isActive || status === "paused";
  const hasContent = segments.length > 0;

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
                  ? "bg-marcoreid-600 text-white shadow-lg shadow-marcoreid-600/30 scale-110"
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
            {capsLock && (
              <Badge variant="warning" className="mt-2 text-[10px]">
                CAPS ON
              </Badge>
            )}
          </div>

          {/* Waveform - respects showWaveform setting */}
          {showWaveform && (
            <Waveform className="w-full max-w-lg" height={60} />
          )}

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

        {/* Transcript or empty state */}
        {hasContent ? (
          <TranscriptView
            className="flex-1"
            onCorrectGrammar={handleCorrectGrammar}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-14 h-14 rounded-2xl bg-surface-200 flex items-center justify-center mb-3">
              <Mic className="h-7 w-7 text-surface-700" />
            </div>
            <p className="text-sm font-medium text-surface-900">
              Press the mic button or use your shortcut to start
            </p>
            <p className="text-xs text-surface-600 mt-1 flex items-center gap-1">
              <Keyboard className="h-3 w-3" />
              {shortcutToggle.replace("CommandOrControl", "Ctrl/Cmd")}
            </p>
          </div>
        )}
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
              <Button variant="ghost" size="sm" onClick={handleClearSession}>
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
