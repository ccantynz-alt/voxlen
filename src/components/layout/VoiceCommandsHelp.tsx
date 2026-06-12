import { useState, useMemo } from "react";
import { X, Search, Mic, AlignLeft, Settings2, BookOpen, Clock } from "lucide-react";

interface CommandEntry {
  command: string;
  description: string;
  category: "formatting" | "control" | "clause" | "billing";
}

const ALL_COMMANDS: CommandEntry[] = [
  // Formatting
  { command: "new line", description: "Insert a line break", category: "formatting" },
  { command: "new paragraph", description: "Insert a paragraph break (double newline)", category: "formatting" },
  { command: "period / full stop / dot", description: "Insert a period (.)", category: "formatting" },
  { command: "comma", description: "Insert a comma (,)", category: "formatting" },
  { command: "question mark", description: "Insert a question mark (?)", category: "formatting" },
  { command: "exclamation mark", description: "Insert an exclamation mark (!)", category: "formatting" },
  { command: "colon", description: "Insert a colon (:)", category: "formatting" },
  { command: "semicolon", description: "Insert a semicolon (;)", category: "formatting" },
  { command: "dash / em dash", description: "Insert an em dash ( — )", category: "formatting" },
  { command: "open quote / begin quote", description: 'Insert opening quote (")', category: "formatting" },
  { command: "close quote / end quote", description: 'Insert closing quote (")', category: "formatting" },
  { command: "open bracket / open parenthesis", description: "Insert an opening parenthesis", category: "formatting" },
  { command: "close bracket / close parenthesis", description: "Insert a closing parenthesis", category: "formatting" },
  { command: "tab / tab key", description: "Insert a tab character", category: "formatting" },
  { command: "caps on / all caps", description: "Enable caps lock mode", category: "formatting" },
  { command: "caps off", description: "Disable caps lock mode", category: "formatting" },
  // Control
  { command: "stop listening / stop dictation", description: "Stop the current dictation session", category: "control" },
  { command: "pause dictation / pause recording", description: "Pause recording", category: "control" },
  { command: "resume dictation / resume recording", description: "Resume recording", category: "control" },
  { command: "clear / clear all", description: "Clear the current session text", category: "control" },
  { command: "delete that / scratch that / remove that", description: "Delete the last dictated segment", category: "control" },
  { command: "undo / undo that", description: "Undo the last action", category: "control" },
  { command: "copy that / copy text", description: "Copy all text to clipboard", category: "control" },
  { command: "select all", description: "Select all text", category: "control" },
  { command: "review uncertain words / check uncertain", description: "Show count of low-confidence words in transcript", category: "control" },
  // Billable time
  { command: "start billing / start timer", description: "Start the billable time timer", category: "billing" },
  { command: "stop billing / stop timer", description: "Stop the billable time timer", category: "billing" },
  { command: "log thirty minutes / log 30 minutes", description: "Log 30 minutes to timesheet", category: "billing" },
  { command: "log fifteen minutes / log 15 minutes", description: "Log 15 minutes to timesheet", category: "billing" },
  { command: "log forty five minutes / log 45 minutes", description: "Log 45 minutes to timesheet", category: "billing" },
  { command: "log one hour / log 60 minutes", description: "Log 1 hour to timesheet", category: "billing" },
  { command: "log two hours / log 120 minutes", description: "Log 2 hours to timesheet", category: "billing" },
  { command: "log six minutes / log 6 minutes", description: "Log 6 minutes (1 unit) to timesheet", category: "billing" },
  // Clause insertion
  { command: "insert indemnity clause", description: "Insert standard indemnity clause", category: "clause" },
  { command: "insert limitation of liability", description: "Insert limitation of liability clause", category: "clause" },
  { command: "insert confidentiality clause", description: "Insert confidentiality / NDA clause", category: "clause" },
  { command: "insert governing law England", description: "Insert governing law (England & Wales)", category: "clause" },
  { command: "insert governing law Australia", description: "Insert governing law (Australia — NSW)", category: "clause" },
  { command: "insert governing law New York", description: "Insert governing law (New York)", category: "clause" },
  { command: "insert force majeure", description: "Insert force majeure clause", category: "clause" },
  { command: "insert IP assignment", description: "Insert IP assignment clause", category: "clause" },
  { command: "insert GDPR data processing clause", description: "Insert GDPR data processing clause", category: "clause" },
  { command: "insert entire agreement", description: "Insert entire agreement / merger clause", category: "clause" },
  { command: "insert severability", description: "Insert severability clause", category: "clause" },
  { command: "insert no assignment clause", description: "Insert no assignment clause", category: "clause" },
  { command: "insert engagement terms", description: "Insert accounting engagement terms", category: "clause" },
  { command: "insert accountant liability cap", description: "Insert accountant liability cap clause", category: "clause" },
  { command: "insert without prejudice", description: "Insert WITHOUT PREJUDICE header", category: "clause" },
  { command: "insert arbitration clause", description: "Insert arbitration / dispute resolution clause", category: "clause" },
  { command: "insert dispute resolution clause", description: "Insert negotiation + mediation clause", category: "clause" },
  { command: "insert warranty disclaimer", description: "Insert AS IS warranty disclaimer", category: "clause" },
  { command: "insert governing law New Zealand", description: "Insert governing law (New Zealand)", category: "clause" },
  { command: "insert governing law Ontario", description: "Insert governing law (Ontario, Canada)", category: "clause" },
  { command: "insert payment terms", description: "Insert payment terms (30-day, 1.5%/mo interest)", category: "clause" },
  { command: "insert termination for cause", description: "Insert termination for cause clause", category: "clause" },
];

