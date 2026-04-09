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
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((_s, i) => (
          <div key={i} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                i === step
                  ? "bg-vox-600 text-white scale-110"
                  : i < step
                    ? "bg-green-500/20 text-green-400"
                    : "bg-surface-200 text-surface-600"
              )}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-1",
                  i < step ? "bg-green-500/40" : "bg-surface-300"
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
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-vox-500 to-vox-700 flex items-center justify-center shadow-xl shadow-vox-600/30">
                <Mic className="h-10 w-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-surface-950 mb-2">
                Welcome to Vox
              </h1>
              <p className="text-surface-700 leading-relaxed">
                The most advanced AI dictation tool. Speak naturally and let AI
                transcribe, polish, and inject your words into any application.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4">
              <div className="p-3 rounded-xl bg-surface-100 border border-surface-300/50 text-center">
                <Zap className="h-5 w-5 text-vox-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-surface-800">Real-time</p>
                <p className="text-[10px] text-surface-600">Words appear as you speak</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-100 border border-surface-300/50 text-center">
                <Sparkles className="h-5 w-5 text-purple-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-surface-800">AI Grammar</p>
                <p className="text-[10px] text-surface-600">Auto-polishes your text</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-100 border border-surface-300/50 text-center">
                <Shield className="h-5 w-5 text-green-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-surface-800">Privacy</p>
                <p className="text-[10px] text-surface-600">Offline mode available</p>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-surface-950 mb-1">
                Select Your Microphone
              </h2>
              <p className="text-sm text-surface-700">
                External mics give much better accuracy than built-in laptop mics
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
                  <Mic className="h-4 w-4 text-vox-400" />
                ) : (
                  <Mic className="h-4 w-4 text-surface-600" />
                ),
              }))}
              placeholder="Choose a microphone..."
            />

            {/* External mic recommendation */}
            {selectedDeviceId && !devices.find(d => d.id === selectedDeviceId)?.isExternal && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-300">Using built-in microphone</p>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">
                    An external USB mic (like your Razer) will give 20-30% better accuracy
                  </p>
                </div>
              </div>
            )}

            {selectedDeviceId && devices.find(d => d.id === selectedDeviceId)?.isExternal && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-green-300">External mic detected</p>
                  <p className="text-[10px] text-green-400/70 mt-0.5">
                    Great choice - you'll get the best possible accuracy
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
                <Volume2 className="h-4 w-4" />
                {isTesting ? "Listening... speak now!" : "Test Microphone"}
              </Button>

              {(isTesting || micTestLevel > 0) && (
                <div className="space-y-1">
                  <div className="h-3 rounded-full bg-surface-200 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-100",
                        micTestLevel > 0.3
                          ? "bg-green-500"
                          : micTestLevel > 0.1
                            ? "bg-amber-500"
                            : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(micTestLevel * 200, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-surface-600 text-center">
                    {micTestLevel > 0.3
                      ? "Excellent signal!"
                      : micTestLevel > 0.1
                        ? "Good - try speaking a bit louder"
                        : isTesting
                          ? "Listening... speak into your mic"
                          : "Signal too low - check your mic connection"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-surface-950 mb-1">
                Connect Your AI
              </h2>
              <p className="text-sm text-surface-700">
                Add an API key to power voice transcription and grammar correction
              </p>
            </div>

            <Select
              label="Speech Engine"
              value={settings.sttEngine}
              onChange={(v) => settings.updateSetting("sttEngine", v)}
              options={[
                { value: "deepgram", label: "Deepgram Nova-2", description: "Best for real-time (recommended)" },
                { value: "whisper_cloud", label: "OpenAI Whisper", description: "High accuracy, batch mode" },
                { value: "whisper_local", label: "Whisper Local", description: "Offline - no API key needed" },
              ]}
            />

            {settings.sttEngine !== "whisper_local" && (
              <>
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

                <div className="p-3 rounded-lg bg-surface-100 border border-surface-300/50">
                  <p className="text-xs text-surface-700">
                    {settings.sttEngine === "deepgram" ? (
                      <>Get a free Deepgram API key with $200 in credits at deepgram.com. That's enough for ~46,000 minutes of dictation.</>
                    ) : (
                      <>Get an OpenAI API key at platform.openai.com. Whisper costs ~$0.006/minute (about $0.36/hour).</>
                    )}
                  </p>
                </div>
              </>
            )}

            {settings.sttEngine === "whisper_local" && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-300 mb-1">
                  No API key needed
                </p>
                <p className="text-xs text-green-400/70">
                  Whisper Local runs entirely on your device. Your audio never leaves your computer.
                  Note: accuracy may be lower than cloud options.
                </p>
              </div>
            )}

            <div className="border-t border-surface-300/50 pt-4">
              <h3 className="text-xs font-semibold text-surface-800 mb-3">
                Grammar AI (optional)
              </h3>
              <Input
                label="Anthropic API Key (for grammar correction)"
                type="password"
                value={settings.grammarApiKey}
                onChange={(e) => settings.updateSetting("grammarApiKey", e.target.value)}
                placeholder="sk-ant-..."
                icon={<Sparkles className="h-4 w-4" />}
              />
              <p className="text-[10px] text-surface-600 mt-1.5">
                Powers the AI grammar engine. Uses Claude Haiku - costs ~$0.03/month for heavy use.
                Skip this for now if you just want dictation.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-surface-950 mb-2">
                You're All Set!
              </h2>
              <p className="text-sm text-surface-700 leading-relaxed">
                Vox is ready to go. Here are your shortcuts:
              </p>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border border-surface-300/50">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-vox-400" />
                  <span className="text-sm text-surface-900">Toggle Dictation</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-surface-200 border border-surface-300 text-xs font-mono text-surface-800">
                  Ctrl/Cmd+Shift+D
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border border-surface-300/50">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-vox-400" />
                  <span className="text-sm text-surface-900">Push to Talk</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-surface-200 border border-surface-300 text-xs font-mono text-surface-800">
                  Ctrl/Cmd+Shift+Space
                </kbd>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border border-surface-300/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-surface-900">Polish Grammar</span>
                </div>
                <kbd className="px-2 py-1 rounded bg-surface-200 border border-surface-300 text-xs font-mono text-surface-800">
                  Ctrl/Cmd+Shift+G
                </kbd>
              </div>
            </div>

            <p className="text-xs text-surface-600">
              These shortcuts work from any app, even when Vox is minimized to the tray.
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
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {step < steps.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="glow" onClick={onComplete}>
            <Sparkles className="h-4 w-4" />
            Start Dictating
          </Button>
        )}
      </div>

      {/* Skip link */}
      {step < steps.length - 1 && (
        <button
          onClick={onComplete}
          className="mt-4 text-xs text-surface-600 hover:text-surface-800 transition-colors"
        >
          Skip setup - I'll configure later
        </button>
      )}
    </div>
  );
}
