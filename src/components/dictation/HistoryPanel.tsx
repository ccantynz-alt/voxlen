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
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-200">
            <History className="h-5 w-5 text-surface-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-surface-950">
              Session History
            </h2>
            <p className="text-xs text-surface-600">
              {loading ? "Loading..." : `${sessions.length} session${sessions.length === 1 ? "" : "s"} recorded`}
            </p>
          </div>
        </div>
        {sessions.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-xs text-surface-600">Clear all sessions?</span>
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
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {!saveTranscripts && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <p className="text-xs text-amber-300">
            Transcript saving is disabled. Enable it in Settings &gt; Privacy to keep your history.
          </p>
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Search transcripts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        icon={<Search className="h-4 w-4" />}
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-400">
            <p className="font-medium">Unable to load history</p>
            <p className="text-surface-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* History list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="animate-pulse text-sm text-surface-600">Loading history...</div>
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-10 w-10 text-surface-500 mb-3" />
            <p className="text-sm text-surface-700">
              {searchQuery.trim() ? "No matching sessions" : "No sessions yet"}
            </p>
            <p className="text-xs text-surface-600 mt-1">
              {searchQuery.trim()
                ? "Try a different search term"
                : "Start dictating to build your history"}
            </p>
          </div>
        ) : (
          sortedSessions.map((session) => {
            const expanded = expandedId === session.id;
            const preview = getPreview(session);
            return (
              <div
                key={session.id}
                className="group rounded-xl bg-surface-100 border border-surface-300/50 hover:border-surface-400/50 transition-colors"
              >
                <button
                  onClick={() =>
                    setExpandedId(expanded ? null : session.id)
                  }
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs text-surface-600">
                      {expanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <Clock className="h-3 w-3" />
                      {session.startedAt.toLocaleDateString()} at{" "}
                      {session.startedAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
                          <Check className="h-3 w-3 text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "txt")}
                        className="h-7 px-2"
                        title="Export as .txt"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(session)}
                        className="h-7 px-2"
                        title="Delete session"
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-surface-900 leading-relaxed line-clamp-2">
                    {preview}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-surface-600">
                      {formatDuration(session.durationMs)}
                    </span>
                    <span className="text-[10px] text-surface-600">
                      {session.wordCount} words
                    </span>
                    {session.language && (
                      <span className="text-[10px] text-surface-600 uppercase">
                        {session.language}
                      </span>
                    )}
                    {session.segments.some((s) => s.grammarApplied) && (
                      <Badge variant="info" className="text-[10px] py-0">
                        Polished
                      </Badge>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-surface-300/30 pt-3 space-y-2">
                    {session.segments.length === 0 ? (
                      <p className="text-xs text-surface-600">No segments in this session.</p>
                    ) : (
                      session.segments.map((seg) => (
                        <div
                          key={seg.id}
                          className="text-xs text-surface-900 p-2 rounded-md bg-surface-200/50"
                        >
                          <div className="flex items-center gap-2 mb-1 text-[10px] text-surface-600">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(seg.timestampMs).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                            {seg.grammarApplied && (
                              <Badge variant="info" className="text-[9px] py-0">
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
                        <Download className="h-3 w-3" />
                        .txt
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "md")}
                      >
                        <Download className="h-3 w-3" />
                        .md
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "json")}
                      >
                        <Download className="h-3 w-3" />
                        .json
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExport(session, "srt")}
                      >
                        <Download className="h-3 w-3" />
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
