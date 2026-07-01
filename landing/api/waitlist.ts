import type { VercelRequest, VercelResponse } from "@vercel/node";
import { corsHeaders } from "./_auth";

/**
 * Waitlist capture. Tries, in order:
 *  1. Vercel KV / Upstash (KV_REST_API_URL + KV_REST_API_TOKEN)
 *  2. Resend email notification to WAITLIST_NOTIFY_EMAIL (RESEND_API_KEY)
 *  3. Structured console log (always) — recoverable from Vercel logs
 * Returns 200 as long as the entry was recorded by at least the log.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") {
    return res.status(204).set(headers).end();
  }
  if (req.method !== "POST") {
    return res.status(405).set(headers).json({ error: "Method not allowed" });
  }

  const { email, platform } = (req.body ?? {}) as { email?: string; platform?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).set(headers).json({ error: "Valid email required" });
  }

  const entry = {
    email: email.trim().toLowerCase(),
    platform: (platform || "unknown").slice(0, 40),
    date: new Date().toISOString(),
    ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? null,
  };

  // Always log — Vercel function logs are the storage of last resort
  console.log("WAITLIST_SIGNUP", JSON.stringify(entry));

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const r = await fetch(`${kvUrl}/lpush/voxlen:waitlist/${encodeURIComponent(JSON.stringify(entry))}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      if (!r.ok) console.error("WAITLIST_KV_ERROR", r.status, await r.text());
    } catch (e) {
      console.error("WAITLIST_KV_ERROR", e);
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.WAITLIST_NOTIFY_EMAIL;
  if (resendKey && notifyEmail) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Voxlen Waitlist <waitlist@voxlen.ai>",
          to: [notifyEmail],
          subject: `Waitlist signup: ${entry.email} (${entry.platform})`,
          text: `New waitlist signup\n\nEmail: ${entry.email}\nPlatform: ${entry.platform}\nDate: ${entry.date}`,
        }),
      });
    } catch (e) {
      console.error("WAITLIST_RESEND_ERROR", e);
    }
  }

  return res.status(200).set(headers).json({ ok: true });
}
