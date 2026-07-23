import { useEffect, useState } from "react";

/**
 * Content of the always-on-top recording indicator window. Deliberately
 * honest: red dot, elapsed time, and a Stop button — Voxlen never records
 * covertly. Created/destroyed by the Rust meeting commands (fail-closed:
 * capture aborts if this window cannot be shown).
 */
export function MeetingIndicator() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  const stop = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("stop_meeting_capture");
    } catch {
      // Non-Tauri / already stopped.
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center gap-2.5 h-screen w-screen px-3 bg-surface-0 border border-red-500/40 rounded-lg select-none cursor-move"
    >
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      <span className="text-[12px] font-semibold text-surface-950 shrink-0">Recording</span>
      <span className="text-[12px] font-mono text-surface-700 tabular-nums flex-1">
        {mins}:{String(secs).padStart(2, "0")}
      </span>
      <button
        onClick={stop}
        className="text-[11px] font-semibold px-2.5 py-1 rounded bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors shrink-0"
      >
        Stop
      </button>
    </div>
  );
}
