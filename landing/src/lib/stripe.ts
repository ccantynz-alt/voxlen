// Stripe integration — replace placeholder keys with real ones from the Stripe dashboard.
// Price IDs are created per product in Stripe → Products.
export const STRIPE_PUBLISHABLE_KEY = "pk_live_REPLACE_ME";

export const PRICE_PRO_MONTHLY = "price_pro_monthly_REPLACE_ME";
export const PRICE_PROFESSIONAL_MONTHLY = "price_professional_monthly_REPLACE_ME";
export const PRICE_LIFETIME = "price_lifetime_REPLACE_ME";

export async function redirectToCheckout(priceId: string, email?: string): Promise<void> {
  // Build a Stripe Checkout URL via the Voxlen API, then redirect.
  // This avoids needing stripe-js for URL construction while keeping the
  // integration ready to swap in a real session endpoint.
  const params = new URLSearchParams({
    price: priceId,
    mode: priceId === PRICE_LIFETIME ? "payment" : "subscription",
    success_url: `${window.location.origin}/?checkout=success`,
    cancel_url: `${window.location.origin}/#pricing`,
  });
  if (email) params.set("prefilled_email", email);

  // When the Voxlen API is live, replace this with:
  //   const res = await fetch("https://api.voxlen.com/v1/checkout", { method: "POST", body: JSON.stringify({ priceId, email }) });
  //   const { url } = await res.json();
  //   window.location.href = url;
  //
  // For now, open the Stripe payment link directly (create these in Stripe dashboard).
  const paymentLinks: Record<string, string> = {
    [PRICE_PRO_MONTHLY]: "https://buy.stripe.com/REPLACE_PRO",
    [PRICE_PROFESSIONAL_MONTHLY]: "https://buy.stripe.com/REPLACE_PROFESSIONAL",
    [PRICE_LIFETIME]: "https://buy.stripe.com/REPLACE_LIFETIME",
  };

  const url = paymentLinks[priceId];
  if (url && !url.includes("REPLACE")) {
    window.location.href = email ? `${url}?prefilled_email=${encodeURIComponent(email)}` : url;
  } else {
    // Stripe not yet configured — scroll to waitlist
    const el = document.getElementById("download") ?? document.getElementById("pricing");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.hash = "#download";
    }
  }
}
