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
import { useHistoryStore } from "@/stores/history";
import { useFlywheelStore } from "@/stores/flywheel";
import { useClientsStore, buildMatterContext } from "@/stores/clients";
import { VoiceCommandsHelp } from "@/components/layout/VoiceCommandsHelp";
import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { toast } from "@/components/ui/Toast";
import { downloadExport } from "@/lib/export";
import type { ExportFormat } from "@/lib/export";

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
  const shortcutToggle = useSettingsStore((s) => s.shortcutToggle);
  const showWaveform = useSettingsStore((s) => s.showWaveform);

  const restoreDraft = useDictationStore((s) => s.restoreDraft);
  const discardDraft = useDictationStore((s) => s.discardDraft);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<Date | null>(null);

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
    if (status === "idle" || status === "paused" || status === "error") {
      sessionStartRef.current = new Date();
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        // Merge active client's matter vocabulary into STT config before starting
        const { activeClientId: cid, clients: cls } = useClientsStore.getState();
        const activeClientForSTT = cls.find((c) => c.id === cid);
        const matterVocab = activeClientForSTT?.vocabulary ?? [];
        const globalVocab = useSettingsStore.getState().customVocabulary;
        const mergedVocab = [...new Set([...globalVocab, ...matterVocab])];
        if (mergedVocab.length !== globalVocab.length) {
          try {
            const currentCfg = await invoke<Record<string, unknown>>("get_stt_config");
            await invoke("set_stt_config", { config: { ...currentCfg, custom_vocabulary: mergedVocab } });
          } catch {
            // Non-fatal — proceed without updating vocabulary
          }
        }

        await invoke("start_dictation");
        setStatus("listening");
      } catch (e) {
        // Real failure in the desktop app (mic permission, device missing,
        // no account) — never pretend we're listening.
        const msg = typeof e === "string" ? e : e instanceof Error ? e.message : "Could not start dictation";
        useDictationStore.getState().setError(msg);
        setStatus("error");
        toast(msg.length > 100 ? msg.slice(0, 100) + "…" : msg, "error", 6000);
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

        // Update the last segment with corrected text
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];
          useDictationStore.getState().updateSegment(lastSegment.id, {
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
            if (translation?.translated && segments.length > 0) {
              const lastSegment = segments[segments.length - 1];
              useDictationStore.getState().updateSegment(lastSegment.id, {
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
              {status === "error" && "Couldn't start dictation"}
            </h2>
            {status === "error" && errorMessage && (
              <p className="text-[12px] text-red-400 mt-2 max-w-md mx-auto leading-relaxed">
                {errorMessage} — press the microphone to retry.
              </p>
            )}
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
            onClick={() => updateSetting("privilegedMode", !privilegedMode)}
            title={privilegedMode ? "Privileged mode ON — click to disable" : "Enable privileged mode (ABA 1.6 safe)"}
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
