import { useEffect, useState } from "react";
import { X, ChevronDown, ChevronUp, Shield } from "lucide-react";

interface CookieConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const STORAGE_KEY = "voxlen_cookie_consent";

function loadConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "necessary" in parsed &&
      "analytics" in parsed &&
      "marketing" in parsed
    ) {
      return parsed as CookieConsent;
    }
    // Legacy string value — treat as "accept all" already given
    return { necessary: true, analytics: true, marketing: false, timestamp: Date.now() };
  } catch {
    return null;
  }
}

function saveConsent(consent: CookieConsent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Storage unavailable — ignore
  }
}

interface CookieCategory {
  id: "necessary" | "analytics" | "marketing";
  label: string;
  description: string;
  alwaysOn: boolean;
}

const CATEGORIES: CookieCategory[] = [
  {
    id: "necessary",
    label: "Necessary",
    description:
      "Essential cookies required for the site to function. They enable core features like remembering your preferences and keeping you signed in. These cannot be disabled.",
    alwaysOn: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    description:
      "Google Analytics cookies that help us understand how visitors interact with the site — which pages are visited, how long sessions last, and where traffic comes from. All data is anonymous and aggregated.",
    alwaysOn: false,
  },
  {
    id: "marketing",
    label: "Marketing",
    description:
      "Cookies used to deliver relevant advertisements and track campaign performance. Currently disabled by default. We will only enable these with your explicit consent.",
    alwaysOn: false,
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Toggle ${label}`}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7345d1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#18181b] ${
        checked
          ? disabled
            ? "bg-[#7345d1]/50 cursor-not-allowed"
            : "bg-[#7345d1] cursor-pointer"
          : "bg-zinc-700 cursor-pointer"
      } ${disabled ? "opacity-70" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

interface SettingsModalProps {
  analytics: boolean;
  marketing: boolean;
  onToggle: (id: "analytics" | "marketing", value: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

function SettingsModal({ analytics, marketing, onToggle, onSave, onClose }: SettingsModalProps) {
  const toggleValues: Record<"necessary" | "analytics" | "marketing", boolean> = {
    necessary: true,
    analytics,
    marketing,
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cookie Settings"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-lg rounded-2xl bg-[#18181b] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#7345d1]" />
            <h2 className="text-base font-bold text-white">Cookie Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cookie settings"
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7345d1]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Categories */}
        <div className="px-6 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-white">{cat.label}</span>
                  {cat.alwaysOn && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-400 uppercase tracking-wide">
                      Always on
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{cat.description}</p>
              </div>
              <div className="shrink-0 mt-0.5">
                <Toggle
                  checked={toggleValues[cat.id]}
                  onChange={(v) => {
                    if (cat.id !== "necessary") onToggle(cat.id, v);
                  }}
                  disabled={cat.alwaysOn}
                  label={cat.label}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7345d1]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="h-10 px-5 rounded-xl bg-[#7345d1] hover:bg-[#6035bb] text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7345d1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#18181b]"
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = (consent: Omit<CookieConsent, "necessary" | "timestamp">) => {
    saveConsent({ necessary: true, ...consent, timestamp: Date.now() });
    setVisible(false);
    setSettingsOpen(false);
  };

  const acceptAll = () => dismiss({ analytics: true, marketing: true });
  const acceptNecessary = () => dismiss({ analytics: false, marketing: false });

  const saveSettings = () => {
    dismiss({ analytics: analyticsEnabled, marketing: marketingEnabled });
  };

  return (
    <>
      {/* Banner */}
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Cookie consent"
        className="fixed bottom-0 left-0 right-0 z-[60] border-t border-white/10 bg-[#18181b]/95 backdrop-blur-xl shadow-2xl"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-300 leading-relaxed">
                We use cookies to improve your experience. By continuing, you agree to our use of analytics cookies.{" "}
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-[#a78bfa] hover:text-[#c4b5fd] underline underline-offset-2 text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7345d1] rounded"
                  aria-expanded={detailsOpen}
                >
                  Cookie Settings
                  {detailsOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </p>

              {/* Inline details summary */}
              {detailsOpen && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.04] border border-white/5 text-xs text-zinc-400 leading-relaxed"
                    >
                      <span className="font-semibold text-zinc-200 shrink-0">{cat.label}:</span>
                      <span>{cat.description.split(".")[0]}.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="h-9 px-4 rounded-xl text-sm font-medium text-zinc-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7345d1] whitespace-nowrap"
                aria-label="Open cookie settings modal"
              >
                Manage
              </button>
              <button
                type="button"
                onClick={acceptNecessary}
                className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7345d1] whitespace-nowrap"
              >
                Necessary Only
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="h-9 px-4 rounded-xl bg-[#7345d1] hover:bg-[#6035bb] text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7345d1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#18181b] whitespace-nowrap"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <SettingsModal
          analytics={analyticsEnabled}
          marketing={marketingEnabled}
          onToggle={(id, value) => {
            if (id === "analytics") setAnalyticsEnabled(value);
            if (id === "marketing") setMarketingEnabled(value);
          }}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
