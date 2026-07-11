import { useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { useClientsStore } from "@/stores/clients";
import { useDictationStore } from "@/stores/dictation";
import { useNavigationStore } from "@/stores/navigation";
import { formatBillableHours } from "@/lib/billing";
import { ACTIVITY_CODES } from "@/lib/utbms";
import { cn } from "@/lib/utils";

/**
 * Post-session billing review — shown when the last dictation session
 * auto-drafted a time entry. The attorney accepts, edits, or discards;
 * dismissing leaves the draft in the Clients panel queue.
 */
export function TimeEntryReviewBanner() {
  const lastDraftEntryId = useDictationStore((s) => s.lastDraftEntryId);
  const setLastDraftEntryId = useDictationStore((s) => s.setLastDraftEntryId);
  const entries = useClientsStore((s) => s.entries);
  const clients = useClientsStore((s) => s.clients);
  const updateEntry = useClientsStore((s) => s.updateEntry);
  const approveEntry = useClientsStore((s) => s.approveEntry);
  const deleteEntry = useClientsStore((s) => s.deleteEntry);

  const [editing, setEditing] = useState(false);

  const entry = entries.find((e) => e.id === lastDraftEntryId);
  if (!entry || entry.status !== "draft") return null;

  const client = clients.find((c) => c.id === entry.clientId);
  const rate = entry.rateAtTime ?? 0;
  const hours = rate > 0 ? entry.billableAmount / rate : entry.durationSeconds / 3600;
  const noRate = rate <= 0;

  const close = () => {
    setEditing(false);
    setLastDraftEntryId(null);
  };

  const handleClientChange = (clientId: string) => {
    // Re-derive amount when assignment changes the effective rate.
    const next = clients.find((c) => c.id === clientId);
    const nextRate = next && next.billableRate > 0 ? next.billableRate : rate;
    updateEntry(entry.id, {
      clientId,
      rateAtTime: nextRate,
      billableAmount: Math.round(hours * nextRate * 100) / 100,
    });
  };

  return (
    <div className="px-5 py-2.5 bg-marcoreid-950/60 border-b border-brass-500/20">
      <div className="flex items-center gap-2.5">
        <Clock className="h-3.5 w-3.5 text-brass-400 shrink-0" strokeWidth={1.75} />
        <p className="text-[11px] text-surface-200 font-medium truncate">
          <span className="text-brass-400 font-semibold">{formatBillableHours(hours)}h</span>
          {" drafted"}
          {client ? (
            <> for <span className="text-surface-50">{client.name}</span></>
          ) : (
            <span className="text-amber-400"> — unassigned</span>
          )}
          {entry.note && <span className="text-surface-400"> · {entry.note}</span>}
        </p>
        {noRate ? (
          <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold shrink-0">
            <AlertTriangle className="h-3 w-3" /> $0.00 — no rate set
          </span>
        ) : (
          <span className="text-[11px] font-mono text-brass-400 tabular-nums shrink-0">
            ${entry.billableAmount.toFixed(2)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <button
            onClick={() => { approveEntry(entry.id); close(); }}
            className="text-[10px] text-brass-400 hover:text-brass-200 font-semibold underline transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => setEditing((e) => !e)}
            className="text-[10px] text-surface-400 hover:text-surface-200 underline transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => { deleteEntry(entry.id); close(); }}
            className="text-[10px] text-surface-500 hover:text-red-400 underline transition-colors"
          >
            Discard
          </button>
          <button
            onClick={close}
            aria-label="Dismiss — keep as draft"
            title="Keep as draft (review later in Clients)"
            className="text-surface-500 hover:text-surface-300 text-[12px] leading-none transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 mt-2 pl-6">
          <select
            value={entry.clientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="text-[11px] bg-surface-100 border border-surface-300/60 rounded px-2 py-1 text-surface-800"
          >
            <option value="">Unassigned</option>
            {clients.filter((c) => !c.archived).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const nextHours = Math.max(0.1, Math.round((hours - 0.1) * 10) / 10);
                updateEntry(entry.id, {
                  durationSeconds: Math.round(nextHours * 3600),
                  billableAmount: Math.round(nextHours * rate * 100) / 100,
                });
              }}
              className="w-5 h-5 rounded bg-surface-100 border border-surface-300/60 text-surface-700 hover:text-surface-950 text-[12px] leading-none"
            >
              −
            </button>
            <span className="text-[11px] font-mono text-surface-800 tabular-nums w-10 text-center">
              {formatBillableHours(hours)}h
            </span>
            <button
              onClick={() => {
                const nextHours = Math.round((hours + 0.1) * 10) / 10;
                updateEntry(entry.id, {
                  durationSeconds: Math.round(nextHours * 3600),
                  billableAmount: Math.round(nextHours * rate * 100) / 100,
                });
              }}
              className="w-5 h-5 rounded bg-surface-100 border border-surface-300/60 text-surface-700 hover:text-surface-950 text-[12px] leading-none"
            >
              +
            </button>
          </div>
          <select
            value={entry.activityCode ?? ""}
            onChange={(e) => updateEntry(entry.id, { activityCode: e.target.value || undefined })}
            className="text-[11px] bg-surface-100 border border-surface-300/60 rounded px-2 py-1 text-surface-800 max-w-[220px]"
          >
            <option value="">No activity code</option>
            {ACTIVITY_CODES.map((a) => (
              <option key={a.code} value={a.code}>{a.code} — {a.label}</option>
            ))}
          </select>
          <input
            value={entry.note ?? ""}
            onChange={(e) => updateEntry(entry.id, { note: e.target.value })}
            placeholder="Narrative…"
            className="flex-1 min-w-[160px] text-[11px] bg-surface-100 border border-surface-300/60 rounded px-2 py-1 text-surface-800 placeholder:text-surface-500"
          />
          {noRate && (
            <button
              onClick={() => useNavigationStore.getState().requestView("clients")}
              className={cn("text-[10px] text-red-400 hover:text-red-300 underline shrink-0")}
            >
              Set a rate in Clients
            </button>
          )}
        </div>
      )}
    </div>
  );
}
