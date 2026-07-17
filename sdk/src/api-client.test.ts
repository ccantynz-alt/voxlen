import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoxlenApiClient } from "./api-client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: "",
    json: vi.fn().mockResolvedValue(body) };
}

describe("VoxlenApiClient", () => {
  beforeEach(() => fetchMock.mockReset());

  it("posts raw audio and STT options to the deployed /stt contract", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { text: "hello", confidence: 0.9, words: [] }));
    const client = new VoxlenApiClient({ voxlenKey: "jwt", voxlenApiBase: "https://example.test/api/" });
    const audio = new Blob(["audio"], { type: "audio/webm" });
    await expect(client.transcribe(audio, { language: "en-NZ", vocabularyHints: ["A B"],
      smartFormat: false, punctuate: true, speakerLabels: true })).resolves.toMatchObject({ text: "hello" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.test/api/stt");
    expect(init.body).toBe(audio);
    expect(init.headers).toMatchObject({ Authorization: "Bearer jwt", "Content-Type": "audio/webm",
      "X-Language": "en-NZ", "X-Keyterms": "A%20B", "X-Smart-Format": "false",
      "X-Punctuate": "true", "X-Diarize": "true" });
  });

  it("uses /me to validate a key", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { sub: "1", features: ["stt"] }));
    const client = new VoxlenApiClient({ voxlenKey: "jwt" });
    await client.validateKey();
    expect(fetchMock.mock.calls[0][0]).toBe("https://www.voxlen.ai/api/me");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer jwt");
  });

  it("posts the exact grammar and translation field names", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { corrected: "Hello.", changes: [], score: 1 }));
    fetchMock.mockResolvedValueOnce(response(200, { translated: "Hola", detected_source: "en", target_language: "es" }));
    const client = new VoxlenApiClient({ voxlenKey: "jwt" });
    await client.polishGrammar("hello", { writingStyle: "professional", vocabularyHints: ["Voxlen"] });
    await client.translate("Hello", "es");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "hello", writingStyle: "professional",
      custom_vocabulary: ["Voxlen"] });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ text: "Hello", target_language: "es" });
  });

  it("gets a temporary Deepgram key and posts vocabulary terms", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { key: "temp", ttl: 30, fallback: false }));
    fetchMock.mockResolvedValueOnce(response(200, { ok: true, name: "legal", count: 1 }));
    const client = new VoxlenApiClient({ voxlenKey: "jwt" });
    await expect(client.getDeepgramToken()).resolves.toMatchObject({ key: "temp", ttl: 30 });
    await client.saveVocabulary(["Voxlen"], "legal");
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/deepgram-token$/);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: "legal", terms: ["Voxlen"] });
  });

  it("reports a 401 invalid key", async () => {
    fetchMock.mockResolvedValueOnce(response(401, { error: "Invalid token" }));
    await expect(new VoxlenApiClient({ voxlenKey: "bad" }).validateKey())
      .rejects.toThrow(/401.*Invalid token/);
  });

  it("reports a 503 service configuration failure", async () => {
    fetchMock.mockResolvedValueOnce(response(503, { error: "STT service not configured" }));
    await expect(new VoxlenApiClient({ voxlenKey: "jwt" }).getDeepgramToken())
      .rejects.toThrow(/503.*not configured/);
  });

  it("preserves network failures", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(new VoxlenApiClient({ voxlenKey: "jwt" }).validateKey())
      .rejects.toThrow("Failed to fetch");
  });
});
