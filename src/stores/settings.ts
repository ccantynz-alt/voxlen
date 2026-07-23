import { create } from "zustand";
import { getSecret, setSecret, deleteSecret } from "@/lib/keyring";

export interface AppSettings {
  // Audio
  preferredDeviceId: string | null;
  inputGain: number;
  noiseSuppression: boolean;

  // STT
  sttEngine: string;
  sttApiKey: string;
  /** Local Whisper model id (e.g. "base.en") used by the offline engine. */
  whisperLocalModel: string;
  sttLanguage: string;
  autoDetectLanguage: boolean;
  customVocabulary: string[];
  speakerDiarization: boolean;

  // Grammar
  grammarEnabled: boolean;
  grammarApiKey: string;
  grammarProvider: "claude" | "openai";
  /** "cloud" sends text to an external LLM; "local_rules" runs the
   *  on-device deterministic engine; "local_llm" adds an on-device AI
   *  polish on top of the rules. Privileged mode forces local. */
  grammarEngine: "cloud" | "local_rules" | "local_llm";
  /** Catalog id of the downloaded grammar LLM (e.g. "qwen3-4b"). */
  grammarLocalModel: string;
  writingStyle: "professional" | "casual" | "academic" | "creative" | "technical";
  autoCorrect: boolean;
  preserveTone: boolean;

  // Dictation
  autoPunctuate: boolean;
  smartFormat: boolean;
  voiceCommandsEnabled: boolean;
  /** Tray-resident hands-free mode: capture stays alive permanently and a
   *  local voice-activity gate opens the cloud session only while speech is
   *  present. The mic's hardware mute button becomes the only control. */
  alwaysReadyMode: boolean;
  /** Hardware mic-switch mode: the physical mute/power switch on an
   *  external mic (Razer, Yeti, …) starts and stops dictation directly —
   *  no Win+H, no keyboard shortcut. Works with every STT engine. */
  micSwitchMode: boolean;

  // Translation
  translationEnabled: boolean;
  translationTargetLanguage: string;

  // Text injection
  injectionMode: "keyboard" | "clipboard" | "buffer";

  // Shortcuts
  shortcutToggle: string;
  shortcutPushToTalk: string;
  shortcutCancel: string;
  shortcutCorrectGrammar: string;

  // UI
  theme: "dark" | "light" | "system";
  showWaveform: boolean;
  fontSize: number;
  startMinimized: boolean;
  minimizeToTray: boolean;
  launchAtLogin: boolean;

  // Privacy
  telemetryEnabled: boolean;
  saveTranscripts: boolean;
  autoDocEnabled: boolean;
  autoDocRootPath: string;
  autoDocFilenamePattern: string;
  reviewSharedFolderPath: string;
  reviewDisplayName: string;
  privilegedMode: boolean;
  legalMode: boolean; // enables Latin phrase recognition + legal smart format
  jurisdiction: "uk" | "us" | "australia" | "canada" | "nz" | "global";
  billableRatePerHour: number;

  // Billing
  /** Time-unit rounding for billable entries, in hours. 0 = no rounding. */
  billingRoundingIncrement: 0 | 0.1 | 0.25;
  /** Minimum billable hours per entry. */
  billingMinimumHours: number;
  /** Auto-draft a time entry for review when a dictation session ends. */
  autoTimeCapture: boolean;
  // LEDES export metadata
  ledesLawFirmId: string;
  ledesTimekeeperId: string;
  ledesTimekeeperName: string;
  ledesClassification: string;

  // Flywheel
  /** Automatically include learned vocabulary (freq >= 2) in STT config. */
  flywheelAutoVocab: boolean;
  /** Pre-apply learned correction patterns locally to final transcripts. */
  applyLearnedCorrections: boolean;

  // Meeting capture consent (Rust start-gate reads these; fail-closed)
  meetingJurisdiction: string;
  meetingConsentAckVersion: string | null;
  meetingConsentAckAt: string | null;
  voxlenApiKey: string;
  voxlenContext: string; // VoxlenContext value
  voxlenTenantId: string;

  // Legal
  legalAcceptedVersion: string | null;
  legalAcceptedAt: string | null;
}

interface SettingsState extends AppSettings {
  activeTab: string;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  /** Load previously-saved settings into the store WITHOUT scheduling a
   * persist cycle. Startup hydration must use this, not updateSettings —
   * otherwise loading settings back in (e.g. from settings.json) races the
   * still-in-flight keychain/backend hydration of API keys: schedulePersist
   * reads whatever is in the store 500ms later and writes it back, so if the
   * API key hasn't loaded into the store yet by then, its write-or-delete
   * logic deletes the key from the OS keychain — the exact bug this was
   * created to prevent (users having to re-enter their key every launch). */
  hydrateSettings: (settings: Partial<AppSettings>) => void;
  setActiveTab: (tab: string) => void;
  resetToDefaults: () => void;
}

