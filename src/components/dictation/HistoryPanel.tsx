import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  History,
  Clock,
  Copy,
  Check,
  Search,
  Calendar,
  Trash2,
  Download,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDuration } from "@/lib/utils";
import type { BackendSessionRecord } from "@/stores/dictation";
import type { TranscriptionSegment } from "@/stores/dictation";
import { downloadExport, type ExportFormat } from "@/lib/export";
import { useSettingsStore } from "@/stores/settings";

interface HistorySession {
  id: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  wordCount: number;
  language: string | null;
  segments: Array<{
    id: string;
    text: string;
    correctedText: string | null;
    confidence: number;
    language: string | null;
    timestampMs: number;
    grammarApplied: boolean;
  }>;
}

function fromBackend(record: BackendSessionRecord): HistorySession {
  return {
    id: record.id,
    startedAt: new Date(record.started_at_ms),
    endedAt: new Date(record.ended_at_ms),
    durationMs: record.duration_ms,
    wordCount: record.word_count,
    language: record.language,
    segments: record.segments.map((s) => ({
      id: s.id,
      text: s.text,
      correctedText: s.corrected_text,
      confidence: s.confidence,
      language: s.language,
      timestampMs: s.timestamp_ms,
      grammarApplied: s.grammar_applied,
    })),
  };
}

function getPreview(session: HistorySession): string {
  if (session.segments.length === 0) return "(empty session)";
  const first = session.segments[0];
  return (first.correctedText || first.text).split("\n")[0];
}

function sessionToSegments(session: HistorySession): TranscriptionSegment[] {
  return session.segments.map((s) => ({
    id: s.id,
    text: s.text,
    correctedText: s.correctedText ?? undefined,
    timestamp: new Date(s.timestampMs),
    confidence: s.confidence,
    language: s.language ?? undefined,
    isFinal: true,
    grammarApplied: s.grammarApplied,
  }));
}

