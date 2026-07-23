import { useState, useRef } from "react";
import { Plus, Briefcase, Archive, Trash2, Edit2, Check, X, Download, BookOpen, Clock, AlertTriangle } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useClientsStore, type Client, type MatterEntry } from "../../stores/clients";
import { useSettingsStore } from "../../stores/settings";
import { exportBillingCsv, exportAllBillingCsv, downloadBillingExport } from "../../lib/export";
import { exportLedes1998B, exportClioCsv } from "../../lib/exportLedes";
import { formatBillableHours } from "../../lib/billing";
import { Button } from "../ui/Button";

const CLIENT_COLORS = [
  "#7345d1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899",
];

const INPUT_CLS = "w-full bg-surface-50 border border-surface-300/70 rounded-lg px-3 py-2 text-sm text-surface-900 placeholder-surface-500 focus:outline-none focus:border-brass-400 focus:ring-1 focus:ring-brass-400/30 shadow-inset-hairline transition-colors";

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
      <div className="bg-surface-50 border border-surface-300/60 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-bold text-surface-950 mb-5">Add Client / Matter</h2>

        <div className="space-y-4">
          <div>
            <label className="label-caps mb-1.5 block">Client Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className={INPUT_CLS}
              placeholder="e.g. Acme Corp, Smith v Jones"
            />
          </div>

          <div>
            <label className="label-caps mb-1.5 block">Matter / File Number</label>
            <input
              value={matterNumber}
              onChange={(e) => setMatterNumber(e.target.value)}
              className={INPUT_CLS}
              placeholder="e.g. 2024-001, M-4821"
            />
          </div>

          <div>
            <label className="label-caps mb-1.5 block">Billable Rate ($/hr)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={2000}
                step={25}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="flex-1 accent-brass-500"
              />
              <span className="text-sm font-semibold text-surface-900 w-20 text-right">
                {rate === 0 ? "Use default" : `$${rate}/hr`}
              </span>
            </div>
          </div>

          <div>
            <label className="label-caps mb-1.5 block">Colour</label>
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
          <Button
            variant="primary"
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1"
          >
            Add Client
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small dialog collecting invoice metadata for a LEDES export. */
function LedesExportModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const settings = useSettingsStore();
  const entries = useClientsStore((s) => s.entries).filter(
    (e) => e.clientId === client.id && e.status === "approved"
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
  );
  const [lawFirmId, setLawFirmId] = useState(settings.ledesLawFirmId);
  const [timekeeperId, setTimekeeperId] = useState(settings.ledesTimekeeperId);
  const [timekeeperName, setTimekeeperName] = useState(settings.ledesTimekeeperName);

  const doExport = async () => {
    // Remember firm/timekeeper details for next time.
    settings.updateSettings({
      ledesLawFirmId: lawFirmId,
      ledesTimekeeperId: timekeeperId,
      ledesTimekeeperName: timekeeperName,
    });
    const { content, filename, mimeType } = exportLedes1998B(client, entries, {
      invoiceNumber,
      invoiceDate: new Date(),
      lawFirmId,
      timekeeperId,
      timekeeperName,
      timekeeperClassification: settings.ledesClassification || "PT",
    });
    await downloadBillingExport(content, filename, mimeType, {
      name: "LEDES 1998B",
      extensions: ["txt", "ledes"],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-50 border border-surface-300/60 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-bold text-surface-950 mb-1">LEDES 1998B Export</h2>
        <p className="text-xs text-surface-600 mb-5">
          {entries.length} approved entr{entries.length === 1 ? "y" : "ies"} for {client.name}
        </p>
        <div className="space-y-3">
          <div>
            <label className="label-caps mb-1.5 block">Invoice Number *</label>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="label-caps mb-1.5 block">Law Firm ID (tax/firm identifier)</label>
            <input value={lawFirmId} onChange={(e) => setLawFirmId(e.target.value)} className={INPUT_CLS} placeholder="e.g. 12-3456789" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-caps mb-1.5 block">Timekeeper ID</label>
              <input value={timekeeperId} onChange={(e) => setTimekeeperId(e.target.value)} className={INPUT_CLS} placeholder="e.g. CC01" />
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Timekeeper Name</label>
              <input value={timekeeperName} onChange={(e) => setTimekeeperName(e.target.value)} className={INPUT_CLS} placeholder="e.g. C. Canty" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="primary" onClick={doExport} disabled={!invoiceNumber.trim() || entries.length === 0} className="flex-1">
            Export LEDES
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: Client }) {
  const { updateClient, archiveClient, deleteClient, getClientEntries, getTotalBillable, getTotalHours, addVocabularyTerm, removeVocabularyTerm } = useClientsStore();
  const defaultRate = useSettingsStore((s) => s.billableRatePerHour);
  const [exportOpen, setExportOpen] = useState(false);
  const [ledesOpen, setLedesOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(client.name);
  const [editMatter, setEditMatter] = useState(client.matterNumber ?? "");
  const [editRate, setEditRate] = useState(client.billableRate);
  const [editDescription, setEditDescription] = useState(client.matterDescription ?? "");
  const [newVocabTerm, setNewVocabTerm] = useState("");
  const vocabInputRef = useRef<HTMLInputElement>(null);

  const entries = getClientEntries(client.id);
  const totalBillable = getTotalBillable(client.id);
  const totalHours = getTotalHours(client.id);
  const recentEntries = [...entries].sort((a, b) => b.date - a.date).slice(0, 3);

  const saveEdit = () => {
    updateClient(client.id, {
      name: editName.trim() || client.name,
      matterNumber: editMatter.trim() || undefined,
      billableRate: editRate,
      matterDescription: editDescription.trim() || undefined,
    });
    setEditing(false);
  };

  const handleAddVocab = () => {
    const term = newVocabTerm.trim();
    if (!term) return;
    addVocabularyTerm(client.id, term);
    setNewVocabTerm("");
    vocabInputRef.current?.focus();
  };

  return (
    <div className="bg-surface-50 border border-surface-300/60 rounded-xl overflow-hidden shadow-inset-hairline">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-surface-300/50">
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
                className="w-full bg-surface-100 border border-surface-300/70 rounded px-2 py-1 text-sm text-surface-900 focus:outline-none focus:border-brass-400"
              />
              <input
                value={editMatter}
                onChange={(e) => setEditMatter(e.target.value)}
                placeholder="Matter number"
                className="w-full bg-surface-100 border border-surface-300/70 rounded px-2 py-1 text-xs text-surface-900 placeholder-surface-500 focus:outline-none focus:border-brass-400"
              />
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={25}
                  value={editRate}
                  onChange={(e) => setEditRate(Number(e.target.value))}
                  className="flex-1 accent-brass-500"
                />
                <span className="text-xs text-surface-700 w-16 text-right">
                  {editRate === 0 ? "Default" : `$${editRate}/hr`}
                </span>
              </div>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Matter description (used by AI for context-aware correction)"
                rows={2}
                className="w-full bg-surface-100/50 border border-surface-300/60 rounded px-2 py-1 text-xs text-surface-900 placeholder-surface-500 focus:outline-none focus:border-voxlen-500 resize-none dark:bg-surface-900 dark:border-surface-700 dark:text-surface-100 dark:placeholder-surface-500"
              />
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-sm text-surface-950 truncate">{client.name}</h3>
              {client.matterNumber && (
                <p className="text-xs text-surface-600 mt-0.5">{client.matterNumber}</p>
              )}
              <p className="text-xs text-surface-600 mt-0.5 flex items-center gap-1.5">
                {client.billableRate === 0 ? "Default rate" : `$${client.billableRate}/hr`}
                {client.billableRate === 0 && defaultRate === 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold">
                    <AlertTriangle className="w-2.5 h-2.5" /> $0/hr — set a rate
                  </span>
                )}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-500/10 rounded transition-colors">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-surface-500 hover:bg-surface-200 rounded transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="p-1.5 text-surface-500 hover:text-surface-800 hover:bg-surface-200 rounded transition-colors" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              {entries.some((e) => e.status === "approved") && (
                <div className="relative">
                  <button
                    onClick={() => setExportOpen((o) => !o)}
                    className="p-1.5 text-surface-500 hover:text-surface-800 hover:bg-surface-200 rounded transition-colors"
                    title="Export billing"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 top-full mt-1 z-40 w-40 rounded-lg border border-surface-300/60 bg-surface-50 shadow-elevation py-1">
                      <button
                        onClick={async () => {
                          setExportOpen(false);
                          const approved = entries.filter((e) => e.status === "approved");
                          const { content, filename, mimeType } = exportBillingCsv(client, approved);
                          await downloadBillingExport(content, filename, mimeType);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-surface-700 hover:bg-surface-100 transition-colors"
                      >
                        CSV
                      </button>
                      <button
                        onClick={async () => {
                          setExportOpen(false);
                          const { content, filename, mimeType } = exportClioCsv(client, entries);
                          await downloadBillingExport(content, filename, mimeType);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-surface-700 hover:bg-surface-100 transition-colors"
                      >
                        Clio CSV
                      </button>
                      <button
                        onClick={() => { setExportOpen(false); setLedesOpen(true); }}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-surface-700 hover:bg-surface-100 transition-colors"
                      >
                        LEDES 1998B…
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => archiveClient(client.id)} className="p-1.5 text-surface-500 hover:text-surface-800 hover:bg-surface-200 rounded transition-colors" title="Archive">
                <Archive className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteClient(client.id)} className="p-1.5 text-surface-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-surface-300/50">
        <div className="p-3 text-center">
          <p className="text-[10px] text-surface-600 uppercase tracking-wide-caps mb-0.5">Sessions</p>
          <p className="text-lg font-bold text-surface-950">{entries.length}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-surface-600 uppercase tracking-wide-caps mb-0.5">Hours</p>
          <p className="text-lg font-bold text-surface-950">{totalHours.toFixed(1)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-surface-600 uppercase tracking-wide-caps mb-0.5">Billable</p>
          <p className="text-lg font-bold" style={{ color: client.color }}>
            ${totalBillable.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <div className="p-3 border-t border-surface-300/50 space-y-1.5">
          <p className="text-[10px] text-surface-600 uppercase tracking-wide-caps mb-2">Recent Sessions</p>
          {recentEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-xs">
              <span className="text-surface-600">
                {new Date(entry.date).toLocaleDateString()} · {Math.round(entry.durationSeconds / 60)}m
                {entry.wordCount > 0 && ` · ${entry.wordCount} words`}
                {entry.status === "draft" && (
                  <span className="ml-1.5 text-[9px] uppercase tracking-wide text-amber-500 font-semibold">draft</span>
                )}
              </span>
              <span className="text-surface-800 font-medium">${entry.billableAmount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Vocabulary section */}
      <div className="p-3 border-t border-[#27272a]">
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="w-3 h-3 text-zinc-500" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Matter Vocabulary
          </p>
          {client.vocabulary && client.vocabulary.length > 0 && (
            <span className="text-[10px] text-zinc-600 ml-auto">{client.vocabulary.length} terms</span>
          )}
        </div>
        {client.vocabulary && client.vocabulary.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {client.vocabulary.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#27272a] text-xs text-zinc-300"
              >
                {term}
                <button
                  onClick={() => removeVocabularyTerm(client.id, term)}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            ref={vocabInputRef}
            value={newVocabTerm}
            onChange={(e) => setNewVocabTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddVocab(); } }}
            placeholder="Add term (party names, case refs…)"
            className="flex-1 bg-surface-100/50 border border-surface-300/60 rounded px-2 py-1 text-xs text-surface-900 placeholder-surface-500 focus:outline-none focus:border-voxlen-500 dark:bg-surface-900 dark:border-surface-700 dark:text-surface-100 dark:placeholder-surface-500"
          />
          <button
            onClick={handleAddVocab}
            disabled={!newVocabTerm.trim()}
            className="px-2 py-1 rounded bg-surface-200 text-surface-600 hover:text-surface-900 hover:bg-surface-300 transition-colors disabled:opacity-40 text-xs dark:bg-surface-800 dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-700"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {client.matterDescription && (
          <p className="text-[10px] text-zinc-600 mt-2 italic leading-relaxed">{client.matterDescription}</p>
        )}
      </div>

      {ledesOpen && <LedesExportModal client={client} onClose={() => setLedesOpen(false)} />}
    </div>
  );
}

function DraftEntryRow({ entry }: { entry: MatterEntry }) {
  const clients = useClientsStore((s) => s.clients);
  const updateEntry = useClientsStore((s) => s.updateEntry);
  const approveEntry = useClientsStore((s) => s.approveEntry);
  const deleteEntry = useClientsStore((s) => s.deleteEntry);

  const rate = entry.rateAtTime ?? 0;
  const hours = rate > 0 ? entry.billableAmount / rate : entry.durationSeconds / 3600;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-100/60 border border-surface-300/40 text-xs">
      <span className="font-mono text-surface-900 tabular-nums shrink-0 w-12">
        {formatBillableHours(hours)}h
      </span>
      <select
        value={entry.clientId}
        onChange={(e) => {
          const next = clients.find((c) => c.id === e.target.value);
          const nextRate = next && next.billableRate > 0 ? next.billableRate : rate;
          updateEntry(entry.id, {
            clientId: e.target.value,
            rateAtTime: nextRate,
            billableAmount: Math.round(hours * nextRate * 100) / 100,
          });
        }}
        className="bg-surface-50 border border-surface-300/60 rounded px-1.5 py-0.5 text-xs text-surface-800 shrink-0 max-w-[140px]"
      >
        <option value="">Unassigned</option>
        {clients.filter((c) => !c.archived).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input
        value={entry.note ?? ""}
        onChange={(e) => updateEntry(entry.id, { note: e.target.value })}
        placeholder="Narrative…"
        className="flex-1 min-w-0 bg-transparent border-b border-surface-300/40 px-1 py-0.5 text-xs text-surface-700 placeholder-surface-500 focus:outline-none focus:border-brass-400"
      />
      <span className="text-surface-500 shrink-0">{new Date(entry.date).toLocaleDateString()}</span>
      {rate <= 0 ? (
        <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold shrink-0">
          <AlertTriangle className="w-2.5 h-2.5" /> $0.00
        </span>
      ) : (
        <span className="font-medium text-surface-900 shrink-0">${entry.billableAmount.toFixed(2)}</span>
      )}
      <button
        onClick={() => approveEntry(entry.id)}
        disabled={!entry.clientId}
        title={entry.clientId ? "Approve" : "Assign a client first"}
        className="p-1 text-green-600 hover:bg-green-500/10 rounded transition-colors disabled:opacity-30 shrink-0"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => deleteEntry(entry.id)}
        title="Discard"
        className="p-1 text-surface-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ClientsPanel() {
  const { clients, activeClientId, setActiveClient, entries } = useClientsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const handleExportAll = async () => {
    // Approved entries only — drafts haven't been reviewed by the attorney.
    const approved = entries.filter((e) => e.status === "approved");
    const { content, filename, mimeType } = exportAllBillingCsv(clients, approved);
    await downloadBillingExport(content, filename, mimeType);
  };

  const active = clients.filter((c) => !c.archived);
  const archived = clients.filter((c) => c.archived);
  const drafts = useClientsStore(
    useShallow((s) => s.entries.filter((e) => e.status === "draft"))
  );

  const totalBillable = useClientsStore((s) =>
    s.entries.reduce((sum, e) => sum + (e.status === "approved" ? e.billableAmount : 0), 0)
  );
  const totalHours = useClientsStore((s) =>
    s.entries.reduce((sum, e) => sum + (e.status === "approved" ? e.durationSeconds : 0), 0) / 3600
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/50 shrink-0 bg-surface-50/60">
        <div>
          <h2 className="text-sm font-semibold text-surface-950">Clients & Matters</h2>
          <p className="text-xs text-surface-600 mt-0.5">
            {active.length} active · {totalHours.toFixed(1)} hrs · ${totalBillable.toFixed(2)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportAll}
              title="Export all billing as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Draft time entries awaiting review */}
      {drafts.length > 0 && (
        <div className="px-4 py-3 border-b border-surface-300/50 shrink-0 bg-voxlen-950/20">
          <p className="label-caps mb-2 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-brass-500" />
            Draft time entries — review &amp; approve ({drafts.length})
          </p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {[...drafts]
              .sort((a, b) => b.date - a.date)
              .map((entry) => (
                <DraftEntryRow key={entry.id} entry={entry} />
              ))}
          </div>
        </div>
      )}

      {/* Active client selector */}
      {active.length > 0 && (
        <div className="px-4 py-3 border-b border-surface-300/50 shrink-0">
          <p className="label-caps mb-2">Active Client (for new dictations)</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveClient(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                activeClientId === null
                  ? "bg-surface-200 border-surface-300/60 text-surface-950"
                  : "border-transparent text-surface-600 hover:text-surface-900"
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
                    ? "border-transparent text-surface-950"
                    : "border-transparent text-surface-600 hover:text-surface-900"
                }`}
                style={activeClientId === c.id ? { backgroundColor: c.color + "22", borderColor: c.color + "80" } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
                {c.matterNumber && (
                  <span className="text-surface-500">#{c.matterNumber}</span>
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
            <Briefcase className="w-10 h-10 text-surface-400 mb-4" />
            <p className="text-sm font-medium text-surface-700 mb-1">No clients yet</p>
            <p className="text-xs text-surface-600 max-w-xs mb-4">
              Add a client or matter to track billable time and usage per file.
            </p>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add First Client
            </Button>
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
              className="text-xs text-surface-500 hover:text-surface-800 flex items-center gap-1.5 transition-colors"
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
