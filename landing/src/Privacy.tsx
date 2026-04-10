import { Mic, ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300">
      <nav className="border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-voxlen-600 flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Voxlen</span>
          </a>
          <a href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mb-12">Last updated: April 10, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Overview</h2>
            <p>
              Voxlen is a desktop voice dictation application. We built it with
              privacy as a core principle. Your audio is processed in real-time
              and is never stored on our servers. You own your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Audio Data</h2>
            <p className="mb-3">
              When you use Voxlen, audio from your microphone is captured
              locally on your device. Depending on your chosen speech-to-text
              engine:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Whisper Local (offline):</strong>{" "}
                Audio is processed entirely on your device. Nothing leaves your
                computer.
              </li>
              <li>
                <strong className="text-white">Deepgram / OpenAI Whisper (cloud):</strong>{" "}
                Audio is streamed to the respective provider for transcription
                and immediately discarded after processing. We do not have
                access to this audio.
              </li>
            </ul>
            <p className="mt-3">
              We never store, log, listen to, or retain your audio recordings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Grammar Correction</h2>
            <p>
              When AI grammar correction is enabled, your transcribed text
              (not audio) is sent to your chosen provider (Anthropic Claude or
              OpenAI) for processing. This text is subject to the respective
              provider's data policies. We do not store or have access to the
              text sent for grammar correction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">API Keys</h2>
            <p>
              Voxlen uses a "bring your own key" model. Your API keys for
              Deepgram, OpenAI, and Anthropic are stored locally on your device
              using your operating system's secure storage. We never transmit,
              collect, or have access to your API keys.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Local Data Storage</h2>
            <p>The following data is stored locally on your device:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Application settings and preferences</li>
              <li>Transcription history (if you have "Save Transcripts" enabled)</li>
              <li>API keys (in your system's secure storage)</li>
              <li>Onboarding completion state</li>
            </ul>
            <p className="mt-3">
              You can delete all local data at any time from the Settings panel.
              None of this data is synced to our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Analytics</h2>
            <p>
              If you opt in to usage analytics in Settings, we collect anonymous,
              aggregated usage data (such as which features are used and crash
              reports) to help improve Voxlen. This data contains no personal
              information, no audio, and no transcription content. You can
              disable this at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Third-Party Services</h2>
            <p className="mb-3">
              Voxlen integrates with the following third-party services, each
              governed by their own privacy policies:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Deepgram</strong> — Speech-to-text
                transcription
              </li>
              <li>
                <strong className="text-white">OpenAI</strong> — Whisper
                transcription and optional grammar correction
              </li>
              <li>
                <strong className="text-white">Anthropic</strong> — Claude-powered
                grammar correction
              </li>
            </ul>
            <p className="mt-3">
              Your use of these services is governed by their respective privacy
              policies and terms. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Children's Privacy</h2>
            <p>
              Voxlen is not directed at children under 13. We do not knowingly
              collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will
              notify you of significant changes through the application or on
              our website. Continued use of Voxlen after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Contact</h2>
            <p>
              If you have questions about this privacy policy, contact us at{" "}
              <a
                href="mailto:support@voxlen.ai"
                className="text-voxlen-400 hover:underline"
              >
                support@voxlen.ai
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} Voxlen. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
