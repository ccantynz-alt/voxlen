import { motion } from "framer-motion";
import { Shield, AlertTriangle, Check, ExternalLink, Scale, FileText } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};

const risks = [
  {
    product: "Wispr Flow",
    risk: "Transmits screenshots of your screen to cloud servers — including privileged documents visible on your display.",
    rule: "ABA Rule 1.6(c)",
  },
  {
    product: "Otter.ai",
    risk: "Stores full meeting transcripts on Otter's servers. Your client communications become Otter's data.",
    rule: "ABA Rule 1.6(c)",
  },
  {
    product: "Dragon (Nuance)",
    risk: "Cloud sync and analytics features transmit usage data. Microsoft ownership raises data jurisdiction concerns.",
    rule: "ABA Rule 5.3",
  },
];

const voxlenGuarantees = [
  { icon: Shield, title: "Zero transmission", body: "Audio never leaves your device. Transcription happens via encrypted API — we never see your words." },
  { icon: FileText, title: "No transcript storage", body: "We do not store, log, or train on any dictation content. Your client matter stays yours." },
  { icon: Scale, title: "Privilege-mode flag", body: "Mark sessions as privileged. Voxlen adds a visible on-screen indicator and disables cloud features automatically." },
  { icon: Check, title: "Verifiable architecture", body: "The desktop app is open for audit. No hidden cloud calls, no telemetry on content. Privacy you can prove to your bar association." },
];

export default function EthicsSection() {
  return (
    <section id="ethics" className="py-24 px-6 bg-paper">
      <div className="max-w-5xl mx-auto">
        {/* Header — formal notice */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 uppercase tracking-[0.18em] text-[11px] font-sans font-semibold text-brass mb-5">
            <Scale className="h-3 w-3" aria-hidden="true" />
            Professional Responsibility
          </div>

          <h2 className="font-display text-4xl md:text-5xl tracking-tight text-ink mb-5">
            The only dictation tool lawyers
            <br />
            <span className="italic">can use without calling ethics counsel.</span>
          </h2>

          <div className="mx-auto w-16 border-t border-rule mb-5" aria-hidden="true" />

          <p className="font-sans text-ink-soft text-lg max-w-2xl mx-auto leading-relaxed">
            Every other dictation product sends your words to a cloud server.
            Under ABA Model Rule 1.6(c), that may constitute an unauthorized disclosure
            of client confidences. Voxlen is architecturally different.
          </p>
        </motion.div>

        {/* Risk table */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-12"
        >
          <div className="rounded-md bg-white border border-rule overflow-hidden shadow-[0_1px_3px_rgba(29,26,21,0.06)]">
            <div className="px-5 py-3 bg-paper-deep border-b border-rule flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-brass" aria-hidden="true" />
              <span className="font-serif text-sm font-semibold text-ink">Compliance risks with competitors</span>
            </div>
            <div className="divide-y divide-rule">
              {risks.map((r) => (
                <div key={r.product} className="flex items-start gap-4 px-5 py-4">
                  <div className="w-28 shrink-0">
                    <span className="font-sans text-sm font-semibold text-ink">{r.product}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-sans text-sm text-ink-soft leading-relaxed">{r.risk}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="px-2 py-0.5 rounded-sm bg-paper border border-rule text-ink-soft text-xs font-mono whitespace-nowrap">
                      {r.rule}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs font-sans text-ink-soft mt-2 text-right">
            Based on publicly available privacy policies and product documentation.{" "}
            <a
              href="https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brass hover:text-brass-deep underline underline-offset-2 inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-paper rounded-sm"
            >
              ABA Rule 1.6 reference <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </p>
        </motion.div>

        {/* Voxlen guarantees */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <div className="rounded-md bg-white border border-rule overflow-hidden shadow-[0_1px_3px_rgba(29,26,21,0.06)]">
            <div className="px-5 py-3 bg-paper-deep border-b border-rule flex items-center gap-2">
              <Shield className="h-4 w-4 text-brass" aria-hidden="true" />
              <span className="font-serif text-sm font-semibold text-ink">How Voxlen protects client confidences</span>
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-rule">
              {voxlenGuarantees.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-4 px-5 py-5">
                  <div className="w-9 h-9 rounded-md bg-paper border border-rule flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-brass" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-serif text-sm font-semibold text-ink mb-1">{title}</div>
                    <p className="font-sans text-sm text-ink-soft leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-center mt-10"
        >
          <a
            href="#download"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-md bg-brass text-paper font-sans font-semibold hover:bg-brass-deep transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <Shield className="h-4 w-4" aria-hidden="true" />
            Start your free trial — privacy guaranteed
          </a>
          <p className="text-xs font-sans text-ink-soft mt-3">
            No credit card required. 14-day free trial. Works on macOS, Windows &amp; iOS.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
