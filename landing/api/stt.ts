import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders, applyHeaders } from "./_auth.js";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return applyHeaders(res, headers).status(204).end();
  }
  if (req.method !== "POST") {
    return applyHeaders(res, headers).status(405).json({ error: "Method not allowed" });
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return applyHeaders(res, headers).status(401).json({ error: "Missing Authorization header" });
  }

  try {
    await verifyAccessToken(token);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "Invalid token" });
  }

  if (!DEEPGRAM_API_KEY) {
    return applyHeaders(res, headers).status(503).json({ error: "STT service not configured" });
  }

  // Read raw body for multipart â€” forward directly to Deepgram
  const contentType = req.headers["content-type"] ?? "audio/wav";
  const rawLang = (req.headers["x-language"] as string) || "en";
  const VALID_LANGS = new Set(["en","en-US","en-GB","en-AU","en-NZ","fr","de","es","it","pt","nl","ja","ko","zh","ar","hi","ru","pl","sv","da","no","fi","tr"]);
  const language = VALID_LANGS.has(rawLang) ? rawLang : "en";
  const smartFormat = req.headers["x-smart-format"] !== "false";
  const punctuate = req.headers["x-punctuate"] !== "false";
  const diarize = req.headers["x-diarize"] === "true";
  const autoDetect = req.headers["x-auto-detect"] === "true";
  // Comma-separated, URL-encoded custom vocabulary for Nova-3 keyterm prompting
  const keyterms = ((req.headers["x-keyterms"] as string) || "")
    .split(",")
    .map((k) => k.trim().slice(0, 100))
    .filter((k) => k.length > 0 && k.length <= 100)
    .slice(0, 50);

  // mip_opt_out: never allow Deepgram to use customer audio for model training
  let dgUrl = "https://api.deepgram.com/v1/listen?model=nova-3&mip_opt_out=true";
  if (punctuate) dgUrl += "&punctuate=true";
  if (smartFormat) dgUrl += "&smart_format=true";
  if (diarize) dgUrl += "&diarize=true";
  if (autoDetect) {
    dgUrl += "&detect_language=true";
  } else {
    dgUrl += `&language=${encodeURIComponent(language)}`;
  }
  for (const term of keyterms) {
    dgUrl += `&keyterm=${encodeURIComponent(term)}`;
  }

  // Buffer the incoming body (max 25 MB)
  const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_AUDIO_BYTES) {
        reject(new Error("payload_too_large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", reject);
  }).catch((err: Error) => {
    if (err.message === "payload_too_large") {
      return applyHeaders(res, headers).status(413).json({ error: "Audio file exceeds 25 MB limit" });
    }
    throw err;
  });
  if (res.headersSent) return;
  // @types/node's Buffer.concat signature wants Uint8Array<ArrayBuffer>[], but Buffer's
  // own backing ArrayBufferLike is wider (includes SharedArrayBuffer) â€” a type-only
  // mismatch; Buffer.concat(Buffer[]) is Node's normal, always-safe usage at runtime.
  const body = Buffer.concat(chunks as unknown as Uint8Array<ArrayBuffer>[]);

  try {
    const dgRes = await fetch(dgUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(body),
    });

    if (!dgRes.ok) {
      const err = await dgRes.text();
      return applyHeaders(res, headers).status(502).json({ error: "Deepgram error", detail: err });
    }

    const result = await dgRes.json() as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number; words?: unknown[] }> }> };
    };
    const alt = result.results?.channels?.[0]?.alternatives?.[0];
    return applyHeaders(res, headers).status(200).json({
      text: alt?.transcript ?? "",
      confidence: alt?.confidence ?? 0.95,
      words: alt?.words ?? [],
    });
  } catch (e) {
    return applyHeaders(res, headers).status(502).json({ error: "STT request failed" });
  }
}
