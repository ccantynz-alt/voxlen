export const APP_NAME = "Voxlen";
export const APP_VERSION = "1.0.8";
export const APP_DESCRIPTION = "AI-powered voice dictation for professionals";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "da", name: "Danish", flag: "🇩🇰" },
  { code: "fi", name: "Finnish", flag: "🇫🇮" },
  { code: "no", name: "Norwegian", flag: "🇳🇴" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
] as const;

export const VOICE_COMMANDS = [
  { command: "new line", action: "insert_newline", description: "Insert a new line" },
  { command: "new paragraph", action: "insert_paragraph", description: "Insert a paragraph break" },
  { command: "period", action: "insert_period", description: "Insert a period" },
  { command: "comma", action: "insert_comma", description: "Insert a comma" },
  { command: "question mark", action: "insert_question", description: "Insert a question mark" },
  { command: "exclamation mark", action: "insert_exclamation", description: "Insert an exclamation mark" },
  { command: "delete that", action: "delete_last", description: "Delete the last dictated text" },
  { command: "undo", action: "undo", description: "Undo the last action" },
  { command: "select all", action: "select_all", description: "Select all text" },
  { command: "copy that", action: "copy", description: "Copy selected text" },
  { command: "stop listening", action: "stop", description: "Stop dictation" },
] as const;

export const DEFAULT_SHORTCUTS = {
  toggleDictation: "CommandOrControl+Shift+D",
  pushToTalk: "CommandOrControl+Shift+Space",
  cancel: "Escape",
  correctGrammar: "CommandOrControl+Shift+G",
} as const;

export const STT_ENGINES = {
  whisper_cloud: {
    id: "whisper_cloud",
    name: "OpenAI Whisper",
    description: "High-accuracy cloud transcription",
    icon: "cloud",
  },
  deepgram: {
    id: "deepgram",
    name: "Deepgram Nova-2",
    description: "Fastest real-time transcription",
    icon: "zap",
  },
} as const;
