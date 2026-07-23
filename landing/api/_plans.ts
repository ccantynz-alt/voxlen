export type PaidPlan = "professional" | "privileged" | "firm";

export interface PlanEntitlement {
  plan: PaidPlan | "free";
  status: string;
  updatedAt: string;
}

const KNOWN_PLANS = new Set<string>(["professional", "privileged", "firm", "free"]);

/**
 * Stripe subscription statuses that mean the customer is no longer paying.
 * `past_due` stays entitled: Stripe is still dunning and will send
 * `customer.subscription.deleted` (or flip to `canceled`/`unpaid`) if it gives up.
 */
const DISENTITLED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

/** The plan a stored entitlement actually grants, once subscription status is considered. */
export function effectivePlan(entitlement: PlanEntitlement | null): PaidPlan | "free" | null {
  if (!entitlement) return null;
  return DISENTITLED_STATUSES.has(entitlement.status) ? "free" : entitlement.plan;
}

function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export async function readPlanEntitlement(email: string): Promise<PlanEntitlement | null> {
  const kv = kvConfig();
  if (!kv || !email) return null;

  try {
    const key = `plan:${email.trim().toLowerCase()}`;
    const response = await fetch(`${kv.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    if (!response.ok) {
      console.error("PLAN_KV_READ_ERROR", response.status, await response.text());
      return null;
    }
    const data = await response.json() as { result?: string | PlanEntitlement | null };
    if (!data.result) return null;
    const value = typeof data.result === "string" ? JSON.parse(data.result) as PlanEntitlement : data.result;
    return value && typeof value.plan === "string" && KNOWN_PLANS.has(value.plan) ? value : null;
  } catch (error) {
    console.error("PLAN_KV_READ_ERROR", error);
    return null;
  }
}

export async function writePlanEntitlement(email: string, entitlement: PlanEntitlement): Promise<boolean> {
  const kv = kvConfig();
  if (!kv) {
    console.error("STRIPE_ENTITLEMENT_NOT_PERSISTED: Vercel KV is not configured", { email, entitlement });
    return false;
  }

  try {
    const key = `plan:${email.trim().toLowerCase()}`;
    const response = await fetch(
      `${kv.url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(entitlement))}`,
      { method: "POST", headers: { Authorization: `Bearer ${kv.token}` } },
    );
    if (!response.ok) {
      console.error("STRIPE_ENTITLEMENT_KV_ERROR", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("STRIPE_ENTITLEMENT_KV_ERROR", error);
    return false;
  }
}
