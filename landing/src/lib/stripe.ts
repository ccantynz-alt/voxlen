// Stripe checkout — the /api/checkout Vercel function creates the Checkout
// Session server-side (it holds the secret key and price IDs in env vars).
import { getStoredToken } from "./auth";

// Plan identifiers passed to /api/checkout, which maps them to Stripe price
// IDs via STRIPE_PRICE_* env vars.
//
// Schedule of fees:
//   Professional — $29/mo   (cloud dictation + grammar, costs included)
//   Privileged   — $59/mo   (adds on-device offline mode, matter billing, clause library)
//   Firm         — $49/seat/mo, 5-seat minimum
export const PRICE_PROFESSIONAL_MONTHLY = "professional";
export const PRICE_PRIVILEGED_MONTHLY = "privileged";
export const PRICE_FIRM_SEAT_MONTHLY = "firm";

/**
 * Redirects to Stripe Checkout when configured.
 * @returns true if a redirect was started; false if Stripe is not yet
 *          configured (or the user is signed out) — in that case the page is
 *          scrolled to the waitlist and the caller should show a notice.
 */
export async function redirectToCheckout(priceId: string, _email?: string): Promise<boolean> {
  const plans: Record<string, "professional" | "privileged" | "firm"> = {
    [PRICE_PROFESSIONAL_MONTHLY]: "professional",
    [PRICE_PRIVILEGED_MONTHLY]: "privileged",
    [PRICE_FIRM_SEAT_MONTHLY]: "firm",
  };
  const plan = plans[priceId];
  const token = getStoredToken();
  if (plan && token) {
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json() as { url?: string; error?: string };
      if (response.ok && data.url) {
        window.location.href = data.url;
        return true;
      }
      // A 503 stripe_not_configured (or any other failure) falls through to
      // the waitlist below so the caller shows the "launching soon" notice.
    } catch {
      // Preserve the existing waitlist fallback on network or API failures.
    }
  }

  // Stripe not yet configured — scroll to waitlist; caller shows a visible notice
  const el = document.getElementById("download") ?? document.getElementById("pricing");
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  } else {
    window.location.hash = "#download";
  }
  return false;
}
