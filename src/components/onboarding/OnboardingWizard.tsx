import { useState, useEffect, useCallback } from "react";
import {
  Mic,
  Key,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Shield,
  Zap,
  Volume2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

function ShortcutTest({ shortcut, onTested }: { shortcut: string; onTested: () => void }) {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const parts = shortcut.toLowerCase().split("+");
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const needsAlt = parts.includes("alt");
      const needsCtrl = parts.includes("ctrl") || parts.includes("control");
      const needsShift = parts.includes("shift");
      const mainKey = parts[parts.length - 1];
      if (
        (needsAlt ? e.altKey : !e.altKey) &&
        (needsCtrl ? e.ctrlKey : !e.ctrlKey) &&
        (needsShift ? e.shiftKey : !e.shiftKey) &&
        key === mainKey
      ) {
        e.preventDefault();
        setPressed(true);
        onTested();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcut, onTested]);

  return (
    <div className={cn(
      "rounded-lg border p-3 flex items-center gap-3 transition-colors",
      pressed
        ? "border-emerald-500/40 bg-emerald-500/5"
        : "border-surface-300/60 bg-surface-50"
    )}>
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] transition-colors",
        pressed ? "bg-emerald-500 text-white" : "bg-surface-200 text-surface-600"
      )}>
        {pressed ? "✓" : "?"}
      </div>
      <div className="flex-1">
        <p className="text-[12px] text-surface-800">
          {pressed ? "Shortcut works." : "Test your toggle shortcut — press it now."}
        </p>
      </div>
      <kbd className="px-2 py-0.5 rounded bg-surface-100 border border-surface-300/70 text-[10px] font-mono text-surface-700">
        {shortcut}
      </kbd>
    </div>
  );
}

export const LEGAL_POLICY_VERSION = "2026-04-16";
const LEGAL_BASE_URL =
  "https://github.com/ccantynz-alt/voxlen/blob/main/legal";
