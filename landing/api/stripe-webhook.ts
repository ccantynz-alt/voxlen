import type { VercelRequest, VercelResponse } from "@vercel/node";
import { writePlanEntitlement } from "./_plans.js";
import type { PaidPlan } from "./_plans.js";
import { planFromPriceId, verifyStripeSignature } from "./_stripe-webhook.js";

export const config = { api: { bodyParser: false } };

interface StripeObject {
  customer_email?: string | null;
  status?: string;
  metadata?: { email?: string; plan?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
  line_items?: { data?: Array<{ price?: { id?: string } }> };
}

async function rawBody(req: VercelRequest): Promise<string> {
  req.setEncoding("utf8");
  let body = "";
  for await (const chunk of req) body += chunk as string;
  return body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];
  const signatureHeader = Array.isArray(signature) ? signature[0] : signature;
  const payload = await rawBody(req);
  if (!secret || !signatureHeader || !verifyStripeSignature(payload, signatureHeader, secret)) {
    return res.status(400).json({ error: "invalid_signature" });
  }

  let event: { type?: string; data?: { object?: StripeObject } };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    console.error("STRIPE_WEBHOOK_INVALID_JSON");
    return res.status(200).json({ received: true, stored: false });
  }

  const handled = new Set(["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"]);
  if (!event.type || !handled.has(event.type)) return res.status(200).json({ received: true });

  const object = event.data?.object;
  const email = object?.metadata?.email ?? object?.customer_email ?? undefined;
  const metadataPlan = object?.metadata?.plan;
  const priceId = object?.items?.data?.[0]?.price?.id ?? object?.line_items?.data?.[0]?.price?.id;
  const mappedPlan = metadataPlan === "professional" || metadataPlan === "privileged" || metadataPlan === "firm"
    ? metadataPlan as PaidPlan
    : planFromPriceId(priceId);
  const deleted = event.type === "customer.subscription.deleted";

  if (!email || (!mappedPlan && !deleted)) {
    console.error("STRIPE_ENTITLEMENT_MISSING_DATA", event.type, { email, metadataPlan, priceId });
    return res.status(200).json({ received: true, stored: false });
  }
  const stored = await writePlanEntitlement(email, {
    plan: deleted ? "free" : mappedPlan!,
    status: deleted ? "canceled" : (object?.status ?? "active"),
    updatedAt: new Date().toISOString(),
  });
  if (!stored) {
    // 5xx so Stripe redelivers (retries with backoff for ~3 days) — a 200 here
    // would mean a paying customer silently never gets entitled after a KV blip.
    return res.status(500).json({ received: true, stored: false });
  }
  return res.status(200).json({ received: true, stored: true });
}
