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
  sttLanguage: string;
  autoDetectLanguage: boolean;
  customVocabulary: string[];
  speakerDiarization: boolean;

  // Grammar
  grammarEnabled: boolean;
  grammarApiKey: string;
  grammarProvider: "claude" | "openai";
  writingStyle: "professional" | "casual" | "academic" | "creative" | "technical";
  autoCorrect: boolean;
  preserveTone: boolean;

  // Dictation
  autoPunctuate: boolean;
  smartFormat: boolean;
  voiceCommandsEnabled: boolean;

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
  privilegedMode: boolean;
  legalMode: boolean; // enables Latin phrase recognition + legal smart format
  jurisdiction: "uk" | "us" | "australia" | "canada" | "nz" | "global";
  billableRatePerHour: number;
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
  setActiveTab: (tab: string) => void;
  resetToDefaults: () => void;
}

const defaultSettings: AppSettings = {
  preferredDeviceId: null,
  inputGain: 1.0,
  noiseSuppression: true,

  sttEngine: "deepgram",
  sttApiKey: "",
  sttLanguage: "en",
  autoDetectLanguage: true,
  customVocabulary: [],
  speakerDiarization: false,

  grammarEnabled: true,
  grammarApiKey: "",
  grammarProvider: "claude",
  writingStyle: "professional",
  autoCorrect: true,
  preserveTone: true,

  autoPunctuate: true,
  smartFormat: true,
  voiceCommandsEnabled: true,

  translationEnabled: false,
  translationTargetLanguage: "en",

  injectionMode: "keyboard",

  shortcutToggle: "CommandOrControl+Shift+D",
  shortcutPushToTalk: "CommandOrControl+Shift+Space",
  shortcutCancel: "Escape",
  shortcutCorrectGrammar: "CommandOrControl+Shift+G",

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
  billableRatePerHour: 0,
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
      sttLanguage: state.sttLanguage,
      autoDetectLanguage: state.autoDetectLanguage,
      customVocabulary: state.customVocabulary,
      speakerDiarization: state.speakerDiarization,
      grammarEnabled: state.grammarEnabled,
      grammarProvider: state.grammarProvider,
      writingStyle: state.writingStyle,
      autoCorrect: state.autoCorrect,
      preserveTone: state.preserveTone,
      autoPunctuate: state.autoPunctuate,
      smartFormat: state.smartFormat,
      voiceCommandsEnabled: state.voiceCommandsEnabled,
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
      privilegedMode: state.privilegedMode,
      legalMode: state.legalMode,
      jurisdiction: state.jurisdiction,
      billableRatePerHour: state.billableRatePerHour,
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
  const [sttApiKey, grammarApiKey, voxlenApiKey] = await Promise.all([
    getSecret("sttApiKey"),
    getSecret("grammarApiKey"),
    getSecret("voxlenApiKey"),
  ]);
  const updates: Partial<AppSettings> = {};
  if (sttApiKey) updates.sttApiKey = sttApiKey;
  if (grammarApiKey) updates.grammarApiKey = grammarApiKey;
  if (voxlenApiKey) updates.voxlenApiKey = voxlenApiKey;
  if (Object.keys(updates).length > 0) {
    useSettingsStore.getState().updateSettings(updates);
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaultSettings,
  activeTab: "voxlen-api",

  updateSetting: (key, value) => {
    set({ [key]: value });
    schedulePersist();
  },

  updateSettings: (settings) => {
    set(settings);
    schedulePersist();
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  resetToDefaults: () => {
    set({ ...defaultSettings });
    schedulePersist();
  },
}));
