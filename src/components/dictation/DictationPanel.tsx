import { useEffect, useCallback, useRef, useState } from "react";
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
  ChevronDown,
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
import { useClientsStore } from "@/stores/clients";

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

        // Record billable entry for active client
        const { activeClientId, clients, addEntry } = useClientsStore.getState();
        if (activeClientId) {
          const client = clients.find((c) => c.id === activeClientId);
          if (client) {
            const defaultRate = useSettingsStore.getState().billableRatePerHour ?? 350;
            const rate = client.billableRate > 0 ? client.billableRate : defaultRate;
            const billable = (currentDuration / 3600) * rate;
            addEntry({
              clientId: activeClientId,
              date: Date.now(),
              durationSeconds: currentDuration,
              wordCount: wc,
              billableAmount: billable,
            });
          }
        }
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

  const voxlenContext = useSettingsStore((s) => s.voxlenContext);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [contextOpen, setContextOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const activeClientId = useClientsStore((s) => s.activeClientId);
  const allClients = useClientsStore((s) => s.clients.filter((c) => !c.archived));
  const activeClient = allClients.find((c) => c.id === activeClientId) ?? null;
  const setActiveClient = useClientsStore((s) => s.setActiveClient);

  const isActive = status === "listening" || status === "processing";
  const showControls = isActive || status === "paused";
  const hasContent = segments.length > 0;

  const CONTEXTS = [
    { value: "", label: "General" },
    { value: "legal_general", label: "Legal" },
    { value: "legal_contract", label: "Contract" },
    { value: "legal_case_note", label: "Case Note" },
    { value: "legal_court_filing", label: "Court Filing" },
    { value: "legal_deposition", label: "Deposition" },
    { value: "legal_correspondence", label: "Legal Letter" },
    { value: "accounting_general", label: "Accounting" },
    { value: "accounting_tax", label: "Tax" },
    { value: "accounting_audit", label: "Audit" },
    { value: "accounting_memo", label: "Memo" },
    { value: "accounting_correspondence", label: "Accounting Letter" },
  ];

  const currentContext = CONTEXTS.find((c) => c.value === voxlenContext) ?? CONTEXTS[0];

  return (
    <div className="flex flex-col h-full">
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
              className={cn(
                "relative z-10 flex items-center justify-center w-[84px] h-[84px] rounded-full transition-all duration-300 shadow-inset-hairline",
                isActive
                  ? "bg-gradient-to-br from-marcoreid-700 to-marcoreid-900 text-brass-300 shadow-elevation-lg scale-105"
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

          {/* Client / matter selector */}
          {allClients.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setClientOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-surface-300/60 bg-surface-50/70 text-[11px] font-medium text-surface-700 hover:border-brass-400/50 hover:text-surface-900 transition-all shadow-inset-hairline"
              >
                {activeClient && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeClient.color }}
                  />
                )}
                <span className="text-brass-500/80 text-[9px] uppercase tracking-widest mr-0.5">Client</span>
                {activeClient ? activeClient.name : "None"}
                <ChevronDown className="h-3 w-3 text-surface-500" strokeWidth={1.75} />
              </button>
              {clientOpen && (
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 w-52 rounded-lg border border-surface-300/60 bg-surface-50 shadow-elevation py-1">
                  <button
                    onClick={() => { setActiveClient(null); setClientOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-[11px] transition-colors",
                      !activeClientId ? "bg-marcoreid-900/20 text-surface-950 font-semibold" : "text-surface-700 hover:bg-surface-100"
                    )}
                  >
                    No client
                  </button>
                  {allClients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setActiveClient(c.id); setClientOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors",
                        c.id === activeClientId ? "bg-marcoreid-900/20 text-surface-950 font-semibold" : "text-surface-700 hover:bg-surface-100"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="truncate">{c.name}</span>
                      {c.matterNumber && <span className="text-surface-500 text-[10px] ml-auto shrink-0">#{c.matterNumber}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Context selector */}
          <div className="relative">
            <button
              onClick={() => setContextOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-surface-300/60 bg-surface-50/70 text-[11px] font-medium text-surface-700 hover:border-brass-400/50 hover:text-surface-900 transition-all shadow-inset-hairline"
            >
              <span className="text-brass-500/80 text-[9px] uppercase tracking-widest mr-0.5">Context</span>
              {currentContext.label}
              <ChevronDown className="h-3 w-3 text-surface-500" strokeWidth={1.75} />
            </button>
            {contextOpen && (
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 w-52 rounded-lg border border-surface-300/60 bg-surface-50 shadow-elevation py-1">
                {CONTEXTS.map((ctx) => (
                  <button
                    key={ctx.value}
                    onClick={() => {
                      updateSetting("voxlenContext", ctx.value);
                      setContextOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-[11px] transition-colors",
                      ctx.value === voxlenContext
                        ? "bg-marcoreid-900/20 text-surface-950 font-semibold"
                        : "text-surface-700 hover:bg-surface-100"
                    )}
                  >
                    {ctx.label}
                  </button>
                ))}
              </div>
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
