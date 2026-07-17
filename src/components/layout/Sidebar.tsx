import { useEffect, useState } from "react";
import {
  Mic,
  Settings,
  SpellCheck,
  History,
  ShieldCheck,
  Brain,
  BookOpen,
  BarChart3,
  Briefcase,
  ChevronDown,
  Headphones,
  ClipboardCheck,
} from "lucide-react";
import { APP_VERSION } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useReviewStore } from "@/stores/review";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const coreItems = [
  { id: "dictation", label: "Dictation", icon: Mic, description: "Voice to text" },
  { id: "grammar", label: "Grammar", icon: SpellCheck, description: "AI correction" },
  { id: "history", label: "History", icon: History, description: "Past sessions" },
  { id: "review", label: "Review", icon: ClipboardCheck, description: "Secretary queue" },
];

const proItems = [
  { id: "meeting", label: "Meetings", icon: Headphones, description: "Bot-free capture" },
  { id: "clauses", label: "Clauses", icon: BookOpen, description: "Clause library" },
  { id: "clients", label: "Clients", icon: Briefcase, description: "Billable matters" },
  { id: "analytics", label: "Analytics", icon: BarChart3, description: "Usage stats" },
  { id: "flywheel", label: "Flywheel", icon: Brain, description: "Local learning" },
];

const bottomItems = [
  { id: "admin", label: "Admin", icon: ShieldCheck, description: "Permissions" },
  { id: "settings", label: "Settings", icon: Settings, description: "Configuration" },
];

function NavButton({
  id, label, icon: Icon, activeView, onViewChange, badge,
}: { id: string; label: string; icon: React.ElementType; activeView: string; onViewChange: (v: string) => void; badge?: number }) {
  const isActive = activeView === id;
  return (
    <button
      onClick={() => onViewChange(id)}
      className={cn(
        "group relative flex items-center gap-3 w-full pl-4 pr-3 py-2 rounded-md text-sm transition-all duration-200",
        isActive
          ? "bg-marcoreid-900/40 text-surface-950"
          : "text-surface-700 hover:bg-surface-100/80 hover:text-surface-900"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brass-400" />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-brass-400" : "text-surface-600 group-hover:text-surface-800"
        )}
        strokeWidth={isActive ? 2.25 : 1.75}
      />
      <span className={cn("font-medium truncate tracking-tight", isActive ? "text-surface-950" : "")}>
        {label}
      </span>
      {!!badge && <span className="ml-auto rounded-full bg-brass-400 text-surface-0 text-[9px] min-w-4 h-4 px-1 flex items-center justify-center">{badge}</span>}
    </button>
  );
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const pendingCount = useReviewStore((s) => s.packets.filter((p) => p.status?.status === "pending_review").length);
  const refreshReview = useReviewStore((s) => s.refresh);
  useEffect(() => { void refreshReview(); }, [refreshReview]);
  const proIsActive = proItems.some((i) => i.id === activeView);
  const [proExpanded, setProExpanded] = useState(() => {
    try { return localStorage.getItem("voxlen_pro_expanded") === "true" || proIsActive; } catch { return proIsActive; }
  });

  const togglePro = () => {
    const next = !proExpanded;
    setProExpanded(next);
    try { localStorage.setItem("voxlen_pro_expanded", String(next)); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col w-[228px] h-full bg-surface-50/60 border-r border-surface-300/60 shrink-0">
      <div className="px-5 pt-4 pb-2">
        <span className="label-caps">Workspace</span>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-1">
        {coreItems.map((item) => (
          <NavButton key={item.id} {...item} badge={item.id === "review" ? pendingCount : undefined} activeView={activeView} onViewChange={onViewChange} />
        ))}

        {/* Professional tools expander */}
        <button
          onClick={togglePro}
          className="flex items-center gap-2 w-full px-4 py-1.5 text-[10px] font-semibold tracking-widest text-surface-500 uppercase hover:text-surface-700 transition-colors mt-1"
        >
          <span className="flex-1 text-left">Pro Tools</span>
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", proExpanded ? "rotate-180" : "")}
            strokeWidth={2}
          />
        </button>

        {proExpanded && proItems.map((item) => (
          <NavButton key={item.id} {...item} activeView={activeView} onViewChange={onViewChange} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-surface-300/50 space-y-1">
        <div className="px-1 pb-1">
          <span className="label-caps">System</span>
        </div>
        {bottomItems.map((item) => (
          <NavButton key={item.id} {...item} activeView={activeView} onViewChange={onViewChange} />
        ))}

        <div className="px-1 pt-3 mt-1">
          <div className="divider-brass mb-2" />
          <div className="flex items-baseline leading-none">
            <span className="font-display text-[11px] text-surface-700 tracking-tight-display leading-none">Vox</span>
            <span className="font-display text-[11px] italic text-brass-500/80 leading-none">len</span>
          </div>
          <span className="text-[10px] text-surface-600 font-mono block mt-0.5">v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}
