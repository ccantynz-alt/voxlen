import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { useSettingsStore } from "@/stores/settings";
import { VOICE_COMMANDS } from "@/lib/constants";

/**
 * Global keyboard shortcut cheatsheet. Open with `?` or `Ctrl/Cmd+/`
 * from anywhere in the app. Reads live shortcut bindings from settings
 * so re-maps stay accurate.
 */
export function ShortcutsCheatsheet() {
  const [open, setOpen] = useState(false);

  const shortcutToggle = useSettingsStore((s) => s.shortcutToggle);
  const shortcutPushToTalk = useSettingsStore((s) => s.shortcutPushToTalk);
  const shortcutCancel = useSettingsStore((s) => s.shortcutCancel);
  const shortcutCorrectGrammar = useSettingsStore(
    (s) => s.shortcutCorrectGrammar
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Avoid hijacking typing in inputs/textareas/contentEditable.
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (inEditable) return;

      const isHelp =
        (e.key === "?" && !e.ctrlKey && !e.metaKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === "/");

      if (isHelp) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const globalShortcuts: Array<{ label: string; keys: string }> = [
    { label: "Toggle dictation", keys: shortcutToggle },
    { label: "Push-to-talk (hold)", keys: shortcutPushToTalk },
    { label: "Cancel / stop", keys: shortcutCancel },
    { label: "Correct grammar on last segment", keys: shortcutCorrectGrammar },
  ].filter((s) => !!s.keys);

  const appShortcuts: Array<{ label: string; keys: string }> = [
    { label: "Open this cheatsheet", keys: "?  or  Ctrl/Cmd+/" },
    { label: "Close dialog", keys: "Esc" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] overflow-auto rounded-xl border border-surface-300/60 bg-surface-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300/50 sticky top-0 bg-surface-50/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-200">
              <Keyboard className="h-4 w-4 text-surface-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-950">
                Keyboard shortcuts
              </h2>
              <p className="text-[11px] text-surface-600">
                Press <KeyHint>?</KeyHint> any time to open this list.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-surface-600 hover:text-surface-900 transition-colors p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Global">
            {globalShortcuts.map((row) => (
              <Row key={row.label} label={row.label} keys={row.keys} />
            ))}
          </Section>
          <Section title="App">
            {appShortcuts.map((row) => (
              <Row key={row.label} label={row.label} keys={row.keys} />
            ))}
          </Section>
          <Section title="Voice commands" className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
              {VOICE_COMMANDS.map((c) => (
                <div
                  key={c.command}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-surface-600 font-mono text-[12px]">
                    "{c.command}"
                  </span>
                  <span className="text-surface-900 truncate ml-3">
                    {c.description}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="text-[10px] font-medium uppercase tracking-wide-caps text-surface-600 mb-2">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-surface-900">{label}</span>
      <KeyHint>{humanizeBinding(keys)}</KeyHint>
    </div>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-surface-300/70 bg-surface-100 text-[11px] text-surface-900 font-mono shadow-inset-hairline">
      {children}
    </kbd>
  );
}

function humanizeBinding(binding: string): string {
  if (!binding) return "—";
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  return binding
    .split("+")
    .map((part) => {
      const p = part.trim();
      if (p === "CommandOrControl") return isMac ? "⌘" : "Ctrl";
      if (p === "Command") return "⌘";
      if (p === "Control") return "Ctrl";
      if (p === "Shift") return isMac ? "⇧" : "Shift";
      if (p === "Alt" || p === "Option") return isMac ? "⌥" : "Alt";
      if (p === "Escape") return "Esc";
      if (p === "Space") return "Space";
      return p;
    })
    .join(" + ");
}
