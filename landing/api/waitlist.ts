import type { VercelRequest, VercelResponse } from "@vercel/node";
import { corsHeaders, applyHeaders } from "./_auth";

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
    return applyHeaders(res, headers).status(204).end();
  }
  if (req.method !== "POST") {
    return applyHeaders(res, headers).status(405).json({ error: "Method not allowed" });
  }

  const { email, platform } = (req.body ?? {}) as { email?: string; platform?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return applyHeaders(res, headers).status(400).json({ error: "Valid email required" });
  }

  const entry = {
    email: email.trim().toLowerCase(),
    platform: (platform || "unknown").slice(0, 40),
    date: new Date().toISOString(),
    ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? null,
  };

  // Always log — Vercel function logs are the storage of last resort
  console.log("WAITLIST_SIGNUP", JSON.stringify(entry));

  // Tracks whether the entry reached durable storage (KV) or a notification
  // (Resend). When false, the console.log above is the only record — the
  // endpoint still returns 200 because the log is recoverable from Vercel.
  let stored = false;

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    try {
      const r = await fetch(`${kvUrl}/lpush/voxlen:waitlist/${encodeURIComponent(JSON.stringify(entry))}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${kvToken}` },
      });
      if (r.ok) stored = true;
      else console.error("WAITLIST_KV_ERROR", r.status, await r.text());
    } catch (e) {
      console.error("WAITLIST_KV_ERROR", e);
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.WAITLIST_NOTIFY_EMAIL;
  if (resendKey && notifyEmail) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
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
      if (r.ok) stored = true;
    } catch (e) {
      console.error("WAITLIST_RESEND_ERROR", e);
    }
  }

  return applyHeaders(res, headers).status(200).json({ ok: true, stored });
}
