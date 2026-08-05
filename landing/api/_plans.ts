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

/** Whether the entitlement store exists at all. When false, gating must fail open. */
export function kvConfigured(): boolean {
  return kvConfig() !== null;
}

/**
 * KV lookup outcome that keeps "no entry" distinct from "KV unavailable/errored",
 * so entitlement gating can fail open on infrastructure problems instead of
 * treating an outage as a free plan.
 */
export type KvLookup<T> = { ok: true; value: T | null } | { ok: false };

export async function lookupPlanEntitlement(email: string): Promise<KvLookup<PlanEntitlement>> {
  const kv = kvConfig();
  if (!kv) return { ok: false };
  if (!email) return { ok: true, value: null };

  try {
    const key = `plan:${email.trim().toLowerCase()}`;
    const response = await fetch(`${kv.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    if (!response.ok) {
      console.error("PLAN_KV_READ_ERROR", response.status, await response.text());
      return { ok: false };
    }
    const data = await response.json() as { result?: string | PlanEntitlement | null };
    if (!data.result) return { ok: true, value: null };
    const value = typeof data.result === "string" ? JSON.parse(data.result) as PlanEntitlement : data.result;
    return { ok: true, value: value && typeof value.plan === "string" && KNOWN_PLANS.has(value.plan) ? value : null };
  } catch (error) {
    console.error("PLAN_KV_READ_ERROR", error);
    return { ok: false };
  }
}

export async function readPlanEntitlement(email: string): Promise<PlanEntitlement | null> {
  const lookup = await lookupPlanEntitlement(email);
  return lookup.ok ? lookup.value : null;
}

/**
 * First time we saw this email use a metered endpoint without a paid plan
 * (Unix seconds). Anchors the 14-day free trial so re-minting a fresh token
 * (fresh `iat`) can't restart the clock.
 */
export async function readTrialStart(email: string): Promise<KvLookup<number>> {
  const kv = kvConfig();
  if (!kv || !email) return { ok: false };

  try {
    const key = `trial:${email.trim().toLowerCase()}`;
    const response = await fetch(`${kv.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
    });
    if (!response.ok) {
      console.error("TRIAL_KV_READ_ERROR", response.status, await response.text());
      return { ok: false };
    }
    const data = await response.json() as { result?: string | number | null };
    if (data.result === null || data.result === undefined) return { ok: true, value: null };
    const value = Number(data.result);
    return { ok: true, value: Number.isFinite(value) && value > 0 ? value : null };
  } catch (error) {
    console.error("TRIAL_KV_READ_ERROR", error);
    return { ok: false };
  }
}

/** Best-effort — a failed write only delays the trial clock, never blocks a request. */
export async function writeTrialStart(email: string, epochSeconds: number): Promise<void> {
  const kv = kvConfig();
  if (!kv || !email) return;

  try {
    const key = `trial:${email.trim().toLowerCase()}`;
    const response = await fetch(
      `${kv.url}/set/${encodeURIComponent(key)}/${Math.floor(epochSeconds)}`,
      { method: "POST", headers: { Authorization: `Bearer ${kv.token}` } },
    );
    if (!response.ok) {
      console.error("TRIAL_KV_WRITE_ERROR", response.status, await response.text());
    }
  } catch (error) {
    console.error("TRIAL_KV_WRITE_ERROR", error);
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
