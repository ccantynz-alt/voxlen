import { useState, useRef } from "react";
import { useClauseStore, Clause } from "@/stores/clauses";
import { useDictationStore } from "@/stores/dictation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Search, FileText, Copy, Check, Plus, Pencil, Trash2, X, Download, Upload, SendHorizonal } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  contract: "Contract",
  liability: "Liability",
  ip: "IP",
  employment: "Employment",
  gdpr: "GDPR",
  accounting: "Accounting",
  general: "General",
};

const CATEGORY_COLORS: Record<string, string> = {
  contract: "bg-blue-500/10 text-blue-400",
  liability: "bg-red-500/10 text-red-400",
  ip: "bg-purple-500/10 text-purple-400",
  employment: "bg-green-500/10 text-green-400",
  gdpr: "bg-orange-500/10 text-orange-400",
  accounting: "bg-yellow-500/10 text-yellow-600",
  general: "bg-surface-500/10 text-surface-400",
};

type ClauseFormState = {
  title: string;
  category: Clause["category"];
  voiceTrigger: string;
  text: string;
};

const EMPTY_FORM: ClauseFormState = {
  title: "",
  category: "general",
  voiceTrigger: "",
  text: "",
};

export function ClauseLibrary() {
  const { clauses, templates, recentlyUsed, customClauseIds, markUsed, addClause, removeClause, updateClause } = useClauseStore();
  const appendToLastSegment = useDictationStore((s) => s.appendToLastSegment);
  const addSegment = useDictationStore((s) => s.addSegment);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"clauses" | "templates">("clauses");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [injectedId, setInjectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClauseFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [importError, setImportError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const exportCustomClauses = () => {
    const custom = clauses.filter((c) => customClauseIds.includes(c.id));
    if (custom.length === 0) return;
    const blob = new Blob([JSON.stringify(custom, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voxlen-clauses-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as unknown[];
        if (!Array.isArray(parsed)) throw new Error("Expected an array of clauses");
        let imported = 0;
        for (const item of parsed) {
          const c = item as Partial<Clause>;
          if (!c.title || !c.text) continue;
          addClause({
            id: crypto.randomUUID(),
            title: String(c.title),
            category: (["contract","liability","ip","employment","gdpr","accounting","general"] as const).includes(c.category as never)
              ? (c.category as Clause["category"])
              : "general",
            voiceTrigger: c.voiceTrigger ? String(c.voiceTrigger) : String(c.title).toLowerCase(),
            text: String(c.text),
            tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          });
          imported++;
        }
        if (imported === 0) setImportError("No valid clauses found in file.");
      } catch {
        setImportError("Invalid file — expected a JSON array of clause objects.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = clauses.filter((c) => {
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.includes(search.toLowerCase())) ||
      c.voiceTrigger.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const recent = recentlyUsed
    .map((id) => clauses.find((c) => c.id === id))
    .filter(Boolean) as Clause[];

  const insertClause = (clause: Clause) => {
    markUsed(clause.id);
    const segments = useDictationStore.getState().segments;
    if (segments.length > 0) {
      appendToLastSegment(" " + clause.text);
    } else {
      addSegment({
        id: crypto.randomUUID(),
        text: clause.text,
        timestamp: new Date(),
        confidence: 1.0,
        isFinal: true,
        grammarApplied: false,
      });
    }
  };

  const insertTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const text = template.sections.map((s) => `${s.toUpperCase()}\n\n`).join("\n");
    addSegment({
      id: crypto.randomUUID(),
      text,
      timestamp: new Date(),
      confidence: 1.0,
      isFinal: true,
      grammarApplied: false,
    });
  };

  const copyClause = async (clause: Clause) => {
    await navigator.clipboard.writeText(clause.text);
    setCopiedId(clause.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const injectClause = async (clause: Clause) => {
    markUsed(clause.id);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("inject_text", { text: clause.text });
      setInjectedId(clause.id);
      setTimeout(() => setInjectedId(null), 2000);
    } catch {
      await navigator.clipboard.writeText(clause.text);
      setCopiedId(clause.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (clause: Clause) => {
    setForm({ title: clause.title, category: clause.category, voiceTrigger: clause.voiceTrigger, text: clause.text });
    setEditingId(clause.id);
    setFormError("");
    setShowForm(true);
  };

  const submitForm = () => {
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (!form.text.trim()) { setFormError("Clause text is required."); return; }
    if (!form.voiceTrigger.trim()) { setFormError("Voice trigger is required."); return; }
    setFormError("");
    if (editingId) {
      updateClause(editingId, { title: form.title.trim(), category: form.category, voiceTrigger: form.voiceTrigger.trim().toLowerCase(), text: form.text.trim() });
    } else {
      addClause({ id: crypto.randomUUID(), title: form.title.trim(), category: form.category, voiceTrigger: form.voiceTrigger.trim().toLowerCase(), text: form.text.trim(), tags: [] });
    }
    setShowForm(false);
    setEditingId(null);
  };

  const categories = ["all", ...Array.from(new Set(clauses.map((c) => c.category)))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-300/50 flex items-center justify-between">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-surface-950 tracking-tight-display">
            Clause Library
          </h2>
          <p className="text-[11px] text-surface-600 mt-0.5">
            Voice-insert standard legal &amp; accounting clauses
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {customClauseIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={exportCustomClauses} title="Export custom clauses as JSON">
              <Download className="h-3 w-3" strokeWidth={1.75} />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => importRef.current?.click()} title="Import clauses from JSON">
            <Upload className="h-3 w-3" strokeWidth={1.75} />
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button variant="secondary" size="sm" onClick={openNew}>
            <Plus className="h-3 w-3" strokeWidth={2} />
            New Clause
          </Button>
        </div>
      </div>
      {importError && (
        <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-[11px] text-red-500">
          {importError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-surface-300/50 px-5 gap-4">
        {(["clauses", "templates"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "py-2.5 text-[12px] font-medium capitalize border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-brass-500 text-brass-500"
                : "border-transparent text-surface-600 hover:text-surface-900"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "clauses" ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search + filters */}
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" strokeWidth={1.75} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clauses..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-surface-100 border border-surface-300/60 rounded text-surface-950 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-brass-500/40"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors",
                    activeCategory === cat
                      ? "bg-brass-500 text-white"
                      : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                  )}
                >
                  {cat === "all" ? "All" : CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>

          {/* Recent */}
          {recent.length > 0 && !search && activeCategory === "all" && (
            <div className="px-4 pb-2">
              <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-1.5">Recently Used</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => insertClause(c)}
                    className="px-2 py-1 text-[11px] bg-surface-100 hover:bg-brass-500/10 text-surface-700 hover:text-brass-600 rounded border border-surface-300/50 transition-colors"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clause list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {filtered.map((clause) => (
              <div
                key={clause.id}
                className="p-3 rounded-lg bg-surface-50 border border-surface-300/50 hover:border-brass-500/30 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-medium text-surface-950">{clause.title}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono", CATEGORY_COLORS[clause.category])}>
                        {CATEGORY_LABELS[clause.category]}
                      </span>
                    </div>
                    <p className="text-[11px] text-surface-600 line-clamp-2 leading-relaxed">
                      {clause.text}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-1 font-mono italic">
                      Say: &quot;{clause.voiceTrigger}&quot;
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => injectClause(clause)}
                      title="Type into active app"
                      className="p-1.5 rounded hover:bg-surface-200 text-surface-500 hover:text-surface-900 transition-colors"
                    >
                      {injectedId === clause.id ? (
                        <Check className="h-3 w-3 text-green-400" strokeWidth={2} />
                      ) : (
                        <SendHorizonal className="h-3 w-3" strokeWidth={1.75} />
                      )}
                    </button>
                    <button
                      onClick={() => copyClause(clause)}
                      title="Copy to clipboard"
                      className="p-1.5 rounded hover:bg-surface-200 text-surface-500 hover:text-surface-900 transition-colors"
                    >
                      {copiedId === clause.id ? (
                        <Check className="h-3 w-3 text-brass-500" strokeWidth={2} />
                      ) : (
                        <Copy className="h-3 w-3" strokeWidth={1.75} />
                      )}
                    </button>
                    {customClauseIds.includes(clause.id) && (
                      <>
                        <button
                          onClick={() => openEdit(clause)}
                          title="Edit clause"
                          className="p-1.5 rounded hover:bg-surface-200 text-surface-500 hover:text-brass-500 transition-colors"
                        >
                          <Pencil className="h-3 w-3" strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => removeClause(clause.id)}
                          title="Delete clause"
                          className="p-1.5 rounded hover:bg-surface-200 text-surface-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => insertClause(clause)}
                      className="h-7 px-2 text-[11px]"
                    >
                      Insert
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-surface-500 text-[12px]">
                No clauses match your search.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-3 rounded-lg bg-surface-50 border border-surface-300/50 hover:border-brass-500/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 text-brass-500" strokeWidth={1.75} />
                    <span className="text-[12px] font-medium text-surface-950">{template.name}</span>
                  </div>
                  <p className="text-[11px] text-surface-600">
                    {template.sections.length} sections: {template.sections.slice(0, 3).join(", ")}{template.sections.length > 3 ? "..." : ""}
                  </p>
                  <p className="text-[10px] text-surface-500 mt-1 font-mono italic">
                    Say: &quot;{template.voiceTrigger}&quot;
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTemplate(template.id)}
                  className="h-7 px-2 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  Use
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Add/Edit Clause Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-xl bg-surface-50 border border-surface-300/60 shadow-elevation-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[14px] font-semibold text-surface-950">
                {editingId ? "Edit Clause" : "New Custom Clause"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-surface-500 hover:text-surface-900">
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-surface-700 mb-1 block">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Limitation of Liability"
                  className="w-full rounded-md border border-surface-300/70 bg-surface-100 px-3 py-1.5 text-[12px] text-surface-950 focus:outline-none focus:border-brass-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-surface-700 mb-1 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Clause["category"] }))}
                  className="w-full rounded-md border border-surface-300/70 bg-surface-100 px-3 py-1.5 text-[12px] text-surface-950 focus:outline-none focus:border-brass-400"
                >
                  {(["general","contract","liability","ip","employment","gdpr","accounting"] as Clause["category"][]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-surface-700 mb-1 block">Voice Trigger</label>
                <input
                  value={form.voiceTrigger}
                  onChange={(e) => setForm((f) => ({ ...f, voiceTrigger: e.target.value }))}
                  placeholder='e.g. "insert limitation clause"'
                  className="w-full rounded-md border border-surface-300/70 bg-surface-100 px-3 py-1.5 text-[12px] text-surface-950 focus:outline-none focus:border-brass-400"
                />
                <p className="text-[10px] text-surface-500 mt-0.5">Say this phrase to insert the clause automatically.</p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-surface-700 mb-1 block">Clause Text</label>
                <textarea
                  value={form.text}
                  onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                  placeholder="Enter the full clause text..."
                  rows={5}
                  className="w-full rounded-md border border-surface-300/70 bg-surface-100 px-3 py-1.5 text-[12px] text-surface-950 focus:outline-none focus:border-brass-400 resize-none"
                />
              </div>
              {formError && <p className="text-[11px] text-red-400">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="primary" size="sm" onClick={submitForm} className="flex-1">
                  {editingId ? "Save Changes" : "Add Clause"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
