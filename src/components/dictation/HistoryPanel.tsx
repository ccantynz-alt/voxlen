import { useState, useEffect } from "react";
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
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDuration } from "@/lib/utils";
import { useHistoryStore, loadHistory } from "@/stores/history";
import { useSettingsStore } from "@/stores/settings";

export function HistoryPanel() {
  const saveTranscripts = useSettingsStore((s) => s.saveTranscripts);
  const entries = useHistoryStore((s) => s.entries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clearAll = useHistoryStore((s) => s.clearAll);

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredEntries = entries.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = async (entry: (typeof entries)[0]) => {
    await navigator.clipboard.writeText(entry.text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportTxt = (entry: (typeof entries)[0]) => {
    const blob = new Blob([entry.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${new Date(entry.timestamp).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full p-8 gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-200">
            <History className="h-5 w-5 text-surface-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-950">History</h2>
            <p className="text-xs text-surface-600">
              {entries.length} session{entries.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-xs text-surface-600">Clear all?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    clearAll();
                    setConfirmClear(false);
                  }}
                >
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
          <p className="text-xs text-amber-600">
            Transcript saving is disabled. Enable it in Settings &gt; Privacy to
            keep your history.
          </p>
        </div>
      )}

      <Input
        placeholder="Search transcripts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        icon={<Search className="h-4 w-4" />}
      />

      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-6 w-6 text-surface-500 mb-3" />
            <p className="text-sm font-medium text-surface-800">
              {searchQuery.trim()
                ? "No matching sessions."
                : "No sessions yet."}
            </p>
            <p className="text-xs text-surface-600 mt-1">
              {searchQuery.trim()
                ? "Try a different search term."
                : "Start dictating to build your history."}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
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
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportTxt(entry)}
                    className="h-7 px-2"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(entry.id)}
                    className="h-7 px-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <p
                className={`text-sm text-surface-900 leading-relaxed ${
                  expandedId === entry.id ? "" : "line-clamp-3"
                }`}
              >
                {entry.text}
              </p>

              {entry.text.length > 200 && (
                <button
                  onClick={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                  className="text-xs text-voxlen-500 hover:text-voxlen-400 mt-1 flex items-center gap-1"
                >
                  {expandedId === entry.id ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Show more
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center gap-3 mt-3 text-xs text-surface-500">
                <span>{entry.wordCount} words</span>
                <span>{formatDuration(entry.duration)}</span>
                <span className="uppercase">{entry.language}</span>
                {entry.grammarCorrected && (
                  <Badge variant="success" className="text-[10px]">
                    AI Polished
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
