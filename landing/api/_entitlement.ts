/**
 * Plan/entitlement gate for the metered AI proxy endpoints (/api/stt,
 * /api/grammar, /api/translate, /api/deepgram-token). Auth proves who the
 * caller is; this decides whether Voxlen should pay for their request.
 *
 * Policy:
 *   - Admin, and admin-issued token plans (`admin`, `pro`, `free_trial`) —
 *     allowed; the token's own `exp` bounds those grants.
 *   - KV entitlement with an effective paid plan (professional/privileged/firm,
 *     status not canceled/unpaid) — allowed.
 *   - Everyone else — allowed for a 14-day free trial measured from the
 *     EARLIEST of the token's `iat` and a KV first-seen record (`trial:<email>`),
 *     so re-minting a fresh key never restarts the clock. After that: 402.
 *
 * Fail open: if KV isn't configured, or any KV read fails, the request is
 * allowed — an infra outage must never become a paying-customer outage.
 * Legacy tokens with no `iat` and no KV record start the clock at first sight.
 */

import {
  effectivePlan,
  kvConfigured,
  lookupPlanEntitlement,
  readTrialStart,
  writeTrialStart,
} from "./_plans.js";

export const UPGRADE_URL = "https://www.voxlen.ai/#pricing";

const TRIAL_DAYS = 14;
const TRIAL_SECONDS = TRIAL_DAYS * 86400;

/** Token plans granted outside Stripe (admin-issued keys). The signed token is the grant. */
const NON_STRIPE_GRANTS = new Set(["admin", "pro", "free_trial"]);
const PAID_PLANS = new Set(["professional", "privileged", "firm"]);

export interface EntitlementSubject {
  email: string;
  isAdmin: boolean;
  plan?: string;
  iat?: number;
}

export type EntitlementDecision =
  | { allowed: true }
  | { allowed: false; error: string; message: string };

const ALLOWED: EntitlementDecision = { allowed: true };

export async function checkEntitlement(user: EntitlementSubject): Promise<EntitlementDecision> {
  if (user.isAdmin || (user.plan && NON_STRIPE_GRANTS.has(user.plan))) return ALLOWED;
  if (!kvConfigured()) return ALLOWED; // no entitlement store — fail open

  const lookup = await lookupPlanEntitlement(user.email);
  if (!lookup.ok) return ALLOWED; // KV outage — fail open
  if (lookup.value) {
    const plan = effectivePlan(lookup.value);
    if (plan && PAID_PLANS.has(plan)) return ALLOWED;
    // Entitlement exists but is canceled/unpaid — fall through to the trial window.
  } else if (user.plan && PAID_PLANS.has(user.plan)) {
    // Token was stamped with a paid plan at mint time but the KV row is gone —
    // fail toward the customer rather than cutting off someone who paid.
    return ALLOWED;
  }

  return trialWindow(user);
}

async function trialWindow(user: EntitlementSubject): Promise<EntitlementDecision> {
  const now = Math.floor(Date.now() / 1000);
  const record = await readTrialStart(user.email);
  if (!record.ok) return ALLOWED; // KV outage — fail open

  const candidates = [record.value, user.iat].filter(
    (n): n is number => typeof n === "number" && n > 0,
  );
  if (candidates.length === 0) {
    // Legacy token without iat and never seen before — the clock starts now.
    await writeTrialStart(user.email, now);
    return ALLOWED;
  }

  const start = Math.min(...candidates);
  if (record.value === null) await writeTrialStart(user.email, start);
  if (now < start + TRIAL_SECONDS) return ALLOWED;

  return {
    allowed: false,
    error: "trial_expired",
    message: `Your ${TRIAL_DAYS}-day free trial of Voxlen AI features has ended. Upgrade to a paid plan to continue.`,
  };
}

/** JSON body for the HTTP 402 denial response — same shape on every gated endpoint. */
export function entitlementDeniedBody(decision: Extract<EntitlementDecision, { allowed: false }>) {
  return { error: decision.error, message: decision.message, upgrade_url: UPGRADE_URL };
}
