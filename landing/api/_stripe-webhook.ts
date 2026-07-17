import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaidPlan } from "./_plans.js";

export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const fields = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestampText = fields.find(([key]) => key === "t")?.[1];
  const signatures = fields.filter(([key]) => key === "v1").map(([, value]) => value);
  const timestamp = Number(timestampText);
  if (!timestampText || !Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || signatures.length === 0) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestampText}.`)
    .update(payload, "utf8")
    .digest();
  return signatures.some((signature) => {
    if (!/^[a-f\d]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(new Uint8Array(actual), new Uint8Array(expected));
  });
}

export function planFromPriceId(priceId: string | undefined): PaidPlan | null {
  if (!priceId) return null;
  const prices: Array<[string | undefined, PaidPlan]> = [
    [process.env.STRIPE_PRICE_PROFESSIONAL, "professional"],
    [process.env.STRIPE_PRICE_PRIVILEGED, "privileged"],
    [process.env.STRIPE_PRICE_FIRM, "firm"],
  ];
  return prices.find(([configured]) => configured && configured === priceId)?.[1] ?? null;
}
