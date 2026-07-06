import { useEffect, useCallback, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
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
  HelpCircle,
  Download,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Waveform } from "./Waveform";
import { TranscriptView } from "./TranscriptView";
import { useDictationStore, buildSessionRecord, loadDraftRecord } from "@/stores/dictation";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";
import { formatDuration } from "@/lib/utils";
import { useFlywheelStore } from "@/stores/flywheel";
import { useClientsStore, buildMatterContext } from "@/stores/clients";
import { useNavigationStore } from "@/stores/navigation";
import { VoiceCommandsHelp } from "@/components/layout/VoiceCommandsHelp";
import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { toast } from "@/components/ui/Toast";
import { downloadExport } from "@/lib/export";
import type { ExportFormat } from "@/lib/export";

function DevicePicker({
  activeDeviceName,
  selectedDevice,
}: {
  activeDeviceName: string | null;
  selectedDevice: { id: string; name: string; isExternal: boolean } | undefined;
}) {
  const [open, setOpen] = useState(false);
  const devices = useAudioStore((s) => s.devices);
  const setSelectedDevice = useAudioStore((s) => s.setSelectedDevice);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayName = activeDeviceName || selectedDevice?.name;

  if (!displayName && devices.length === 0) {
    return (
      <p className="text-[11px] text-brass-500 mt-2 tracking-tight">
        No microphone selected — configure in Settings
      </p>
    );
  }

  return (
    <div className="relative mt-2" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-[11px] text-surface-600 hover:text-surface-800 transition-colors group"
      >
        <Mic className="h-3 w-3 text-brass-500/80" strokeWidth={1.75} />
        <span className="font-medium text-surface-700">{displayName ?? "Select mic"}</span>
        {selectedDevice?.isExternal && (
          <Badge variant="info" className="ml-1 text-[9px] py-0">External</Badge>
        )}
        {activeDeviceName && activeDeviceName !== selectedDevice?.name && (
          <Badge variant="warning" className="ml-1 text-[9px] py-0">Fallback</Badge>
        )}
        <ChevronDown className="h-2.5 w-2.5 text-surface-500 group-hover:text-surface-700 transition-colors" strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 w-56 rounded-lg border border-surface-300/60 bg-surface-0 shadow-elevation-lg py-1 animate-fade-in">
          {devices.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-surface-500">No devices found</p>
          )}
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDevice(d.id);
                updateSetting("preferredDeviceId", d.id);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-surface-100 transition-colors",
                d.id === selectedDevice?.id ? "text-surface-900 font-medium" : "text-surface-700"
              )}
            >
              <span className="flex-1 truncate">{d.name}</span>
              {d.isExternal && <Badge variant="info" className="text-[9px] py-0 shrink-0">External</Badge>}
              {d.id === selectedDevice?.id && <span className="text-brass-500 text-[10px] shrink-0">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DictationPanel() {
  const status = useDictationStore((s) => s.status);
  const errorMessage = useDictationStore((s) => s.error);
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
  const activeDeviceName = useAudioStore((s) => s.activeDeviceName);
  const setActiveDeviceName = useAudioStore((s) => s.setActiveDeviceName);
  const shortcutToggle = useSettingsStore((s) => s.shortcutToggle);
  const showWaveform = useSettingsStore((s) => s.showWaveform);

  const restoreDraft = useDictationStore((s) => s.restoreDraft);
  const discardDraft = useDictationStore((s) => s.discardDraft);
  const alwaysReadyPhase = useDictationStore((s) => s.alwaysReadyPhase);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);

  const [pendingDraft, setPendingDraft] = useState<ReturnType<typeof loadDraftRecord>>(null);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  // Check for unsaved draft on mount
  useEffect(() => {
    if (segments.length === 0) {
      const draft = loadDraftRecord();
      if (draft && draft.segments.length > 0) {
        setPendingDraft(draft);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // In Always-Ready mode the supervisor owns start/stop (the watchdog
    // would immediately re-arm a stop). The button pauses/resumes instead —
    // pause hard-gates audio at the capture callback.
    if (alwaysReadyPhase !== "off") {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        if (status === "paused") {
          try {
            await invoke("resume_dictation");
          } catch {
            // Backend wasn't paused (e.g. recovering) — supervisor handles it.
          }
          setStatus("listening");
        } else {
          await invoke("pause_dictation");
          setStatus("paused");
        }
      } catch {
        // Non-Tauri.
      }
      return;
    }
    if (status === "idle" || status === "paused" || status === "error") {
      if (isStartingRef.current) return; // prevent double-tap race
      isStartingRef.current = true;
      sessionStartRef.current = new Date();
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        // Always push current client's vocabulary into STT config so a client
        // switch mid-session doesn't leak the previous client's terms.
        const { activeClientId: cid, clients: cls } = useClientsStore.getState();
        const activeClientForSTT = cls.find((c) => c.id === cid);
        const matterVocab = activeClientForSTT?.vocabulary ?? [];
        const globalVocab = useSettingsStore.getState().customVocabulary;
        const mergedVocab = [...new Set([...globalVocab, ...matterVocab])];
        try {
          const currentCfg = await invoke<Record<string, unknown>>("get_stt_config");
          await invoke("set_stt_config", { config: { ...currentCfg, custom_vocabulary: mergedVocab } });
        } catch {
          // Non-fatal — proceed without updating vocabulary
        }

        await invoke("start_dictation");
        setStatus("listening");
        try {
          const active = await invoke<string | null>("get_active_device");
          setActiveDeviceName(active);
        } catch {
          // Non-fatal — device status line just won't show.
        }
      } catch (e) {
        const msg = typeof e === "string" ? e : e instanceof Error ? e.message : "Could not start dictation";
        useDictationStore.getState().setError(msg);
        setStatus("error");
        setActiveDeviceName(null);
        toast(msg.length > 100 ? msg.slice(0, 100) + "…" : msg, "error", 6000);
      } finally {
        isStartingRef.current = false;
      }
    } else if (status === "listening") {
      if (isStoppingRef.current) return;
      isStoppingRef.current = true;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("stop_dictation");
      } catch {
        // Demo mode
      }
      // Setting status to idle triggers the autosave subscription in
      // useTauriEvents, which is the single source of truth for recording
      // history, flywheel sessions, and billable time. Don't duplicate
      // that logic here — it causes double-entries when grammar correction
      // updates correctedText between the two saves.
      setStatus("idle");
      setActiveDeviceName(null);
      isStoppingRef.current = false;
    }
  }, [status, alwaysReadyPhase, setStatus, setActiveDeviceName]);

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
        try {
          // Capture is still running while paused — just lift the gate.
          await invoke("resume_dictation");
        } catch {
          // Backend wasn't actually paused (e.g. capture died) — full restart.
          await invoke("start_dictation");
        }
        setStatus("listening");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to resume";
        useDictationStore.getState().setError(msg);
        setStatus("error");
      }
    }
  }, [status, setStatus]);

  const handleInjectText = useCallback(async () => {
    const { translationEnabled } = useSettingsStore.getState();
    const fullText = segments
      .map((s) =>
        translationEnabled && s.translatedText
          ? s.translatedText
          : s.correctedText || s.text
      )
      .join(" ");

    if (!fullText) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("inject_text", { text: fullText });
      const wc = fullText.split(/\s+/).filter(Boolean).length;
      toast(`Injected ${wc} word${wc === 1 ? "" : "s"}`, "success", 2000);
    } catch {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(fullText);
        toast("Copied to clipboard", "info", 2000);
      } catch {
        // Ignore
      }
    }
  }, [segments]);

  const handleCorrectGrammar = useCallback(
    async (text: string) => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const { activeClientId: cid, clients: cls } = useClientsStore.getState();
        const activeClientForGrammar = cls.find((c) => c.id === cid);
        const matterContext = buildMatterContext(activeClientForGrammar) || undefined;
        const flywheelVocab = useFlywheelStore.getState().vocabulary
          .filter((v) => v.frequency >= 2)
          .map((v) => v.word);
        const clientVocab = activeClientForGrammar?.vocabulary ?? [];
        const globalVocabList = useSettingsStore.getState().customVocabulary;
        const mergedVocab = Array.from(new Set([...flywheelVocab, ...clientVocab, ...globalVocabList]));
        const customVocabulary = mergedVocab.length > 0 ? mergedVocab : undefined;

        const result = await invoke<{
          corrected: string;
          changes: Array<{
            original: string;
            corrected: string;
            reason: string;
          }>;
        }>("correct_grammar", { text, customVocabulary, matterContext });

        // Apply the corrected text. The polish button passes the FULL
        // transcript — writing that into only the last segment would leave
        // segments 1..n-1 in place and duplicate the whole transcript, so
        // for multi-segment sessions collapse to a single corrected segment.
        let targetSegmentId: string | null = null;
        if (segments.length > 1) {
          targetSegmentId = crypto.randomUUID();
          useDictationStore.getState().replaceAllSegments({
            id: targetSegmentId,
            text,
            correctedText: result.corrected,
            timestamp: new Date(),
            confidence: 1,
            isFinal: true,
            grammarApplied: true,
          });
        } else if (segments.length === 1) {
          targetSegmentId = segments[0].id;
          useDictationStore.getState().updateSegment(targetSegmentId, {
            correctedText: result.corrected,
            grammarApplied: true,
          });
        }

        // If translation is also enabled, translate the corrected text
        const { translationEnabled, translationTargetLanguage } = useSettingsStore.getState();
        if (translationEnabled && translationTargetLanguage && result.corrected) {
          try {
            const { invoke: inv } = await import("@tauri-apps/api/core");
            const translation = await inv<{ translated: string }>(
              "translate_text",
              { text: result.corrected, targetLanguage: translationTargetLanguage }
            );
            if (translation?.translated && targetSegmentId) {
              useDictationStore.getState().updateSegment(targetSegmentId, {
                translatedText: translation.translated,
                translatedToLanguage: translationTargetLanguage,
              });
            }
          } catch {
            toast("Translation unavailable — check your API key in Settings", "error", 4000);
          }
        }
      } catch {
        toast("Grammar correction unavailable — check your API key in Settings", "error", 4000);
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

  const sttApiKey = useSettingsStore((s) => s.sttApiKey);
  const voxlenApiKey = useSettingsStore((s) => s.voxlenApiKey);
  const hasApiKey = !!(sttApiKey || voxlenApiKey);
  const voxlenContext = useSettingsStore((s) => s.voxlenContext);
  const privilegedMode = useSettingsStore((s) => s.privilegedMode);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [contextOpen, setContextOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const sttLanguage = useSettingsStore((s) => s.sttLanguage);
  const autoDetectLanguage = useSettingsStore((s) => s.autoDetectLanguage);
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === sttLanguage) ?? SUPPORTED_LANGUAGES[0];
  const activeClientId = useClientsStore((s) => s.activeClientId);
  // NOTE: `.filter()` allocates a fresh array on every call. Passing that
  // selector straight to Zustand v5 (which is backed by useSyncExternalStore)
  // makes the snapshot reference change on every render, which React detects
  // as a never-settling store and force-re-renders into an infinite loop
  // ("Maximum update depth exceeded", React error #185). useShallow memoises
  // the result with a shallow compare so the reference stays stable.
  const allClients = useClientsStore(useShallow((s) => s.clients.filter((c) => !c.archived)));
  const activeClient = allClients.find((c) => c.id === activeClientId) ?? null;
  const setActiveClient = useClientsStore((s) => s.setActiveClient);

  const currentTranscript = useDictationStore((s) => s.currentTranscript);
  const isActive = status === "listening" || status === "processing";
  const showControls = isActive || status === "paused";
  // Include the live interim transcript so the very first utterance is
  // visible while it's still being spoken
  const hasContent = segments.length > 0 || !!currentTranscript;

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
      {/* Privileged mode banner */}
      {privilegedMode && (
        <div className="flex items-center gap-2.5 px-5 py-2.5 bg-emerald-950/60 border-b border-emerald-500/20">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" strokeWidth={1.75} />
          <p className="text-[11px] text-emerald-300 font-medium">
            Privileged mode active — attorney-client privilege protected. Cloud grammar and translation disabled.
          </p>
          <button
            onClick={() => updateSetting("privilegedMode", false)}
            className="ml-auto text-[10px] text-emerald-600 hover:text-emerald-400 underline transition-colors shrink-0"
          >
            Disable
          </button>
        </div>
      )}
      {/* No API key banner — stays visible even in error state */}
      {!hasApiKey && (
        <div className="flex items-center gap-2.5 px-5 py-2.5 bg-red-950/50 border-b border-red-500/20">
          <Zap className="h-3.5 w-3.5 text-red-400 shrink-0" strokeWidth={1.75} />
          <p className="text-[11px] text-red-300 font-medium flex-1">
            No API key — add a Deepgram key or Voxlen account to start dictating.
          </p>
          <button
            onClick={() => useNavigationStore.getState().requestView("settings")}
            className="text-[11px] font-semibold text-red-300 hover:text-red-100 underline shrink-0 transition-colors"
          >
            Open Settings
          </button>
        </div>
      )}
      {/* Draft recovery banner */}
      {pendingDraft && (
        <div className="flex items-center gap-2.5 px-5 py-2.5 bg-amber-950/60 border-b border-amber-500/20">
          <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" strokeWidth={1.75} />
          <p className="text-[11px] text-amber-300 font-medium">
            Unsaved draft from {new Date(pendingDraft.savedAt).toLocaleString()} ({pendingDraft.segments.length} segment{pendingDraft.segments.length !== 1 ? "s" : ""}) — restore?
          </p>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <button
              onClick={() => { restoreDraft(pendingDraft); setPendingDraft(null); }}
              className="text-[10px] text-amber-400 hover:text-amber-200 font-semibold underline transition-colors"
            >
              Restore
            </button>
            <button
              onClick={() => { discardDraft(); setPendingDraft(null); }}
              className="text-[10px] text-amber-600 hover:text-amber-400 underline transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
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
              aria-label={isActive ? "Stop dictation" : "Start dictation"}
              aria-pressed={isActive}
              disabled={!hasApiKey && !isActive}
              className={cn(
                "relative z-10 flex items-center justify-center w-[84px] h-[84px] rounded-full transition-all duration-300 shadow-inset-hairline",
                !hasApiKey && !isActive
                  ? "opacity-40 cursor-not-allowed bg-gradient-to-br from-surface-100 to-surface-200 text-surface-500"
                  : isActive
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
              {status === "listening" && alwaysReadyPhase === "armed" && (
                <>
                  Ready — speak anytime<span className="text-brass-400">.</span>
                </>
              )}
              {status === "listening" && alwaysReadyPhase === "streaming" && (
                <>
                  Transcribing<span className="text-brass-400">.</span>
                </>
              )}
              {status === "listening" && (alwaysReadyPhase === "off" || alwaysReadyPhase === "error") && (
                <>
                  Listening<span className="text-brass-400">.</span>
                </>
              )}
              {status === "processing" && "Processing speech"}
              {status === "paused" && "Paused"}
              {status === "error" && "Couldn't start dictation"}
            </h2>
            {status === "error" && errorMessage && (
              <p className="text-[12px] text-red-400 mt-2 max-w-md mx-auto leading-relaxed">
                {errorMessage} — press the microphone to retry.
              </p>
            )}
            <DevicePicker
              activeDeviceName={activeDeviceName}
              selectedDevice={selectedDevice}
            />
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

          {/* Live billing ticker — shown when recording with active client */}
          {isActive && activeClient && (() => {
            const rate = activeClient.billableRate > 0 ? activeClient.billableRate : (useSettingsStore.getState().billableRatePerHour ?? 0);
            if (rate <= 0) return null;
            const elapsed = sessionDuration; // seconds
            const amount = (elapsed / 3600) * rate;
            return (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brass-500/10 border border-brass-400/30 text-[11px] font-mono text-brass-600 tabular-nums">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brass-500 animate-pulse" />
                £{amount.toFixed(2)}
              </div>
            );
          })()}

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

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-surface-300/60 bg-surface-50/70 text-[11px] font-medium text-surface-700 hover:border-brass-400/50 hover:text-surface-900 transition-all shadow-inset-hairline"
              title={autoDetectLanguage ? "Auto-detect language" : currentLang.name}
            >
              <span className="text-base leading-none">{autoDetectLanguage ? "🌐" : currentLang.flag}</span>
              <span className="hidden sm:inline">{autoDetectLanguage ? "Auto" : currentLang.code.toUpperCase()}</span>
              <ChevronDown className="h-3 w-3 text-surface-500" strokeWidth={1.75} />
            </button>
            {langOpen && (
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 w-52 rounded-lg border border-surface-300/60 bg-surface-50 shadow-elevation py-1 max-h-64 overflow-y-auto">
                <button
                  onClick={() => {
                    updateSetting("autoDetectLanguage", true);
                    setLangOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2",
                    autoDetectLanguage ? "bg-marcoreid-900/20 text-surface-950 font-semibold" : "text-surface-700 hover:bg-surface-100"
                  )}
                >
                  <span>🌐</span> Auto-detect
                </button>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      updateSetting("sttLanguage", lang.code);
                      updateSetting("autoDetectLanguage", false);
                      setLangOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2",
                      !autoDetectLanguage && lang.code === sttLanguage
                        ? "bg-marcoreid-900/20 text-surface-950 font-semibold"
                        : "text-surface-700 hover:bg-surface-100"
                    )}
                  >
                    <span>{lang.flag}</span> {lang.name}
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
          <button
            onClick={() => {
              if (!privilegedMode) {
                // Privileged mode forces the local Whisper engine, which is
                // not implemented yet — enabling it fails closed and every
                // dictation start errors. Block with an explanation instead
                // of silently bricking the core feature.
                toast(
                  "Privileged (offline) mode requires the local Whisper engine, which is coming soon. Until then, dictation uses your configured cloud engine.",
                  "info",
                  6000
                );
                return;
              }
              updateSetting("privilegedMode", false);
            }}
            title={privilegedMode ? "Privileged mode ON — click to disable" : "Privileged offline mode (coming soon — requires local Whisper)"}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
              privilegedMode
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/15"
                : "text-surface-600 hover:bg-surface-100 hover:text-surface-800"
            )}
          >
            {privilegedMode ? (
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {privilegedMode ? "Privileged" : "Privilege"}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHelpOpen(true)}
            title="Voice commands help"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Voice Commands
          </Button>
          {segments.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClearSession}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExportOpen((o) => !o)}
                  title="Export transcript"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
                {exportOpen && (
                  <div
                    className="absolute bottom-full right-0 mb-1 w-40 rounded-lg border border-surface-300/60 bg-surface-50 shadow-lg z-50 py-1"
                    onMouseLeave={() => setExportOpen(false)}
                  >
                    {(["txt", "md", "rtf", "json", "srt"] as ExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={async () => {
                          setExportOpen(false);
                          try {
                            await downloadExport(segments, fmt);
                          } catch {
                            toast("Export failed", "error");
                          }
                        }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-surface-900 hover:bg-surface-100 transition-colors"
                      >
                        {fmt === "txt" && "Plain Text (.txt)"}
                        {fmt === "md" && "Markdown (.md)"}
                        {fmt === "rtf" && "Word / RTF (.rtf)"}
                        {fmt === "json" && "JSON (.json)"}
                        {fmt === "srt" && "Subtitles (.srt)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
        {helpOpen && <VoiceCommandsHelp onClose={() => setHelpOpen(false)} />}
      </div>
    </div>
  );
}
