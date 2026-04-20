/**
 * Privacy & Terms modal displayed from the landing page footer.
 * Extracted from App.tsx to keep the main file focused on marketing sections.
 */
import { useEffect } from "react";

export type LegalType = "privacy" | "terms";

export function LegalModal({
  type,
  onClose,
}: {
  type: LegalType;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#111114] border border-white/10 p-8 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          &times;
        </button>
        {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
      </div>
    </div>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="text-zinc-200">{children}</strong>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold mt-8">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-300 leading-relaxed">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="text-zinc-400 space-y-2 list-disc pl-5">{children}</ul>;
}

function PrivacyContent() {
  return (
    <div className="max-w-none space-y-6">
      <h1 className="text-2xl font-black">Privacy Policy</h1>
      <p className="text-xs text-zinc-500">Last updated: April 2026</p>

      <P>
        Voxlen ("we", "us", "our") is committed to protecting your privacy. This
        policy explains how our voice dictation application handles your data. We
        designed Voxlen with privacy-first principles, especially for
        professionals handling sensitive information.
      </P>

      <H2>1. Data We Do NOT Collect</H2>
      <UL>
        <li>
          <Bold>Audio recordings</Bold> — We never store, log, or retain your
          voice audio. Audio is streamed to your chosen STT provider and
          immediately discarded after transcription.
        </li>
        <li>
          <Bold>Transcribed text</Bold> — Your dictated text stays on your
          device. We never transmit transcription content to our servers.
        </li>
        <li>
          <Bold>Grammar-corrected content</Bold> — Text sent for AI grammar
          correction goes directly to your chosen provider (Anthropic or OpenAI)
          using your own API key. We have no access to this content.
        </li>
        <li>
          <Bold>Documents or files</Bold> — Voxlen never reads, scans, or
          accesses any files on your device beyond its own configuration.
        </li>
      </UL>

      <H2>2. Data Processing Architecture</H2>
      <P>
        Voxlen operates as a <strong>pass-through</strong> application. Even
        though paid plans include AI infrastructure as part of your subscription,
        your data flows directly between your device and the underlying AI
        providers — never through Voxlen-operated servers:
      </P>
      <UL>
        <li>
          <Bold>Speech-to-Text:</Bold> Audio streams directly from your device
          to the speech-to-text provider on zero-retention endpoints. In offline
          mode, audio never leaves your device.
        </li>
        <li>
          <Bold>Grammar Correction:</Bold> Text is sent directly from your
          device to the grammar AI provider (Anthropic or OpenAI) on
          zero-retention endpoints. We have no intermediary server.
        </li>
        <li>
          <Bold>Text Injection:</Bold> All text injection happens locally via
          OS-level APIs. No network transmission involved.
        </li>
        <li>
          <Bold>API credentials:</Bold> Voxlen provisions provider credentials
          as part of your subscription, but credentials are issued to your
          device and used only for direct device-to-provider traffic.
        </li>
      </UL>

      <H2>3. Confidentiality for Legal &amp; Accounting Professionals</H2>
      <P>
        We understand that attorneys, accountants, and other professionals using
        Voxlen may handle privileged or confidential information. Voxlen is
        designed to respect these obligations:
      </P>
      <UL>
        <li>
          No Voxlen-operated server ever receives your content — this is a hard
          architectural rule
        </li>
        <li>
          Session history is stored only on your local device and never synced
          to our infrastructure
        </li>
        <li>Custom vocabulary and dictionaries remain local to your device</li>
        <li>All AI provider traffic uses zero-retention endpoints</li>
        <li>
          Professional plan users get the strictest zero-retention guarantees
          enabled by default, plus per-matter / per-client vocabulary isolation
        </li>
        <li>Offline mode ensures zero external data transmission</li>
      </UL>

      <H2>4. Analytics &amp; Telemetry</H2>
      <P>Voxlen collects minimal, anonymous usage telemetry to improve the product:</P>
      <UL>
        <li>Application launch and feature usage counts (no content)</li>
        <li>Crash reports with stack traces (no user content)</li>
        <li>OS platform and app version</li>
      </UL>
      <P>
        You can disable all telemetry in Settings &gt; Privacy. When disabled,
        zero data is transmitted.
      </P>

      <H2>5. Third-Party Services</H2>
      <P>
        Voxlen includes AI infrastructure as part of your paid subscription.
        Your audio and text are processed by our underlying AI providers on
        zero-retention endpoints:
      </P>
      <UL>
        <li>Deepgram — processes audio for transcription</li>
        <li>OpenAI — processes audio (Whisper) or text (grammar correction)</li>
        <li>Anthropic — processes text for grammar correction</li>
      </UL>
      <P>
        We configure zero-retention with every provider wherever it is
        available. The Professional plan enables the strictest retention and
        data-handling controls by default. Advanced users who prefer to supply
        their own credentials may do so in Settings.
      </P>

      <H2>6. Contact</H2>
      <P>
        For privacy inquiries, contact us at{" "}
        <a
          href="mailto:privacy@voxlen.ai"
          className="text-voxlen-400 hover:underline"
        >
          privacy@voxlen.ai
        </a>
        .
      </P>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="max-w-none space-y-6">
      <h1 className="text-2xl font-black">Terms of Service</h1>
      <p className="text-xs text-zinc-500">Last updated: April 2026</p>

      <P>
        By downloading or using Voxlen, you agree to these terms. Please read
        them carefully.
      </P>

      <H2>1. Service Description</H2>
      <P>
        Voxlen is a desktop and mobile application that provides voice-to-text
        dictation with AI-powered grammar correction and universal text
        injection. The application runs locally on your device and connects to
        third-party APIs using your own credentials.
      </P>

      <H2>2. AI Services &amp; Third-Party Providers</H2>
      <P>
        Paid plans include all AI infrastructure (speech-to-text and grammar
        correction) as part of your subscription. You do not need to provide
        your own API keys. Audio streams directly from your device to the
        relevant AI providers on zero-retention endpoints — Voxlen provisions
        the credentials, but your content never passes through Voxlen-operated
        infrastructure. Advanced users may optionally supply their own API keys.
      </P>

      <H2>3. Subscription Plans</H2>
      <P>
        Voxlen offers Free, Pro ($29/month), Professional ($79/month for legal
        and accounting teams), and Lifetime ($599 one-time) plans. The Free plan
        includes limited dictation. Paid plans unlock all features and include
        all AI costs. Subscriptions can be cancelled at any time. We offer a
        14-day free trial for Pro and Professional with no credit card required.
      </P>

      <H2>4. Acceptable Use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Reverse-engineer, decompile, or disassemble the application</li>
        <li>Use the application for any unlawful purpose</li>
        <li>Redistribute, sublicense, or resell the application</li>
        <li>Attempt to bypass subscription or usage limitations</li>
      </UL>

      <H2>5. Intellectual Property</H2>
      <P>
        Voxlen and its original content, features, and functionality are owned
        by Voxlen and are protected by international copyright and trademark
        laws. Your transcribed content remains entirely yours — we claim no
        rights over content you create using Voxlen.
      </P>

      <H2>6. Disclaimer of Warranties</H2>
      <P>
        Voxlen is provided "as is" without warranties of any kind. We do not
        guarantee that transcriptions or grammar corrections will be error-free.
        You should review all output, especially for legal, medical, or
        financial documents.
      </P>

      <H2>7. Limitation of Liability</H2>
      <P>
        Voxlen shall not be liable for any indirect, incidental, special,
        consequential, or punitive damages resulting from your use of the
        application, including but not limited to errors in transcription or
        grammar correction.
      </P>

      <H2>8. Changes to Terms</H2>
      <P>
        We may update these terms from time to time. Continued use of Voxlen
        after changes constitutes acceptance of the new terms. We will notify
        users of significant changes through the application.
      </P>

      <H2>9. Contact</H2>
      <P>
        For questions about these terms, contact us at{" "}
        <a
          href="mailto:legal@voxlen.ai"
          className="text-voxlen-400 hover:underline"
        >
          legal@voxlen.ai
        </a>
        .
      </P>
    </div>
  );
}