const defaultSettings: AppSettings = {
  preferredDeviceId: null,
  inputGain: 1.0,
  noiseSuppression: true,

  sttEngine: "deepgram",
  sttApiKey: "",
  whisperLocalModel: "base.en",
  sttLanguage: "en",
  autoDetectLanguage: true,
  customVocabulary: [],
  speakerDiarization: false,

  grammarEnabled: true,
  grammarApiKey: "",
  grammarProvider: "claude",
  grammarEngine: "cloud",
  grammarLocalModel: "qwen3-4b",
  writingStyle: "professional",
  autoCorrect: true,
  preserveTone: true,

  autoPunctuate: true,
  smartFormat: true,
  voiceCommandsEnabled: true,
  alwaysReadyMode: false,
  micSwitchMode: false,

  translationEnabled: false,
  translationTargetLanguage: "en",

  injectionMode: "keyboard",

  shortcutToggle: "Alt+D",
  shortcutPushToTalk: "Alt+Space",
  shortcutCancel: "Escape",
  shortcutCorrectGrammar: "Alt+G",

  theme: "dark",
  showWaveform: true,
  fontSize: 14,
  startMinimized: false,
  minimizeToTray: true,
  launchAtLogin: false,

  telemetryEnabled: false,
  saveTranscripts: true,
  autoDocEnabled: false,
  autoDocRootPath: "",
  autoDocFilenamePattern: "{date} {kind}",
  reviewSharedFolderPath: "",
  reviewDisplayName: "",
  privilegedMode: false,
  legalMode: false,
  jurisdiction: "global",
  billableRatePerHour: 0,

  billingRoundingIncrement: 0.1,
  billingMinimumHours: 0.1,
  autoTimeCapture: true,
  ledesLawFirmId: "",
  ledesTimekeeperId: "",
  ledesTimekeeperName: "",
  ledesClassification: "PT",

  flywheelAutoVocab: true,
  applyLearnedCorrections: true,

  meetingJurisdiction: "",
  meetingConsentAckVersion: null,
  meetingConsentAckAt: null,
  voxlenApiKey: "",
  voxlenContext: "legal_general",
  voxlenTenantId: "",

  legalAcceptedVersion: null,
  legalAcceptedAt: null,
};

