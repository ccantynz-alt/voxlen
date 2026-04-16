import { useMemo, useState } from "react";
import { BookOpen, Sparkles, Trash2, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useFlywheelStore } from "@/stores/flywheel";

/**
 * Flywheel settings panel.
 *
 * The flywheel captures local, privacy-safe learning signal — vocabulary
 * the user uses, correction patterns the grammar AI applies, and session
 * metrics — and stores it entirely on-device. This panel is the user's
 * window into that data so they can audit, curate, or wipe it.
 *
 * No network calls. No telemetry. Just transparency.
 */
export function FlywheelSettings() {
  const vocabulary = useFlywheelStore((s) => s.vocabulary);
  const corrections = useFlywheelStore((s) => s.corrections);
  const metrics = useFlywheelStore((s) => s.metrics);
  const removeVocabulary = useFlywheelStore((s) => s.removeVocabulary);
  const getTopCorrectionPatterns = useFlywheelStore((s) => s.getTopCorrectionPatterns);
  const clearAll = useFlywheelStore((s) => s.clearAll);

  const [query, setQuery] = useState("");

  const filteredVocab = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...vocabulary].sort((a, b) => b.frequency - a.frequency);
    if (!q) return sorted.slice(0, 200);
    return sorted.filter((v) => v.word.toLowerCase().includes(q)).slice(0, 200);
  }, [vocabulary, query]);

  const topCorrections = useMemo(
    () => getTopCorrectionPatterns(10),
    [corrections, getTopCorrectionPatterns], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleClearAll = () => {
    if (!confirm("Erase all on-device learning data? Vocabulary, correction patterns, and metrics will be wiped.")) {
      return;
    }
    clearAll();
  };

  const wpm = metrics.avgWordsPerMinute || 0;
  const hours = Math.round((metrics.totalDuration / 3600) * 10) / 10;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-surface-950 mb-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brass-500" />
          Learning
        </h2>
        <p className="text-sm text-surface-700">
          Marco Reid Voice learns your vocabulary and correction patterns locally to get better
          over time. Nothing leaves your device — audit or wipe anything below.
        </p>
      </div>

      {/* Metrics tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <MetricTile label="Sessions" value={metrics.totalSessions.toLocaleString()} />
        <MetricTile label="Words" value={metrics.totalWords.toLocaleString()} />
        <MetricTile label="Hours" value={hours.toLocaleString()} />
        <MetricTile label="Words / min" value={wpm.toLocaleString()} />
      </div>

      {/* Correction patterns */}
      <section className="mb-8">
        <header className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-brass-500" />
          <h3 className="text-sm font-semibold text-surface-950 tracking-tight">
            Top correction patterns
          </h3>
        </header>
        {topCorrections.length === 0 ? (
          <EmptyState>Dictate a few sessions and accept AI corrections — patterns will appear here.</EmptyState>
        ) : (
          <div className="rounded-md border border-surface-300/60 overflow-hidden">
            {topCorrections.map((c, i) => (
              <div
                key={`${c.original}-${c.corrected}-${i}`}
                className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/30 last:border-0 bg-surface-50/40"
              >
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-[12px] text-red-700 line-through truncate">
                    {c.original}
                  </span>
                  <span className="text-surface-500">→</span>
                  <span className="font-mono text-[12px] text-green-700 truncate">
                    {c.corrected}
                  </span>
                  <span className="label-caps">{c.category}</span>
                </div>
                <span className="text-[11px] text-surface-600 font-mono tabular-nums shrink-0">
                  ×{c.occurrences}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Vocabulary */}
      <section className="mb-8">
        <header className="flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brass-500" />
            <h3 className="text-sm font-semibold text-surface-950 tracking-tight">
              Learned vocabulary
            </h3>
            <span className="text-[11px] text-surface-600 font-mono">
              {vocabulary.length.toLocaleString()} terms
            </span>
          </div>
          <Input
            type="text"
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-[200px] text-xs"
          />
        </header>
        {filteredVocab.length === 0 ? (
          <EmptyState>
            {vocabulary.length === 0
              ? "No vocabulary captured yet. Terms you dictate repeatedly will show up here."
              : "No matches."}
          </EmptyState>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filteredVocab.map((v) => (
              <span
                key={v.word}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-surface-300/60 bg-surface-50/60 text-[11px] text-surface-800"
                title={`Seen ${v.frequency} time${v.frequency === 1 ? "" : "s"} · ${v.source}`}
              >
                {v.word}
                <span className="font-mono text-[10px] text-surface-500 tabular-nums">
                  ×{v.frequency}
                </span>
                <button
                  type="button"
                  onClick={() => removeVocabulary(v.word)}
                  className="ml-0.5 p-0.5 rounded-full text-surface-500 hover:text-red-700 hover:bg-red-100 transition-colors"
                  aria-label={`Remove ${v.word}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="pt-4 border-t border-surface-300/50">
        <h3 className="text-sm font-semibold text-surface-950 tracking-tight mb-2">
          Reset learning data
        </h3>
        <p className="text-xs text-surface-700 mb-3 max-w-md">
          Wipes vocabulary, correction patterns, and usage metrics from this device. Your
          dictation history and settings are unaffected.
        </p>
        <Button variant="danger" size="sm" onClick={handleClearAll}>
          <Trash2 className="h-3.5 w-3.5" />
          Clear learning data
        </Button>
      </section>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-surface-300/60 bg-surface-50/60 px-4 py-3">
      <div className="label-caps">{label}</div>
      <div className="font-display text-[22px] text-surface-950 font-medium tabular-nums mt-0.5">
        {value}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-surface-300/60 px-4 py-6 text-center text-[12px] text-surface-600">
      {children}
    </div>
  );
}
