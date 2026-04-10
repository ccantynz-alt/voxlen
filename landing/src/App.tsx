import { useState } from "react";
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
import Privacy from "./Privacy";
import Terms from "./Terms";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const GITHUB_RELEASES = "https://github.com/ccantynz-alt/voice/releases/latest";

export default function App() {
  const path = window.location.pathname;

  if (path === "/privacy") return <Privacy />;
  if (path === "/terms") return <Terms />;

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
      <Footer />
    </div>
  );
}

function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-voxlen-600 flex items-center justify-center">
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
          className="h-9 px-4 rounded-lg bg-voxlen-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-voxlen-700 transition-colors"
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
      <div className="glow-orb w-[500px] h-[500px] bg-voxlen-600 top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="space-y-6"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-voxlen-600/10 border border-voxlen-600/20 text-voxlen-400 text-xs font-medium">
              <Zap className="h-3 w-3" />
              The Grammarly + Dictation killer is here
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
            Real-time voice dictation with AI grammar correction that types into
            any application. Never interrupted by window switches. Works with
            your external mic. 90+ languages.{" "}
            <span className="text-white font-medium">
              100x cheaper than Grammarly.
            </span>
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4"
          >
            <a
              href="#download"
              className="h-12 px-8 rounded-xl bg-voxlen-600 text-white font-semibold flex items-center gap-2 hover:bg-voxlen-700 transition-all shadow-lg shadow-voxlen-600/25 hover:shadow-voxlen-600/40 hover:scale-[1.02]"
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
              <Smartphone className="h-3.5 w-3.5" /> iOS Keyboard
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
                <div className="w-5 h-5 rounded bg-voxlen-600 flex items-center justify-center">
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
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-voxlen-600/10 text-voxlen-400 text-xs font-medium">
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
                      className="w-1 rounded-full bg-voxlen-500"
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
                    <Sparkles className="h-3 w-3 text-voxlen-400 inline ml-1" />
                  </p>
                  <p className="text-sm text-zinc-500 italic leading-relaxed">
                    <span className="text-[10px] text-zinc-600 font-mono mr-2">10:32:28</span>
                    We should schedule a follow up meeting to discuss the...
                    <span className="inline-block w-0.5 h-3.5 bg-voxlen-400 ml-0.5 animate-pulse align-text-bottom" />
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
      description: "Every sentence gets polished by Claude AI. Grammar, punctuation, style - all corrected instantly. Like Grammarly but 100x cheaper.",
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
      title: "90+ Languages",
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
      description: "Install the Voxlen keyboard on your iPhone. AI grammar correction in every text field - iMessage, WhatsApp, email, everywhere.",
      color: "text-pink-400",
      bg: "bg-pink-400/10",
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
          <motion.p variants={fadeUp} className="text-voxlen-400 text-sm font-semibold tracking-wider uppercase mb-3">
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
          <motion.p variants={fadeUp} className="text-voxlen-400 text-sm font-semibold tracking-wider uppercase mb-3">
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
              <div className="shrink-0 w-12 h-12 rounded-xl bg-voxlen-600/10 border border-voxlen-600/20 flex items-center justify-center">
                <span className="text-voxlen-400 font-bold text-sm">{step.num}</span>
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
    { name: "Voxlen", price: "$5.99/mo", realtime: true, neverInterrupts: true, grammar: true, anyApp: true, offline: true, extMic: true, highlight: true },
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
          <motion.p variants={fadeUp} className="text-voxlen-400 text-sm font-semibold tracking-wider uppercase mb-3">
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
                  className={`border-b border-white/5 ${c.highlight ? "bg-voxlen-600/5" : ""}`}
                >
                  <td className={`py-4 px-4 font-semibold ${c.highlight ? "text-voxlen-400" : ""}`}>
                    {c.name}
                    {c.highlight && <Star className="h-3 w-3 text-voxlen-400 inline ml-1" />}
                  </td>
                  <td className="text-center py-4 px-3 text-zinc-400">{c.price}</td>
                  {[c.realtime, c.neverInterrupts, c.grammar, c.anyApp, c.offline, c.extMic].map((val, i) => (
                    <td key={i} className="text-center py-4 px-3">
                      {val ? (
                        <Check className={`h-4 w-4 mx-auto ${c.highlight ? "text-voxlen-400" : "text-green-400"}`} />
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
  return (
    <section id="pricing" className="py-24 bg-[#0c0c0f]">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-voxlen-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Pricing
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            Made to be affordable.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-zinc-400 mt-3 max-w-lg mx-auto">
            Life is hard enough. Good tools shouldn't break the bank.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Free */}
          <motion.div variants={fadeUp} className="p-8 rounded-2xl bg-[#111114] border border-white/5">
            <h3 className="text-lg font-bold mb-1">Free</h3>
            <p className="text-sm text-zinc-500 mb-6">Get started, no strings</p>
            <div className="mb-6">
              <span className="text-4xl font-black">$0</span>
              <span className="text-zinc-500 text-sm">/forever</span>
            </div>
            <ul className="space-y-3 mb-8">
              {["2,000 words/week", "1 STT engine", "Basic voice commands", "Buffer mode only", "Community support"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-zinc-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#download" className="block text-center h-11 leading-[44px] rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors">
              Download Free
            </a>
          </motion.div>

          {/* Pro */}
          <motion.div variants={fadeUp} className="p-8 rounded-2xl bg-[#111114] border-2 border-voxlen-600/50 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-voxlen-600 text-white text-xs font-semibold">
              Most Popular
            </div>
            <h3 className="text-lg font-bold mb-1">Pro</h3>
            <p className="text-sm text-zinc-500 mb-6">For daily dictation users</p>
            <div className="mb-6">
              <span className="text-4xl font-black">$5.99</span>
              <span className="text-zinc-500 text-sm">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                "Unlimited dictation",
                "All STT engines",
                "AI Grammar (Claude)",
                "Text injection (any app)",
                "Voice commands",
                "90+ languages",
                "iOS keyboard",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                  <Check className="h-4 w-4 text-voxlen-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#download" className="block text-center h-11 leading-[44px] rounded-xl bg-voxlen-600 text-white text-sm font-semibold hover:bg-voxlen-700 transition-colors shadow-lg shadow-voxlen-600/25">
              Start Free Trial
            </a>
          </motion.div>

          {/* Lifetime */}
          <motion.div variants={fadeUp} className="p-8 rounded-2xl bg-[#111114] border border-white/5">
            <h3 className="text-lg font-bold mb-1">Lifetime</h3>
            <p className="text-sm text-zinc-500 mb-6">Pay once, own forever</p>
            <div className="mb-6">
              <span className="text-4xl font-black">$149</span>
              <span className="text-zinc-500 text-sm">/one-time</span>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                "Everything in Pro",
                "Lifetime updates",
                "Early access to new features",
                "Custom vocabulary",
                "API access",
                "Direct support line",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-zinc-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#download" className="block text-center h-11 leading-[44px] rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors">
              Get Lifetime
            </a>
          </motion.div>
        </motion.div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          All plans include a 14-day free trial. No credit card required. Cancel anytime.
          <br />
          You bring your own API keys (Deepgram, OpenAI, Anthropic) - we don't mark up API costs.
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "How is this different from Windows+H or Apple Dictation?",
      a: "Those stop working the moment you switch apps or click somewhere else. Voxlen runs as a background service - it NEVER gets interrupted. Plus, it has AI grammar correction, works with your external mic, and supports 90+ languages.",
    },
    {
      q: "How is this cheaper than Grammarly?",
      a: "Grammarly charges $12/month and just killed their voice features. Voxlen uses Claude Haiku for grammar correction which costs about $0.03/month for heavy use. You bring your own API key, so there's no markup. We charge $5.99/month for the app itself.",
    },
    {
      q: "Do I need an internet connection?",
      a: "Not necessarily. Voxlen includes a fully offline mode using Whisper Local that runs entirely on your device. Cloud engines (Deepgram, OpenAI) give better accuracy but require internet. You choose.",
    },
    {
      q: "What API keys do I need?",
      a: "For the best experience: a Deepgram key (free $200 credits) for real-time transcription, and an Anthropic key for grammar correction. Both take 2 minutes to set up. The onboarding wizard walks you through it.",
    },
    {
      q: "Does it work with my external USB microphone?",
      a: "Yes! Voxlen auto-detects external mics (Razer, Blue Yeti, Rode, HyperX, etc.) and prioritizes them over your built-in laptop mic. You'll get a warning if you're accidentally using the internal mic.",
    },
    {
      q: "Can I use it on my iPhone?",
      a: "Yes. Voxlen includes an iOS keyboard extension that adds AI grammar correction to every text field on your phone - iMessage, WhatsApp, email, everything. Install it from the App Store.",
    },
    {
      q: "Is my audio data private?",
      a: "In offline mode, your audio never leaves your device. In cloud mode, audio is sent to the STT provider (Deepgram/OpenAI) for processing and immediately discarded. We never store, log, or access your audio.",
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
          <motion.p variants={fadeUp} className="text-voxlen-400 text-sm font-semibold tracking-wider uppercase mb-3">
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

function CTA() {
  return (
    <section id="download" className="py-24 bg-[#0c0c0f] relative overflow-hidden">
      <div className="glow-orb w-[600px] h-[600px] bg-voxlen-600 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
        >
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Ready to ditch typing?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-zinc-400 mb-8">
            Download Voxlen for free and start dictating in under 2 minutes.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={GITHUB_RELEASES} className="h-14 px-10 rounded-xl bg-voxlen-600 text-white text-lg font-bold flex items-center gap-3 hover:bg-voxlen-700 transition-all shadow-xl shadow-voxlen-600/30 hover:shadow-voxlen-600/50 hover:scale-[1.02]">
              <Apple className="h-6 w-6" />
              Download for Mac
            </a>
            <a href={GITHUB_RELEASES} className="h-14 px-10 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-medium flex items-center gap-3 hover:bg-white/10 transition-all">
              <Monitor className="h-5 w-5" />
              Windows / Linux
            </a>
          </motion.div>
          <motion.p variants={fadeUp} className="text-xs text-zinc-600 mt-6">
            Free forever with limits. Pro starts at $5.99/mo. No credit card needed.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-voxlen-600 flex items-center justify-center">
              <Mic className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-bold">Voxlen</span>
            <span className="text-xs text-zinc-600">v1.0.0</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="mailto:support@voxlen.ai" className="hover:text-white transition-colors">Support</a>
            <a href={GITHUB_RELEASES} className="hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-xs text-zinc-600">
            Built with pride. Made to help people.
          </p>
        </div>
      </div>
    </footer>
  );
}
