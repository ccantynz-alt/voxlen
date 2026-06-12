# Sub-processors

**Voxlen**
**Last updated: 12 June 2026**

This page lists the service providers Voxlen engages to process
personal information on Voxlen's behalf (**"Sub-processors"**), as
required by the Data Processing Addendum (`legal/DPA.md`).

Because Voxlen runs on your device and never stores Your Content on
Voxlen-operated servers (account requests pass transiently through
zero-retention endpoints), most processing never involves a Voxlen
Sub-processor. This list covers only the ancillary services Voxlen uses to operate its business (email, billing, release hosting, etc.).

## Current Sub-processors

| Sub-processor     | Purpose                                                                            | Location of processing |
| ----------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| GitHub, Inc.      | Source control, release hosting (installer downloads), auto-update manifest        | United States           |
| Cloudflare, Inc.  | CDN, TLS termination, DDoS protection for `voxlen.ai` and release endpoints    | Global                  |
| Stripe, Inc.      | Payment processing, subscription billing (if you purchase a paid tier)             | United States           |
| Amazon Web Services | Email relay and secure file storage for support attachments                      | Sydney (ap-southeast-2) |
| Google Workspace  | Support email, calendar, document collaboration for Voxlen staff               | United States / EU      |
| Vercel, Inc.      | Hosting for `voxlen.ai` and the zero-retention API endpoints (transit only — no Customer content stored) | United States |
| Deepgram, Inc.    | Speech-to-text processing when you use a Voxlen account (model-training opt-out enforced on every request) | United States |
| Anthropic, PBC    | Language-model grammar correction (Claude) when you use a Voxlen account | United States |
| OpenAI, L.L.C.    | Speech-to-text (Whisper) and language-model grammar correction when you use a Voxlen account | United States |

### Customer-configured third parties (not Sub-processors)

If you configure the Service with your own API credentials instead of a
Voxlen account, the providers above act as independent processors engaged
directly by you under your own terms, and you are responsible for
executing your own data-processing agreement with each of them where
required.

## Changes

Voxlen will update this page before engaging a new Sub-processor or
replacing an existing one. Customers who have signed the DPA may object in
writing within fourteen (14) days of the update on reasonable data-
protection grounds.

## Contact

`privacy@voxlen.ai`.
