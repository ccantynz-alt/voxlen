import { useState, useEffect } from "react";
import {
  History,
  Clock,
  Copy,
  Check,
  Search,
  Calendar,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDuration } from "@/lib/utils";
import { useHistoryStore, loadHistory } from "@/stores/history";

export function HistoryPanel() {
  const saveTranscripts = useSettingsStore((s) => s.saveTranscripts);
  const [searchQuery, setSearchQuery] = useState("");
  const entries = useHistoryStore((s) => s.entries);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  // Load persisted history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory = entries.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = async (entry: typeof entries[0]) => {
    await navigator.clipboard.writeText(entry.text);
    setCopiedId(entry.id);
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
            <p className="text-xs text-surface-600">
              {entries.length} sessions recorded
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
          filteredHistory.map((entry) => (
            <div
              key={entry.id}
              className="group p-4 rounded-xl bg-surface-100 border border-surface-300/50 hover:border-surface-400/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 text-xs text-surface-600">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.timestamp).toLocaleDateString()} at{" "}
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(entry)}
                    className="h-7 px-2"
                  >
                    {copiedId === entry.id ? (
                      <Check className="h-3 w-3 text-green-400" />
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
