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
import { useHistoryStore } from "@/stores/history";
import { useFlywheelStore } from "@/stores/flywheel";
import { useEntitlementStore } from "@/stores/entitlement";
import { useUsageStore } from "@/stores/usage";
import { FREE_WEEKLY_WORD_CAP } from "@/stores/entitlement";

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
  const tier = useEntitlementStore((s) => s.tier);
  const weeklyWordsUsed = useUsageStore((s) => s.wordsUsed);
  const recordWeeklyWords = useUsageStore((s) => s.recordWords);
  const isFree = tier === "free";
  const weeklyRemaining = Math.max(0, FREE_WEEKLY_WORD_CAP - weeklyWordsUsed);
  const overFreeCap = isFree && weeklyRemaining === 0;

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
      if (overFreeCap) {
        // Free tier has exhausted the weekly cap. Don't start a session.
        return;
      }
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
        // Weekly meter is only enforced for Free, but we record for all tiers
        // so the UI is accurate the moment a license is revoked or expires.
        recordWeeklyWords(wc);
      }
      setStatus("idle");
    }
  }, [status, setStatus, overFreeCap, recordWeeklyWords]);

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
      {/* Free-tier weekly word meter. Hidden for paid tiers. */}
      {isFree && (
        <FreeTierMeter
          used={weeklyWordsUsed}
          cap={FREE_WEEKLY_WORD_CAP}
          remaining={weeklyRemaining}
        />
      )}
      {/* Main dictation area */}
      <div className="flex-1 flex flex-col p-8 gap-7 overflow-hidden">
        {/* Mic control + waveform */}
        <div className="flex flex-col items-center gap-5">
          {/* Large mic button — oxford navy gradient with brass inflection. */}
          <div className="relative">
            {isActive && (
              <div className="absolute inset-0 rounded-full dictation-pulse" />
            )}
            <button
              onClick={handleToggleDictation}
              disabled={overFreeCap && !isActive}
              title={overFreeCap && !isActive ? "Free tier cap reached — upgrade to continue" : undefined}
              className={cn(
                "relative z-10 flex items-center justify-center w-[84px] h-[84px] rounded-full transition-all duration-300 shadow-inset-hairline",
                isActive
                  ? "bg-gradient-to-br from-marcoreid-700 to-marcoreid-900 text-brass-300 shadow-elevation-lg scale-105"
                  : overFreeCap
                    ? "bg-gradient-to-br from-surface-100 to-surface-200 text-surface-500 opacity-50 cursor-not-allowed shadow-elevation"
                    : "bg-gradient-to-br from-surface-100 to-surface-200 text-surface-700 hover:from-surface-200 hover:to-surface-300 hover:text-surface-900 shadow-elevation"
              )}
            >
              {isActive ? (
                <Mic className="h-7 w-7" strokeWidth={1.75} />
              ) : (
                <MicOff className="h-7 w-7" strokeWidth={1.75} />
              )}
            </button>
          </div>

          {/* Status text — editorial serif for the headline, small-caps metadata below. */}
          <div className="text-center">
            <h2 className="font-display text-[22px] font-medium tracking-tight-display text-surface-950 leading-tight">
              {status === "idle" && "Press to begin dictation"}
              {status === "listening" && (
                <>
                  Listening<span className="text-brass-400">.</span>
                </>
              )}
              {status === "processing" && "Processing speech"}
              {status === "paused" && "Paused"}
              {status === "error" && "An error occurred"}
            </h2>
            {selectedDevice && (
              <p className="text-[11px] text-surface-600 mt-2 flex items-center justify-center gap-1.5 tracking-tight">
                <Mic className="h-3 w-3 text-brass-500/80" strokeWidth={1.75} />
                <span className="font-medium text-surface-700">{selectedDevice.name}</span>
                {selectedDevice.isExternal && (
                  <Badge variant="info" className="ml-1 text-[9px] py-0">
                    External
                  </Badge>
                )}
              </p>
            )}
            {!selectedDevice && (
              <p className="text-[11px] text-brass-500 mt-2 tracking-tight">
                No microphone selected — configure in Settings
              </p>
            )}
            {capsLock && (
              <Badge variant="warning" className="mt-2 text-[9px]">
                CAPS ON
              </Badge>
            )}
          </div>

          {/* Waveform - respects showWaveform setting */}
          {showWaveform && (
            <Waveform className="w-full max-w-lg" height={56} />
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
            <div className="divider-brass w-24 mb-5" />
            <h3 className="font-display text-[15px] italic text-surface-800 tracking-tight-display leading-snug max-w-sm">
              Press the microphone, or use your shortcut, to begin a session.
            </h3>
            <p className="text-[11px] text-surface-600 mt-3 flex items-center gap-1.5 font-mono">
              <Keyboard className="h-3 w-3 text-brass-500/80" strokeWidth={1.75} />
              {shortcutToggle.replace("CommandOrControl", "Ctrl/Cmd")}
            </p>
          </div>
        )}
      </div>

      {/* Bottom status bar — metadata row with small-caps labels. */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-surface-300/50 bg-surface-50/50">
        <div className="flex items-center gap-5">
          <div className="flex items-baseline gap-1.5">
            <Clock className="h-3 w-3 text-surface-600 self-center" strokeWidth={1.75} />
            <span className="font-mono text-[11px] tabular-nums text-surface-800">
              {formatDuration(sessionDuration * 1000)}
            </span>
            <span className="label-caps">elapsed</span>
          </div>
          <div className="h-3 w-px bg-surface-300/60" />
          <div className="flex items-baseline gap-1.5">
            <FileText className="h-3 w-3 text-surface-600 self-center" strokeWidth={1.75} />
            <span className="font-mono text-[11px] tabular-nums text-surface-800">
              {wordCount}
            </span>
            <span className="label-caps">words</span>
          </div>
          {inputLevel > 0 && (
            <>
              <div className="h-3 w-px bg-surface-300/60" />
              <div className="flex items-baseline gap-1.5">
                <Zap className="h-3 w-3 text-brass-500/80 self-center" strokeWidth={1.75} />
                <span className="font-mono text-[11px] tabular-nums text-surface-800">
                  {Math.round(inputLevel * 100)}%
                </span>
                <span className="label-caps">level</span>
              </div>
            </>
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

interface FreeTierMeterProps {
  used: number;
  cap: number;
  remaining: number;
}

function FreeTierMeter({ used, cap, remaining }: FreeTierMeterProps) {
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const depleted = remaining === 0;
  const warning = !depleted && remaining <= cap * 0.2;
  const barColour = depleted
    ? "bg-red-500"
    : warning
      ? "bg-amber-500"
      : "bg-brass-500";
  const copy = depleted
    ? "Weekly free cap reached — upgrade to keep dictating"
    : warning
      ? `${remaining} words left this week`
      : `${used} / ${cap} words used this week`;

  return (
    <div className="px-6 py-2 border-b border-surface-300/50 bg-surface-50/70">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="label-caps">Free tier</span>
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums",
                depleted ? "text-red-600" : warning ? "text-amber-600" : "text-surface-700"
              )}
            >
              {copy}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-300/60 overflow-hidden">
            <div
              className={cn("h-full transition-all duration-300", barColour)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <a
          href="https://voxlen.ai/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-[11px] font-medium tracking-tight whitespace-nowrap transition-colors",
            depleted
              ? "border-brass-500 bg-brass-500 text-marcoreid-900 hover:bg-brass-400"
              : "border-surface-300 text-surface-800 hover:border-brass-500 hover:text-marcoreid-900"
          )}
        >
          Upgrade
        </a>
      </div>
    </div>
  );
}
