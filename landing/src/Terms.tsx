import { Mic, ArrowLeft } from "lucide-react";

export default function Terms() {
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
        <h1 className="text-4xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-zinc-500 mb-12">Last updated: April 10, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, or using Voxlen ("the Application"),
              you agree to be bound by these Terms of Service. If you do not
              agree, do not use the Application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Description of Service</h2>
            <p>
              Voxlen is a desktop voice dictation application that provides
              real-time speech-to-text transcription, AI-powered grammar
              correction, and universal text injection. The Application runs
              locally on your device and connects to third-party APIs based on
              your configuration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. API Keys and Third-Party Services</h2>
            <p className="mb-3">
              Voxlen operates on a "bring your own key" model. You are
              responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Obtaining and maintaining your own API keys from third-party providers (Deepgram, OpenAI, Anthropic)</li>
              <li>Complying with the terms of service of those providers</li>
              <li>Any costs incurred through your use of those APIs</li>
              <li>Keeping your API keys secure</li>
            </ul>
            <p className="mt-3">
              Voxlen is not responsible for the availability, accuracy, or
              pricing of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Subscription Plans</h2>
            <p className="mb-3">Voxlen offers the following plans:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Free:</strong> Limited usage with
                basic features at no cost.
              </li>
              <li>
                <strong className="text-white">Pro ($5.99/month):</strong>{" "}
                Unlimited usage with all features. Billed monthly, cancel
                anytime.
              </li>
              <li>
                <strong className="text-white">Lifetime ($149 one-time):</strong>{" "}
                Permanent access to all Pro features with lifetime updates.
              </li>
            </ul>
            <p className="mt-3">
              All paid plans include a 14-day free trial. You will not be
              charged until the trial period ends. Prices are subject to change
              with 30 days notice to existing subscribers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Refunds</h2>
            <p>
              Monthly subscriptions can be cancelled at any time. No refunds are
              provided for partial months. Lifetime purchases may be refunded
              within 30 days of purchase if you are not satisfied.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Acceptable Use</h2>
            <p className="mb-3">You agree not to use Voxlen to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Generate or distribute harmful, abusive, or illegal content</li>
              <li>Attempt to reverse engineer, decompile, or disassemble the Application</li>
              <li>Circumvent licensing or usage restrictions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Intellectual Property</h2>
            <p>
              Voxlen and its original content, features, and functionality are
              owned by Voxlen and are protected by international copyright,
              trademark, and other intellectual property laws. Your transcriptions
              and content remain entirely yours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Disclaimer of Warranties</h2>
            <p>
              Voxlen is provided "as is" and "as available" without warranties
              of any kind, either express or implied. We do not guarantee that
              transcriptions will be 100% accurate, that grammar corrections
              will be perfect, or that the service will be uninterrupted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Voxlen shall not be liable
              for any indirect, incidental, special, consequential, or punitive
              damages, including but not limited to loss of data, loss of
              profits, or business interruption, arising from your use of the
              Application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will
              provide notice of significant changes through the Application or
              our website. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">11. Termination</h2>
            <p>
              We may terminate or suspend your access to the Application at any
              time, without notice, for conduct that we believe violates these
              Terms or is harmful to other users, us, or third parties. You may
              stop using the Application at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">12. Contact</h2>
            <p>
              If you have questions about these terms, contact us at{" "}
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
