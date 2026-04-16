# Privacy Policy

**Marco Reid Voice**
**Effective 16 April 2026**

Marco Reid ("**Marco Reid**", "**we**", "**us**", "**our**") respects your
privacy. This Privacy Policy explains what personal information we and the
Marco Reid Voice software ("**the Software**") do and do not collect, how it
is used, the choices you have, and the rights you may have under applicable
law.

This policy applies to:

- the Marco Reid Voice desktop application (macOS, Windows, Linux);
- the Marco Reid Voice iOS keyboard extension;
- the `marcoreid.com` marketing website (the "**Site**"); and
- any direct support communications you have with us.

It does **not** cover the third-party services you choose to integrate with
the Software (see section 5).

## 1. The short version

- Marco Reid Voice runs **on your own device**. Your audio, transcripts,
  settings, and credentials stay on your device unless you explicitly send
  them to a third-party provider that you have configured.
- **We do not operate servers that receive, store, or process your audio or
  your transcripts.**
- **We do not use analytics, telemetry, crash reporting, advertising IDs, or
  third-party trackers** in the Software.
- Third-party speech-to-text and language-model providers (Deepgram, OpenAI,
  Anthropic) handle your content only when you enable them, and only under
  your own API credentials. Their terms and privacy policies apply to that
  content.
- You can delete any or all data from the Software at any time.

## 2. Who the "controller" is

For the desktop and iOS software, **you** are the data controller of Your
Content (your audio, your transcripts, your settings). Marco Reid is not a
controller, joint controller, or processor of that content — it never leaves
your device in a form that reaches us.

For information you submit to us directly (for example, by emailing support
or purchasing a licence through the Site), Marco Reid is the controller. Our
contact point is `privacy@marcoreid.com`.

## 3. What the Software processes locally (on your device)

The following data is stored on your device by the Software. It is **not**
transmitted to Marco Reid.

| Local data            | Where it is stored                                   |
| --------------------- | ---------------------------------------------------- |
| Application settings  | `settings.json` in the Tauri app-data directory       |
| Dictation history     | `history.json` (up to 500 most recent sessions)       |
| Custom vocabulary     | Within settings                                        |
| Third-party API keys  | Within settings (**plaintext at rest** — see below)   |
| Matter / document context | Within settings and session records                 |

### Plaintext-at-rest notice

API keys and transcripts are stored in plaintext on disk. They are protected
only by the file-system permissions of your user account. Any process
running as your user (or anyone with physical access to the unlocked device)
can read them.

We are actively working on OS-keychain integration (macOS Keychain, Windows
Credential Manager, Linux Secret Service / libsecret). Until that ships, if
you are handling material that requires stronger at-rest protection
(privileged client communications, PHI, financial records subject to
stricter regulation) you should consider supplementary controls such as
full-disk encryption, device-management policies, and dedicated user
profiles.

## 4. What leaves your device

The Software makes outbound network requests only in the following
situations, and only to the destinations listed:

| Traffic                       | Destination                                        | Trigger                                                                                             |
| ----------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Audio frames                  | Deepgram **or** OpenAI Whisper                     | While dictation is active, only to the speech-to-text engine you selected                           |
| Transcript text               | Anthropic **or** OpenAI                            | Only when you enable grammar correction and trigger a polish pass                                   |
| Update check                  | GitHub Releases / Marco Reid update endpoint        | When the built-in updater runs (configurable; you can disable auto-update in Settings)              |

**No other outbound traffic originates from the Software.** The Software
does not send anything to Marco Reid-operated servers as part of normal
operation.

## 5. Third-party providers you configure

When you enter your own API key for a provider and use a feature that calls
that provider, the Software connects directly from your device to the
provider. Marco Reid does not proxy, log, or intercept this traffic.

- **Deepgram** — <https://deepgram.com/privacy>
- **OpenAI (Whisper, GPT models)** — <https://openai.com/policies/privacy-policy>
- **Anthropic (Claude)** — <https://www.anthropic.com/legal/privacy>

Those providers act as independent controllers or processors in respect of
the content you send them. Their privacy policies and data-processing terms
apply. You are responsible for reviewing and accepting them. Marco Reid is
not a party to the data relationship between you and any of them, does not
act as your processor in respect of that content, and does not hold a data
processing agreement with those providers on your behalf.

## 6. Information we collect directly

We collect personal information from you only when you voluntarily provide
it, for example:

