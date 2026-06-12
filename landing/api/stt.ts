import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractBearer, corsHeaders } from "./_auth";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY!;

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return res.status(204).set(headers).end();
  }
  if (req.method !== "POST") {
    return res.status(405).set(headers).json({ error: "Method not allowed" });
  }

  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return res.status(401).set(headers).json({ error: "Missing Authorization header" });
  }

  try {
    await verifyAccessToken(token);
  } catch {
    return res.status(401).set(headers).json({ error: "Invalid token" });
  }

  if (!DEEPGRAM_API_KEY) {
    return res.status(503).set(headers).json({ error: "STT service not configured" });
  }

  // Read raw body for multipart — forward directly to Deepgram
  const contentType = req.headers["content-type"] ?? "audio/wav";
  const language = (req.headers["x-language"] as string) || "en";
  const smartFormat = req.headers["x-smart-format"] !== "false";
  const punctuate = req.headers["x-punctuate"] !== "false";
  const diarize = req.headers["x-diarize"] === "true";
  const autoDetect = req.headers["x-auto-detect"] === "true";
  // Comma-separated, URL-encoded custom vocabulary for Nova-3 keyterm prompting
  const keyterms = ((req.headers["x-keyterms"] as string) || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

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
    dgUrl += `&keyterm=${term}`;
  }

  // Buffer the incoming body
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", resolve);
    req.on("error", reject);
  });
  const body = Buffer.concat(chunks);

  try {
    const dgRes = await fetch(dgUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": contentType.includes("multipart") ? "audio/wav" : contentType,
      },
      body,
    });

    if (!dgRes.ok) {
      const err = await dgRes.text();
      return res.status(502).set(headers).json({ error: "Deepgram error", detail: err });
    }

    const result = await dgRes.json() as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number; words?: unknown[] }> }> };
    };
    const alt = result.results?.channels?.[0]?.alternatives?.[0];
    return res.status(200).set(headers).json({
      text: alt?.transcript ?? "",
      confidence: alt?.confidence ?? 0.95,
      words: alt?.words ?? [],
    });
  } catch (e) {
    return res.status(502).set(headers).json({ error: "STT request failed" });
  }
}
