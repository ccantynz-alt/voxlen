import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Zap,
  Shield,
  Globe,
  Sparkles,
  Keyboard,
  Monitor,
  Smartphone,
  ArrowRight,
  Check,
  Star,
  ChevronDown,
  ChevronUp,
  Volume2,
  Cpu,
  Download,
  Apple,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function App() {
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Comparison />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer onOpenLegal={setLegalModal} />
      {legalModal && (
        <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
      )}
    </div>
  );
}

function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-marcoreid-600 flex items-center justify-center">
            <Mic className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Voxlen</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <a
          href="#download"
          className="h-9 px-4 rounded-lg bg-marcoreid-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-marcoreid-700 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Download Free
        </a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden glow-hero">
      {/* Background orbs */}
      <div className="glow-orb w-[500px] h-[500px] bg-marcoreid-600 top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="space-y-6"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-marcoreid-600/10 border border-marcoreid-600/20 text-marcoreid-400 text-xs font-medium">
              <Zap className="h-3 w-3" />
              The professional-grade dictation tool has arrived
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]"
          >
            Speak. AI Polishes.
            <br />
            <span className="gradient-text">Text Appears Anywhere.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            Professional-grade voice dictation with AI grammar correction that types
            into any application, on any device. Never interrupted. Built for lawyers,
            accountants, and professionals who can't afford mistakes.{" "}
            <span className="text-white font-medium">
              Everything included — no API keys, no setup.
            </span>
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4"
          >
            <a
              href="#download"
              className="h-12 px-8 rounded-xl bg-marcoreid-600 text-white font-semibold flex items-center gap-2 hover:bg-marcoreid-700 transition-all shadow-lg shadow-marcoreid-600/25 hover:shadow-marcoreid-600/40 hover:scale-[1.02]"
            >
              <Download className="h-5 w-5" />
              Download for Free
            </a>
            <a
              href="#features"
              className="h-12 px-8 rounded-xl bg-white/5 border border-white/10 text-white font-medium flex items-center gap-2 hover:bg-white/10 transition-all"
            >
              See How It Works
              <ArrowRight className="h-4 w-4" />
            </a>
          </motion.div>

          {/* Platform badges */}
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-center gap-4 pt-2 text-xs text-zinc-500"
          >
            <span className="flex items-center gap-1.5">
              <Apple className="h-3.5 w-3.5" /> macOS
            </span>
            <span className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" /> Windows
            </span>
            <span className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" /> Linux
            </span>
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> iOS
            </span>
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Android
            </span>
          </motion.div>
        </motion.div>

        {/* App screenshot mockup */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-16 relative"
        >
          <div className="max-w-4xl mx-auto rounded-2xl bg-[#111114] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
            {/* Mock title bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0c0c0f] border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="w-5 h-5 rounded bg-marcoreid-600 flex items-center justify-center">
                  <Mic className="h-3 w-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-zinc-300">Voxlen</span>
                <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-medium">
                  Listening
                </span>
              </div>
            </div>

            {/* Mock app content */}
            <div className="flex">
              {/* Sidebar */}
              <div className="w-48 border-r border-white/5 p-3 space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-marcoreid-600/10 text-marcoreid-400 text-xs font-medium">
                  <Mic className="h-3.5 w-3.5" /> Dictation
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 text-xs">
                  <Sparkles className="h-3.5 w-3.5" /> Grammar
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-500 text-xs">
                  <Globe className="h-3.5 w-3.5" /> History
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 p-8 text-center">
                {/* Waveform visualization */}
                <div className="flex items-center justify-center gap-[3px] h-16 mb-6">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-marcoreid-500"
                      style={{
                        height: `${8 + Math.sin(i * 0.4) * 20 + Math.random() * 16}px`,
                        opacity: 0.3 + Math.sin(i * 0.3) * 0.4 + 0.3,
                      }}
                    />
                  ))}
                </div>

                <div className="space-y-3 text-left max-w-md mx-auto">
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    <span className="text-[10px] text-zinc-600 font-mono mr-2">10:32:15</span>
                    The quarterly results exceeded all expectations, with revenue growing
                    forty-two percent year over year.
                    <Sparkles className="h-3 w-3 text-marcoreid-400 inline ml-1" />
                  </p>
                  <p className="text-sm text-zinc-500 italic leading-relaxed">
                    <span className="text-[10px] text-zinc-600 font-mono mr-2">10:32:28</span>
                    We should schedule a follow up meeting to discuss the...
                    <span className="inline-block w-0.5 h-3.5 bg-marcoreid-400 ml-0.5 animate-pulse align-text-bottom" />
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#09090b] to-transparent pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Zap,
      title: "Real-Time Streaming",
      description: "Words appear on screen as you speak. Sub-300ms latency powered by Deepgram Nova-2. No more waiting for batch processing.",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
    {
      icon: Sparkles,
      title: "AI Grammar Engine",
      description: "Every sentence gets polished by Claude — the most advanced AI. Grammar, punctuation, and style corrected instantly. More accurate than Grammarly, more capable than Dragon.",
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      icon: Keyboard,
      title: "Universal Text Injection",
      description: "Dictated text types directly into ANY application. Email, Slack, Word, your IDE - wherever your cursor is. No copy-paste needed.",
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      icon: Shield,
      title: "Never Interrupted",
      description: "Unlike Windows+H or Apple Dictation, Voxlen NEVER stops when you switch apps. Runs as a background service with its own audio pipeline.",
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      icon: Mic,
      title: "Smart Mic Management",
      description: "Auto-detects external USB mics and selects the best one. Warns you if you're using your crappy laptop mic. Live audio level testing.",
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
    {
      icon: Globe,
      title: "20+ Languages",
      description: "Auto-detects what language you're speaking. Switch between languages mid-sentence. Full support for accents and dialects.",
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
    },
    {
      icon: Volume2,
      title: "Voice Commands",
      description: "Say 'new line', 'period', 'delete that', 'stop listening'. Natural voice commands that work exactly like you'd expect.",
      color: "text-orange-400",
      bg: "bg-orange-400/10",
    },
    {
      icon: Cpu,
      title: "Offline Mode",
      description: "Run Whisper locally for complete privacy. Your audio never leaves your device. Perfect for sensitive documents.",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      icon: Smartphone,
      title: "iOS Keyboard",
      description: "Deepgram Nova-2 powered voice dictation with AI grammar correction. Works in every app — iMessage, WhatsApp, Mail, Notes, everywhere. 20+ languages. 95%+ accuracy.",
      color: "text-pink-400",
      bg: "bg-pink-400/10",
    },
    {
      icon: Keyboard,
      title: "Android Keyboard",
      description: "Full custom keyboard for Android with Deepgram Nova-2 streaming STT, AI grammar polish, haptic feedback, and dark mode. Replace your stock keyboard with professional-grade dictation.",
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-marcoreid-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Features
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            Everything you need.
            <br />
            <span className="text-zinc-500">Nothing you don't.</span>
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                className="group p-6 rounded-2xl bg-[#111114] border border-white/5 hover:border-white/10 transition-all duration-300"
              >
                <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { num: "01", title: "Speak naturally", desc: "Hit Ctrl+Shift+D or click the mic. Talk normally into your external mic. No special syntax needed." },
    { num: "02", title: "AI transcribes in real-time", desc: "Words appear on screen as you speak. Deepgram Nova-2 delivers 95%+ accuracy with sub-300ms latency." },
    { num: "03", title: "Grammar gets polished", desc: "Claude AI automatically corrects grammar, adds punctuation, and matches your chosen writing style." },
    { num: "04", title: "Text appears in your app", desc: "Click 'Insert Text' and your polished words type directly into whatever application you're working in." },
  ];

  return (
    <section className="py-24 bg-[#0c0c0f]">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-marcoreid-400 text-sm font-semibold tracking-wider uppercase mb-3">
            How it works
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            Four steps. Zero friction.
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="space-y-8"
        >
          {steps.map((step) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              className="flex items-start gap-6 p-6 rounded-2xl bg-[#111114] border border-white/5"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-marcoreid-600/10 border border-marcoreid-600/20 flex items-center justify-center">
                <span className="text-marcoreid-400 font-bold text-sm">{step.num}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1">{step.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Comparison() {
  const competitors = [
    { name: "Windows+H", price: "Free", realtime: false, neverInterrupts: false, grammar: false, anyApp: false, offline: false, extMic: false },
    { name: "Apple Dictation", price: "Free", realtime: false, neverInterrupts: false, grammar: false, anyApp: false, offline: true, extMic: false },
    { name: "Grammarly", price: "$12/mo", realtime: false, neverInterrupts: false, grammar: true, anyApp: false, offline: false, extMic: false },
    { name: "Dragon", price: "$700", realtime: true, neverInterrupts: false, grammar: false, anyApp: true, offline: true, extMic: false },
    { name: "Wispr Flow", price: "$12/mo", realtime: true, neverInterrupts: true, grammar: false, anyApp: true, offline: false, extMic: false },
    { name: "Voxlen", price: "$29/mo", realtime: true, neverInterrupts: true, grammar: true, anyApp: true, offline: true, extMic: true, highlight: true },
  ];

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-marcoreid-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Comparison
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            See why Voxlen wins.
          </motion.h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="overflow-x-auto"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4 font-medium text-zinc-400">Product</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Price</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Real-time</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Never Interrupts</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">AI Grammar</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Any App</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Offline</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Smart Mic</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => (
                <tr
                  key={c.name}
                  className={`border-b border-white/5 ${c.highlight ? "bg-marcoreid-600/5" : ""}`}
                >
                  <td className={`py-4 px-4 font-semibold ${c.highlight ? "text-marcoreid-400" : ""}`}>
                    {c.name}
                    {c.highlight && <Star className="h-3 w-3 text-marcoreid-400 inline ml-1" />}
                  </td>
                  <td className="text-center py-4 px-3 text-zinc-400">{c.price}</td>
                  {[c.realtime, c.neverInterrupts, c.grammar, c.anyApp, c.offline, c.extMic].map((val, i) => (
                    <td key={i} className="text-center py-4 px-3">
                      {val ? (
                        <Check className={`h-4 w-4 mx-auto ${c.highlight ? "text-marcoreid-400" : "text-green-400"}`} />
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Free",
      tagline: "Try it out",
      price: "$0",
      period: "/forever",
      features: [
        "500 words/week",
        "Basic dictation",
        "Community support",
      ],
      cta: "Download Free",
      ctaStyle: "secondary",
      highlight: false,
    },
    {
      name: "Pro",
      tagline: "For daily dictation",
      price: "$29",
      period: "/month",
      features: [
        "Unlimited dictation",
        "AI grammar (Claude)",
        "All APIs included — zero setup",
        "Text injection (any app)",
        "Voice commands",
        "20+ languages",
        "iOS + Android keyboard",
        "macOS, Windows, Linux",
        "Priority email support",
      ],
      cta: "Start 14-Day Free Trial",
      ctaStyle: "primary",
      highlight: true,
      badge: "Most Popular",
    },
    {
      name: "Professional",
      tagline: "For lawyers, accountants & firms",
      price: "$79",
      period: "/month",
      features: [
        "Everything in Pro",
        "Confidential mode (zero-retention)",
        "Per-matter / per-client vocabulary",
        "Legal & accounting terminology packs",
        "Local audit logs",
        "SSO & team management",
        "SLA & dedicated support",
      ],
      cta: "Start Free Trial",
      ctaStyle: "secondary",
      highlight: false,
      badge: "Recommended for Pros",
    },
    {
      name: "Lifetime",
      tagline: "Pay once, own forever",
      price: "$599",
      period: "/one-time",
      features: [
        "Everything in Pro",
        "Lifetime updates",
        "Early access to new features",
        "Custom vocabulary",
        "Direct founder support",
      ],
      cta: "Get Lifetime",
      ctaStyle: "secondary",
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-[#0c0c0f]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-marcoreid-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Pricing
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            Professional-grade. Priced like one.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-zinc-400 mt-3 max-w-xl mx-auto">
            Every plan includes the full AI stack — speech, grammar, text injection.
            No API keys, no separate bills, no setup. Just download and speak.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {tiers.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              className={`p-7 rounded-2xl bg-[#111114] relative ${
                t.highlight ? "border-2 border-marcoreid-600/50" : "border border-white/5"
              }`}
            >
              {t.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    t.highlight
                      ? "bg-marcoreid-600 text-white"
                      : "bg-white/10 text-zinc-300 border border-white/10"
                  }`}
                >
                  {t.badge}
                </div>
              )}
              <h3 className="text-lg font-bold mb-1">{t.name}</h3>
              <p className="text-xs text-zinc-500 mb-5">{t.tagline}</p>
              <div className="mb-5">
                <span className="text-4xl font-black">{t.price}</span>
                <span className="text-zinc-500 text-sm">{t.period}</span>
              </div>
              <ul className="space-y-2.5 mb-7">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 text-sm ${
                      t.highlight ? "text-zinc-300" : "text-zinc-400"
                    }`}
                  >
                    <Check
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        t.highlight ? "text-marcoreid-400" : "text-zinc-600"
                      }`}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#download"
                className={`block text-center h-11 leading-[44px] rounded-xl text-sm font-semibold transition-colors ${
                  t.ctaStyle === "primary"
                    ? "bg-marcoreid-600 text-white hover:bg-marcoreid-700 shadow-lg shadow-marcoreid-600/25"
                    : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                }`}
              >
                {t.cta}
              </a>
            </motion.div>
          ))}
        </motion.div>

        <p className="text-center text-xs text-zinc-600 mt-10 max-w-2xl mx-auto leading-relaxed">
          Pro and Professional include a 14-day free trial. No credit card required. Cancel anytime.
          All AI costs (speech-to-text and grammar correction) are included — your subscription
          covers everything. Audio still streams directly from your device to AI providers and is
          never routed through or stored by Voxlen.
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "How is this different from Windows+H or Apple Dictation?",
      a: "Those stop working the moment you switch apps or click somewhere else. Voxlen runs as a background service — it NEVER gets interrupted. Plus, it has AI grammar correction, works with your external mic, and supports 20+ languages.",
    },
    {
      q: "Why is this better than Grammarly?",
      a: "Grammarly is a typing-focused tool that killed their voice features — and their grammar engine is weaker than the frontier AI models we use. Voxlen is built on Claude, the most capable language AI available, and combines real-time dictation with grammar correction in a single product. It is more advanced and more accurate, and it works everywhere you type — not just inside Grammarly's browser extension.",
    },
    {
      q: "Do I need to set up API keys or separate accounts?",
      a: "No. Everything is included. Your subscription covers all the AI infrastructure — speech-to-text, grammar correction, all of it. Download, sign in, speak. There is nothing else to configure. (Advanced users can optionally plug in their own API keys if they prefer — but 99% of users will never need to.)",
    },
    {
      q: "What platforms does it run on?",
      a: "Everything. macOS (Apple Silicon and Intel), Windows 10/11, Linux, iOS (keyboard extension), and Android (keyboard extension). Your subscription covers every device you use. We will never lock features behind a specific OS.",
    },
    {
      q: "Do I need an internet connection?",
      a: "Not always. Voxlen includes a fully offline mode that runs entirely on your device — ideal for flights or sensitive work. Our cloud models give higher accuracy and lower latency, but you always have the choice.",
    },
    {
      q: "Does it work with my external USB microphone?",
      a: "Yes. Voxlen auto-detects external mics (Razer, Blue Yeti, Rode, HyperX, etc.) and prioritizes them over your built-in laptop mic. You will get a warning if you are accidentally using the internal mic.",
    },
    {
      q: "Is my audio private? I handle privileged information.",
      a: "Yes. Even though we provide the AI infrastructure as part of your subscription, your audio and transcripts are NEVER routed through or stored on Voxlen-operated servers. Audio streams directly from your device to the AI provider using zero-retention endpoints and is discarded immediately after transcription. On the Professional plan, we enable the strictest zero-retention guarantees from every AI provider. Offline mode means nothing leaves your device at all. This is a hard architectural rule we will never compromise.",
    },
    {
      q: "Can my firm get a team plan?",
      a: "Yes. The Professional plan includes SSO, team management, and per-client / per-matter vocabulary isolation — designed specifically for law firms and accounting practices. Contact us for firm-wide pricing.",
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-marcoreid-400 text-sm font-semibold tracking-wider uppercase mb-3">
            FAQ
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl font-black tracking-tight">
            Questions? Answered.
          </motion.h2>
        </motion.div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl bg-[#111114] border border-white/5 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex items-center justify-between w-full p-5 text-left"
              >
                <span className="text-sm font-semibold pr-4">{faq.q}</span>
                {openIndex === i ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                )}
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 -mt-1">
                  <p className="text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const GH_OWNER = "ccantynz-alt";
const GH_REPO = "voxlen";
const GH_RELEASES = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest/download`;
const GH_API_LATEST = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/latest`;
const APP_VERSION = "1.0.8";

type Platform = "mac-arm" | "mac-intel" | "windows" | "linux" | "unknown";

type ReleaseAsset = { name: string; browser_download_url: string };

function pickAssetFor(platform: Exclude<Platform, "unknown">, assets: ReleaseAsset[]): ReleaseAsset | null {
  const lowered = assets.map((a) => ({ ...a, lower: a.name.toLowerCase() }));
  const find = (pred: (a: { name: string; lower: string; browser_download_url: string }) => boolean) =>
    lowered.find(pred) ?? null;
  switch (platform) {
    case "mac-arm":
      return find((a) => a.lower.endsWith(".dmg") && (a.lower.includes("aarch64") || a.lower.includes("arm64")))
        ?? find((a) => a.lower.endsWith(".dmg"));
    case "mac-intel":
      return find((a) => a.lower.endsWith(".dmg") && (a.lower.includes("x64") || a.lower.includes("x86_64") || a.lower.includes("intel")))
        ?? find((a) => a.lower.endsWith(".dmg"));
    case "windows":
      return find((a) => a.lower.endsWith(".msi") && (a.lower.includes("x64") || a.lower.includes("x86_64")))
        ?? find((a) => a.lower.endsWith(".msi"))
        ?? find((a) => a.lower.endsWith(".exe") && a.lower.includes("setup"))
        ?? find((a) => a.lower.endsWith(".exe"));
    case "linux":
      return find((a) => a.lower.endsWith(".appimage") && (a.lower.includes("amd64") || a.lower.includes("x86_64")))
        ?? find((a) => a.lower.endsWith(".appimage"))
        ?? find((a) => a.lower.endsWith(".deb"));
  }
}

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform || "";
  if (/Mac/i.test(platform) || /Mac/i.test(ua)) {
    // Best-effort Apple Silicon detection
    if (/ARM|Apple/i.test(ua) || (window.navigator as Navigator & { userAgentData?: { architecture?: string } }).userAgentData?.architecture === "arm") {
      return "mac-arm";
    }
    return "mac-arm"; // Default modern Macs to ARM; Intel users can pick manually
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return "linux";
  return "unknown";
}

const DOWNLOADS: Record<
  Exclude<Platform, "unknown">,
  { label: string; subLabel: string; file: string; size: string; icon: "apple" | "monitor" }
> = {
  "mac-arm": {
    label: "Download for macOS",
    subLabel: "Apple Silicon (M1/M2/M3/M4)",
    file: `Voxlen_${APP_VERSION}_aarch64.dmg`,
    size: "~18 MB",
    icon: "apple",
  },
  "mac-intel": {
    label: "Download for macOS",
    subLabel: "Intel (x86_64) — build on request",
    file: `Voxlen_${APP_VERSION}_aarch64.dmg`,
    size: "~18 MB",
    icon: "apple",
  },
  windows: {
    label: "Download for Windows",
    subLabel: "Windows 10/11 (x64)",
    file: `Voxlen_${APP_VERSION}_x64_en-US.msi`,
    size: "~5 MB",
    icon: "monitor",
  },
  linux: {
    label: "Download for Linux",
    subLabel: "AppImage (x86_64)",
    file: `Voxlen_${APP_VERSION}_amd64.AppImage`,
    size: "~80 MB",
    icon: "monitor",
  },
};

function CTA() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [liveAssets, setLiveAssets] = useState<ReleaseAsset[] | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    const ac = new AbortController();
    fetch(GH_API_LATEST, { signal: ac.signal, headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`GitHub API ${r.status}`))))
      .then((json: { assets?: ReleaseAsset[] }) => {
        if (Array.isArray(json.assets)) setLiveAssets(json.assets);
      })
      .catch(() => {
        // Network blocked or rate-limited: fall back to hardcoded filenames below.
      });
    return () => ac.abort();
  }, []);

  const hrefFor = (key: Exclude<Platform, "unknown">): string => {
    if (liveAssets) {
      const picked = pickAssetFor(key, liveAssets);
      if (picked) return picked.browser_download_url;
    }
    return `${GH_RELEASES}/${encodeURIComponent(DOWNLOADS[key].file)}`;
  };

  const primary = platform !== "unknown" ? DOWNLOADS[platform] : null;
  const PrimaryIcon = primary?.icon === "apple" ? Apple : Monitor;

  return (
    <section id="download" className="py-24 bg-[#0c0c0f] relative overflow-hidden">
      <div className="glow-orb w-[600px] h-[600px] bg-marcoreid-600 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="text-marcoreid-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Download
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Ready to ditch typing?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-zinc-400 mb-10">
            Free forever. No credit card. Under 2 minutes to first word.
          </motion.p>

          {/* Primary auto-detected button */}
          {primary && (
            <motion.div variants={fadeUp} className="flex justify-center mb-4">
              <a
                href={hrefFor(platform as Exclude<Platform, "unknown">)}
                className="group h-16 px-10 rounded-2xl bg-marcoreid-600 text-white font-bold flex items-center gap-4 hover:bg-marcoreid-700 transition-all shadow-xl shadow-marcoreid-600/30 hover:shadow-marcoreid-600/50 hover:scale-[1.02]"
              >
                <PrimaryIcon className="h-7 w-7" />
                <div className="text-left">
                  <div className="text-lg leading-tight">{primary.label}</div>
                  <div className="text-xs font-normal opacity-80">
                    {primary.subLabel} · {primary.size}
                  </div>
                </div>
                <Download className="h-5 w-5 opacity-70 group-hover:translate-y-0.5 transition-transform" />
              </a>
            </motion.div>
          )}

          <motion.p variants={fadeUp} className="text-xs text-zinc-500 mb-12">
            Version {APP_VERSION} · Signed & notarized · Auto-updates
          </motion.p>
        </motion.div>

        {/* All platforms grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {(Object.entries(DOWNLOADS) as [Exclude<Platform, "unknown">, (typeof DOWNLOADS)[keyof typeof DOWNLOADS]][]).map(
            ([key, d]) => {
              const Icon = d.icon === "apple" ? Apple : Monitor;
              const isDetected = key === platform;
              return (
                <motion.a
                  key={key}
                  variants={fadeUp}
                  href={hrefFor(key)}
                  className={`group relative p-5 rounded-xl border transition-all ${
                    isDetected
                      ? "bg-marcoreid-600/5 border-marcoreid-600/40 hover:border-marcoreid-600/60"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                  }`}
                >
                  {isDetected && (
                    <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-marcoreid-600 text-white text-[10px] font-bold uppercase tracking-wider">
                      Detected
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isDetected ? "bg-marcoreid-600/20 text-marcoreid-400" : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <Download className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-y-0.5 transition-all" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">{d.label.replace("Download for ", "")}</div>
                  <div className="text-xs text-zinc-500 mb-3">{d.subLabel}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">{d.size}</div>
                </motion.a>
              );
            }
          )}
        </motion.div>

        {/* Mobile keyboard promo */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-marcoreid-600/10 to-transparent border border-marcoreid-600/20 flex flex-col md:flex-row items-center gap-6"
        >
          <div className="w-14 h-14 rounded-xl bg-marcoreid-600/20 border border-marcoreid-600/30 flex items-center justify-center shrink-0">
            <Smartphone className="h-7 w-7 text-marcoreid-400" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="text-lg font-bold text-white mb-1">Voice Keyboard for iPhone &amp; iPad</div>
            <div className="text-sm text-zinc-400">
              Deepgram-powered dictation that actually understands you. AI grammar correction in every text field. Free to download, bring your own API key.
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 shrink-0">
            <a
              href="#"
              className="h-12 px-6 rounded-xl bg-black border border-white/10 text-white text-sm font-semibold flex items-center gap-2 hover:bg-white/5 transition-colors"
            >
              <Apple className="h-5 w-5" />
              <div className="text-left leading-tight">
                <div className="text-[10px] text-zinc-400">Coming soon on the</div>
                <div>App Store</div>
              </div>
            </a>
            <span className="text-xs text-marcoreid-400 font-medium">Get notified when it launches</span>
          </div>
        </motion.div>

        {/* Checksums / integrity footer */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-8 text-center text-xs text-zinc-600"
        >
          <a
            href="https://github.com/ccantynz-alt/voxlen/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-marcoreid-400 transition-colors"
          >
            View all releases &amp; changelog →
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function Footer({ onOpenLegal }: { onOpenLegal: (type: "privacy" | "terms") => void }) {
  return (
    <footer className="py-12 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-marcoreid-600 flex items-center justify-center">
              <Mic className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-bold">Voxlen</span>
            <span className="text-xs text-zinc-600">v{APP_VERSION}</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <button onClick={() => onOpenLegal("privacy")} className="hover:text-white transition-colors">Privacy Policy</button>
            <button onClick={() => onOpenLegal("terms")} className="hover:text-white transition-colors">Terms of Service</button>
            <a href="mailto:support@voxlen.ai" className="hover:text-white transition-colors">Support</a>
            <a href="https://github.com/ccantynz-alt/voxlen" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Voxlen. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function LegalModal({ type, onClose }: { type: "privacy" | "terms"; onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
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

function PrivacyContent() {
  return (
    <div className="max-w-none space-y-6">
      <h1 className="text-2xl font-black">Privacy Policy</h1>
      <p className="text-xs text-zinc-500">Last updated: April 2026</p>

      <p className="text-zinc-300 leading-relaxed">
        Voxlen ("we", "us", "our") is committed to protecting your privacy. This policy explains
        how our voice dictation application handles your data. We designed Voxlen with
        privacy-first principles, especially for professionals handling sensitive information.
      </p>

      <h2 className="text-lg font-bold mt-8">1. Data We Do NOT Collect</h2>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li><strong className="text-zinc-200">Audio recordings</strong> — We never store, log, or retain your voice audio. Audio is streamed to your chosen STT provider and immediately discarded after transcription.</li>
        <li><strong className="text-zinc-200">Transcribed text</strong> — Your dictated text stays on your device. We never transmit transcription content to our servers.</li>
        <li><strong className="text-zinc-200">Grammar-corrected content</strong> — Text sent for AI grammar correction goes directly to your chosen provider (Anthropic or OpenAI) using your own API key. We have no access to this content.</li>
        <li><strong className="text-zinc-200">Documents or files</strong> — Voxlen never reads, scans, or accesses any files on your device beyond its own configuration.</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">2. Data Processing Architecture</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen operates as a <strong>pass-through</strong> application. Even though paid plans
        include AI infrastructure as part of your subscription, your data flows directly between
        your device and the underlying AI providers — never through Voxlen-operated servers:
      </p>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li><strong className="text-zinc-200">Speech-to-Text:</strong> Audio streams directly from your device to the speech-to-text provider on zero-retention endpoints. In offline mode, audio never leaves your device.</li>
        <li><strong className="text-zinc-200">Grammar Correction:</strong> Text is sent directly from your device to the grammar AI provider (Anthropic or OpenAI) on zero-retention endpoints. We have no intermediary server.</li>
        <li><strong className="text-zinc-200">Text Injection:</strong> All text injection happens locally via OS-level APIs. No network transmission involved.</li>
        <li><strong className="text-zinc-200">API credentials:</strong> Voxlen provisions provider credentials as part of your subscription, but credentials are issued to your device and used only for direct device-to-provider traffic.</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">3. Confidentiality for Legal &amp; Accounting Professionals</h2>
      <p className="text-zinc-300 leading-relaxed">
        We understand that attorneys, accountants, and other professionals using Voxlen may handle
        privileged or confidential information. Voxlen is designed to respect these obligations:
      </p>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li>No Voxlen-operated server ever receives your content — this is a hard architectural rule</li>
        <li>Session history is stored only on your local device and never synced to our infrastructure</li>
        <li>Custom vocabulary and dictionaries remain local to your device</li>
        <li>All AI provider traffic uses zero-retention endpoints</li>
        <li>Professional plan users get the strictest zero-retention guarantees enabled by default, plus per-matter / per-client vocabulary isolation</li>
        <li>Offline mode ensures zero external data transmission</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">4. Analytics &amp; Telemetry</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen collects minimal, anonymous usage telemetry to improve the product:
      </p>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li>Application launch and feature usage counts (no content)</li>
        <li>Crash reports with stack traces (no user content)</li>
        <li>OS platform and app version</li>
      </ul>
      <p className="text-zinc-300 leading-relaxed">
        You can disable all telemetry in Settings &gt; Privacy. When disabled, zero data is transmitted.
      </p>

      <h2 className="text-lg font-bold mt-8">5. Third-Party Services</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen includes AI infrastructure as part of your paid subscription. Your audio and text
        are processed by our underlying AI providers on zero-retention endpoints:
      </p>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li>Deepgram — processes audio for transcription</li>
        <li>OpenAI — processes audio (Whisper) or text (grammar correction)</li>
        <li>Anthropic — processes text for grammar correction</li>
      </ul>
      <p className="text-zinc-300 leading-relaxed">
        We configure zero-retention with every provider wherever it is available. The
        Professional plan enables the strictest retention and data-handling controls by default.
        Advanced users who prefer to supply their own credentials may do so in Settings.
      </p>

      <h2 className="text-lg font-bold mt-8">6. Contact</h2>
      <p className="text-zinc-300 leading-relaxed">
        For privacy inquiries, contact us at <a href="mailto:privacy@voxlen.ai" className="text-voxlen-400 hover:underline">privacy@voxlen.ai</a>.
      </p>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="max-w-none space-y-6">
      <h1 className="text-2xl font-black">Terms of Service</h1>
      <p className="text-xs text-zinc-500">Last updated: April 2026</p>

      <p className="text-zinc-300 leading-relaxed">
        By downloading or using Voxlen, you agree to these terms. Please read them carefully.
      </p>

      <h2 className="text-lg font-bold mt-8">1. Service Description</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen is a desktop and mobile application that provides voice-to-text dictation with
        AI-powered grammar correction and universal text injection. The application runs locally
        on your device and connects to third-party APIs using your own credentials.
      </p>

      <h2 className="text-lg font-bold mt-8">2. AI Services &amp; Third-Party Providers</h2>
      <p className="text-zinc-300 leading-relaxed">
        Paid plans include all AI infrastructure (speech-to-text and grammar correction) as part of
        your subscription. You do not need to provide your own API keys. Audio streams directly
        from your device to the relevant AI providers on zero-retention endpoints — Voxlen
        provisions the credentials, but your content never passes through Voxlen-operated
        infrastructure. Advanced users may optionally supply their own API keys.
      </p>

      <h2 className="text-lg font-bold mt-8">3. Subscription Plans</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen offers Free, Pro ($29/month), Professional ($79/month for legal and accounting
        teams), and Lifetime ($599 one-time) plans. The Free plan includes limited dictation. Paid
        plans unlock all features and include all AI costs. Subscriptions can be cancelled at any
        time. We offer a 14-day free trial for Pro and Professional with no credit card required.
      </p>

      <h2 className="text-lg font-bold mt-8">4. Acceptable Use</h2>
      <p className="text-zinc-300 leading-relaxed">You agree not to:</p>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li>Reverse-engineer, decompile, or disassemble the application</li>
        <li>Use the application for any unlawful purpose</li>
        <li>Redistribute, sublicense, or resell the application</li>
        <li>Attempt to bypass subscription or usage limitations</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">5. Intellectual Property</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen and its original content, features, and functionality are owned by Voxlen and are
        protected by international copyright and trademark laws. Your transcribed content remains
        entirely yours — we claim no rights over content you create using Voxlen.
      </p>

      <h2 className="text-lg font-bold mt-8">6. Disclaimer of Warranties</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen is provided "as is" without warranties of any kind. We do not guarantee that
        transcriptions or grammar corrections will be error-free. You should review all output,
        especially for legal, medical, or financial documents.
      </p>

      <h2 className="text-lg font-bold mt-8">7. Limitation of Liability</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen shall not be liable for any indirect, incidental, special, consequential, or punitive
        damages resulting from your use of the application, including but not limited to errors in
        transcription or grammar correction.
      </p>

      <h2 className="text-lg font-bold mt-8">8. Changes to Terms</h2>
      <p className="text-zinc-300 leading-relaxed">
        We may update these terms from time to time. Continued use of Voxlen after changes
        constitutes acceptance of the new terms. We will notify users of significant changes
        through the application.
      </p>

      <h2 className="text-lg font-bold mt-8">9. Contact</h2>
      <p className="text-zinc-300 leading-relaxed">
        For questions about these terms, contact us at <a href="mailto:legal@voxlen.ai" className="text-voxlen-400 hover:underline">legal@voxlen.ai</a>.
      </p>
    </div>
  );
}
