// Stripe integration — replace placeholder keys with real ones from the Stripe dashboard.
// Price IDs are created per product in Stripe → Products.
import { getStoredToken } from "./auth";

export const STRIPE_PUBLISHABLE_KEY = "pk_live_REPLACE_ME";

// Schedule of fees:
//   Professional — $29/mo   (cloud dictation + grammar, costs included)
//   Privileged   — $59/mo   (adds on-device offline mode, matter billing, clause library)
//   Firm         — $49/seat/mo, 5-seat minimum
export const PRICE_PROFESSIONAL_MONTHLY = "price_professional_monthly_REPLACE_ME";
export const PRICE_PRIVILEGED_MONTHLY = "price_privileged_monthly_REPLACE_ME";
export const PRICE_FIRM_SEAT_MONTHLY = "price_firm_seat_monthly_REPLACE_ME";

/**
 * Redirects to Stripe Checkout when configured.
 * @returns true if a redirect was started; false if Stripe is not yet
 *          configured (placeholder links) — in that case the page is
 *          scrolled to the waitlist and the caller should show a notice.
 */
export async function redirectToCheckout(priceId: string, email?: string): Promise<boolean> {
  // When the Voxlen API is live, replace this with:
  //   const res = await fetch("https://api.voxlen.com/v1/checkout", { method: "POST", body: JSON.stringify({ priceId, email }) });
  //   const { url } = await res.json();
  //   window.location.href = url;
  //
  // For now, open the Stripe payment link directly (create these in Stripe dashboard).
  const paymentLinks: Record<string, string> = {
    [PRICE_PROFESSIONAL_MONTHLY]: "https://buy.stripe.com/REPLACE_PROFESSIONAL",
    [PRICE_PRIVILEGED_MONTHLY]: "https://buy.stripe.com/REPLACE_PRIVILEGED",
    [PRICE_FIRM_SEAT_MONTHLY]: "https://buy.stripe.com/REPLACE_FIRM",
  };

  const url = paymentLinks[priceId];
  if (url && !url.includes("REPLACE")) {
    window.location.href = email ? `${url}?prefilled_email=${encodeURIComponent(email)}` : url;
    return true;
  }

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