type Category = "all" | "formatting" | "control" | "billing" | "clause";

const CATEGORIES: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Mic },
  { id: "formatting", label: "Formatting", icon: AlignLeft },
  { id: "control", label: "Control", icon: Settings2 },
  { id: "billing", label: "Billing", icon: Clock },
  { id: "clause", label: "Clauses", icon: BookOpen },
];

interface Props {
  onClose: () => void;
}

export function VoiceCommandsHelp({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return ALL_COMMANDS.filter((c) => {
      const matchesCategory = activeCategory === "all" || c.category === activeCategory;
      const matchesQuery =
        !q || c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-[680px] max-h-[80vh] rounded-xl border border-surface-300/60 bg-surface-50 shadow-elevation-lg overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-300/50 bg-surface-100/60">
          <Mic className="h-4 w-4 text-brass-500 shrink-0" strokeWidth={1.75} />
          <div className="flex-1">
            <h2 className="font-display text-[15px] font-semibold text-surface-950 tracking-tight">
              Voice Commands
            </h2>
            <p className="text-[11px] text-surface-600 mt-0.5">
              Speak any of these commands while dictating
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-surface-500 hover:text-surface-900 hover:bg-surface-200/60 transition-colors"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Search + category tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-surface-300/30 space-y-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" strokeWidth={1.75} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands…"
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-surface-300/60 bg-white text-[12px] text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-brass-400/50 focus:border-brass-400/60 transition-colors"
            />
          </div>
          {/* Category pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                className={[
                  "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors",
                  activeCategory === id
                    ? "bg-marcoreid-900 text-brass-300"
                    : "bg-surface-200/70 text-surface-700 hover:bg-surface-300/60 hover:text-surface-900",
                ].join(" ")}
              >
                <Icon className="h-3 w-3" strokeWidth={1.75} />
                {label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-surface-500 font-mono">
              {filtered.length} command{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Command list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-[12px] text-surface-500 py-8">
              No commands match "{query}"
            </p>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-100/70 transition-colors group"
              >
                <code className="shrink-0 px-2 py-0.5 rounded-md bg-surface-200/70 border border-surface-300/40 text-[11px] font-mono text-surface-900 group-hover:border-brass-400/30 group-hover:bg-brass-50/40 transition-colors whitespace-nowrap">
                  "{cmd.command}"
                </code>
                <span className="text-[11px] text-surface-600 leading-snug">
                  {cmd.description}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer tip */}
        <div className="px-5 py-2.5 border-t border-surface-300/40 bg-surface-100/40">
          <p className="text-[10px] text-surface-500 text-center">
            Commands are matched anywhere in your speech — you can say them mid-sentence.
            Clause insertions are inserted at the end of the current text.
          </p>
        </div>
      </div>
    </div>
  );
}
