import { useMemo, useState } from "react";
import {
  Brain,
  BookOpen,
  Wand2,
  Trash2,
  Plus,
  BarChart3,
  ShieldCheck,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useFlywheelStore } from "@/stores/flywheel";
import { formatDuration } from "@/lib/utils";

type Tab = "vocabulary" | "corrections" | "metrics";

export function FlywheelPanel() {
  const [tab, setTab] = useState<Tab>("vocabulary");
  const [query, setQuery] = useState("");
  const [newWord, setNewWord] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const vocabulary = useFlywheelStore((s) => s.vocabulary);
  const corrections = useFlywheelStore((s) => s.corrections);
  const metrics = useFlywheelStore((s) => s.metrics);
  const addVocabulary = useFlywheelStore((s) => s.addVocabulary);
  const removeVocabulary = useFlywheelStore((s) => s.removeVocabulary);
  const clearAll = useFlywheelStore((s) => s.clearAll);

  const filteredVocab = useMemo(() => {
    const q = query.toLowerCase().trim();
    const sorted = [...vocabulary].sort((a, b) => b.frequency - a.frequency);
    return q ? sorted.filter((v) => v.word.toLowerCase().includes(q)) : sorted;
  }, [vocabulary, query]);

  const filteredCorrections = useMemo(() => {
    const q = query.toLowerCase().trim();
    const sorted = [...corrections].sort((a, b) => b.occurrences - a.occurrences);
    return q
      ? sorted.filter(
          (c) =>
            c.original.toLowerCase().includes(q) ||
            c.corrected.toLowerCase().includes(q)
        )
      : sorted;
  }, [corrections, query]);

  const handleAdd = () => {
    const word = newWord.trim();
    if (!word) return;
    addVocabulary(word, "manual");
    setNewWord("");
  };

  const totalAcceptance =
    metrics.correctionsApplied + metrics.correctionsRejected;
  const acceptanceRate =
    totalAcceptance > 0
      ? Math.round((metrics.correctionsApplied / totalAcceptance) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full p-8 gap-5 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-200">
            <Brain className="h-5 w-5 text-surface-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-950">Flywheel</h2>
            <p className="text-xs text-surface-600">
              Local-only learning · nothing leaves your device
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            <ShieldCheck className="h-2.5 w-2.5" /> On-device
          </Badge>
          {(vocabulary.length > 0 ||
            corrections.length > 0 ||
            metrics.totalSessions > 0) && (
            <>
              {confirmClear ? (
                <>
                  <span className="text-xs text-surface-600">Reset all?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      clearAll();
                      setConfirmClear(false);
                    }}
                  >
                    Reset
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
                  <Trash2 className="h-3.5 w-3.5" /> Reset
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-surface-300/50">
        <TabButton
          active={tab === "vocabulary"}
          onClick={() => setTab("vocabulary")}
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Vocabulary"
          count={vocabulary.length}
        />
        <TabButton
          active={tab === "corrections"}
          onClick={() => setTab("corrections")}
          icon={<Wand2 className="h-3.5 w-3.5" />}
          label="Corrections"
          count={corrections.length}
        />
        <TabButton
          active={tab === "metrics"}
          onClick={() => setTab("metrics")}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="Metrics"
        />
      </div>

      {tab !== "metrics" && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              icon={<Search className="h-4 w-4" />}
              placeholder={
                tab === "vocabulary"
                  ? "Search vocabulary..."
                  : "Search correction patterns..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {tab === "vocabulary" && (
            <div className="flex items-center gap-2 w-[320px]">
              <Input
                placeholder="Add a word..."
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={handleAdd}
                disabled={!newWord.trim()}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-surface-300/50 bg-surface-50/50">
        {tab === "vocabulary" && (
          <VocabularyList
            entries={filteredVocab}
            onRemove={removeVocabulary}
          />
        )}
        {tab === "corrections" && (
          <CorrectionsList entries={filteredCorrections} />
        )}
        {tab === "metrics" && (
          <MetricsView
            metrics={metrics}
            acceptanceRate={acceptanceRate}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors " +
        (active
          ? "text-surface-950"
          : "text-surface-600 hover:text-surface-900")
      }
    >
      {icon}
      {label}
      {typeof count === "number" && (
        <span className="text-[10px] text-surface-600">{count}</span>
      )}
      {active && (
        <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-brass-400 rounded-full" />
      )}
    </button>
  );
}

function VocabularyList({
  entries,
  onRemove,
}: {
  entries: ReturnType<typeof useFlywheelStore.getState>["vocabulary"];
  onRemove: (word: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-6 w-6" />}
        title="No vocabulary yet"
        description="Terms you dictate often get added automatically. You can also add words manually so the AI never flags them."
      />
    );
  }

  return (
    <ul className="divide-y divide-surface-300/40">
      {entries.map((entry) => (
        <li
          key={entry.word + entry.addedAt}
          className="flex items-center justify-between px-4 py-2.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm text-surface-900 font-medium truncate">
              {entry.word}
            </span>
            <Badge variant={entry.source === "manual" ? "info" : "default"}>
              {entry.source === "manual" ? "Manual" : "Auto"}
            </Badge>
            <span className="text-[11px] text-surface-600">
              {entry.frequency}×
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(entry.word)}
            className="text-surface-600 hover:text-red-500 transition-colors p-1"
            aria-label={"Remove " + entry.word}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function CorrectionsList({
  entries,
}: {
  entries: ReturnType<typeof useFlywheelStore.getState>["corrections"];
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Wand2 className="h-6 w-6" />}
        title="No correction patterns yet"
        description="As you accept grammar corrections, the most common edits appear here. Over time they can be pre-applied locally to cut API latency."
      />
    );
  }

  return (
    <ul className="divide-y divide-surface-300/40">
      {entries.map((entry, idx) => (
        <li key={idx} className="px-4 py-2.5 flex items-center gap-4">
          <div className="flex-1 min-w-0 text-sm flex items-center gap-3">
            <span className="text-surface-600 line-through truncate">
              {entry.original}
            </span>
            <span className="text-surface-400">→</span>
            <span className="text-surface-950 font-medium truncate">
              {entry.corrected}
            </span>
          </div>
          <Badge variant="default">{entry.category}</Badge>
          <span className="text-[11px] text-surface-600 w-10 text-right">
            {entry.occurrences}×
          </span>
        </li>
      ))}
    </ul>
  );
}

function MetricsView({
  metrics,
  acceptanceRate,
}: {
  metrics: ReturnType<typeof useFlywheelStore.getState>["metrics"];
  acceptanceRate: number;
}) {
  const last14 = useMemo(() => {
    const out: { day: string; count: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, count: metrics.sessionsPerDay[key] || 0 });
    }
    return out;
  }, [metrics.sessionsPerDay]);

  const max = Math.max(1, ...last14.map((d) => d.count));

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
      <MetricCard
        label="Sessions"
        value={metrics.totalSessions.toLocaleString()}
      />
      <MetricCard
        label="Words dictated"
        value={metrics.totalWords.toLocaleString()}
      />
      <MetricCard
        label="Total time"
        value={formatDuration(metrics.totalDuration * 1000)}
      />
      <MetricCard
        label="Avg WPM"
        value={metrics.avgWordsPerMinute.toString()}
      />
      <MetricCard
        label="Preferred engine"
        value={metrics.mostUsedEngine || "—"}
      />
      <MetricCard
        label="Correction acceptance"
        value={acceptanceRate + "%"}
        sub={
          metrics.correctionsApplied +
          " accepted · " +
          metrics.correctionsRejected +
          " rejected"
        }
      />
      <div className="md:col-span-2 rounded-lg border border-surface-300/50 bg-surface-100/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] uppercase tracking-wide-caps text-surface-600">
            Last 14 days
          </span>
          <span className="text-[11px] text-surface-600">
            {last14.reduce((s, d) => s + d.count, 0)} sessions
          </span>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {last14.map((d) => {
            const h = (d.count / max) * 100;
            return (
              <div
                key={d.day}
                className="flex-1 flex flex-col items-center gap-1"
                title={d.day + ": " + d.count}
              >
                <div
                  className="w-full rounded-sm bg-gradient-to-t from-marcoreid-700 to-brass-400/70 min-h-[2px]"
                  style={{ height: h + "%" }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-300/50 bg-surface-100/40 p-4">
      <div className="text-[11px] uppercase tracking-wide-caps text-surface-600">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-surface-950 tracking-tight">
        {value}
      </div>
      {sub && <div className="text-[11px] text-surface-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-10 text-surface-600">
      <div className="w-12 h-12 rounded-xl bg-surface-200 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium text-surface-900">{title}</div>
      <p className="text-xs mt-1 max-w-md">{description}</p>
    </div>
  );
}
