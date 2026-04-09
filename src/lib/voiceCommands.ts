import { useDictationStore } from "@/stores/dictation";

export interface VoiceCommandResult {
  matched: boolean;
  command?: string;
  action?: string;
  remainingText: string;
}

const COMMAND_MAP: Record<string, (text: string) => string> = {
  insert_newline: () => "\n",
  insert_paragraph: () => "\n\n",
  insert_period: () => ".",
  insert_comma: () => ",",
  insert_question: () => "?",
  insert_exclamation: () => "!",
  insert_colon: () => ":",
  insert_semicolon: () => ";",
  insert_dash: () => " — ",
  insert_open_quote: () => '"',
  insert_close_quote: () => '"',
};

const EXTENDED_COMMANDS: Array<{
  patterns: string[];
  action: string;
}> = [
  { patterns: ["new line", "newline", "next line"], action: "insert_newline" },
  { patterns: ["new paragraph", "next paragraph"], action: "insert_paragraph" },
  { patterns: ["period", "full stop", "dot"], action: "insert_period" },
  { patterns: ["comma"], action: "insert_comma" },
  { patterns: ["question mark"], action: "insert_question" },
  { patterns: ["exclamation mark", "exclamation point"], action: "insert_exclamation" },
  { patterns: ["colon"], action: "insert_colon" },
  { patterns: ["semicolon", "semi colon"], action: "insert_semicolon" },
  { patterns: ["dash", "em dash"], action: "insert_dash" },
  { patterns: ["open quote", "begin quote", "quote"], action: "insert_open_quote" },
  { patterns: ["close quote", "end quote", "unquote"], action: "insert_close_quote" },
  { patterns: ["delete that", "scratch that", "remove that"], action: "delete_last" },
  { patterns: ["undo", "undo that"], action: "undo" },
  { patterns: ["select all"], action: "select_all" },
  { patterns: ["copy that", "copy text"], action: "copy" },
  { patterns: ["stop listening", "stop dictation", "stop recording"], action: "stop" },
  { patterns: ["caps on", "all caps", "capitalize"], action: "caps_on" },
  { patterns: ["caps off", "no caps"], action: "caps_off" },
  { patterns: ["tab", "tab key"], action: "insert_tab" },
  { patterns: ["space", "spacebar"], action: "insert_space" },
];

export function processVoiceCommands(text: string): VoiceCommandResult {
  const lower = text.toLowerCase().trim();

  for (const cmd of EXTENDED_COMMANDS) {
    for (const pattern of cmd.patterns) {
      // Check if the text IS the command
      if (lower === pattern) {
        return {
          matched: true,
          command: pattern,
          action: cmd.action,
          remainingText: "",
        };
      }

      // Check if the text ENDS with the command
      if (lower.endsWith(` ${pattern}`)) {
        const remaining = text.slice(0, text.length - pattern.length - 1).trim();
        return {
          matched: true,
          command: pattern,
          action: cmd.action,
          remainingText: remaining,
        };
      }

      // Check if the text STARTS with the command
      if (lower.startsWith(`${pattern} `)) {
        const remaining = text.slice(pattern.length + 1).trim();
        return {
          matched: true,
          command: pattern,
          action: cmd.action,
          remainingText: remaining,
        };
      }
    }
  }

  return { matched: false, remainingText: text };
}

export function executeVoiceCommand(action: string): string | null {
  const handler = COMMAND_MAP[action];
  if (handler) {
    return handler("");
  }

  switch (action) {
    case "delete_last": {
      const segments = useDictationStore.getState().segments;
      if (segments.length > 0) {
        useDictationStore.setState({ segments: segments.slice(0, -1) });
      }
      return null;
    }
    case "undo": {
      const store = useDictationStore.getState();
      const segments = store.segments;
      if (segments.length > 0) {
        const remaining = segments.slice(0, -1);
        useDictationStore.setState({ segments: remaining });
      }
      return null;
    }
    case "select_all":
      return null; // Handled by keyboard shortcut
    case "copy": {
      const store = useDictationStore.getState();
      const fullText = store.segments
        .map((s) => s.correctedText || s.text)
        .join(" ");
      navigator.clipboard.writeText(fullText);
      return null;
    }
    case "stop":
      useDictationStore.getState().setStatus("idle");
      return null;
    case "caps_on":
      return null; // Toggle state
    case "caps_off":
      return null;
    case "insert_tab":
      return "\t";
    case "insert_space":
      return " ";
    default:
      return null;
  }
}

export function applyTextCommand(
  existingText: string,
  commandOutput: string | null
): string {
  if (commandOutput === null) return existingText;
  // Punctuation: no space before, space after
  if ([".","!","?",",",":",";"].includes(commandOutput)) {
    return existingText.trimEnd() + commandOutput + " ";
  }
  return existingText + commandOutput;
}
