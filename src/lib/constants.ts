export const APP_NAME = "Voxlen";
export const APP_VERSION = "1.0.9";
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
  { command: "stop dictation", action: "stop", description: "Stop dictation" },
  { command: "clear", action: "clear_session", description: "Clear current session" },
  { command: "clear all", action: "clear_session", description: "Clear all session text" },
  { command: "pause dictation", action: "pause", description: "Pause recording" },
  { command: "start billing", action: "billing_start", description: "Start billable time timer" },
  { command: "stop billing", action: "billing_stop", description: "Stop billable time timer" },
  { command: "insert indemnity clause", action: "insert_clause", description: "Insert standard indemnity clause" },
  { command: "insert confidentiality clause", action: "insert_clause", description: "Insert confidentiality clause" },
  { command: "insert force majeure", action: "insert_clause", description: "Insert force majeure clause" },
  { command: "insert governing law England", action: "insert_clause", description: "Insert governing law (England & Wales)" },
  { command: "insert governing law Australia", action: "insert_clause", description: "Insert governing law (Australia)" },
  { command: "insert governing law New York", action: "insert_clause", description: "Insert governing law (New York)" },
  { command: "insert IP assignment", action: "insert_clause", description: "Insert IP assignment clause" },
  { command: "insert GDPR data processing clause", action: "insert_clause", description: "Insert GDPR data processing clause" },
  { command: "insert entire agreement", action: "insert_clause", description: "Insert entire agreement clause" },
  { command: "insert severability", action: "insert_clause", description: "Insert severability clause" },
  { command: "insert no assignment clause", action: "insert_clause", description: "Insert no assignment clause" },
  { command: "insert limitation of liability", action: "insert_clause", description: "Insert limitation of liability clause" },
  { command: "insert engagement terms", action: "insert_clause", description: "Insert accounting engagement terms" },
  { command: "insert accountant liability cap", action: "insert_clause", description: "Insert accountant liability cap clause" },
  { command: "insert without prejudice", action: "insert_clause", description: "Insert without prejudice header" },
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
    name: "Deepgram Nova-3",
    description: "Fastest real-time transcription",
    icon: "zap",
  },
} as const;
