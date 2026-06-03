import { useState } from "react";
import { useClauseStore, Clause } from "@/stores/clauses";
import { useDictationStore } from "@/stores/dictation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Search, FileText, Copy, Check } from "lucide-react";

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

export function ClauseLibrary() {
  const { clauses, templates, recentlyUsed, markUsed } = useClauseStore();
  const appendToLastSegment = useDictationStore((s) => s.appendToLastSegment);
  const addSegment = useDictationStore((s) => s.addSegment);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"clauses" | "templates">("clauses");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const categories = ["all", ...Array.from(new Set(clauses.map((c) => c.category)))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-300/50">
        <h2 className="font-display text-[15px] font-semibold text-surface-950 tracking-tight-display">
          Clause Library
        </h2>
        <p className="text-[11px] text-surface-600 mt-0.5">
          Voice-insert standard legal &amp; accounting clauses
        </p>
      </div>

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
    </div>
  );
}
