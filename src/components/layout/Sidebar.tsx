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
    <div className="flex flex-col w-[220px] h-full bg-surface-50 border-r border-surface-300/50 shrink-0">
      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-voxlen-600/10 text-voxlen-400"
                  : "text-surface-700 hover:bg-surface-200 hover:text-surface-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-voxlen-400" : "text-surface-600"
                )}
              />
              <div className="flex flex-col items-start min-w-0">
                <span className="font-medium truncate">{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="px-2 py-3 border-t border-surface-300/50 space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-voxlen-600/10 text-voxlen-400"
                  : "text-surface-700 hover:bg-surface-200 hover:text-surface-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-voxlen-400" : "text-surface-600"
                )}
              />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}

        {/* Version info */}
        <div className="px-3 pt-2">
          <span className="text-[10px] text-surface-600 font-mono">
            Voxlen v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
}
