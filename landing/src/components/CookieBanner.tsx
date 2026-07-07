import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

// Honest privacy notice: this site sets no tracking or advertising cookies and
// loads no analytics. It only uses essential browser localStorage (sign-in
// session, waitlist backup, and remembering that this notice was dismissed).
const STORAGE_KEY = "voxlen_cookie_consent";

function hasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return true; // storage unavailable — don't nag on every render
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() })
    );
  } catch {
    // Storage unavailable — ignore
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasDismissed()) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    saveDismissed();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacy notice"
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-rule bg-white shadow-[0_-1px_3px_rgba(29,26,21,0.06)]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Shield className="h-4 w-4 text-brass mt-0.5 shrink-0" aria-hidden="true" />
            <p className="font-sans text-sm text-ink-soft leading-relaxed">
              This site uses no tracking or advertising cookies and no analytics. We only use
              essential browser storage to remember your sign-in and preferences.{" "}
              <a
                href="/privacy"
                className="text-brass hover:text-brass-deep underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm"
              >
                Privacy Policy
              </a>
            </p>
          </div>
          <div className="sm:shrink-0">
            <button
              type="button"
              onClick={dismiss}
              className="h-9 px-5 rounded-md bg-brass hover:bg-brass-deep text-paper font-sans text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-white whitespace-nowrap"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
