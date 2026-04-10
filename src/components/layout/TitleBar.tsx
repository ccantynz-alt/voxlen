import {} from "react";
import { Minus, Square, X, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { useDictationStore } from "@/stores/dictation";

declare global {
  interface Window {
    __TAURI__?: {
      window: {
        getCurrent: () => {
          minimize: () => Promise<void>;
          toggleMaximize: () => Promise<void>;
          hide: () => Promise<void>;
          startDragging: () => Promise<void>;
        };
      };
    };
  }
}

export function TitleBar() {
  const status = useDictationStore((s) => s.status);

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch {
      // Not in Tauri environment
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch {
      // Not in Tauri environment
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    } catch {
      // Not in Tauri environment
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-11 px-4 bg-surface-50/80 backdrop-blur-xl border-b border-surface-300/50 select-none shrink-0"
    >
      {/* Left: App identity */}
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-voxlen-600">
          <Mic className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-surface-900 tracking-tight">
          Voxlen
        </span>
        <Badge
          variant={
            status === "listening"
              ? "success"
              : status === "processing"
                ? "info"
                : status === "error"
                  ? "error"
                  : "default"
          }
          dot
        >
          {status === "idle" && "Ready"}
          {status === "listening" && "Listening"}
          {status === "processing" && "Processing"}
          {status === "paused" && "Paused"}
          {status === "error" && "Error"}
        </Badge>
      </div>

      {/* Right: Window controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className={cn(
            "flex items-center justify-center w-8 h-7 rounded-md",
            "text-surface-700 hover:bg-surface-300 hover:text-surface-900 transition-colors"
          )}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className={cn(
            "flex items-center justify-center w-8 h-7 rounded-md",
            "text-surface-700 hover:bg-surface-300 hover:text-surface-900 transition-colors"
          )}
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={handleClose}
          className={cn(
            "flex items-center justify-center w-8 h-7 rounded-md",
            "text-surface-700 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
