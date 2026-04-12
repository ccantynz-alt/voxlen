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
import { useHistoryStore, type HistoryEntry } from "@/stores/history";
import { useSettingsStore } from "@/stores/settings";

export function HistoryPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const entries = useHistoryStore((s) => s.entries);
  const isLoaded = useHistoryStore((s) => s.isLoaded);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clearAll = useHistoryStore((s) => s.clearAll);
  const saveTranscripts = useSettingsStore((s) => s.saveTranscripts);

  // Load history on mount if not already loaded
  useEffect(() => {
    if (!isLoaded) {
      useHistoryStore.getState().loadFromStore();
    }
  }, [isLoaded]);

  const filteredHistory = entries.filter((entry) =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopy = async (entry: HistoryEntry) => {
    await navigator.clipboard.writeText(entry.text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
              {entries.length} session{entries.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>
        {entries.length > 0 && (
          <Button variant="danger" size="sm" onClick={clearAll}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </Button>
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

      {/* History list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {!isLoaded ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="animate-pulse text-surface-600 text-sm">
              Loading history...
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-10 w-10 text-surface-500 mb-3" />
            <p className="text-sm text-surface-700">
              {searchQuery ? "No matching sessions" : "No sessions yet"}
            </p>
            <p className="text-xs text-surface-600 mt-1">
              {searchQuery
                ? "Try a different search term"
                : "Start dictating to build your history"}
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
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEntry(entry.id)}
                    className="h-7 px-2"
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-surface-900 leading-relaxed line-clamp-2">
                {entry.text}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-surface-600">
                  {formatDuration(entry.duration)}
                </span>
                <span className="text-[10px] text-surface-600">
                  {entry.wordCount} words
                </span>
                {entry.grammarCorrected && (
                  <Badge variant="info" className="text-[10px] py-0">
                    Polished
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
