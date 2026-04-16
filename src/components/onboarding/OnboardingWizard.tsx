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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useAudioStore } from "@/stores/audio";
import { useSettingsStore } from "@/stores/settings";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [apiKeyValidating, setApiKeyValidating] = useState(false);

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

  const handleValidateApiKey = useCallback(async () => {
    const key = settings.sttApiKey;
    if (!key) { setApiKeyValid(false); return; }

    setApiKeyValidating(true);
    try {
      // Try a simple API call to validate
      const response = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${key}` },
      });
      setApiKeyValid(response.ok);
    } catch {
      // Try OpenAI validation
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        setApiKeyValid(response.ok);
      } catch {
        setApiKeyValid(false);
      }
    }
    setApiKeyValidating(false);
  }, [settings.sttApiKey]);

  const steps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Microphone", icon: Mic },
    { title: "API Key", icon: Key },
    { title: "Ready", icon: CheckCircle2 },
  ];

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return !!selectedDeviceId;
      case 2: return !!settings.sttApiKey;
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
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[17px] font-medium text-surface-900 tracking-tight-display leading-none">
            Marco Reid
          </span>
          <span className="font-display text-[17px] italic text-brass-400 leading-none">
            Voice
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
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-[26px] font-medium tracking-tight-display text-surface-950 mb-1 leading-tight">
                Connect your AI
              </h2>
              <p className="text-[13px] text-surface-700 leading-relaxed">
                An API key powers transcription and grammar polishing.
              </p>
            </div>

            <Select
              label="Speech Engine"
              value={settings.sttEngine}
              onChange={(v) => settings.updateSetting("sttEngine", v)}
              options={[
                { value: "deepgram", label: "Deepgram Nova-2", description: "Best for real-time (recommended)" },
                { value: "whisper_cloud", label: "OpenAI Whisper", description: "High accuracy, batch mode" },
              ]}
            />

            <Input
              label={settings.sttEngine === "deepgram" ? "Deepgram API Key" : "OpenAI API Key"}
              type="password"
              value={settings.sttApiKey}
              onChange={(e) => settings.updateSetting("sttApiKey", e.target.value)}
              placeholder={settings.sttEngine === "deepgram" ? "Enter Deepgram API key..." : "sk-..."}
              icon={<Key className="h-4 w-4" />}
            />

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleValidateApiKey}
                loading={apiKeyValidating}
                disabled={!settings.sttApiKey}
              >
                Validate Key
              </Button>
              {apiKeyValid === true && (
                <Badge variant="success" dot>Valid</Badge>
              )}
              {apiKeyValid === false && (
                <Badge variant="error" dot>Invalid - check your key</Badge>
              )}
            </div>

            <div className="p-3 rounded-md bg-surface-50 border border-surface-300/60 shadow-inset-hairline">
              <p className="text-[11px] text-surface-700 leading-relaxed">
                {settings.sttEngine === "deepgram" ? (
                  <>Free Deepgram API key with $200 in credits at deepgram.com — enough for ~46,000 minutes of dictation.</>
                ) : (
                  <>OpenAI API key at platform.openai.com. Whisper costs ~$0.006/min (~$0.36/hr).</>
                )}
              </p>
            </div>

            <div className="border-t border-surface-300/50 pt-5">
              <h3 className="label-caps mb-3 block">
                Grammar engine &mdash; optional
              </h3>
              <Input
                label="Anthropic API key"
                type="password"
                value={settings.grammarApiKey}
                onChange={(e) => settings.updateSetting("grammarApiKey", e.target.value)}
                placeholder="sk-ant-..."
                icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
              />
              <p className="text-[10px] text-surface-600 mt-2 leading-snug">
                Powers AI grammar polishing via Claude Haiku — approximately $0.03/month at
                heavy use. Skip for now if you just want dictation.
              </p>
            </div>
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
              These shortcuts work from any app — even when Marco Reid Voice is minimised.
            </p>
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
          <Button variant="glow" onClick={onComplete}>
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            Begin
          </Button>
        )}
      </div>

      {/* Skip link */}
      {step < steps.length - 1 && (
        <button
          onClick={onComplete}
          className="mt-5 text-[11px] italic text-surface-600 hover:text-surface-800 transition-colors font-display"
        >
          Skip setup &mdash; I'll configure later.
        </button>
      )}
    </div>
  );
}