| Category                 | Example                                                |
| ------------------------ | ------------------------------------------------------ |
| Identity & contact       | Name, business name, email address, phone (support)     |
| Billing                  | Billing address, tax ID, payment metadata (handled by our payment processor — we do not store card numbers) |
| Support correspondence   | The content of emails or messages you send us           |
| Site analytics           | Minimal: page, referrer, coarse location, user-agent (if the Site uses analytics; see the Site's cookie notice) |

We collect this information to: (a) provide, invoice, and support the
Software; (b) respond to your enquiries; (c) comply with legal, tax, and
accounting obligations; (d) detect and prevent fraud or abuse; and (e)
improve the Software (we do **not** rely on Your Content for this).

## 7. How we use and share personal information

We process the personal information in section 6 on one or more of the
following legal bases (as applicable under GDPR / UK GDPR / NZ Privacy Act /
APPs / CCPA / CPRA):

- **Performance of a contract** — to deliver the Software and support you.
- **Legitimate interests** — to secure the Software, prevent abuse, and run
  our business (subject to your right to object).
- **Legal obligation** — tax, accounting, anti-fraud, sanctions compliance.
- **Consent** — where consent is required (you can withdraw at any time
  without affecting lawfulness of prior processing).

We share personal information only:

- with service providers acting on our instructions (for example, our email
  provider, hosted forms provider, payment processor, accountant, legal
  advisors) under confidentiality and data-protection obligations;
- with competent authorities where legally required;
- in connection with a corporate transaction (merger, acquisition,
  financing, or asset sale), subject to equivalent protections;
- with your consent, for any other purpose disclosed at the point of
  collection.

**We do not sell personal information. We do not "share" personal
information for cross-contextual behavioural advertising (as those terms are
defined under the California Consumer Privacy Act / CPRA).**

## 8. International transfers

We are based in New Zealand. If you are outside New Zealand, your personal
information may be processed in New Zealand or in any country where our
service providers operate. Where required, we rely on adequacy
determinations, the UK International Data Transfer Addendum, EU Standard
Contractual Clauses, or equivalent safeguards to protect cross-border
transfers. Copies of the relevant safeguards are available on request at
`privacy@marcoreid.com`.

## 9. Retention

We keep personal information for only as long as is necessary for the
purpose it was collected, or as required by law. Indicative periods:

- **Support correspondence** — up to three (3) years after the last
  contact.
- **Billing and tax records** — seven (7) years (NZ IRD requirements).
- **Account information** — duration of your licence, plus a short period
  thereafter to handle refunds and disputes.

Locally-stored Software data is retained by you and deleted when you delete
it. Marco Reid cannot delete data that never reached Marco Reid.

## 10. Your rights

Depending on where you live, you may have some or all of the following
rights over personal information we hold about you:

- **Access** — to request a copy of your personal information;
- **Rectification** — to have inaccurate information corrected;
- **Erasure / deletion** — to have your personal information deleted;
- **Restriction** — to restrict processing in certain cases;
- **Portability** — to receive your data in a structured, commonly-used,
  machine-readable format;
- **Objection** — to object to processing based on legitimate interests or
  for direct marketing;
- **Withdraw consent** — at any time where processing is based on
  consent;
- **Complaint** — to lodge a complaint with your local data-protection
  authority, including:
  - New Zealand: Office of the Privacy Commissioner — <https://www.privacy.org.nz>
  - Australia: Office of the Australian Information Commissioner — <https://www.oaic.gov.au>
  - United Kingdom: Information Commissioner's Office — <https://ico.org.uk>
  - European Economic Area: your national supervisory authority;
  - California: California Attorney General — <https://oag.ca.gov/privacy/privacy-laws>.

California residents additionally have the right to non-discrimination for
exercising a CCPA/CPRA right, to know the categories of personal information
collected in the prior 12 months, the sources, the purposes, and the
categories of third parties with whom it is shared. Marco Reid does not
"sell" or "share" personal information as those terms are defined in
CCPA/CPRA.

To exercise any right, email `privacy@marcoreid.com`. We may need to verify
your identity before responding.

## 11. Security

We take commercially reasonable administrative, technical, and physical
measures to protect personal information, including: access controls on our
systems, encryption in transit (TLS) for direct communications, least
privilege for service-provider access, secure-by-default configuration for
the Software, and periodic review of our practices. No system is perfectly
secure; see section 3 for notes on at-rest storage in the Software itself.

See `docs/SECURITY.md` for our vulnerability-disclosure policy.

## 12. Children

The Software is not directed to children under 16 and we do not knowingly
collect personal information from children under 16. If you believe a child
has provided personal information to us, email `privacy@marcoreid.com` and
we will delete it.

## 13. Automated decision-making

The Software uses third-party machine-learning models to transcribe and
polish text. Those are not "decisions producing legal or similarly
significant effects" within the meaning of GDPR Article 22; the Output is
drafting assistance that you must review. Marco Reid does not use your data
to make automated decisions about you.

## 14. Do Not Track

Browsers' "Do Not Track" signals are not consistently interpreted. The Site
and the Software honour the **Global Privacy Control (GPC)** signal where
it applies. We otherwise do not perform behavioural tracking.

## 15. Changes

We may update this Privacy Policy from time to time. Material changes will
be communicated via in-product notice or email. The "Effective" date at the
top reflects the latest version.

## 16. Contact

**Marco Reid — Privacy**
Email: `privacy@marcoreid.com`
Postal: *to be published before public launch*

If you are in the European Economic Area or the United Kingdom and require
a representative under Article 27 of the GDPR or the UK GDPR, contact
`privacy@marcoreid.com` and we will provide details of our appointed
representative.

---

*Last updated: 16 April 2026.*
