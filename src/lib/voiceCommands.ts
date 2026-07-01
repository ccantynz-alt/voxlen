import { useDictationStore } from "@/stores/dictation";
import { useClauseStore } from "@/stores/clauses";

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
  insert_open_paren: () => "(",
  insert_close_paren: () => ")",
  legal_new_section: () => "\n\n",
  legal_new_clause: () => "\n\n",
  legal_item_1: () => "\n1. ",
  legal_item_2: () => "\n2. ",
  legal_item_3: () => "\n3. ",
  legal_item_4: () => "\n4. ",
  legal_item_5: () => "\n5. ",
  log_30_min: () => "__LOG_TIME_30__",
  log_45_min: () => "__LOG_TIME_45__",
  log_60_min: () => "__LOG_TIME_60__",
  log_120_min: () => "__LOG_TIME_120__",
  log_15_min: () => "__LOG_TIME_15__",
  log_6_min: () => "__LOG_TIME_6__",
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
  // Legal document structure
  { patterns: ["new section", "new heading"], action: "legal_new_section" },
  { patterns: ["new clause", "next clause"], action: "legal_new_clause" },
  { patterns: ["open bracket", "open parenthesis"], action: "insert_open_paren" },
  { patterns: ["close bracket", "close parenthesis"], action: "insert_close_paren" },
  { patterns: ["number one"], action: "legal_item_1" },
  { patterns: ["number two"], action: "legal_item_2" },
  { patterns: ["number three"], action: "legal_item_3" },
  { patterns: ["number four"], action: "legal_item_4" },
  { patterns: ["number five"], action: "legal_item_5" },
  { patterns: ["sub clause one", "sub clause two", "sub clause three"], action: "legal_sub_clause" },
  // Billable time
  { patterns: ["log time", "add to timesheet", "record time"], action: "log_time" },
  { patterns: ["log thirty minutes", "log 30 minutes"], action: "log_30_min" },
  { patterns: ["log forty five minutes", "log 45 minutes"], action: "log_45_min" },
  { patterns: ["log one hour", "log 60 minutes"], action: "log_60_min" },
  { patterns: ["log two hours", "log 120 minutes"], action: "log_120_min" },
  { patterns: ["log fifteen minutes", "log 15 minutes"], action: "log_15_min" },
  { patterns: ["log six minutes", "log 6 minutes"], action: "log_6_min" },
  // Session control
  { patterns: ["clear", "clear all", "clear session", "start over"], action: "clear_session" },
  { patterns: ["pause dictation", "pause recording"], action: "pause" },
  { patterns: ["resume dictation", "resume recording"], action: "resume" },
  // Clause insertion (dynamic — resolved at execution time via clause store)
  { patterns: ["insert indemnity clause"], action: "insert_clause:insert indemnity clause" },
  { patterns: ["insert limitation of liability"], action: "insert_clause:insert limitation of liability" },
  { patterns: ["insert confidentiality clause"], action: "insert_clause:insert confidentiality clause" },
  { patterns: ["insert governing law england"], action: "insert_clause:insert governing law england" },
  { patterns: ["insert governing law australia"], action: "insert_clause:insert governing law australia" },
  { patterns: ["insert governing law new york"], action: "insert_clause:insert governing law new york" },
  { patterns: ["insert force majeure"], action: "insert_clause:insert force majeure" },
  { patterns: ["insert ip assignment"], action: "insert_clause:insert ip assignment" },
  { patterns: ["insert gdpr data processing clause"], action: "insert_clause:insert gdpr data processing clause" },
  { patterns: ["insert entire agreement"], action: "insert_clause:insert entire agreement" },
  { patterns: ["insert severability"], action: "insert_clause:insert severability" },
  { patterns: ["insert no assignment clause"], action: "insert_clause:insert no assignment clause" },
  { patterns: ["insert engagement terms"], action: "insert_clause:insert engagement terms" },
  { patterns: ["insert accountant liability cap"], action: "insert_clause:insert accountant liability cap" },
  { patterns: ["insert without prejudice"], action: "insert_clause:insert without prejudice" },
  { patterns: ["insert arbitration clause"], action: "insert_clause:insert arbitration clause" },
  { patterns: ["insert dispute resolution clause"], action: "insert_clause:insert dispute resolution clause" },
  { patterns: ["insert warranty disclaimer"], action: "insert_clause:insert warranty disclaimer" },
  { patterns: ["insert governing law new zealand"], action: "insert_clause:insert governing law new zealand" },
  { patterns: ["insert governing law ontario"], action: "insert_clause:insert governing law ontario" },
  { patterns: ["insert payment terms"], action: "insert_clause:insert payment terms" },
  { patterns: ["insert termination for cause"], action: "insert_clause:insert termination for cause" },
  // Billable time — start/stop billing
  { patterns: ["start billing", "start timer", "start billable time"], action: "billing_start" },
  { patterns: ["stop billing", "stop timer", "stop billable time"], action: "billing_stop" },
  // Navigation
  { patterns: ["review uncertain words", "check uncertain", "show uncertain"], action: "review_uncertain" },
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
    case "legal_sub_clause":
      return "\n    ";
    case "log_time": {
      // Extract minutes from the original text if possible
      // e.g. "log thirty minutes", "add to timesheet 45 minutes"
      // This is a signal to the UI layer — return a marker string
      return "__LOG_TIME__";
    }
    case "clear_session":
      useDictationStore.getState().clearSession();
      return null;
    case "pause":
      useDictationStore.getState().setStatus("paused");
      return null;
    case "resume":
      useDictationStore.getState().setStatus("listening");
      return null;
    case "billing_start":
    case "billing_stop":
      return null; // UI concern — handled by caller
    case "review_uncertain":
      return null; // UI concern
    default:
      // Dynamic clause insertion: action = "insert_clause:<trigger>"
      if (action.startsWith("insert_clause:")) {
        const trigger = action.slice("insert_clause:".length);
        const clause = useClauseStore.getState().findByTrigger(trigger);
        if (clause) {
          useClauseStore.getState().markUsed(clause.id);
          return "\n\n" + clause.text + "\n\n";
        }
      }
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
