import { useCallback, useEffect, useRef, useState } from "react";
import {
  Headphones,
  ShieldCheck,
  AlertTriangle,
  Square,
  Mic,
  Copy,
  Check,
  X,
  CalendarClock,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settings";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

/** Bump to re-prompt everyone when the consent copy changes. */
const CONSENT_VERSION = "2026-07";

/** US states requiring ALL parties to consent to recording a conversation. */
const ALL_PARTY_CONSENT = new Set([
  "CA", "DE", "FL", "IL", "MD", "MA", "MT", "NV", "NH", "PA", "WA",
]);

const JURISDICTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select your jurisdiction…" },
  { value: "one-party-us", label: "US — one-party consent state" },
  ...[...ALL_PARTY_CONSENT].sort().map((s) => ({
    value: s,
    label: `US — ${s} (all-party consent)`,
  })),
  { value: "UK", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "CA-country", label: "Canada" },
  { value: "other", label: "Other / multiple jurisdictions" },
];

interface MeetingSegment {
  speaker: "you" | "remote";
  text: string;
  timestamp_ms: number;
}

interface ExtractedItem {
  id: string;
  kind: "Task" | "Deadline" | "Date";
  text: string;
  due_date: string | null;
  speaker: string | null;
  timestamp_ms: number;
  source: string;
}

