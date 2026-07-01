import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub clause store so no Zustand/Tauri side-effects
vi.mock("@/stores/clauses", () => {
  const clauses = [
    {
      id: "indemnity-standard",
      title: "Standard Indemnity",
      category: "liability",
      voiceTrigger: "insert indemnity clause",
      text: "INDEMNITY_TEXT",
      tags: [],
    },
  ];
  return {
    useClauseStore: {
      getState: () => ({
        clauses,
        findByTrigger: (text: string) =>
          clauses.find((c) => text.toLowerCase().includes(c.voiceTrigger.toLowerCase())),
        markUsed: vi.fn(),
      }),
    },
  };
});

// Zustand store imports side-effect; stub the dictation store so tests stay
// pure and don't pull in Tauri/plugin-store code paths.
vi.mock("@/stores/dictation", () => {
  const state = {
    segments: [] as Array<{ id: string; text: string }>,
    status: "idle",
    setStatus: vi.fn((s: string) => {
      state.status = s;
    }),
  };
  return {
    useDictationStore: {
      getState: () => state,
      setState: (patch: Partial<typeof state>) => Object.assign(state, patch),
    },
  };
});

import { processVoiceCommands, executeVoiceCommand, applyTextCommand } from "./voiceCommands";
import { useDictationStore } from "@/stores/dictation";

describe("processVoiceCommands", () => {
  it("matches exact command", () => {
    const r = processVoiceCommands("new line");
    expect(r.matched).toBe(true);
    expect(r.action).toBe("insert_newline");
    expect(r.remainingText).toBe("");
  });

  it("matches trailing command and extracts remainder", () => {
    const r = processVoiceCommands("this is the text period");
    expect(r.matched).toBe(true);
    expect(r.action).toBe("insert_period");
    expect(r.remainingText).toBe("this is the text");
  });

  it("matches leading command", () => {
    const r = processVoiceCommands("new paragraph here we go");
    expect(r.matched).toBe(true);
    expect(r.action).toBe("insert_paragraph");
    expect(r.remainingText).toBe("here we go");
  });

  it("treats unknown text as no match", () => {
    const r = processVoiceCommands("a random sentence");
    expect(r.matched).toBe(false);
    expect(r.remainingText).toBe("a random sentence");
  });

  it("is case insensitive", () => {
    const r = processVoiceCommands("DELETE THAT");
    expect(r.matched).toBe(true);
    expect(r.action).toBe("delete_last");
  });

  it("supports alternates for the same action", () => {
    expect(processVoiceCommands("full stop").action).toBe("insert_period");
    expect(processVoiceCommands("dot").action).toBe("insert_period");
    expect(processVoiceCommands("scratch that").action).toBe("delete_last");
    expect(processVoiceCommands("stop dictation").action).toBe("stop");
  });

  it("matches clear and clear all commands", () => {
    expect(processVoiceCommands("clear").action).toBe("clear_session");
    expect(processVoiceCommands("clear all").action).toBe("clear_session");
    expect(processVoiceCommands("clear session").action).toBe("clear_session");
  });

  it("matches new paragraph command", () => {
    const r = processVoiceCommands("new paragraph");
    expect(r.matched).toBe(true);
    expect(r.action).toBe("insert_paragraph");
  });

  it("matches stop listening and stop dictation", () => {
    expect(processVoiceCommands("stop listening").action).toBe("stop");
    expect(processVoiceCommands("stop dictation").action).toBe("stop");
  });

  it("matches clause insertion commands", () => {
    const r = processVoiceCommands("insert indemnity clause");
    expect(r.matched).toBe(true);
    expect(r.action).toBe("insert_clause:insert indemnity clause");
  });
});

describe("executeVoiceCommand", () => {
  it("returns punctuation output for insert_period", () => {
    expect(executeVoiceCommand("insert_period")).toBe(".");
  });

  it("returns newline for insert_newline", () => {
    expect(executeVoiceCommand("insert_newline")).toBe("\n");
  });

  it("returns tab and space", () => {
    expect(executeVoiceCommand("insert_tab")).toBe("\t");
    expect(executeVoiceCommand("insert_space")).toBe(" ");
  });

  it("returns null for state-only actions", () => {
    expect(executeVoiceCommand("caps_on")).toBe(null);
    expect(executeVoiceCommand("caps_off")).toBe(null);
    expect(executeVoiceCommand("select_all")).toBe(null);
  });

  it("stop action sets idle status", () => {
    executeVoiceCommand("stop");
    expect(useDictationStore.getState().status).toBe("idle");
  });

  it("clear_session calls clearSession on the store", () => {
    const clearSession = vi.fn();
    vi.spyOn(useDictationStore, "getState").mockReturnValueOnce({
      ...useDictationStore.getState(),
      clearSession,
    });
    executeVoiceCommand("clear_session");
    expect(clearSession).toHaveBeenCalled();
  });

  it("insert_clause action returns clause text", () => {
    const result = executeVoiceCommand("insert_clause:insert indemnity clause");
    expect(result).toContain("INDEMNITY_TEXT");
  });

  it("returns null for unknown action", () => {
    expect(executeVoiceCommand("nonexistent_action")).toBe(null);
  });

  it("returns numbered list items for legal_item_1 through legal_item_5", () => {
    expect(executeVoiceCommand("legal_item_1")).toBe("\n1. ");
    expect(executeVoiceCommand("legal_item_2")).toBe("\n2. ");
    expect(executeVoiceCommand("legal_item_3")).toBe("\n3. ");
    expect(executeVoiceCommand("legal_item_4")).toBe("\n4. ");
    expect(executeVoiceCommand("legal_item_5")).toBe("\n5. ");
  });
});

describe("applyTextCommand", () => {
  beforeEach(() => {});

  it("appends newline directly", () => {
    expect(applyTextCommand("hello", "\n")).toBe("hello\n");
  });

  it("places punctuation flush against last word, then a space", () => {
    expect(applyTextCommand("hello ", ".")).toBe("hello. ");
    expect(applyTextCommand("hello", ",")).toBe("hello, ");
  });

  it("is a no-op when command output is null", () => {
    expect(applyTextCommand("hello", null)).toBe("hello");
  });
});
