import { create } from "zustand";

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
}

interface SettingsState extends AppSettings {
  isLoaded: boolean;
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

  sttEngine: "whisper_cloud",
  sttApiKey: "",
  sttLanguage: "en",
  autoDetectLanguage: true,
  customVocabulary: [],

  grammarEnabled: true,
  grammarApiKey: "",
  grammarProvider: "claude",
  writingStyle: "professional",
  autoCorrect: true,
  preserveTone: true,

  autoPunctuate: true,
  smartFormat: true,
  voiceCommandsEnabled: true,

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
};

// Debounced persistence — saves settings after changes settle
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const state = useSettingsStore.getState();
    // Extract only AppSettings keys (not UI state like activeTab/isLoaded)
    const toSave: Partial<AppSettings> = {
      preferredDeviceId: state.preferredDeviceId,
      inputGain: state.inputGain,
      noiseSuppression: state.noiseSuppression,
      sttEngine: state.sttEngine,
      sttApiKey: state.sttApiKey,
      sttLanguage: state.sttLanguage,
      autoDetectLanguage: state.autoDetectLanguage,
      customVocabulary: state.customVocabulary,
      grammarEnabled: state.grammarEnabled,
      grammarApiKey: state.grammarApiKey,
      grammarProvider: state.grammarProvider,
      writingStyle: state.writingStyle,
      autoCorrect: state.autoCorrect,
      preserveTone: state.preserveTone,
      autoPunctuate: state.autoPunctuate,
      smartFormat: state.smartFormat,
      voiceCommandsEnabled: state.voiceCommandsEnabled,
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
  }, 500);
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaultSettings,
  isLoaded: false,
  activeTab: "general",

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
