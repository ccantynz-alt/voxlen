# Voxlen billing

Stripe webhook + Ed25519 license signing. Deployable to any Node 20+ host (Vercel, Railway, Fly, AWS Lambda, bare VM, Cloudflare Workers with minor tweaks).

## How it works

1. Customer clicks **Buy Pro / Professional / Lifetime** on the landing page.
2. They complete checkout on Stripe-hosted checkout.
3. Stripe fires `checkout.session.completed` → this service.
4. This service generates an Ed25519-signed license payload and emails it to the customer via Resend.
5. Customer pastes the license into Voxlen → Settings → License. Done.
6. On subscription renewal (`invoice.paid`), a fresh license is issued automatically.

**No user audio, transcripts, or document content ever touches this service.** Only the customer's email and the purchased tier — both of which Stripe already holds.

## First-time setup

```bash
npm install

# Generate your signing keypair. Run ONCE — if you lose it, all existing
# licenses become unverifiable.
npm run keygen
```

Copy the output:

- **Private key** → your host's secret manager as `VOXLEN_LICENSE_PRIVKEY`. Never leave this directory otherwise.
- **Public key** → embed into the desktop build:
  ```bash
  VOXLEN_LICENSE_PUBKEY=<hex> cargo tauri build
  ```

Copy `.env.example` to `.env` and fill in:

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from the Stripe Dashboard
- `RESEND_API_KEY` from resend.com
- `PRICE_ID_PRO`, `PRICE_ID_PROFESSIONAL`, `PRICE_ID_LIFETIME` — Price IDs of the three Products you created in Stripe

## Run

```bash
npm run dev       # local (needs ngrok or a Stripe CLI forward for webhook testing)
npm run build
npm start         # production
```

Point your Stripe webhook endpoint at `https://yourhost/stripe/webhook`.

## Manual license issuance

For team licenses, founder comps, or replacing a lost key without going through Stripe:

```bash
VOXLEN_LICENSE_PRIVKEY=<hex> \
  npm run sign -- --tier pro --email user@example.com --expires 2026-12-31

VOXLEN_LICENSE_PRIVKEY=<hex> \
  npm run sign -- --tier lifetime --email founder@example.com
```

## Why Ed25519 offline licenses (not a licensing server)?

- No infra dependency from the desktop app — customers can use Voxlen on flights, in secure facilities, anywhere.
- Customer privacy — the app never phones home.
- Cheap — no per-activation cost or rate-limiting needed.
- Forgery-resistant — the signing key stays on our server; the desktop app only holds the public half.
- The tradeoff: a determined attacker with one valid license could share the key. Mitigations in future versions: per-seat HWID binding, online periodic revalidation for Professional tier.
