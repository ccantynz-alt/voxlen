import type { VoxlenConfig, GrammarResult } from "./types";

/**
 * AI grammar correction engine.
 * Calls Claude Haiku or GPT-4o-mini to polish text.
 */
export class VoxlenGrammar {
  private config: VoxlenConfig;

  constructor(config: VoxlenConfig) {
    this.config = config;
  }

  /** Correct grammar and style for the given text */
  async correct(text: string): Promise<GrammarResult> {
    if (!text.trim()) {
      return { original: text, corrected: text, changes: [], score: 1.0 };
    }

    const provider = this.config.grammarProvider || "claude";
    if (provider === "claude") {
      return this.correctWithClaude(text);
    }
    return this.correctWithOpenAI(text);
  }

  private async correctWithClaude(text: string): Promise<GrammarResult> {
    const apiKey = this.config.grammarApiKey;
    if (!apiKey) throw new Error("Anthropic API key required for grammar correction");

    const style = this.config.writingStyle || "professional";
    const prompt = `Fix grammar, spelling, and punctuation in this text. Make it ${style}. Respond ONLY with JSON: {"corrected": "text", "changes": [{"original": "x", "corrected": "y", "reason": "z", "category": "grammar|spelling|punctuation|style"}], "score": 0.95}\n\nText: "${text}"`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.content?.[0]?.text;
    if (!content) throw new Error("Empty response from Claude");

    const parsed = JSON.parse(content);
    return {
      original: text,
      corrected: parsed.corrected || text,
      changes: parsed.changes || [],
      score: parsed.score || 1.0,
    };
  }

  private async correctWithOpenAI(text: string): Promise<GrammarResult> {
    const apiKey = this.config.openaiApiKey;
    if (!apiKey) throw new Error("OpenAI API key required for grammar correction");

    const style = this.config.writingStyle || "professional";
    const prompt = `Fix grammar, spelling, and punctuation. Make it ${style}. Respond ONLY with JSON: {"corrected": "text", "changes": [{"original": "x", "corrected": "y", "reason": "z", "category": "grammar|spelling|punctuation|style"}], "score": 0.95}\n\nText: "${text}"`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const parsed = JSON.parse(content);
    return {
      original: text,
      corrected: parsed.corrected || text,
      changes: parsed.changes || [],
      score: parsed.score || 1.0,
    };
  }
}
