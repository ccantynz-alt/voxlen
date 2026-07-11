import { useMemo } from "react";
import {
  BarChart3,
  Clock,
  FileText,
  Zap,
  TrendingUp,
  CheckCircle2,
  XCircle,
  BookOpen,
  DollarSign,
  Activity,
} from "lucide-react";
import { useFlywheelStore } from "@/stores/flywheel";
import { useClientsStore } from "@/stores/clients";
import { cn } from "@/lib/utils";

export function AnalyticsPanel() {
  const metrics = useFlywheelStore((s) => s.metrics);
  const vocabulary = useFlywheelStore((s) => s.vocabulary);
  const corrections = useFlywheelStore((s) => s.corrections);
  const allEntries = useClientsStore((s) => s.entries);
  const clients = useClientsStore((s) => s.clients);

  // Approved entries only — drafts are still pending attorney review.
  const timeEntries = useMemo(
    () => allEntries.filter((e) => e.status === "approved"),
    [allEntries]
  );
  const totalHours = useMemo(
    () => timeEntries.reduce((s, e) => s + (e.durationSeconds || 0) / 3600, 0),
    [timeEntries]
  );
  const totalBillable = useMemo(
    () => timeEntries.reduce((s, e) => s + (e.billableAmount || 0), 0),
    [timeEntries]
  );

  const acceptanceRate = useMemo(() => {
    const total = metrics.correctionsApplied + metrics.correctionsRejected;
    return total > 0 ? Math.round((metrics.correctionsApplied / total) * 100) : null;
  }, [metrics]);

  // Last 14 days of session activity
  const sessionChart = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days.push({
        date: key,
        label: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 1),
        count: metrics.sessionsPerDay[key] ?? 0,
      });
    }
    return days;
  }, [metrics.sessionsPerDay]);

  const maxSessions = useMemo(
    () => Math.max(1, ...sessionChart.map((d) => d.count)),
    [sessionChart]
  );

  const totalSessionDays = sessionChart.filter((d) => d.count > 0).length;

  const avgWPM = metrics.avgWordsPerMinute > 0
    ? Math.round(metrics.avgWordsPerMinute)
    : null;

  const totalHoursDict = metrics.totalDuration > 0
    ? (metrics.totalDuration / 3600).toFixed(1)
    : "0";

  return (
    <div className="flex flex-col h-full p-8 gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-200">
          <BarChart3 className="h-5 w-5 text-surface-700" />
        </div>
        <div>
          <h2 className="font-display text-[18px] font-medium tracking-tight-display text-surface-950 leading-tight">
            Analytics
          </h2>
          <p className="text-[11px] text-surface-600">All data stays on your device — never shared.</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<FileText className="h-4 w-4" />}
          label="Total Words"
          value={metrics.totalWords.toLocaleString()}
          sub={`${metrics.totalSessions} sessions`}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Dictation Time"
          value={`${totalHoursDict}h`}
          sub={avgWPM ? `~${avgWPM} WPM avg` : "No sessions yet"}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Grammar Acceptance"
          value={acceptanceRate !== null ? `${acceptanceRate}%` : "—"}
          sub={`${metrics.correctionsApplied} applied`}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4 text-brass-400" />}
          label="Billable Logged"
          value={totalBillable > 0 ? `$${totalBillable.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
          sub={`${totalHours.toFixed(1)}h across ${timeEntries.length} entries`}
        />
      </div>

      {/* Activity chart + vocab stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Session activity (last 14 days) */}
        <div className="lg:col-span-2 rounded-xl border border-surface-300/50 bg-surface-50/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-surface-600" />
              <span className="text-sm font-medium text-surface-900 tracking-tight">Session activity</span>
            </div>
            <span className="text-[11px] text-surface-600">{totalSessionDays} active days in last 14</span>
          </div>

          {metrics.totalSessions === 0 ? (
            <div className="flex items-center justify-center h-24 text-[12px] text-surface-500">
              No sessions recorded yet
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-24">
              {sessionChart.map((day) => (
                <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={cn(
                      "w-full rounded-sm transition-all",
                      day.count > 0 ? "bg-marcoreid-700/70" : "bg-surface-200/60"
                    )}
                    style={{
                      height: day.count > 0
                        ? `${Math.max(6, Math.round((day.count / maxSessions) * 72))}px`
                        : "4px",
                    }}
                    title={`${day.date}: ${day.count} session${day.count !== 1 ? "s" : ""}`}
                  />
                  <span className="text-[9px] text-surface-500 font-mono">{day.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vocabulary + corrections */}
        <div className="flex flex-col gap-3">
          <StatCard
            icon={<BookOpen className="h-4 w-4 text-surface-600" />}
            label="Vocabulary"
            value={vocabulary.length}
            sub={`${vocabulary.filter((v) => v.source === "manual").length} manual · ${vocabulary.filter((v) => v.source !== "manual").length} auto`}
          />
          <StatCard
            icon={<Zap className="h-4 w-4 text-brass-400" />}
            label="Correction patterns"
            value={corrections.length}
            sub={corrections.length > 0 ? `Top: "${corrections.sort((a, b) => b.occurrences - a.occurrences)[0]?.original}"` : "None yet"}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            label="Streak"
            value={`${computeStreak(metrics.sessionsPerDay)}d`}
            sub="consecutive active days"
          />
        </div>
      </div>

      {/* Grammar breakdown */}
      {(metrics.correctionsApplied + metrics.correctionsRejected) > 0 && (
        <div className="rounded-xl border border-surface-300/50 bg-surface-50/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-surface-600" />
            <span className="text-sm font-medium text-surface-900 tracking-tight">Grammar correction breakdown</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-surface-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/70 transition-all"
                style={{ width: `${acceptanceRate ?? 0}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-[11px] shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                {metrics.correctionsApplied} accepted
              </span>
              <span className="flex items-center gap-1.5 text-surface-500">
                <XCircle className="h-3 w-3" />
                {metrics.correctionsRejected} rejected
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top corrections table */}
      {corrections.length > 0 && (
        <div className="rounded-xl border border-surface-300/50 bg-surface-50/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-surface-600" />
            <span className="text-sm font-medium text-surface-900 tracking-tight">Most common corrections</span>
          </div>
          <div className="space-y-2">
            {[...corrections]
              .sort((a, b) => b.occurrences - a.occurrences)
              .slice(0, 5)
              .map((c) => (
                <div key={c.original + c.corrected} className="flex items-center gap-3 text-[12px]">
                  <span className="text-surface-500 line-through font-mono min-w-[120px] truncate">{c.original}</span>
                  <span className="text-surface-400">→</span>
                  <span className="text-surface-900 font-mono flex-1 truncate">{c.corrected}</span>
                  <span className="text-[10px] text-surface-500 shrink-0">{c.occurrences}×</span>
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full shrink-0",
                      c.category === "grammar" && "bg-blue-500/10 text-blue-600",
                      c.category === "spelling" && "bg-red-500/10 text-red-600",
                      c.category === "punctuation" && "bg-amber-500/10 text-amber-600",
                      c.category === "style" && "bg-purple-500/10 text-purple-600"
                    )}
                  >
                    {c.category}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent billable time */}
      {timeEntries.length > 0 && (
        <div className="rounded-xl border border-surface-300/50 bg-surface-50/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-surface-600" />
              <span className="text-sm font-medium text-surface-900 tracking-tight">Recent billable time</span>
            </div>
            <span className="text-[11px] text-surface-600 font-mono">
              Total: ${totalBillable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="space-y-2">
            {[...timeEntries]
              .sort((a, b) => b.date - a.date)
              .slice(0, 6)
              .map((e) => {
                const clientName =
                  clients.find((c) => c.id === e.clientId)?.name ||
                  e.matterLabel ||
                  "Unassigned";
                return (
                  <div key={e.id} className="flex items-center gap-3 text-[12px]">
                    <span className="text-surface-900 font-medium flex-1 truncate">{clientName}</span>
                    <span className="text-surface-600 shrink-0">{Math.round(e.durationSeconds / 60)}min</span>
                    <span className="text-brass-500 font-mono shrink-0">${e.billableAmount.toFixed(2)}</span>
                    <span className="text-[10px] text-surface-500 shrink-0">
                      {new Date(e.date).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {metrics.totalSessions === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <BarChart3 className="h-10 w-10 text-surface-400 mb-4" />
          <h3 className="font-display text-[15px] text-surface-800 tracking-tight-display mb-2">
            No data yet
          </h3>
          <p className="text-[12px] text-surface-600 max-w-xs">
            Start dictating to see your session analytics, grammar stats, and billable time here.
          </p>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-surface-300/50 bg-surface-50/50 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-surface-600">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-medium">{label}</span>
      </div>
      <div className="font-display text-[28px] font-semibold tracking-tight text-surface-950 leading-none">
        {value}
      </div>
      <div className="text-[11px] text-surface-500">{sub}</div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-surface-300/50 bg-surface-50/50 p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-surface-500 mb-0.5">{label}</div>
        <div className="font-semibold text-surface-950 text-sm">{value}</div>
        <div className="text-[10px] text-surface-500 truncate">{sub}</div>
      </div>
    </div>
  );
}

function computeStreak(sessionsPerDay: Record<string, number>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if ((sessionsPerDay[key] ?? 0) > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
