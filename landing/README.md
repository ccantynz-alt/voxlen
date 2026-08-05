# Voxlen Landing Page

A standalone Vite + React marketing site for Voxlen. Deployed independently from the desktop app.

## Local development

```bash
cd landing
npm install
npm run dev
```

The dev server runs on the default Vite port (http://localhost:5173).

## Production build

```bash
npm run build     # typechecks and emits to landing/dist
npm run preview   # serves the production bundle locally
```

## Deploying to Vercel

This directory ships a `vercel.json` that Vercel reads automatically:

- `framework`: `vite`
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`

### Option 1: CLI

```bash
npm i -g vercel
cd landing
vercel        # first deploy (preview)
vercel --prod # promote to production
```

### Option 2: Git integration

1. Import the repository into Vercel.
2. Set **Root Directory** to `landing`.
3. Leave build/output settings on defaults — they are picked up from `vercel.json`.
4. Pushes to `main` will trigger production deploys.

## Serverless API (`landing/api/`)

The site is **not** fully static: alongside the Vite frontend it ships Vercel serverless functions that hold the provider keys for Voxlen-account mode and run the business backend. Files prefixed `_` (`_auth.ts`, `_plans.ts`, `_stripe-webhook.ts`) are shared helpers, not routes. The routed endpoints are:

| Endpoint              | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `/api/stt`            | Speech-to-text proxy (Deepgram) for account-mode clients       |
| `/api/grammar`        | Grammar-correction proxy (Anthropic Claude)                    |
| `/api/translate`      | Translation proxy (Anthropic Claude)                           |
| `/api/deepgram-token` | Issues short-lived Deepgram keys for streaming clients         |
| `/api/vocabulary`     | Custom-vocabulary/keyterm support (Deepgram)                   |
| `/api/desktop-token`  | Long-lived desktop account tokens                              |
| `/api/generate-key`   | Key issuance                                                   |
| `/api/me`             | Current-user info, plan, and feature entitlements              |
| `/api/checkout`       | Stripe Checkout session creation                               |
| `/api/stripe-webhook` | Signature-verified Stripe webhook → KV plan entitlements       |
| `/api/waitlist`       | Waitlist signup (KV storage + Resend email notification)       |
| `/api/admin-waitlist` | Admin waitlist view                                            |
| `/api/admin-health`   | Admin health/diagnostics                                       |

### Required environment variables (set in Vercel — never commit values)

- `VOXLEN_TOKEN_SECRET` — HS256 secret for signing/verifying Voxlen account JWTs
- `DEEPGRAM_API_KEY` — provider key for the STT/vocabulary/token endpoints
- `ANTHROPIC_API_KEY` — provider key for grammar and translation
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_PRIVILEGED`, `STRIPE_PRICE_FIRM` — Stripe billing
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — Vercel KV (Upstash) for waitlist entries and plan entitlements
- `RESEND_API_KEY`, `WAITLIST_NOTIFY_EMAIL` — waitlist email delivery via Resend

## Notes

- Frontend assets live in `landing/src/` and the Vite entry is `landing/index.html`.
- The API endpoints are zero-retention relays: they do not store or log user content.
