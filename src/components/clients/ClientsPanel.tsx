import { useState } from "react";
import { Plus, Briefcase, Archive, Trash2, Edit2, Check, X, Download } from "lucide-react";
import { useClientsStore, type Client } from "../../stores/clients";
import { useSettingsStore } from "../../stores/settings";
import { exportBillingCsv, exportAllBillingCsv, downloadBillingExport } from "../../lib/export";

const CLIENT_COLORS = [
  "#7345d1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
];

function AddClientModal({ onClose }: { onClose: () => void }) {
  const { addClient } = useClientsStore();
  const settings = useSettingsStore();
  const [name, setName] = useState("");
  const [matterNumber, setMatterNumber] = useState("");
  const [rate, setRate] = useState(settings.billableRatePerHour ?? 350);
  const [color, setColor] = useState(CLIENT_COLORS[0]);

  const submit = () => {
    if (!name.trim()) return;
    addClient({ name: name.trim(), matterNumber: matterNumber.trim() || undefined, billableRate: rate, color });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-bold mb-5">Add Client / Matter</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Client Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#7345d1]"
              placeholder="e.g. Acme Corp, Smith v Jones"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Matter / File Number</label>
            <input
              value={matterNumber}
              onChange={(e) => setMatterNumber(e.target.value)}
              className="w-full bg-[#09090b] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#7345d1]"
              placeholder="e.g. 2024-001, M-4821"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">
              Billable Rate ($/hr)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={2000}
                step={25}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="flex-1 accent-[#7345d1]"
              />
              <span className="text-sm font-semibold w-20 text-right">
                {rate === 0 ? "Use default" : `$${rate}/hr`}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {CLIENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1 bg-[#7345d1] hover:bg-[#5c35b0] disabled:opacity-40 text-white font-semibold text-sm py-2 rounded-lg transition-colors"
          >
            Add Client
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-white font-semibold text-sm py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: Client }) {
  const { updateClient, archiveClient, deleteClient, getClientEntries, getTotalBillable, getTotalHours } = useClientsStore();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(client.name);
  const [editMatter, setEditMatter] = useState(client.matterNumber ?? "");
  const [editRate, setEditRate] = useState(client.billableRate);

  const entries = getClientEntries(client.id);
  const totalBillable = getTotalBillable(client.id);
  const totalHours = getTotalHours(client.id);
  const recentEntries = [...entries].sort((a, b) => b.date - a.date).slice(0, 3);

  const saveEdit = () => {
    updateClient(client.id, {
      name: editName.trim() || client.name,
      matterNumber: editMatter.trim() || undefined,
      billableRate: editRate,
    });
    setEditing(false);
  };

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-[#27272a]">
        <div
          className="w-3 h-3 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: client.color }}
        />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#09090b] border border-[#3f3f46] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#7345d1]"
              />
              <input
                value={editMatter}
                onChange={(e) => setEditMatter(e.target.value)}
                placeholder="Matter number"
                className="w-full bg-[#09090b] border border-[#3f3f46] rounded px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#7345d1]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={25}
                  value={editRate}
                  onChange={(e) => setEditRate(Number(e.target.value))}
                  className="flex-1 accent-[#7345d1]"
                />
                <span className="text-xs w-16 text-right text-zinc-300">
                  {editRate === 0 ? "Default" : `$${editRate}/hr`}
                </span>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-sm text-white truncate">{client.name}</h3>
              {client.matterNumber && (
                <p className="text-xs text-zinc-500 mt-0.5">{client.matterNumber}</p>
              )}
              <p className="text-xs text-zinc-500 mt-0.5">
                {client.billableRate === 0 ? "Default rate" : `$${client.billableRate}/hr`}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={saveEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-zinc-500 hover:bg-zinc-800 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              {entries.length > 0 && (
                <button
                  onClick={async () => {
                    const { content, filename, mimeType } = exportBillingCsv(client, entries);
                    await downloadBillingExport(content, filename, mimeType);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
                  title="Export billing CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => archiveClient(client.id)} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded" title="Archive">
                <Archive className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteClient(client.id)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-[#27272a]">
        <div className="p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Sessions</p>
          <p className="text-lg font-bold text-white">{entries.length}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Hours</p>
          <p className="text-lg font-bold text-white">{totalHours.toFixed(1)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Billable</p>
          <p className="text-lg font-bold" style={{ color: client.color }}>
            ${totalBillable.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <div className="p-3 border-t border-[#27272a] space-y-1.5">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Recent Sessions</p>
          {recentEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                {new Date(entry.date).toLocaleDateString()} · {Math.round(entry.durationSeconds / 60)}m
                {entry.wordCount > 0 && ` · ${entry.wordCount} words`}
              </span>
              <span className="text-zinc-300 font-medium">${entry.billableAmount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientsPanel() {
  const { clients, activeClientId, setActiveClient, entries } = useClientsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const handleExportAll = async () => {
    const { content, filename, mimeType } = exportAllBillingCsv(clients, entries);
    await downloadBillingExport(content, filename, mimeType);
  };

  const active = clients.filter((c) => !c.archived);
  const archived = clients.filter((c) => c.archived);

  const totalBillable = useClientsStore((s) =>
    s.entries.reduce((sum, e) => sum + e.billableAmount, 0)
  );
  const totalHours = useClientsStore((s) =>
    s.entries.reduce((sum, e) => sum + e.durationSeconds, 0) / 3600
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">Clients & Matters</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {active.length} active · {totalHours.toFixed(1)} hrs · ${totalBillable.toFixed(0)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={handleExportAll}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white border border-[#3f3f46] hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
              title="Export all billing as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-xs font-medium bg-[#7345d1] hover:bg-[#5c35b0] text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Client
          </button>
        </div>
      </div>

      {/* Active client selector */}
      {active.length > 0 && (
        <div className="px-4 py-3 border-b border-[#27272a] shrink-0">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Active Client (for new dictations)</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveClient(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                activeClientId === null
                  ? "bg-[#27272a] border-[#3f3f46] text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              None
            </button>
            {active.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveClient(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  activeClientId === c.id
                    ? "border-transparent text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
                style={activeClientId === c.id ? { backgroundColor: c.color + "33", borderColor: c.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
                {c.matterNumber && (
                  <span className="text-zinc-500">#{c.matterNumber}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Client cards */}
      <div className="flex-1 overflow-y-auto p-4">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="w-10 h-10 text-zinc-700 mb-4" />
            <p className="text-sm font-medium text-zinc-400 mb-1">No clients yet</p>
            <p className="text-xs text-zinc-600 max-w-xs mb-4">
              Add a client or matter to track billable time and usage per file.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-xs font-medium bg-[#7345d1] hover:bg-[#5c35b0] text-white px-4 py-2 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Client
            </button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {active.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? "Hide" : "Show"} {archived.length} archived client{archived.length !== 1 ? "s" : ""}
            </button>
            {showArchived && (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mt-3 opacity-60">
                {archived.map((c) => (
                  <ClientCard key={c.id} client={c} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