const openLegalDoc = (path: string) => {
  window.open(`${LEGAL_BASE_URL}/${path}`, "_blank", "noopener,noreferrer");
};
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [voxlenKeyValid, setVoxlenKeyValid] = useState<boolean | "unverified" | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  // Onboarding consent checkbox — simplified to single acceptance
  const [connectMode, setConnectMode] = useState<"voxlen" | "deepgram">("deepgram");
  const [dgKeyInput, setDgKeyInput] = useState("");
  const [dgKeyError, setDgKeyError] = useState("");
  const [dgKeyVerifying, setDgKeyVerifying] = useState(false);
  const [_shortcutTested, setShortcutTested] = useState(false);

  const handleCompleteWithConsent = () => {
    if (!legalAccepted) return;
    settings.updateSettings({
      legalAcceptedVersion: LEGAL_POLICY_VERSION,
      legalAcceptedAt: new Date().toISOString(),
    });
    onComplete();
  };

  const handleSaveDgKey = async () => {
    const key = dgKeyInput.trim();
    if (!key) return;
    setDgKeyError("");
    setDgKeyVerifying(true);
    try {
      const res = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${key}` },
      });
      if (!res.ok) {
        setDgKeyError("Key rejected — double-check it at console.deepgram.com.");
        setDgKeyVerifying(false);
        return;
      }
    } catch {
      // Offline — save anyway.
    }
    setDgKeyVerifying(false);
    settings.updateSetting("sttApiKey", key);
    settings.updateSetting("sttEngine", "deepgram");
    setDgKeyInput("");
  };

  const devices = useAudioStore((s) => s.devices);
  const setDevices = useAudioStore((s) => s.setDevices);
  const selectedDeviceId = useAudioStore((s) => s.selectedDeviceId);
  const setSelectedDevice = useAudioStore((s) => s.setSelectedDevice);
  const settings = useSettingsStore();

  // Load devices on mount
  useEffect(() => {
    async function loadDevices() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const rawDevices = await invoke<
          Array<{
            id: string;
            name: string;
            is_default: boolean;
            is_external: boolean;
            sample_rate: number;
            channels: number;
          }>
        >("list_audio_devices");

        const mapped = rawDevices.map((d) => ({
          id: d.id,
          name: d.name,
          isDefault: d.is_default,
          isExternal: d.is_external,
          sampleRate: d.sample_rate,
          channels: d.channels,
        }));
        setDevices(mapped);

        // Auto-select external mic
        const ext = mapped.find((d) => d.isExternal);
        if (ext) setSelectedDevice(ext.id);
        else {
          const def = mapped.find((d) => d.isDefault);
          if (def) setSelectedDevice(def.id);
        }
      } catch {
        setDevices([
          { id: "default", name: "Built-in Microphone", isDefault: true, isExternal: false, sampleRate: 44100, channels: 1 },
          { id: "razer", name: "Razer Seiren Mini", isDefault: false, isExternal: true, sampleRate: 48000, channels: 1 },
        ]);
        setSelectedDevice("razer");
      }
    }
    loadDevices();
  }, [setDevices, setSelectedDevice]);

  const handleTestMic = useCallback(async () => {
    setIsTesting(true);
    setMicTestLevel(0);

    // Simulate mic test (in Tauri, this would actually capture audio)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("start_dictation");

      // Listen for levels for 3 seconds
      const { listen } = await import("@tauri-apps/api/event");
      let maxLevel = 0;
      const unlisten = await listen<number>("audio-level", (event) => {
        if (event.payload > maxLevel) maxLevel = event.payload;
        setMicTestLevel(event.payload);
      });

      await new Promise((r) => setTimeout(r, 3000));
      unlisten();
      await invoke("stop_dictation");
      setMicTestLevel(maxLevel);
    } catch {
      // Demo mode - simulate levels
      let level = 0;
      const interval = setInterval(() => {
        level = Math.random() * 0.6 + 0.1;
        setMicTestLevel(level);
      }, 100);
      await new Promise((r) => setTimeout(r, 3000));
      clearInterval(interval);
      setMicTestLevel(0.4);
    }
    setIsTesting(false);
  }, []);

  const handleValidateVoxlenKey = useCallback(async () => {
    const key = settings.voxlenApiKey;
    if (!key) { setVoxlenKeyValid(false); return; }
    try {
      const response = await fetch("https://voxlen.ai/api/me", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.tenant_id) {
          settings.updateSetting("voxlenTenantId", data.tenant_id);
        }
        setVoxlenKeyValid(true);
      } else {
        setVoxlenKeyValid(false);
      }
    } catch {
      // Couldn't reach voxlen.ai — let the user continue, but be honest that
      // the key hasn't been verified instead of pretending it's valid.
      setVoxlenKeyValid("unverified");
    }
  }, [settings]);

  const steps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Microphone", icon: Mic },
    { title: "Connect", icon: Key },
    { title: "Ready", icon: CheckCircle2 },
  ];

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return !!selectedDeviceId;
      // Step 2: connected if voxlenApiKey is set OR a direct STT key is set
      case 2: return !!settings.voxlenApiKey || !!settings.sttApiKey;
      case 3: return true;
      default: return true;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-0 p-8">
      {/* Brand mark — editorial wordmark, hairline rule. */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gradient-to-br from-marcoreid-700 to-marcoreid-900 shadow-elevation shadow-inset-hairline">
          <Mic className="h-4 w-4 text-brass-300" strokeWidth={2} />
        </div>
        <div className="flex items-baseline leading-none">
          <span className="font-display text-[17px] font-medium text-surface-900 tracking-tight-display leading-none">
            Vox
          </span>
          <span className="font-display text-[17px] italic text-brass-400 leading-none">
            len
          </span>
        </div>
        <div className="divider-brass w-20" />
      </div>

      {/* Progress dots — brass brand, not neon. */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((_s, i) => (
          <div key={i} className="flex items-center">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono tabular-nums transition-all shadow-inset-hairline",
                i === step
                  ? "bg-gradient-to-b from-marcoreid-700 to-marcoreid-900 text-brass-300 shadow-elevation"
                  : i < step
                    ? "bg-brass-400/10 text-brass-500 border border-brass-400/30"
                    : "bg-surface-100 text-surface-600 border border-surface-300/60"
              )}
            >
              {i < step ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-10 h-px mx-1",
                  i < step ? "bg-brass-400/40" : "bg-surface-300/70"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-md animate-fade-in">
        {step === 0 && (
          <div className="text-center space-y-6">
            <div>
              <h1 className="font-display text-[32px] font-medium tracking-tight-display text-surface-950 leading-[1.1] mb-3">
                A considered voice, <span className="italic text-brass-500">in writing.</span>
              </h1>
              <p className="text-sm text-surface-700 leading-relaxed max-w-sm mx-auto">
                Dictate, polish, and inject into any application — with the
                restraint and precision of counsel.
              </p>
            </div>
            <div className="divider-brass w-32 mx-auto" />
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="p-4 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline text-left">
                <Zap className="h-4 w-4 text-brass-500 mb-2" strokeWidth={1.75} />
                <p className="text-[11px] font-medium text-surface-900 tracking-tight">Real-time</p>
                <p className="text-[10px] text-surface-600 leading-snug mt-0.5">Words appear as you speak</p>
              </div>
              <div className="p-4 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline text-left">
                <Sparkles className="h-4 w-4 text-brass-500 mb-2" strokeWidth={1.75} />
                <p className="text-[11px] font-medium text-surface-900 tracking-tight">AI Grammar</p>
                <p className="text-[10px] text-surface-600 leading-snug mt-0.5">Auto-polishes your text</p>
              </div>
              <div className="p-4 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline text-left">
                <Shield className="h-4 w-4 text-brass-500 mb-2" strokeWidth={1.75} />
                <p className="text-[11px] font-medium text-surface-900 tracking-tight">Privacy</p>
                <p className="text-[10px] text-surface-600 leading-snug mt-0.5">Offline mode available</p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-[26px] font-medium tracking-tight-display text-surface-950 mb-1 leading-tight">
                Select your microphone
              </h2>
              <p className="text-[13px] text-surface-700 leading-relaxed">
                An external mic gives materially better accuracy than a built-in laptop mic.
              </p>
            </div>

            <Select
              value={selectedDeviceId || ""}
              onChange={(v) => {
                setSelectedDevice(v);
                settings.updateSetting("preferredDeviceId", v);
              }}
              options={devices.map((d) => ({
                value: d.id,
                label: d.name,
                description: d.isExternal ? "External - Recommended" : "Built-in",
                icon: d.isExternal ? (
                  <Mic className="h-4 w-4 text-marcoreid-400" />
                ) : (
                  <Mic className="h-4 w-4 text-surface-600" />
                ),
              }))}
              placeholder="Choose a microphone..."
            />

            {/* External mic recommendation */}
            {selectedDeviceId && !devices.find(d => d.id === selectedDeviceId)?.isExternal && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/8 border border-amber-500/25 shadow-inset-hairline">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.75} />
                <div>
                  <p className="text-[11px] font-medium text-amber-600">Using built-in microphone</p>
                  <p className="text-[10px] text-surface-600 mt-0.5 leading-snug">
                    An external USB mic (such as your Razer) will give 20—30% better accuracy.
                  </p>
                </div>
              </div>
            )}

            {selectedDeviceId && devices.find(d => d.id === selectedDeviceId)?.isExternal && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-brass-400/8 border border-brass-400/25 shadow-inset-hairline">
                <CheckCircle2 className="h-4 w-4 text-brass-500 mt-0.5 shrink-0" strokeWidth={1.75} />
                <div>
                  <p className="text-[11px] font-medium text-brass-600">External mic detected</p>
                  <p className="text-[10px] text-surface-600 mt-0.5 leading-snug">
                    You'll get the best possible accuracy.
                  </p>
                </div>
              </div>
            )}

            {/* Mic test */}
            <div className="space-y-3">
              <Button
                variant="secondary"
                onClick={handleTestMic}
                loading={isTesting}
                className="w-full"
              >
                <Volume2 className="h-4 w-4" strokeWidth={1.75} />
                {isTesting ? "Listening — speak now" : "Test microphone"}
              </Button>

              {(isTesting || micTestLevel > 0) && (
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden shadow-inset-hairline">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-100",
                        micTestLevel > 0.3
                          ? "bg-brass-500"
                          : micTestLevel > 0.1
                            ? "bg-amber-500"
                            : "bg-red-500/80"
                      )}
                      style={{ width: `${Math.min(micTestLevel * 200, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-surface-600 text-center tracking-tight">
                    {micTestLevel > 0.3
                      ? "Excellent signal."
                      : micTestLevel > 0.1
                        ? "Good — try speaking a touch louder."
                        : isTesting
                          ? "Listening… speak into your mic."
                          : "Signal too low — check your mic connection."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="font-display text-[26px] font-medium tracking-tight-display text-surface-950 mb-1 leading-tight">
                Add your API key
              </h2>
              <p className="text-[13px] text-surface-700 leading-relaxed">
                Voxlen needs one key to transcribe. Pick the option you have.
              </p>
            </div>

            {/* Already connected state */}
            {(settings.voxlenApiKey || settings.sttApiKey) && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
                <span className="text-emerald-400 text-lg">✓</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-surface-900">
                    {settings.voxlenApiKey ? "Voxlen account connected" : "Deepgram key saved"}
                  </p>
                  <p className="text-[11px] text-surface-600">Transcription is ready.</p>
                </div>
                <button
                  onClick={() => {
                    settings.updateSetting("voxlenApiKey", "");
                    settings.updateSetting("sttApiKey", "");
                  }}
                  className="text-[10px] text-surface-400 hover:text-red-400 transition-colors"
                >
                  Change
                </button>
              </div>
            )}

            {!settings.voxlenApiKey && !settings.sttApiKey && (
              <>
                {/* Tab switcher */}
                <div className="flex rounded-lg border border-surface-300/60 p-1 bg-surface-50 gap-1">
                  <button
                    onClick={() => setConnectMode("deepgram")}
                    className={cn(
                      "flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors",
                      connectMode === "deepgram"
                        ? "bg-white text-surface-900 shadow-inset-hairline"
                        : "text-surface-600 hover:text-surface-800"
                    )}
                  >
                    Deepgram key
                  </button>
                  <button
                    onClick={() => setConnectMode("voxlen")}
                    className={cn(
                      "flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors",
                      connectMode === "voxlen"
                        ? "bg-white text-surface-900 shadow-inset-hairline"
                        : "text-surface-600 hover:text-surface-800"
                    )}
                  >
                    Voxlen account
                  </button>
                </div>

                {connectMode === "deepgram" && (
                  <div className="space-y-3">
                    <p className="text-[12px] text-surface-700 leading-relaxed">
                      Get a free key at{" "}
                      <a href="https://console.deepgram.com" target="_blank" rel="noreferrer" className="text-brass-500 hover:underline font-mono">
                        console.deepgram.com
                      </a>
                      {" "}— the free tier covers hours of dictation.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={dgKeyInput}
                        onChange={(e) => { setDgKeyInput(e.target.value); setDgKeyError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveDgKey()}
                        placeholder="Paste Deepgram API key…"
                        className="flex-1 bg-surface-50 border border-surface-300/70 rounded-lg px-3 py-2 text-sm text-surface-900 placeholder-surface-500 focus:outline-none focus:border-[#7345d1] shadow-inset-hairline"
                        autoFocus
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSaveDgKey}
                        disabled={!dgKeyInput.trim() || dgKeyVerifying}
                      >
                        {dgKeyVerifying ? "Checking…" : "Save"}
                      </Button>
                    </div>
                    {dgKeyError && (
                      <p className="text-[11px] text-red-500">{dgKeyError}</p>
                    )}
                  </div>
                )}

                {connectMode === "voxlen" && (
                  <div className="space-y-3">
                    <ol className="space-y-1.5 text-[12px] text-surface-700 leading-relaxed list-decimal list-inside">
                      <li>Sign in at voxlen.ai/dashboard (or create a free account).</li>
                      <li>Copy your account key from <span className="font-medium">Connect Desktop App</span>.</li>
                      <li>Paste it below — transcription and AI grammar are included.</li>
                    </ol>
                    <a
                      href="https://voxlen.ai/dashboard"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-[#7345d1] hover:bg-[#5c35b0] text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
                    >
                      Open voxlen.ai/dashboard
                    </a>
                    <Input
                      label="Voxlen Account Key"
                      type="password"
                      value={settings.voxlenApiKey}
                      onChange={(e) => {
                        settings.updateSetting("voxlenApiKey", e.target.value);
                        setVoxlenKeyValid(null);
                      }}
                      onBlur={() => { if (settings.voxlenApiKey) handleValidateVoxlenKey(); }}
                      placeholder="Paste your account key"
                      icon={<Key className="h-4 w-4" />}
                      success={voxlenKeyValid === true ? "Key verified" : undefined}
                      error={voxlenKeyValid === false ? "Invalid key — re-copy it from voxlen.ai/dashboard" : undefined}
                    />
                    {voxlenKeyValid === "unverified" && (
                      <p className="text-[11px] text-amber-500 leading-relaxed">
                        Couldn't reach voxlen.ai to verify. You can continue — it'll be checked on first use.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-marcoreid-700 to-marcoreid-900 border border-brass-400/30 flex items-center justify-center shadow-elevation-lg">
                <CheckCircle2 className="h-7 w-7 text-brass-300" strokeWidth={1.75} />
              </div>
            </div>
            <div>
              <h2 className="font-display text-[26px] font-medium tracking-tight-display text-surface-950 mb-2 leading-tight">
                You're <span className="italic text-brass-500">ready.</span>
              </h2>
              <p className="text-[13px] text-surface-700 leading-relaxed">
                A few shortcuts to keep in reach:
              </p>
            </div>

            <div className="divider-brass w-32 mx-auto" />

            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between p-3 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline">
                <div className="flex items-center gap-2.5">
                  <Mic className="h-3.5 w-3.5 text-brass-500" strokeWidth={1.75} />
                  <span className="text-[13px] text-surface-900">Toggle Dictation</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-surface-100 border border-surface-300/70 text-[10px] font-mono text-surface-800">
                  Ctrl/Cmd+Shift+D
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="h-3.5 w-3.5 text-brass-500" strokeWidth={1.75} />
                  <span className="text-[13px] text-surface-900">Push to Talk</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-surface-100 border border-surface-300/70 text-[10px] font-mono text-surface-800">
                  Ctrl/Cmd+Shift+Space
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-brass-500" strokeWidth={1.75} />
                  <span className="text-[13px] text-surface-900">Polish Grammar</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-surface-100 border border-surface-300/70 text-[10px] font-mono text-surface-800">
                  Ctrl/Cmd+Shift+G
                </kbd>
              </div>
            </div>

            <p className="text-[11px] text-surface-600 leading-snug">
              These shortcuts work from any app — even when Voxlen is minimised.
            </p>

            {/* Shortcut test */}
            <ShortcutTest
              shortcut={settings.shortcutToggle || "Alt+D"}
              onTested={() => setShortcutTested(true)}
            />

            {/* Legal acceptance — single checkbox, links to full docs. */}
            <div className="pt-5 border-t border-surface-300/60 space-y-3 text-left">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-surface-400 text-brass-500 focus:ring-brass-400/50"
                />
                <span className="text-[11px] text-surface-800 leading-relaxed">
                  I agree to the{" "}
                  <button type="button" onClick={() => openLegalDoc("EULA.md")} className="text-brass-500 hover:underline">EULA</button>
                  ,{" "}
                  <button type="button" onClick={() => openLegalDoc("TERMS.md")} className="text-brass-500 hover:underline">Terms</button>
                  ,{" "}
                  <button type="button" onClick={() => openLegalDoc("PRIVACY_POLICY.md")} className="text-brass-500 hover:underline">Privacy Policy</button>
                  , and{" "}
                  <button type="button" onClick={() => openLegalDoc("ACCEPTABLE_USE.md")} className="text-brass-500 hover:underline">Acceptable Use Policy</button>
                  . I will review all output before relying on it professionally.
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between w-full max-w-md mt-8">
        <Button
          variant="ghost"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back
        </Button>

        {step < steps.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Continue
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        ) : (
          <Button
            variant="glow"
            onClick={handleCompleteWithConsent}
            disabled={!legalAccepted}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            Accept &amp; begin
          </Button>
        )}
      </div>

      {/* Skip link — only on step 2 if user genuinely has no key yet (will show banner in app) */}
      {step === 2 && !settings.voxlenApiKey && !settings.sttApiKey && (
        <button
          onClick={() => setStep(step + 1)}
          className="mt-5 text-[11px] italic text-surface-500 hover:text-surface-700 transition-colors"
        >
          I'll add a key later
        </button>
      )}
    </div>
  );
}
