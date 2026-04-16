// Voxlen billing webhook.
//
// Listens for Stripe `checkout.session.completed` events, issues a
// signed Ed25519 license, and emails it to the customer via Resend.
// Deployable anywhere that runs Node 20+ (Vercel function, Railway,
// Fly, Cloudflare Workers with a small tweak, bare VM, etc.).
//
// No customer audio, no transcripts, no user content touches this
// server. It only sees the email address and the purchased tier —
// both of which Stripe already has.

import http from "node:http";
import { Buffer } from "node:buffer";
import Stripe from "stripe";
import { Resend } from "resend";
import { createLicense, type Tier } from "./license.js";

const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  VOXLEN_LICENSE_PRIVKEY,
  RESEND_API_KEY,
  RESEND_FROM = "Voxlen <licenses@voxlen.ai>",
  PORT = "8080",
  // Product → tier mapping. Paste the Stripe Price IDs you created.
  PRICE_ID_PRO,
  PRICE_ID_PROFESSIONAL,
  PRICE_ID_LIFETIME,
} = process.env;

for (const [k, v] of Object.entries({
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  VOXLEN_LICENSE_PRIVKEY,
  RESEND_API_KEY,
})) {
  if (!v) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const stripe = new Stripe(STRIPE_SECRET_KEY!);
const resend = new Resend(RESEND_API_KEY!);

function priceToTier(priceId: string | undefined | null): Tier | null {
  if (!priceId) return null;
  if (priceId === PRICE_ID_PRO) return "pro";
  if (priceId === PRICE_ID_PROFESSIONAL) return "professional";
  if (priceId === PRICE_ID_LIFETIME) return "lifetime";
  return null;
}

function tierExpiry(tier: Tier): Date | null {
  // Pro / Professional are monthly subscriptions. Stripe renews them
  // automatically — we mint a fresh license on every successful
  // invoice.payment_succeeded event (wired below) with a rolling
  // 35-day expiry so a missed renewal disables the app promptly but
  // ordinary network hiccups don't break paying customers. Lifetime
  // never expires.
  if (tier === "lifetime") return null;
  const d = new Date();
  d.setDate(d.getDate() + 35);
  return d;
}

async function issueAndEmail(tier: Exclude<Tier, "free">, email: string) {
  const { payload, key } = createLicense(
    { tier, email, expires: tierExpiry(tier) },
    VOXLEN_LICENSE_PRIVKEY!,
  );
  console.log(`Issued ${tier} license ${payload.id} for ${email}`);

  const expiresLine =
    payload.expires === null
      ? "This is a lifetime license — it never expires."
      : `This license is valid until ${new Date(payload.expires * 1000).toUTCString()}. Subscriptions auto-renew; we'll email you a fresh license each billing period.`;

  await resend.emails.send({
    from: RESEND_FROM!,
    to: email,
    subject: `Your Voxlen ${tier[0].toUpperCase() + tier.slice(1)} license`,
    text: [
      `Welcome to Voxlen.`,
      ``,
      `Your ${tier} license key:`,
      ``,
      key,
      ``,
      `To activate: open Voxlen, go to Settings → License, and paste the key above.`,
      `${expiresLine}`,
      ``,
      `Download the latest version at https://voxlen.ai/#download`,
      ``,
      `Questions? Reply to this email.`,
      ``,
      `— The Voxlen team`,
    ].join("\n"),
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_email || session.customer_details?.email;
  if (!email) {
    console.warn(`Session ${session.id} completed with no email; skipping.`);
    return;
  }

  // Pull line items so we can map price → tier.
  const items = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 10,
  });
  for (const item of items.data) {
    const tier = priceToTier(item.price?.id);
    if (tier && tier !== "free") {
      await issueAndEmail(tier, email);
      return;
    }
  }
  console.warn(`Session ${session.id}: no matching tier for purchased items.`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const email = invoice.customer_email;
  if (!email) return;
  for (const item of invoice.lines.data) {
    const tier = priceToTier(item.price?.id);
    if (tier && tier !== "free") {
      await issueAndEmail(tier, email);
      return;
    }
  }
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (req.method !== "POST" || req.url !== "/stripe/webhook") {
    res.writeHead(404);
    res.end();
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.writeHead(400);
    res.end("missing signature");
    return;
  }

  let event: Stripe.Event;
  try {
    const body = await readBody(req);
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    res.writeHead(400);
    res.end("bad signature");
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        // ignore — the Stripe dashboard shows the rest.
        break;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ received: true }));
  } catch (e) {
    console.error("Handler error:", e);
    res.writeHead(500);
    res.end("handler error");
  }
});

const port = Number(PORT);
server.listen(port, () => {
  console.log(`Voxlen billing webhook listening on :${port}`);
});
