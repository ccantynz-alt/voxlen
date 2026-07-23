import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyHeaders, corsHeaders, extractBearer, verifyAccessToken } from "./_auth.js";
import type { PaidPlan } from "./_plans.js";

const PRICE_ENV: Record<PaidPlan, string> = {
  professional: "STRIPE_PRICE_PROFESSIONAL",
  privileged: "STRIPE_PRICE_PRIVILEGED",
  firm: "STRIPE_PRICE_FIRM",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const headers = corsHeaders();
  if (req.method === "OPTIONS") return applyHeaders(res, headers).status(204).end();
  if (req.method !== "POST") return applyHeaders(res, headers).status(405).json({ error: "method_not_allowed" });

  const bearer = extractBearer(req.headers.authorization);
  if (!bearer) return applyHeaders(res, headers).status(401).json({ error: "missing_authorization" });
  let user;
  try {
    user = await verifyAccessToken(bearer);
  } catch {
    return applyHeaders(res, headers).status(401).json({ error: "invalid_token" });
  }

  const plan = (req.body as { plan?: string } | undefined)?.plan;
  if (!plan || !Object.prototype.hasOwnProperty.call(PRICE_ENV, plan)) return applyHeaders(res, headers).status(400).json({ error: "invalid_plan" });
  const typedPlan = plan as PaidPlan;
  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env[PRICE_ENV[typedPlan]];
  if (!secret || !price) return applyHeaders(res, headers).status(503).json({ error: "stripe_not_configured" });

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("customer_email", user.email);
  form.set("success_url", "https://www.voxlen.ai/dashboard?checkout=success");
  form.set("cancel_url", "https://www.voxlen.ai/#pricing");
  form.set("line_items[0][price]", price);
  form.set("line_items[0][quantity]", typedPlan === "firm" ? "5" : "1");
  form.set("metadata[plan]", typedPlan);
  form.set("metadata[email]", user.email);
  form.set("subscription_data[metadata][plan]", typedPlan);
  form.set("subscription_data[metadata][email]", user.email);

  try {
    const stripe = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const data = await stripe.json() as { url?: string; error?: { message?: string } };
    if (!stripe.ok || !data.url) {
      console.error("STRIPE_CHECKOUT_ERROR", stripe.status, data.error?.message ?? data);
      return applyHeaders(res, headers).status(502).json({ error: "stripe_checkout_failed" });
    }
    return applyHeaders(res, headers).status(200).json({ url: data.url });
  } catch (error) {
    console.error("STRIPE_CHECKOUT_ERROR", error);
    return applyHeaders(res, headers).status(502).json({ error: "stripe_checkout_failed" });
  }
}
