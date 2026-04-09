import { useState } from "react";
import {
  History,
  Clock,
  Copy,
  Check,
  Search,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatDuration } from "@/lib/utils";

interface HistoryEntry {
  id: string;
  text: string;
  duration: number;
  wordCount: number;
  language: string;
  timestamp: Date;
  grammarCorrected: boolean;
}

// Demo history data
const demoHistory: HistoryEntry[] = [
  {
    id: "1",
    text: "This is a sample dictation entry to show what the history view looks like. The AI-powered grammar engine has already polished this text.",
    duration: 45000,
    wordCount: 25,
    language: "en",
    timestamp: new Date(Date.now() - 3600000),
    grammarCorrected: true,
  },
  {
    id: "2",
    text: "Meeting notes: discussed the quarterly roadmap and upcoming product launches. Action items include finalizing the design specs by Friday.",
    duration: 120000,
    wordCount: 22,
    language: "en",
    timestamp: new Date(Date.now() - 86400000),
    grammarCorrected: true,
  },
];

export function HistoryPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [history] = useState<HistoryEntry[]>(demoHistory);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredHistory = history.filter((entry) =>
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
              {history.length} sessions recorded
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search transcripts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        icon={<Search className="h-4 w-4" />}
      />

      {/* History list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-10 w-10 text-surface-500 mb-3" />
            <p className="text-sm text-surface-700">No sessions found</p>
            <p className="text-xs text-surface-600 mt-1">
              Start dictating to build your history
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
                  {entry.timestamp.toLocaleDateString()} at{" "}
                  {entry.timestamp.toLocaleTimeString([], {
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
