import {
  Mic,
  Settings,
  SpellCheck,
  History,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  {
    id: "dictation",
    label: "Dictation",
    icon: Mic,
    description: "Voice to text",
  },
  {
    id: "grammar",
    label: "Grammar",
    icon: SpellCheck,
    description: "AI correction",
  },
  {
    id: "history",
    label: "History",
    icon: History,
    description: "Past sessions",
  },
];

const bottomItems = [
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    description: "Permissions",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Configuration",
  },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <div className="flex flex-col w-[228px] h-full bg-surface-50/60 border-r border-surface-300/60 shrink-0">
      {/* Section label */}
      <div className="px-5 pt-4 pb-2">
        <span className="label-caps">Workspace</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "group relative flex items-center gap-3 w-full pl-4 pr-3 py-2 rounded-md text-sm transition-all duration-200",
                isActive
                  ? "bg-marcoreid-900/40 text-surface-950"
                  : "text-surface-700 hover:bg-surface-100/80 hover:text-surface-900"
              )}
            >
              {/* Active brass hairline accent on the left */}
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
              <span className={cn(
                "font-medium truncate tracking-tight",
                isActive ? "text-surface-950" : ""
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="px-3 py-3 border-t border-surface-300/50 space-y-1">
        <div className="px-1 pb-1">
          <span className="label-caps">System</span>
        </div>
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
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
              <span className={cn(
                "font-medium tracking-tight",
                isActive ? "text-surface-950" : ""
              )}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Brand footer */}
        <div className="px-1 pt-3 mt-1">
          <div className="divider-brass mb-2" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[11px] text-surface-700 tracking-tight-display">
              Marco Reid
            </span>
            <span className="font-display text-[11px] italic text-brass-500/80">
              Voice
            </span>
          </div>
          <span className="text-[10px] text-surface-600 font-mono block mt-0.5">
            v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
}