export function HistoryPanel() {
  const saveTranscripts = useSettingsStore((s) => s.saveTranscripts);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const records = await invoke<BackendSessionRecord[]>("get_history");
      setSessions(records.map(fromBackend));
    } catch (e) {
      // Non-Tauri or backend error — degrade gracefully.
      setSessions([]);
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (query: string) => {
    setError(null);
    if (!query.trim()) {
      fetchHistory();
      return;
    }
    setLoading(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const records = await invoke<BackendSessionRecord[]>("search_history", {
        query,
      });
      setSessions(records.map(fromBackend));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
    }, 250);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, runSearch]);

  const handleCopy = async (session: HistorySession) => {
    const text = session.segments.map((s) => s.correctedText || s.text).join(" ");
    await navigator.clipboard.writeText(text);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (session: HistorySession) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_session", { id: session.id });
    } catch {
      // Degrade: still remove locally.
    }
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
  };

  const handleClearAll = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_history");
    } catch {
      // Degrade: still clear locally.
    }
    setSessions([]);
    setConfirmClear(false);
  };

  const handleExport = async (session: HistorySession, format: ExportFormat) => {
    await downloadExport(sessionToSegments(session), format);
  };

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()),
    [sessions]
  );

  return (
    <div className="flex flex-col h-full p-8 gap-5">
      {/* Header — editorial, hairline separator. */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gradient-to-br from-marcoreid-700 to-marcoreid-900 shadow-elevation shadow-inset-hairline">
            <History className="h-4 w-4 text-brass-300" strokeWidth={2} />
          </div>
          <div>
            <h2 className="font-display text-[22px] font-medium tracking-tight-display text-surface-950 leading-tight">
              The <span className="italic text-brass-500">record</span>
            </h2>
            <p className="text-[11px] text-surface-600 mt-0.5 leading-snug">
              {loading ? "Loading…" : `${sessions.length} session${sessions.length === 1 ? "" : "s"} on file`}
            </p>
          </div>
        </div>
        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-[11px] italic text-surface-600 font-display">Clear all sessions?</span>
                <Button variant="danger" size="sm" onClick={handleClearAll}>
                  Yes, clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="divider-brass" />

      {!saveTranscripts && (
        <div className="rounded-md bg-amber-500/8 border border-amber-500/25 shadow-inset-hairline px-4 py-3">
          <p className="text-[11px] text-amber-600 leading-snug">
            Transcript saving is disabled. Enable it in <span className="italic">Settings &rsaquo; Privacy</span> to keep your history.
          </p>
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Search transcripts…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        icon={<Search className="h-4 w-4" strokeWidth={1.75} />}
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/8 border border-red-500/25 shadow-inset-hairline">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="text-[11px]">
            <p className="font-medium text-red-600">Unable to load history</p>
            <p className="text-surface-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* History list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="animate-pulse-soft text-[13px] italic text-surface-600 font-display">Loading history…</div>
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="divider-brass w-20 mb-4" />
            <Calendar className="h-6 w-6 text-brass-500/70 mb-3" strokeWidth={1.5} />
            <p className="font-display italic text-[14px] text-surface-800 tracking-tight-display">
              {searchQuery.trim() ? "No matching sessions." : "No sessions yet."}
            </p>
            <p className="text-[11px] text-surface-600 mt-1.5">
              {searchQuery.trim()
                ? "Try a different search term."
                : "Start dictating to build your record."}
            </p>
          </div>
        ) : (
          sortedSessions.map((session) => {
            const expanded = expandedId === session.id;
            const preview = getPreview(session);
            return (
              <div
                key={session.id}
                className="group rounded-md bg-surface-50 border border-surface-300/60 hover:border-surface-400/60 shadow-inset-hairline transition-colors"
              >
                <button
                  onClick={() =>
                    setExpandedId(expanded ? null : session.id)
                  }
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 text-[11px] text-surface-600 font-mono">
                      {expanded ? (
                        <ChevronDown className="h-3 w-3 text-brass-500/80" strokeWidth={1.75} />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-brass-500/80" strokeWidth={1.75} />
                      )}
                      <Clock className="h-3 w-3" strokeWidth={1.75} />
                      <span className="tabular-nums">
                        {session.startedAt.toLocaleDateString()} &middot;{" "}
                        {session.startedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(session)}
                        className="h-7 px-2"
                        title="Copy transcript"
                      >
                        {copiedId === session.id ? (
                          <Check className="h-3 w-3 text-brass-500" strokeWidth={2} />
                        ) : (
                          <Copy className="h-3 w-3" strokeWidth={1.75} />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "txt")}
                        className="h-7 px-2"
                        title="Export as .txt"
                      >
                        <Download className="h-3 w-3" strokeWidth={1.75} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(session)}
                        className="h-7 px-2"
                        title="Delete session"
                      >
                        <Trash2 className="h-3 w-3 text-red-500" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[13.5px] text-surface-900 leading-relaxed line-clamp-2 font-sans">
                    {preview}
                  </p>
                  <div className="flex items-center gap-3 mt-2.5 font-mono">
                    <span className="text-[10px] text-surface-600 tabular-nums">
                      {formatDuration(session.durationMs)}
                    </span>
                    <span className="text-surface-400">&middot;</span>
                    <span className="text-[10px] text-surface-600 tabular-nums">
                      {session.wordCount} words
                    </span>
                    {session.language && (
                      <>
                        <span className="text-surface-400">&middot;</span>
                        <span className="text-[10px] text-surface-600 uppercase tracking-wide-caps">
                          {session.language}
                        </span>
                      </>
                    )}
                    {session.segments.some((s) => s.grammarApplied) && (
                      <Badge variant="success" className="ml-1">
                        Polished
                      </Badge>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-surface-300/40 pt-3 space-y-2">
                    {session.segments.length === 0 ? (
                      <p className="text-[11px] italic text-surface-600 font-display">No segments in this session.</p>
                    ) : (
                      session.segments.map((seg) => (
                        <div
                          key={seg.id}
                          className="text-[12px] text-surface-900 p-3 rounded-md bg-surface-100/60 border border-surface-300/40"
                        >
                          <div className="flex items-center gap-2 mb-1.5 text-[10px] text-surface-600 font-mono">
                            <Clock className="h-2.5 w-2.5" strokeWidth={1.75} />
                            <span className="tabular-nums">
                              {new Date(seg.timestampMs).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            {seg.grammarApplied && (
                              <Badge variant="success" className="ml-1">
                                Polished
                              </Badge>
                            )}
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">
                            {seg.correctedText || seg.text}
                          </p>
                        </div>
                      ))
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "txt")}
                      >
                        <Download className="h-3 w-3" strokeWidth={1.75} />
                        .txt
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "md")}
                      >
                        <Download className="h-3 w-3" strokeWidth={1.75} />
                        .md
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "json")}
                      >
                        <Download className="h-3 w-3" strokeWidth={1.75} />
                        .json
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "srt")}
                      >
                        <Download className="h-3 w-3" strokeWidth={1.75} />
                        .srt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