export function MeetingPanel() {
  const settings = useSettingsStore();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [segments, setSegments] = useState<MeetingSegment[]>([]);
  const [extracted, setExtracted] = useState<ExtractedItem[]>([]);
  const [dismissedItems, setDismissedItems] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [allPartyConfirmed, setAllPartyConfirmed] = useState(false);
  const [jurisdictionDraft, setJurisdictionDraft] = useState(settings.meetingJurisdiction);
  const startedAtRef = useRef<number>(0);
  const segmentsRef = useRef<MeetingSegment[]>([]);
  segmentsRef.current = segments;

  const consentGiven = settings.meetingConsentAckVersion === CONSENT_VERSION;
  const needsPerMeetingConfirm = ALL_PARTY_CONSENT.has(settings.meetingJurisdiction);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const ok = await invoke<boolean>("meeting_capture_supported");
        if (!cancelled) setSupported(ok);
        const isActive = await invoke<boolean>("meeting_capture_active");
        if (!cancelled) setActive(isActive);
      } catch {
        if (!cancelled) setSupported(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the finished meeting and run task/deadline extraction.
  const finishMeeting = useCallback(async () => {
    setActive(false);
    setAllPartyConfirmed(false);
    const segs = segmentsRef.current;
    if (segs.length === 0) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const wordCount = segs.reduce(
        (n, s) => n + s.text.split(/\s+/).filter(Boolean).length,
        0
      );
      const started = startedAtRef.current || segs[0].timestamp_ms;
      const ended = Date.now();
      await invoke("save_session", {
        session: {
          id: crypto.randomUUID(),
          started_at_ms: started,
          ended_at_ms: ended,
          duration_ms: Math.max(0, ended - started),
          word_count: wordCount,
          language: null,
          kind: "meeting",
          segments: segs.map((s) => ({
            id: crypto.randomUUID(),
            text: s.text,
            corrected_text: null,
            confidence: 1,
            language: null,
            timestamp_ms: s.timestamp_ms,
            grammar_applied: false,
            speaker: s.speaker,
          })),
        },
      });
      // Mirror into the in-memory history list so the History panel shows it
      // immediately, labelled with speakers.
      const { useHistoryStore } = await import("@/stores/history");
      useHistoryStore.getState().addEntry({
        id: crypto.randomUUID(),
        text: segs
          .map((s) => `${s.speaker === "you" ? "You" : "Remote"}: ${s.text}`)
          .join("\n"),
        duration: Math.max(0, ended - started),
        wordCount,
        language: "en",
        timestamp: new Date(started).toISOString(),
        grammarCorrected: false,
        kind: "meeting",
      });

      const items = await invoke<ExtractedItem[]>("extract_meeting_items", {
        segments: segs.map((s) => [s.speaker, s.text, s.timestamp_ms]),
        meetingStartedAtMs: started,
      });
      setExtracted(items);
      if (items.length > 0) {
        toast(`${items.length} action item${items.length !== 1 ? "s" : ""} detected`, "info", 4000);
      }
    } catch (e) {
      console.error("Failed to finish meeting:", e);
    }
  }, []);

  useEffect(() => {
    let unlistenSeg: (() => void) | undefined;
    let unlistenErr: (() => void) | undefined;
    let unlistenStop: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlistenSeg = await listen<MeetingSegment>("meeting-transcript-segment", (e) => {
          setSegments((prev) =>
            [...prev, e.payload].sort((a, b) => a.timestamp_ms - b.timestamp_ms)
          );
        });
        unlistenErr = await listen<string>("meeting-error", (e) => {
          toast(`Meeting transcription error: ${e.payload}`, "error", 8000);
        });
        unlistenStop = await listen("meeting-stopped", () => {
          void finishMeeting();
        });
      } catch {
        // Non-Tauri environment.
      }
    })();
    return () => {
      unlistenSeg?.();
      unlistenErr?.();
      unlistenStop?.();
    };
  }, [finishMeeting]);

  const acknowledgeConsent = () => {
    if (!jurisdictionDraft) return;
    settings.updateSettings({
      meetingJurisdiction: jurisdictionDraft,
      meetingConsentAckVersion: CONSENT_VERSION,
      meetingConsentAckAt: new Date().toISOString(),
    });
  };

  const start = async () => {
    if (needsPerMeetingConfirm && !allPartyConfirmed) return;
    setSegments([]);
    setExtracted([]);
    setDismissedItems([]);
    startedAtRef.current = Date.now();
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("start_meeting_capture");
      setActive(true);
    } catch (e) {
      toast(String(e), "error", 8000);
    }
  };

  const stop = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("stop_meeting_capture");
    } catch (e) {
      toast(String(e), "error", 6000);
    }
  };

  const copyItem = async (item: ExtractedItem) => {
    const line = item.due_date ? `${item.text} (due ${item.due_date})` : item.text;
    try {
      await navigator.clipboard.writeText(line);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard unavailable.
    }
  };

  const visibleItems = extracted.filter((i) => !dismissedItems.includes(i.id));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/50 shrink-0 bg-surface-50/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-200">
            <Headphones className="h-4.5 w-4.5 text-surface-700" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-surface-950">Meeting Transcription</h2>
            <p className="text-[11px] text-surface-600">
              Bot-free · both sides captured on this device · Whisper Local only — nothing leaves your machine
            </p>
          </div>
        </div>
        {active ? (
          <Button variant="danger" size="sm" onClick={stop}>
            <Square className="w-3.5 h-3.5" /> Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={start}
            disabled={!supported || !consentGiven || (needsPerMeetingConfirm && !allPartyConfirmed)}
          >
            <Mic className="w-3.5 h-3.5" /> Start capture
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {supported === false && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-surface-700 leading-relaxed">
              System-audio capture is currently available on Windows only. macOS support
              (ScreenCaptureKit) is on the roadmap.
            </p>
          </div>
        )}

        {/* Consent notice — first use, and again when the copy version bumps */}
        {supported && !consentGiven && (
          <div className="rounded-xl border border-surface-300/60 bg-surface-50 p-5 space-y-4 max-w-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brass-500" />
              <h3 className="text-sm font-semibold text-surface-950">Recording consent</h3>
            </div>
            <div className="text-[12px] text-surface-700 leading-relaxed space-y-2">
              <p>
                Meeting capture records <span className="font-medium">both sides</span> of calls
                and meetings playing on this device. Recording laws vary by jurisdiction:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>
                  <span className="font-medium">11 US states</span> (incl. California, Florida,
                  Illinois, Pennsylvania, Washington) require <span className="font-medium">all
                  parties</span> to consent. Illegal recording can be a felony and the recording
                  inadmissible.
                </li>
                <li>Covert recording may separately breach your professional conduct rules.</li>
                <li>
                  A visible recording indicator is always shown on your screen while capture runs —
                  Voxlen will not record covertly.
                </li>
              </ul>
              <p>
                You are responsible for obtaining any consent your jurisdiction requires from
                meeting participants.
              </p>
            </div>
            <select
              value={jurisdictionDraft}
              onChange={(e) => setJurisdictionDraft(e.target.value)}
              className="w-full bg-surface-100 border border-surface-300/60 rounded-lg px-3 py-2 text-[12px] text-surface-900"
            >
              {JURISDICTIONS.map((j) => (
                <option key={j.value} value={j.value}>{j.label}</option>
              ))}
            </select>
            <Button variant="primary" onClick={acknowledgeConsent} disabled={!jurisdictionDraft} className="w-full">
              I understand my consent obligations
            </Button>
          </div>
        )}

        {/* Per-meeting all-party confirmation */}
        {supported && consentGiven && needsPerMeetingConfirm && !active && (
          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/25 cursor-pointer select-none max-w-xl">
            <input
              type="checkbox"
              checked={allPartyConfirmed}
              onChange={(e) => setAllPartyConfirmed(e.target.checked)}
              className="mt-0.5 accent-red-500"
            />
            <span className="text-[12px] text-surface-800 leading-relaxed">
              {settings.meetingJurisdiction} requires <span className="font-semibold">all
              parties</span> to consent. I confirm I have obtained (or will obtain before recording
              begins) consent from every participant in this meeting.
            </span>
          </label>
        )}

        {/* Live transcript */}
        {(active || segments.length > 0) && (
          <div className="rounded-xl border border-surface-300/60 bg-surface-50/50 overflow-hidden">
            <div className="px-4 py-2 border-b border-surface-300/40 flex items-center gap-2">
              {active && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              <span className="text-[11px] uppercase tracking-wide-caps text-surface-600">
                {active ? "Transcribing" : "Transcript"}
              </span>
              <span className="text-[11px] text-surface-500 ml-auto">
                {segments.length} segment{segments.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-4 space-y-3 max-h-[45vh] overflow-y-auto">
              {segments.length === 0 && (
                <p className="text-[12px] text-surface-500 italic">
                  Waiting for speech… play the meeting audio and speak normally.
                </p>
              )}
              {segments.map((s, i) => (
                <div key={`${s.timestamp_ms}-${i}`} className="flex gap-3">
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider shrink-0 w-14 pt-0.5",
                      s.speaker === "you" ? "text-brass-500" : "text-marcoreid-400"
                    )}
                  >
                    {s.speaker === "you" ? "You" : "Remote"}
                  </span>
                  <p className="text-[13px] text-surface-900 leading-relaxed flex-1">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extracted action items */}
        {visibleItems.length > 0 && (
          <div className="rounded-xl border border-brass-400/30 bg-brass-500/5 overflow-hidden">
            <div className="px-4 py-2 border-b border-brass-400/20 flex items-center gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-brass-500" />
              <span className="text-[11px] uppercase tracking-wide-caps text-brass-600">
                Detected tasks &amp; deadlines
              </span>
            </div>
            <ul className="divide-y divide-surface-300/30">
              {visibleItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wider mt-1 shrink-0 px-1.5 py-0.5 rounded bg-surface-200 text-surface-700">
                    {item.kind}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-surface-900 leading-snug">{item.text}</p>
                    {item.due_date && (
                      <p className="text-[11px] text-brass-600 font-medium mt-0.5">Due {item.due_date}</p>
                    )}
                  </div>
                  <button
                    onClick={() => copyItem(item)}
                    title="Copy"
                    className="p-1 text-surface-500 hover:text-surface-900 transition-colors shrink-0"
                  >
                    {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setDismissedItems((d) => [...d, item.id])}
                    title="Dismiss"
                    className="p-1 text-surface-500 hover:text-red-500 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Idle empty state */}
        {supported && consentGiven && !active && segments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Headphones className="w-10 h-10 text-surface-400 mb-4" />
            <p className="text-sm font-medium text-surface-700 mb-1">No meeting in progress</p>
            <p className="text-xs text-surface-600 max-w-sm">
              Start capture before your call. Your microphone is labelled "You" and the
              other side "Remote". The transcript is saved to History and scanned for
              tasks and deadlines — all on this device.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
