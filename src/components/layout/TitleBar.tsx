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
      className="flex items-center justify-between h-12 px-5 bg-surface-50/90 backdrop-blur-xl border-b border-surface-300/60 select-none shrink-0"
    >
      {/* Left: App identity — editorial serif wordmark with brass inflection. */}
      <div className="flex items-center gap-3" data-tauri-drag-region>
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-marcoreid-700 to-marcoreid-900 shadow-inset-hairline">
          <Mic className="h-3.5 w-3.5 text-brass-300" strokeWidth={2} />
        </div>
        <div className="flex items-baseline leading-none">
          <span className="font-display text-[15px] font-medium text-surface-900 tracking-tight-display leading-none">
            Vox
          </span>
          <span className="font-display text-[15px] italic text-brass-400 leading-none">
            len
          </span>
        </div>
        <div className="h-4 w-px bg-surface-300/70 mx-1" />
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

      {/* Right: Window controls — refined hover, no neon. */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className={cn(
            "flex items-center justify-center w-8 h-7 rounded-md",
            "text-surface-700 hover:bg-surface-200 hover:text-surface-900 transition-colors duration-200"
          )}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className={cn(
            "flex items-center justify-center w-8 h-7 rounded-md",
            "text-surface-700 hover:bg-surface-200 hover:text-surface-900 transition-colors duration-200"
          )}
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={handleClose}
          className={cn(
            "flex items-center justify-center w-8 h-7 rounded-md",
            "text-surface-700 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-200"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
