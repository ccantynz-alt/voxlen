import type {
  VoxlenConfig,
  VoxlenContext,
  TranscribeResponse,
  AsyncTranscribeResponse,
  VocabularyList,
} from "./types";

const DEFAULT_BASE = "https://voxlen.ai/api";

/**
 * Low-level client for the Voxlen REST API (voxlen.ai/api/v1).
 * Used when a voxlenApiKey is configured — routes all transcription
 * through the Voxlen platform rather than calling Deepgram directly.
 */
export class VoxlenApiClient {
  private apiKey: string;
  private base: string;
  private tenantId?: string;

  constructor(config: Pick<VoxlenConfig, "voxlenApiKey" | "voxlenApiBase" | "tenantId">) {
    if (!config.voxlenApiKey) throw new Error("voxlenApiKey is required");
    this.apiKey = config.voxlenApiKey;
    this.base = (config.voxlenApiBase || DEFAULT_BASE).replace(/\/$/, "");
    this.tenantId = config.tenantId;
  }

  private headers(): HeadersInit {
    return {
      "X-Voxlen-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  /** Transcribe an audio Blob synchronously (< 60s) */
  async transcribe(
    audio: Blob,
    opts: {
      context?: VoxlenContext;
      language?: string;
      vocabularyHints?: string[];
      formatOutput?: boolean;
      speakerLabels?: boolean;
    } = {}
  ): Promise<TranscribeResponse> {
    const form = new FormData();
    form.append("audio", audio, "audio.webm");
    form.append("context", opts.context ?? "general");
    if (opts.language) form.append("language", opts.language);
    if (opts.vocabularyHints?.length)
      opts.vocabularyHints.forEach((h) => form.append("vocabulary_hints[]", h));
    if (opts.formatOutput !== false) form.append("format_output", "true");
    if (opts.speakerLabels) form.append("speaker_labels", "true");
    if (this.tenantId) form.append("tenant_id", this.tenantId);

    const res = await fetch(`${this.base}/transcribe`, {
      method: "POST",
      headers: { "X-Voxlen-Key": this.apiKey },
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `Transcription failed: ${res.status}`);
    }
    return res.json();
  }

  /** Submit audio for async transcription (> 60s) */
  async transcribeAsync(
    audio: Blob,
    opts: {
      context?: VoxlenContext;
      language?: string;
      vocabularyHints?: string[];
      speakerLabels?: boolean;
      webhookUrl?: string;
    } = {}
  ): Promise<AsyncTranscribeResponse> {
    const form = new FormData();
    form.append("audio", audio, "audio.webm");
    form.append("context", opts.context ?? "general");
    if (opts.language) form.append("language", opts.language);
    if (opts.vocabularyHints?.length)
      opts.vocabularyHints.forEach((h) => form.append("vocabulary_hints[]", h));
    if (opts.speakerLabels) form.append("speaker_labels", "true");
    if (opts.webhookUrl) form.append("webhook_url", opts.webhookUrl);
    if (this.tenantId) form.append("tenant_id", this.tenantId);

    const res = await fetch(`${this.base}/transcribe/async`, {
      method: "POST",
      headers: { "X-Voxlen-Key": this.apiKey },
      body: form,
    });
    if (!res.ok) throw new Error(`Async transcription failed: ${res.status}`);
    return res.json();
  }

  /** Poll for async transcription result */
  async getTranscription(id: string): Promise<TranscribeResponse> {
    const res = await fetch(`${this.base}/transcribe/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Get transcription failed: ${res.status}`);
    return res.json();
  }

  /** Poll until a transcription job completes (max 5 min) */
  async waitForTranscription(
    id: string,
    intervalMs = 2000,
    timeoutMs = 300_000
  ): Promise<TranscribeResponse> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = await this.getTranscription(id);
      if (result.status === "completed") return result;
      if (result.status === "failed") throw new Error("Transcription job failed");
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("Transcription timed out");
  }

  /** Open SSE stream for real-time transcription */
  streamTranscribe(
    audioBlob: Blob,
    onChunk: (chunk: { type: string; text: string; is_final: boolean; segment_index: number }) => void,
    onError?: (err: Error) => void
  ): () => void {
    let aborted = false;
    const abort = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${this.base}/transcribe/stream`, {
          method: "POST",
          headers: { "X-Voxlen-Key": this.apiKey, "Content-Type": "application/octet-stream" },
          body: audioBlob,
          signal: abort.signal,
        });

        if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const chunk = JSON.parse(line.slice(6));
                onChunk(chunk);
              } catch {}
            }
          }
        }
      } catch (err) {
        if (!aborted) onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      aborted = true;
      abort.abort();
    };
  }

  // ---------- Vocabulary Lists ----------

  async listVocabularyLists(): Promise<VocabularyList[]> {
    const res = await fetch(`${this.base}/vocabulary`, { headers: this.headers() });
    if (!res.ok) throw new Error(`List vocabulary failed: ${res.status}`);
    return res.json();
  }

  async createVocabularyList(
    name: string,
    terms: string[],
    context?: string
  ): Promise<VocabularyList> {
    const res = await fetch(`${this.base}/vocabulary`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name, terms, context }),
    });
    if (!res.ok) throw new Error(`Create vocabulary failed: ${res.status}`);
    return res.json();
  }

  async updateVocabularyList(
    id: string,
    updates: { name?: string; terms?: string[] }
  ): Promise<VocabularyList> {
    const res = await fetch(`${this.base}/vocabulary/${id}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update vocabulary failed: ${res.status}`);
    return res.json();
  }

  async deleteVocabularyList(id: string): Promise<void> {
    const res = await fetch(`${this.base}/vocabulary/${id}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Delete vocabulary failed: ${res.status}`);
  }

  async healthCheck(): Promise<{ status: string; version: string; latency_ms: number }> {
    const res = await fetch(`${this.base}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return res.json();
  }
}