// Debounced persistence — saves settings after changes settle.
// API keys go to OS keychain; everything else to tauri-plugin-store.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const state = useSettingsStore.getState();
    const toSave: Partial<AppSettings> = {
      preferredDeviceId: state.preferredDeviceId,
      inputGain: state.inputGain,
      noiseSuppression: state.noiseSuppression,
      sttEngine: state.sttEngine,
      whisperLocalModel: state.whisperLocalModel,
      sttLanguage: state.sttLanguage,
      autoDetectLanguage: state.autoDetectLanguage,
      customVocabulary: state.customVocabulary,
      speakerDiarization: state.speakerDiarization,
      grammarEnabled: state.grammarEnabled,
      grammarProvider: state.grammarProvider,
      grammarEngine: state.grammarEngine,
      grammarLocalModel: state.grammarLocalModel,
      writingStyle: state.writingStyle,
      autoCorrect: state.autoCorrect,
      preserveTone: state.preserveTone,
      autoPunctuate: state.autoPunctuate,
      smartFormat: state.smartFormat,
      voiceCommandsEnabled: state.voiceCommandsEnabled,
      alwaysReadyMode: state.alwaysReadyMode,
      micSwitchMode: state.micSwitchMode,
      translationEnabled: state.translationEnabled,
      translationTargetLanguage: state.translationTargetLanguage,
      injectionMode: state.injectionMode,
      shortcutToggle: state.shortcutToggle,
      shortcutPushToTalk: state.shortcutPushToTalk,
      shortcutCancel: state.shortcutCancel,
      shortcutCorrectGrammar: state.shortcutCorrectGrammar,
      theme: state.theme,
      showWaveform: state.showWaveform,
      fontSize: state.fontSize,
      startMinimized: state.startMinimized,
      minimizeToTray: state.minimizeToTray,
      launchAtLogin: state.launchAtLogin,
      telemetryEnabled: state.telemetryEnabled,
      saveTranscripts: state.saveTranscripts,
      autoDocEnabled: state.autoDocEnabled,
      autoDocRootPath: state.autoDocRootPath,
      autoDocFilenamePattern: state.autoDocFilenamePattern,
      reviewSharedFolderPath: state.reviewSharedFolderPath,
      reviewDisplayName: state.reviewDisplayName,
      privilegedMode: state.privilegedMode,
      legalMode: state.legalMode,
      jurisdiction: state.jurisdiction,
      billableRatePerHour: state.billableRatePerHour,
      billingRoundingIncrement: state.billingRoundingIncrement,
      billingMinimumHours: state.billingMinimumHours,
      autoTimeCapture: state.autoTimeCapture,
      ledesLawFirmId: state.ledesLawFirmId,
      ledesTimekeeperId: state.ledesTimekeeperId,
      ledesTimekeeperName: state.ledesTimekeeperName,
      ledesClassification: state.ledesClassification,
      flywheelAutoVocab: state.flywheelAutoVocab,
      applyLearnedCorrections: state.applyLearnedCorrections,
      meetingJurisdiction: state.meetingJurisdiction,
      meetingConsentAckVersion: state.meetingConsentAckVersion,
      meetingConsentAckAt: state.meetingConsentAckAt,
      voxlenContext: state.voxlenContext,
      voxlenTenantId: state.voxlenTenantId,
      legalAcceptedVersion: state.legalAcceptedVersion,
      legalAcceptedAt: state.legalAcceptedAt,
    };
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json");
      await store.set("settings", toSave);
      await store.save();
    } catch {
      try {
        localStorage.setItem("voxlen_settings", JSON.stringify(toSave));
      } catch {
        // Ignore
      }
    }

    // Persist API keys to OS keychain (delete when cleared).
    // If keychain_set throws inside the Tauri app (isTauri() is true), we
    // surface the error so the user knows — silently losing a key causes
    // confusing auth failures on next startup.
    const keychainOps: Array<Promise<void>> = [];
    if (state.sttApiKey) keychainOps.push(setSecret("sttApiKey", state.sttApiKey));
    else keychainOps.push(deleteSecret("sttApiKey").catch(() => {}));
    if (state.grammarApiKey) keychainOps.push(setSecret("grammarApiKey", state.grammarApiKey));
    else keychainOps.push(deleteSecret("grammarApiKey").catch(() => {}));
    if (state.voxlenApiKey) keychainOps.push(setSecret("voxlenApiKey", state.voxlenApiKey));
    else keychainOps.push(deleteSecret("voxlenApiKey").catch(() => {}));
    try {
      await Promise.all(keychainOps);
    } catch (err) {
      console.error("Failed to save API key to OS keychain:", err);
      // Import lazily to avoid a hard dependency in non-Tauri builds.
      try {
        const { toast } = await import("@/components/ui/Toast");
        toast("Could not save API key to system keychain — please re-enter it after restart.", "error", 8000);
      } catch {
        // Toast not available (e.g. during tests).
      }
    }

    // Push settings to the Rust engine layer so changes take effect immediately
    // (without this, API key / grammar / STT changes only apply after restart).
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { toBackendSettings } = await import("@/lib/settings");
      await invoke("update_settings", { settings: toBackendSettings(state) });
    } catch {
      // Non-Tauri environment — skip.
    }
  }, 500);
}

export async function hydrateSecrets(): Promise<void> {
  // Cancel any in-flight persist timer so it can't fire with empty keys
  // before we finish reading from the keychain.
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const results = await Promise.allSettled([
    getSecret("sttApiKey"),
    getSecret("grammarApiKey"),
    getSecret("voxlenApiKey"),
  ]);

  const [sttResult, grammarResult, voxlenResult] = results;
  const updates: Partial<AppSettings> = {};
  if (sttResult.status === "fulfilled" && sttResult.value) updates.sttApiKey = sttResult.value;
  if (grammarResult.status === "fulfilled" && grammarResult.value) updates.grammarApiKey = grammarResult.value;
  if (voxlenResult.status === "fulfilled" && voxlenResult.value) updates.voxlenApiKey = voxlenResult.value;

  if (Object.keys(updates).length > 0) {
    useSettingsStore.getState().hydrateSettings(updates);
  }

  const anyFailed = results.some((r) => r.status === "rejected");
  if (anyFailed) {
    try {
      const { toast } = await import("@/components/ui/Toast");
      toast(
        "Could not read saved API keys from system keychain — please re-enter them in Settings.",
        "error",
        8000
      );
    } catch {
      // Toast not available (tests / non-Tauri).
    }
  }

  // Now safe to resume persisting — keys are loaded.
  schedulePersist();
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaultSettings,
  activeTab: "voxlen-api",

  updateSetting: (key, value) => {
    set({ [key]: value });
    // API keys must reach the keychain immediately — the 500ms debounce
    // would lose them if the user closes the app before the timer fires.
    if (key === "sttApiKey" || key === "grammarApiKey" || key === "voxlenApiKey") {
      const strValue = value as string;
      if (strValue) {
        setSecret(key, strValue).catch((e) => console.error("keychain write failed:", e));
      } else {
        deleteSecret(key).catch(() => {});
      }
    }
    schedulePersist();
  },

  updateSettings: (settings) => {
    set(settings);
    schedulePersist();
  },

  hydrateSettings: (settings) => {
    set(settings);
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  resetToDefaults: () => {
    set({ ...defaultSettings });
    schedulePersist();
  },
}));
