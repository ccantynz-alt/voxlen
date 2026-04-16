import { useEffect, useState } from "react";
import { KeyRound, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useEntitlementStore, Tier } from "@/stores/entitlement";

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  professional: "Professional",
  lifetime: "Lifetime",
};

const TIER_DESCRIPTIONS: Record<Tier, string> = {
  free: "Limited to 500 words/week. AI grammar and premium engines locked.",
  pro: "Unlimited dictation. AI grammar. All speech engines. All devices.",
  professional: "Everything in Pro plus zero-retention, per-matter vocabulary, audit logs, and SSO.",
  lifetime: "Everything in Pro. Lifetime updates. Direct founder support.",
};

function formatExpiry(ts: number | null): string | null {
  if (ts === null) return null;
  try {
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export function LicenseSettings() {
  const { tier, email, expires, valid, reason, isLoaded, refresh, activate, clear } =
    useEntitlementStore();

  const [keyInput, setKeyInput] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isLoaded) refresh();
  }, [isLoaded, refresh]);

  const handleActivate = async () => {
    setError(null);
    setSuccess(false);
    setActivating(true);
    const err = await activate(keyInput);
    setActivating(false);
    if (err) {
      setError(err);
      return;
    }
    setKeyInput("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleClear = async () => {
    if (!confirm("Remove your license and drop back to the Free tier?")) return;
    await clear();
    setSuccess(false);
    setError(null);
  };

  const expiryLabel = formatExpiry(expires);
  const badCurrentLicense = !valid && reason !== null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-surface-950 mb-1">License</h2>
        <p className="text-sm text-surface-700">
          Activate Pro, Professional, or Lifetime to unlock unlimited dictation and AI grammar.
        </p>
      </div>

      {/* Current tier card */}
      <div className="mb-6 p-5 rounded-lg border border-surface-300/60 bg-surface-50/50">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              tier === "free"
                ? "bg-surface-200 text-surface-700"
                : "bg-brass-100 text-brass-700"
            }`}
          >
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-base font-semibold text-surface-950">
                {TIER_LABELS[tier]}
              </span>
              {tier !== "free" && valid && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-surface-700 mt-0.5">{TIER_DESCRIPTIONS[tier]}</p>
            {email && (
              <p className="text-xs text-surface-600 mt-2 font-mono">Licensed to {email}</p>
            )}
            {expiryLabel && (
              <p className="text-xs text-surface-600 mt-1">Renews {expiryLabel}</p>
            )}
            {badCurrentLicense && (
              <p className="text-xs text-red-700 mt-2 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Installed license is invalid: {reason}. Paste a new key below or contact support.
                </span>
              </p>
            )}
          </div>
          {tier !== "free" && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Activation form */}
      <div className="p-5 rounded-lg border border-surface-300/60">
        <label className="block text-sm font-medium text-surface-950 mb-2">
          Activate a license key
        </label>
        <p className="text-xs text-surface-700 mb-3">
          Paste the key you received after purchasing. Activation happens entirely on your device
          — nothing is sent to our servers.
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="VOXLEN-..."
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            disabled={activating}
            className="font-mono text-xs flex-1"
          />
          <Button
            onClick={handleActivate}
            disabled={activating || keyInput.trim().length === 0}
          >
            {activating ? "Activating…" : "Activate"}
          </Button>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-700 flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 text-xs text-green-700 flex items-start gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            License activated.
          </p>
        )}
      </div>

      {/* Purchase links */}
      {tier === "free" && (
        <div className="mt-6 p-5 rounded-lg bg-surface-50/50 border border-surface-300/60">
          <p className="text-sm text-surface-900 font-medium mb-2">Need a license?</p>
          <p className="text-xs text-surface-700 mb-3">
            Pro ($29/month), Professional for legal and accounting teams ($79/month), or Lifetime
            ($599 one-time). All AI infrastructure included — no API keys required.
          </p>
          <a
            href="https://voxlen.ai/#pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-brass-700 hover:text-brass-800 font-medium"
          >
            View pricing
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
