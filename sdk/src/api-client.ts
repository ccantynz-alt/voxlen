import type { DeepgramTokenResponse, GrammarResult, MeResponse, TranscribeResponse, TranslateResponse, VocabularyResponse, VoxlenConfig } from "./types";

const DEFAULT_BASE = "https://www.voxlen.ai/api";
export type AudioInput = Blob | ArrayBuffer | Uint8Array;

/** Client for the deployed Voxlen API at voxlen.ai/api. */
export class VoxlenApiClient {
  private voxlenKey: string;
  private base: string;

  constructor(config: Pick<VoxlenConfig, "voxlenKey" | "voxlenApiBase">) {
    if (!config.voxlenKey) throw new Error("voxlenKey is required");
    this.voxlenKey = config.voxlenKey;
    this.base = (config.voxlenApiBase || DEFAULT_BASE).replace(/\/$/, "");
  }

  private authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.voxlenKey}` };
  }

  private jsonHeaders(): Record<string, string> {
    return { ...this.authHeader(), "Content-Type": "application/json" };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.base}${path}`, init);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
      const detail = body?.error || body?.detail || response.statusText;
      throw new Error(`Voxlen API request failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    return response.json() as Promise<T>;
  }

  /** Post raw audio to /stt. Options map to the backend's X-* request headers. */
  transcribe(audio: AudioInput, opts: {
    language?: string;
    vocabularyHints?: string[];
    smartFormat?: boolean;
    punctuate?: boolean;
    speakerLabels?: boolean;
    autoDetectLanguage?: boolean;
    contentType?: string;
  } = {}): Promise<TranscribeResponse> {
    const headers: Record<string, string> = {
      ...this.authHeader(),
      "Content-Type": opts.contentType || (audio instanceof Blob && audio.type) || "audio/wav",
    };
    if (opts.language) headers["X-Language"] = opts.language;
    if (opts.smartFormat !== undefined) headers["X-Smart-Format"] = String(opts.smartFormat);
    if (opts.punctuate !== undefined) headers["X-Punctuate"] = String(opts.punctuate);
    if (opts.speakerLabels !== undefined) headers["X-Diarize"] = String(opts.speakerLabels);
    if (opts.autoDetectLanguage !== undefined) headers["X-Auto-Detect"] = String(opts.autoDetectLanguage);
    if (opts.vocabularyHints?.length) {
      headers["X-Keyterms"] = opts.vocabularyHints.slice(0, 50)
        .map((term) => encodeURIComponent(term.slice(0, 100))).join(",");
    }
    return this.request<TranscribeResponse>("/stt", { method: "POST", headers, body: audio as BodyInit });
  }

  async polishGrammar(text: string, opts: {
    context?: string;
    writingStyle?: string;
    preserveTone?: boolean;
    vocabularyHints?: string[];
  } = {}): Promise<GrammarResult> {
    const result = await this.request<Omit<GrammarResult, "original">>("/grammar", {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ text, context: opts.context, writingStyle: opts.writingStyle,
        preserveTone: opts.preserveTone, custom_vocabulary: opts.vocabularyHints }),
    });
    return { original: text, ...result };
  }

  translate(text: string, targetLanguage = "en"): Promise<TranslateResponse> {
    return this.request<TranslateResponse>("/translate", { method: "POST", headers: this.jsonHeaders(),
      body: JSON.stringify({ text, target_language: targetLanguage }) });
  }

  validateKey(): Promise<MeResponse> {
    return this.request<MeResponse>("/me", { headers: this.authHeader() });
  }

  getDeepgramToken(): Promise<DeepgramTokenResponse> {
    return this.request<DeepgramTokenResponse>("/deepgram-token", { method: "POST", headers: this.authHeader() });
  }

  saveVocabulary(terms: string[], name?: string): Promise<VocabularyResponse> {
    return this.request<VocabularyResponse>("/vocabulary", { method: "POST", headers: this.jsonHeaders(),
      body: JSON.stringify({ name, terms }) });
  }
}
