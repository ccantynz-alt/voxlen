import { describe, it, expect } from "vitest";
import { toBackendSettings, fromBackendSettings } from "./settings";
import type { AppSettings } from "@/stores/settings";

const DEFAULTS: AppSettings = {
  preferredDeviceId: null,
  inputGain: 1.0,
  noiseSuppression: true,
  sttEngine: "deepgram",
  sttApiKey: "",
  sttLanguage: "en-US",
  autoDetectLanguage: false,
  customVocabulary: [],
  speakerDiarization: false,
  grammarEnabled: true,
  grammarApiKey: "",
  grammarProvider: "claude",
  writingStyle: "professional",
  autoCorrect: false,
  preserveTone: true,
  autoPunctuate: true,
  smartFormat: true,
  voiceCommandsEnabled: true,
  translationEnabled: false,
  translationTargetLanguage: "en",
  injectionMode: "keyboard",
  shortcutToggle: "CmdOrCtrl+Shift+D",
  shortcutPushToTalk: "",
  shortcutCancel: "Escape",
  shortcutCorrectGrammar: "CmdOrCtrl+Shift+G",
  theme: "dark",
  showWaveform: true,
  fontSize: 14,
  startMinimized: false,
  minimizeToTray: true,
  launchAtLogin: false,
  telemetryEnabled: false,
  saveTranscripts: true,
  privilegedMode: false,
  legalMode: false,
  jurisdiction: "global",
  billableRatePerHour: 350,
  voxlenApiKey: "",
  voxlenContext: "general",
  voxlenTenantId: "",
  legalAcceptedVersion: null,
  legalAcceptedAt: null,
};

describe("toBackendSettings", () => {
  it("converts camelCase to snake_case for all backend fields", () => {
    const backend = toBackendSettings(DEFAULTS);
    expect(backend.preferred_device_id).toBeNull();
    expect(backend.input_gain).toBe(1.0);
    expect(backend.noise_suppression).toBe(true);
    expect(backend.stt_engine).toBe("deepgram");
    expect(backend.grammar_enabled).toBe(true);
    expect(backend.grammar_provider).toBe("claude");
    expect(backend.writing_style).toBe("professional");
    expect(backend.auto_correct).toBe(false);
    expect(backend.shortcut_toggle).toBe("CmdOrCtrl+Shift+D");
    expect(backend.privileged_mode).toBe(false);
    expect(backend.legal_mode).toBe(false);
    expect(backend.jurisdiction).toBe("global");
    expect(backend.voxlen_context).toBe("general");
  });

  it("passes customVocabulary array through unchanged", () => {
    const settings = { ...DEFAULTS, customVocabulary: ["EBITDA", "estoppel"] };
    const backend = toBackendSettings(settings);
    expect(backend.custom_vocabulary).toEqual(["EBITDA", "estoppel"]);
  });
});

describe("fromBackendSettings", () => {
  it("converts snake_case to camelCase for all backend fields", () => {
    const backend = toBackendSettings(DEFAULTS);
    const restored = fromBackendSettings(backend);
    expect(restored.inputGain).toBe(1.0);
    expect(restored.noiseSuppression).toBe(true);
    expect(restored.sttEngine).toBe("deepgram");
    expect(restored.grammarEnabled).toBe(true);
    expect(restored.writingStyle).toBe("professional");
    expect(restored.shortcutToggle).toBe("CmdOrCtrl+Shift+D");
    expect(restored.privilegedMode).toBe(false);
    expect(restored.voxlenContext).toBe("general");
  });

  it("round-trips all mapped fields without data loss", () => {
    const settings = {
      ...DEFAULTS,
      inputGain: 0.8,
      sttApiKey: "dg-test-key",
      grammarProvider: "openai" as const,
      writingStyle: "academic" as const,
      customVocabulary: ["NetSuite", "GAAP"],
      injectionMode: "clipboard" as const,
      theme: "light" as const,
      fontSize: 16,
    };
    const restored = fromBackendSettings(toBackendSettings(settings));
    expect(restored.inputGain).toBe(0.8);
    expect(restored.sttApiKey).toBe("dg-test-key");
    expect(restored.grammarProvider).toBe("openai");
    expect(restored.writingStyle).toBe("academic");
    expect(restored.customVocabulary).toEqual(["NetSuite", "GAAP"]);
    expect(restored.injectionMode).toBe("clipboard");
    expect(restored.theme).toBe("light");
    expect(restored.fontSize).toBe(16);
  });

  it("omits undefined fields from partial backend response", () => {
    const partial = fromBackendSettings({ stt_engine: "deepgram" });
    expect(partial.sttEngine).toBe("deepgram");
    expect(partial.inputGain).toBeUndefined();
    expect(partial.grammarEnabled).toBeUndefined();
  });
});
