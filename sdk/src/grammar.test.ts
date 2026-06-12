import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoxlenGrammar } from "./grammar";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeApiResponse(corrected: string, changes = [], score = 0.95) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ text: JSON.stringify({ corrected, changes, score }) }],
    }),
  };
}

function makeOpenAIResponse(corrected: string, changes = [], score = 0.95) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ corrected, changes, score }) } }],
    }),
  };
}

describe("VoxlenGrammar", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("empty text short-circuit", () => {
    it("returns original unchanged for empty string without making API calls", async () => {
      const grammar = new VoxlenGrammar({ grammarApiKey: "key" });
      const result = await grammar.correct("");
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.corrected).toBe("");
      expect(result.score).toBe(1.0);
      expect(result.changes).toHaveLength(0);
    });

    it("returns original for whitespace-only input", async () => {
      const grammar = new VoxlenGrammar({ grammarApiKey: "key" });
      const result = await grammar.correct("   ");
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.corrected).toBe("   ");
    });
  });

  describe("Claude provider (default)", () => {
    it("calls Anthropic API with correct headers and model", async () => {
      mockFetch.mockResolvedValueOnce(makeApiResponse("Corrected text."));
      const grammar = new VoxlenGrammar({ grammarApiKey: "test-key" });
      await grammar.correct("some text");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("anthropic.com");
      expect(opts.headers["x-api-key"]).toBe("test-key");
      expect(opts.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
      const body = JSON.parse(opts.body);
      expect(body.model).toContain("claude");
    });

    it("returns corrected text and changes from response", async () => {
      const changes = [{ original: "teh", corrected: "the", reason: "typo", category: "spelling" }];
      mockFetch.mockResolvedValueOnce(makeApiResponse("The corrected text.", changes, 0.9));
      const grammar = new VoxlenGrammar({ grammarApiKey: "test-key" });
      const result = await grammar.correct("teh text");
      expect(result.corrected).toBe("The corrected text.");
      expect(result.changes).toHaveLength(1);
      expect(result.score).toBe(0.9);
      expect(result.original).toBe("teh text");
    });

    it("throws when no API key is set", async () => {
      const grammar = new VoxlenGrammar({});
      await expect(grammar.correct("some text")).rejects.toThrow(/api key/i);
    });

    it("throws on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const grammar = new VoxlenGrammar({ grammarApiKey: "bad-key" });
      await expect(grammar.correct("text")).rejects.toThrow(/401/);
    });
  });

  describe("OpenAI provider", () => {
    it("calls OpenAI API when grammarProvider is openai", async () => {
      mockFetch.mockResolvedValueOnce(makeOpenAIResponse("OpenAI corrected."));
      const grammar = new VoxlenGrammar({ openaiApiKey: "oai-key", grammarProvider: "openai" });
      const result = await grammar.correct("some text");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("openai.com");
      expect(result.corrected).toBe("OpenAI corrected.");
    });

    it("throws when no OpenAI key is set", async () => {
      const grammar = new VoxlenGrammar({ grammarProvider: "openai" });
      await expect(grammar.correct("some text")).rejects.toThrow(/api key/i);
    });
  });
});
