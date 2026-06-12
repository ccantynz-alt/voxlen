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
    <section id="ethics" className="py-24 px-6 relative overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/5 to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto relative">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-4">
            <Scale className="h-3 w-3" />
            ABA Rule 1.6(c) Compliance
          </div>

          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
            The only dictation tool lawyers
            <br />
            <span className="text-amber-400">can use without calling ethics counsel.</span>
          </h2>

          <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
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
          <div className="rounded-2xl bg-[#111114] border border-white/10 overflow-hidden">
            <div className="px-5 py-3 bg-red-950/30 border-b border-red-900/30 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-semibold text-red-300">Compliance risks with competitors</span>
            </div>
            <div className="divide-y divide-white/5">
              {risks.map((r) => (
                <div key={r.product} className="flex items-start gap-4 px-5 py-4">
                  <div className="w-28 shrink-0">
                    <span className="text-sm font-medium text-zinc-300">{r.product}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-400 leading-relaxed">{r.risk}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono whitespace-nowrap">
                      {r.rule}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-zinc-600 mt-2 text-right">
            Based on publicly available privacy policies and product documentation.{" "}
            <a
              href="https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-400 underline inline-flex items-center gap-1"
            >
              ABA Rule 1.6 reference <ExternalLink className="h-3 w-3" />
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
          <div className="rounded-2xl bg-[#111114] border border-emerald-500/20 overflow-hidden">
            <div className="px-5 py-3 bg-emerald-950/30 border-b border-emerald-900/30 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">How Voxlen protects client confidences</span>
            </div>
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
              {voxlenGuarantees.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-4 px-5 py-5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">{title}</div>
                    <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
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
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/25 hover:scale-[1.02]"
          >
            <Shield className="h-4 w-4" />
            Start your free trial — privacy guaranteed
          </a>
          <p className="text-xs text-zinc-600 mt-3">
            No credit card required. 14-day free trial. Works on macOS, Windows &amp; iOS.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
