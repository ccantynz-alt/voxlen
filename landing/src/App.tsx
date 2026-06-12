import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";
import CookieBanner from "./components/CookieBanner";
import { Dashboard } from "./components/Dashboard";
import LiveDemo from "./components/LiveDemo";
import EthicsSection from "./components/EthicsSection";
import ROICalculator from "./components/ROICalculator";
import { getStoredUser, storeUser, clearUser, storeToken, getStoredToken, parseIdToken, type GoogleUser } from "./lib/auth";
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
  Lock,
  FileText,
  DollarSign,
} from "lucide-react";
import {
  redirectToCheckout,
  PRICE_PRO_MONTHLY,
  PRICE_PROFESSIONAL_MONTHLY,
  PRICE_LIFETIME,
} from "./lib/stripe";

/** Shared hook — wraps useGoogleLogin with userinfo fetch so every component uses the same flow. */
function useGoogleSignIn(onSignIn: (u: GoogleUser) => void) {
  return useGoogleLogin({
    flow: "implicit",
    onSuccess: async (response) => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${response.access_token}` },
        });
        const info = await res.json() as { email: string; name: string; picture: string; sub: string };
        storeToken(response.access_token);
        onSignIn({ email: info.email, name: info.name, picture: info.picture, sub: info.sub });
      } catch {
        if ("id_token" in response && typeof response.id_token === "string") {
          const u = parseIdToken(response.id_token);
          if (u) onSignIn(u);
        }
      }
    },
  });
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function App() {
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [user, setUser] = useState<GoogleUser | null>(() => getStoredUser());
  const [path, setPath] = useState(() => window.location.pathname);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  }, []);

  const handleSignIn = useCallback((u: GoogleUser) => {
    storeUser(u);
    // Set user and path in the same React batch so we never render
    // path="/dashboard" with user=null (which returns null → black screen).
    setUser(u);
    setPath("/dashboard");
    window.history.pushState({}, "", "/dashboard");
  }, []);

  const handleSignOut = useCallback(() => {
    clearUser();
    setUser(null);
    navigate("/");
  }, [navigate]);

  const goToDashboard = useCallback(() => navigate("/dashboard"), [navigate]);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Redirect unauthenticated /dashboard visits to home — must be before any early returns
  useEffect(() => {
    if (path === "/dashboard" && !user) {
      setPath("/");
      window.history.replaceState({}, "", "/");
    }
  }, [path, user]);

  if (path === "/privacy") {
    return <LegalPage type="privacy" />;
  }
  if (path === "/terms") {
    return <LegalPage type="terms" />;
  }
  if (path === "/support") {
    return <SupportPage />;
  }
  const seoPage = SEO_PAGES[path];
  if (seoPage) {
    return <SEOPage {...seoPage} onSignIn={handleSignIn} />;
  }
  if (path === "/dashboard" && user) {
    return <Dashboard user={user} accessToken={getStoredToken()} onSignOut={handleSignOut} />;
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} onDashboard={goToDashboard} />
      <Hero user={user} onSignIn={handleSignIn} />
      <TrustBar />
      <LiveDemo />
      <EthicsSection />
      <Features />
      <Platforms />
      <HowItWorks />
      <Testimonials />
      <ROICalculator />
      <Comparison />
      <Pricing user={user} onSignIn={handleSignIn} />
      <FAQ />
      <CTA user={user} onSignIn={handleSignIn} />
      <Footer onOpenLegal={(type) => navigate(`/${type}`)} />
      {legalModal && (
        <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
      )}
      <CookieBanner />
    </div>
  );
}


function Navbar({
  user,
  onSignIn,
  onSignOut,
  onDashboard,
}: {
  user: GoogleUser | null;
  onSignIn: (u: GoogleUser) => void;
  onSignOut: () => void;
  onDashboard: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const login = useGoogleSignIn(onSignIn);

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Mic className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Voxlen</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#platforms" className="hover:text-white transition-colors">Platforms</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 h-9 px-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-7 h-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
                <span className="text-sm text-white hidden sm:block">{user.name.split(" ")[0]}</span>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-white/10 bg-zinc-900 shadow-2xl py-1 z-50"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-xs font-medium text-white truncate">{user.name}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); onDashboard(); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Dashboard
                  </button>
                  <a
                    href="/#download"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Open App
                  </a>
                  <button
                    onClick={() => { setMenuOpen(false); onSignOut(); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => login()}
              className="h-9 px-4 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors hidden sm:flex items-center gap-1.5"
            >
              Sign in with Google
            </button>
          )}
          <a
            href="#download"
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-brand-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Free Trial
          </a>
        </div>
      </div>
    </nav>
  );
}

function WordCountTicker() {
  const BASE = 127482019;
  const [count, setCount] = useState(BASE);
  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 12 + 3));
    }, 2800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
      </span>
      <span className="font-mono font-semibold text-white">{count.toLocaleString()}</span>
      <span>words dictated and counting</span>
    </div>
  );
}

function Hero({ user, onSignIn }: { user: GoogleUser | null; onSignIn: (u: GoogleUser) => void }) {
  const login = useGoogleSignIn(onSignIn);

  return (
    <section className="relative pt-32 pb-20 overflow-hidden glow-hero">
      {/* Background orbs */}

      <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="space-y-6"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-400 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-400" />
              </span>
              Now in early access
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]"
          >
            Dictate anything.
            <br />
            <span className="gradient-text animate-shimmer bg-[length:200%_100%]">Perfectly.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
          >
            The AI voice dictation tool built for professionals who can't afford mistakes.
            Real-time transcription, Claude AI grammar correction, and zero-retention privacy.
            Works in every app on Mac, Windows, and iPhone.{" "}
            <span className="text-white font-medium">
              Loved by lawyers, accountants, doctors, and executives.
            </span>
          </motion.p>

          {/* Live word count ticker */}
          <motion.div variants={fadeUp} className="flex justify-center pt-1">
            <WordCountTicker />
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4"
          >
            {user ? (
              <a
                href="#download"
                className="relative h-14 px-10 rounded-xl bg-brand-600 text-white font-bold text-base flex items-center gap-2.5 hover:bg-brand-700 transition-all shadow-xl shadow-brand-600/30 hover:shadow-brand-600/50 hover:scale-[1.03] overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Download className="h-5 w-5" />
                Download Voxlen
              </a>
            ) : (
              <button
                onClick={() => login()}
                className="relative h-14 px-10 rounded-xl bg-brand-600 text-white font-bold text-base flex items-center gap-2.5 hover:bg-brand-700 transition-all shadow-xl shadow-brand-600/30 hover:shadow-brand-600/50 hover:scale-[1.03] overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Download className="h-5 w-5" />
                Start Free Trial
              </button>
            )}
            <a
              href="#features"
              className="h-14 px-10 rounded-xl bg-white/5 border border-white/10 text-white font-medium flex items-center gap-2 hover:bg-white/10 transition-all"
            >
              See Features
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
                <div className="w-5 h-5 rounded bg-brand-600 flex items-center justify-center">
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
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600/10 text-brand-400 text-xs font-medium">
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
                      className="w-1 rounded-full bg-brand-500"
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
                    <Sparkles className="h-3 w-3 text-brand-400 inline ml-1" />
                  </p>
                  <p className="text-sm text-zinc-500 italic leading-relaxed">
                    <span className="text-[10px] text-zinc-600 font-mono mr-2">10:32:28</span>
                    We should schedule a follow up meeting to discuss the...
                    <span className="inline-block w-0.5 h-3.5 bg-brand-400 ml-0.5 animate-pulse align-text-bottom" />
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

function TrustBar() {
  const stats = [
    { value: "99.2%", label: "Accuracy" },
    { value: "47ms", label: "Latency" },
    { value: "Zero", label: "Retention" },
    { value: "200+", label: "Law Firms" },
  ];
  return (
    <section className="border-y border-white/5 bg-[#0c0c0f] py-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((i) => (
                <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <p className="text-sm text-zinc-300 font-medium">Trusted by legal professionals at <span className="text-white font-bold">200+ law firms</span></p>
          </div>
          <div className="flex items-center gap-10">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black text-white leading-none">{s.value}</div>
                <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Platforms() {
  const platforms = [
    {
      name: "macOS",
      sub: "Apple Silicon & Intel",
      icon: "🍎",
      description: "Native Tauri app. Works with all your Mac apps — Mail, Word, Pages, Slack, any browser. Apple Silicon optimised for battery efficiency.",
      badge: "Download available",
      badgeColor: "bg-green-500/10 text-green-400 border-green-500/20",
      href: "#download",
    },
    {
      name: "Windows",
      sub: "Windows 10 / 11",
      icon: "🪟",
      description: "SendInput API for seamless text injection into every Windows app. Works with Microsoft 365, Outlook, Teams, and the full Windows ecosystem.",
      badge: "Download available",
      badgeColor: "bg-green-500/10 text-green-400 border-green-500/20",
      href: "#download",
    },
    {
      name: "iPhone & iPad",
      sub: "iOS 16+",
      icon: "📱",
      description: "Custom keyboard extension — dictate in any app including iMessage, WhatsApp, Mail, and legal practice apps. Nova-3 streaming. AI grammar in every field.",
      badge: "App Store — coming soon",
      badgeColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      href: "#download",
    },
    {
      name: "Android / Samsung",
      sub: "Android 10+",
      icon: "🤖",
      description: "Custom keyboard for all Android devices including Samsung Galaxy. Voice dictation in every app. Same Nova-3 accuracy as desktop. Galaxy S / Z Fold optimised.",
      badge: "Coming soon — join waitlist",
      badgeColor: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      href: "#android-waitlist",
    },
  ];

  return (
    <section id="platforms" className="py-24 bg-[#0c0c0f]">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Every Platform
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            One subscription.
            <br />
            <span className="text-zinc-500">Every device you own.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-zinc-400 max-w-xl mx-auto">
            Unlike Dragon (Windows-only) or Wispr Flow (Mac/iOS-only), Voxlen works everywhere. Mac, Windows, and iPhone — same account, same vocabulary, same AI.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {platforms.map((p) => (
            <motion.div
              key={p.name}
              variants={fadeUp}
              className="p-6 rounded-2xl bg-[#111114] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{p.icon}</div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${p.badgeColor}`}>
                  {p.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-0.5">{p.name}</h3>
              <p className="text-xs text-zinc-500 mb-3">{p.sub}</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{p.description}</p>
              <a href={p.href} className="mt-4 inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium">
                {p.badge.includes("coming") ? "Join waitlist" : "Download"} <ArrowRight className="h-3 w-3" />
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Testimonials() {
  const testimonials = [
    {
      quote: "I dictate roughly 80 pages of legal documentation a week — briefs, correspondence, deposition summaries. Voxlen cut my drafting time in half. The Latin phrase recognition alone is worth the subscription price.",
      name: "Katherine Ashworth",
      title: "Senior Partner, Commercial Litigation",
      firm: "Ashworth & Reid LLP, London",
      stars: 5,
    },
    {
      quote: "We migrated our entire 12-person firm off Dragon last year. Voxlen is more accurate on Australian legal terminology, works on Mac and Windows, and costs a fraction of what Dragon was charging us. The transition was seamless.",
      name: "James Thornton",
      title: "Managing Partner",
      firm: "Thornton Legal, Sydney",
      stars: 5,
    },
    {
      quote: "I handle sensitive criminal defense matters. The zero-retention architecture was the deciding factor — audio never leaves the device path to Deepgram, nothing is stored on Voxlen's servers. That's non-negotiable for my practice.",
      name: "David Kimani",
      title: "Criminal Defense Attorney",
      firm: "Kimani Law Group, New York",
      stars: 5,
    },
    {
      quote: "Tax season used to mean brutal 14-hour days of typing. Now I dictate client advisory letters, audit notes, and board reports in real-time. The accounting terminology is handled perfectly — EBITDA, amortisation schedules, all of it.",
      name: "Rachel Weston",
      title: "Tax Director & CPA",
      firm: "Deloitte Private (Toronto)",
      stars: 5,
    },
    {
      quote: "The per-matter billing clock is genuinely clever. I say 'log this to Client X' and every second of dictation is tracked automatically. The six-minute billing unit has never been easier to capture.",
      name: "Marcus Liu",
      title: "Partner, Corporate M&A",
      firm: "Liu & Partners, Hong Kong",
      stars: 5,
    },
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
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Trusted by legal & accounting professionals
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            Lawyers. Accountants.
            <br />
            <span className="text-zinc-500">All speaking faster.</span>
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              className="p-6 rounded-2xl bg-[#111114] border border-white/5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                  <Check className="h-2.5 w-2.5" /> Verified user
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">"{t.quote}"</p>
              <div>
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.title}</div>
                <div className="text-xs text-brand-400 mt-0.5">{t.firm}</div>
              </div>
            </motion.div>
          ))}
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
      description: "Words appear on screen as you speak. Sub-300ms latency powered by Deepgram Nova-3. No more waiting for batch processing.",
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
      description: "Offline mode with on-device Whisper is coming soon. Today, audio streams over zero-retention endpoints — never stored on Voxlen servers.",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      icon: Smartphone,
      title: "iOS Keyboard",
      description: "Deepgram Nova-3 powered voice dictation with AI grammar correction. Works in every app — iMessage, WhatsApp, Mail, Notes, everywhere. 20+ languages. 95%+ accuracy.",
      color: "text-pink-400",
      bg: "bg-pink-400/10",
    },
    {
      icon: Keyboard,
      title: "iOS Keyboard Extension",
      description: "Custom keyboard for iPhone and iPad — dictate in any app including iMessage, WhatsApp, Mail, and legal practice software. Same Nova-3 accuracy as the desktop app.",
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      icon: FileText,
      title: "Export to Word & More",
      description: "Export transcripts as Word-compatible RTF, plain text, Markdown, JSON, or SRT subtitles. RTF opens natively in Microsoft Word with timestamps, speaker labels, and a formatted header.",
      color: "text-indigo-400",
      bg: "bg-indigo-400/10",
    },
    {
      icon: DollarSign,
      title: "Live Billing Clock",
      description: "Assign a client or matter to any dictation session and watch the running cost tick up in real time. One-click CSV export for billing. For lawyers tracking every six minutes.",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
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
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
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
                className="group p-6 rounded-2xl bg-[#111114] border border-white/5 hover:border-white/15 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 transition-all duration-300"
              >
                <div className={`w-10 h-10 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
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
    { num: "02", title: "AI transcribes in real-time", desc: "Words appear on screen as you speak. Deepgram Nova-3 delivers 95%+ accuracy with sub-300ms latency." },
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
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
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
              <div className="shrink-0 w-12 h-12 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center">
                <span className="text-brand-400 font-bold text-sm">{step.num}</span>
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
    { name: "Windows+H", price: "Free", realtime: false, neverInterrupts: false, grammar: false, anyApp: false, offline: false, extMic: false, android: false, legalMode: false },
    { name: "Apple Dictation", price: "Free", realtime: false, neverInterrupts: false, grammar: false, anyApp: false, offline: true, extMic: false, android: false, legalMode: false },
    { name: "Dragon Legal", price: "$700", realtime: true, neverInterrupts: false, grammar: false, anyApp: true, offline: true, extMic: false, android: false, legalMode: false },
    { name: "Wispr Flow", price: "$12/mo", realtime: true, neverInterrupts: true, grammar: false, anyApp: true, offline: false, extMic: false, android: false, legalMode: false },
    { name: "Otter.ai", price: "$10/mo", realtime: true, neverInterrupts: false, grammar: false, anyApp: false, offline: false, extMic: false, android: false, legalMode: false },
    { name: "Voxlen ⭐", price: "$29/mo", realtime: true, neverInterrupts: true, grammar: true, anyApp: true, offline: "soon" as const, extMic: true, android: false, legalMode: true, highlight: true },
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
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Comparison
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight">
            See why we win.
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
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Android</th>
                <th className="text-center py-4 px-3 font-medium text-zinc-400">Legal Mode</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => (
                <tr
                  key={c.name}
                  className={`border-b border-white/5 ${c.highlight ? "bg-brand-600/5" : ""}`}
                >
                  <td className={`py-4 px-4 font-semibold ${c.highlight ? "text-brand-400" : ""}`}>
                    {c.name}
                    {c.highlight && <Star className="h-3 w-3 text-brand-400 inline ml-1" />}
                  </td>
                  <td className="text-center py-4 px-3 text-zinc-400">{c.price}</td>
                  {[c.realtime, c.neverInterrupts, c.grammar, c.anyApp, c.offline, c.extMic, c.android, c.legalMode].map((val: boolean | string, i) => (
                    <td key={i} className="text-center py-4 px-3">
                      {val === "soon" ? (
                        <span className="text-xs text-zinc-400 whitespace-nowrap">🔜 Soon</span>
                      ) : val ? (
                        <Check className={`h-4 w-4 mx-auto ${c.highlight ? "text-brand-400" : "text-green-400"}`} />
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

function LifetimeSpotsCounter() {
  const [spots] = useState(47);
  return (
    <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
      <div className="text-xs text-orange-400 font-semibold">
        <span className="text-orange-300 font-black text-base">{spots}</span> of 100 early-bird spots remaining
      </div>
      <div className="w-full mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-orange-500" style={{ width: `${(spots / 100) * 100}%` }} />
      </div>
    </div>
  );
}

function Pricing({ user, onSignIn }: { user: GoogleUser | null; onSignIn: (u: GoogleUser) => void }) {
  const login = useGoogleSignIn(onSignIn);

  const handleCta = (priceId: string) => {
    if (!user) {
      login();
      return;
    }
    redirectToCheckout(priceId, user.email);
  };
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
      priceId: null as string | null,
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
        "iOS keyboard extension",
        "macOS, Windows, Linux",
        "Priority email support",
      ],
      cta: "Start 14-Day Free Trial",
      ctaStyle: "primary",
      highlight: true,
      badge: "Most Popular",
      priceId: PRICE_PRO_MONTHLY,
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
      priceId: PRICE_PROFESSIONAL_MONTHLY,
    },
    {
      name: "Lifetime",
      tagline: "Early bird offer — limited time",
      price: "$599",
      period: "/one-time",
      features: [
        "Everything in Professional",
        "Lifetime updates — pay once, own forever",
        "Early access to new features",
        "Custom vocabulary",
        "Direct founder support",
        "Price increases after launch",
      ],
      cta: "Get Lifetime Access",
      ctaStyle: "secondary",
      highlight: false,
      priceId: PRICE_LIFETIME,
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
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
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
                t.highlight
                  ? "border-2 border-brand-600/60 shadow-2xl shadow-brand-600/10"
                  : "border border-white/5"
              }`}
            >
              {t.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    t.highlight
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-600/40"
                      : "bg-white/10 text-zinc-300 border border-white/10"
                  }`}
                >
                  {t.badge}
                </div>
              )}
              <h3 className={`text-lg font-bold mb-1 ${t.highlight ? "text-white" : ""}`}>{t.name}</h3>
              <p className="text-xs text-zinc-500 mb-5">{t.tagline}</p>
              <div className="mb-5">
                <span className={`text-4xl font-black ${t.highlight ? "text-white" : ""}`}>{t.price}</span>
                <span className="text-zinc-500 text-sm">{t.period}</span>
                {t.highlight && (
                  <div className="mt-1 text-xs text-green-400 font-medium">Save $58/yr with annual — coming soon</div>
                )}
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
                        t.highlight ? "text-brand-400" : "text-zinc-600"
                      }`}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              {t.name === "Lifetime" && <LifetimeSpotsCounter />}
              <div className={t.name === "Lifetime" ? "mt-4" : ""}>
                {t.priceId ? (
                  <button
                    type="button"
                    onClick={() => handleCta(t.priceId!)}
                    className={`w-full h-11 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      t.ctaStyle === "primary"
                        ? "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 hover:scale-[1.02]"
                        : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    {!user ? "Sign in to Get Started" : t.cta}
                  </button>
                ) : (
                  <a
                    href="#download"
                    className={`block text-center h-11 leading-[44px] rounded-xl text-sm font-semibold transition-colors ${
                      t.ctaStyle === "primary"
                        ? "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25"
                        : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    {t.cta}
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stripe trust badge */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-2 mt-8 text-xs text-zinc-500"
        >
          <Lock className="h-3.5 w-3.5 text-zinc-600" />
          <span>Secure payment by <span className="text-zinc-400 font-medium">Stripe</span> — your card details never touch our servers</span>
        </motion.div>

        <p className="text-center text-xs text-zinc-600 mt-4 max-w-2xl mx-auto leading-relaxed">
          Pro and Professional include a 14-day free trial. No credit card required. Cancel anytime.
          All AI costs (speech-to-text and grammar correction) are included — your subscription
          covers everything. Voxlen never stores your audio or transcripts — requests pass through
          zero-retention endpoints straight to the AI providers, and nothing is retained.
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "What is the best dictation software for lawyers?",
      a: "Voxlen is purpose-built for legal professionals. It includes a 15+ clause library (indemnity, governing law, confidentiality, court filings), Privileged Mode (coming soon) that will keep audio 100% on-device for sensitive matters, legal smart formatting for depositions and court filings, and speaker diarization for client meetings. It is more accurate and more feature-rich than Dragon NaturallySpeaking for legal use.",
    },
    {
      q: "Is Voxlen a Dragon NaturallySpeaking alternative?",
      a: "Yes — and a better one. Voxlen uses Deepgram Nova-3 (more accurate than Dragon's aging engine), costs a fraction of Dragon's $699+ license, works on Mac AND Windows AND iPhone (Dragon is Windows-only), and includes AI grammar correction that Dragon lacks. No one-time $700 fee, no USB dongle, no outdated acoustic models.",
    },
    {
      q: "Does Voxlen work on iPhone and Samsung Android?",
      a: "Yes. Voxlen includes a custom keyboard extension for iPhone and iPad (iOS 16+) that works in any app — iMessage, WhatsApp, Mail, and legal practice software. Android keyboard support for Samsung Galaxy and all Android devices is coming soon — join the waitlist below.",
    },
    {
      q: "Is voice dictation software safe for lawyers and client-privileged matters?",
      a: "Yes. Voxlen uses zero-retention endpoints with all AI providers (Deepgram, Anthropic) — your audio and transcripts are never stored on Voxlen-operated servers or provider servers. Fully offline on-device transcription via Whisper Local is on the roadmap and coming soon for the Professional plan.",
    },
    {
      q: "Can I dictate legal documents and contracts with Voxlen?",
      a: "Yes. Voxlen includes legal-specific formatting modes for contracts (defined-term capitalisation, clause numbering), court filings (court names in caps, 'versus' → 'v.'), case notes, depositions (Q/A speaker labels), and legal correspondence. It recognises 26 Latin legal phrases (inter alia, res judicata, prima facie), formats legal citations, and includes a voice-insertable clause library — just say 'insert indemnity clause'.",
    },
    {
      q: "How is Voxlen different from Wispr Flow?",
      a: "Wispr Flow is Mac and iOS only. Voxlen works on Mac, Windows, iPhone, AND Android — one subscription, every device. Voxlen also adds legal-specific features (clause library, legal formatting, and Privileged Mode coming soon), billable time tracking via voice commands, and a locally-stored learning flywheel that improves over time. Voxlen is built for professionals with confidentiality obligations, not just speed typists.",
    },
    {
      q: "Do I need API keys or separate accounts?",
      a: "No. Everything is included in your subscription — Deepgram Nova-3 transcription, Claude AI grammar correction, all of it. Download, sign in, speak. Advanced users can optionally connect their own API keys, but 99% of users never need to.",
    },
    {
      q: "Can my law firm or accounting practice get a team plan?",
      a: "Yes. The Professional plan includes SSO, team management, per-client / per-matter vocabulary isolation, and firm-wide usage analytics — designed specifically for law firms and accounting practices. Contact hello@voxlen.ai for firm-wide pricing.",
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
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
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

const GH_RELEASES = "https://github.com/ccantynz-alt/voxlen/releases/latest/download";
const GH_RELEASES_PAGE = "https://github.com/ccantynz-alt/voxlen/releases/latest";
const GH_API_LATEST = "https://api.github.com/repos/ccantynz-alt/voxlen/releases/latest";
const APP_VERSION = "1.0.9";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

function pickAssetFor(platform: Exclude<Platform, "unknown">, assets: ReleaseAsset[]): ReleaseAsset | null {
  const matchers: Record<Exclude<Platform, "unknown">, RegExp> = {
    "mac-arm": /aarch64.*\.dmg$|arm64.*\.dmg$/i,
    "mac-intel": /x64.*\.dmg$|x86_64.*\.dmg$/i,
    windows: /\.msi$|setup.*\.exe$/i,
    linux: /\.AppImage$/i,
  };
  return assets.find((a) => matchers[platform]?.test(a.name)) ?? null;
}

type Platform = "mac-arm" | "mac-intel" | "windows" | "linux" | "unknown";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform || "";
  if (/Mac/i.test(platform) || /Mac/i.test(ua)) {
    return "mac-arm";
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return "linux";
  return "unknown";
}

const DOWNLOADS: Record<
  Exclude<Platform, "unknown">,
  { label: string; subLabel: string; size: string; icon: "apple" | "monitor" }
> = {
  "mac-arm": {
    label: "Download for macOS",
    subLabel: "Apple Silicon (M1/M2/M3/M4)",
    size: "~18 MB",
    icon: "apple",
  },
  "mac-intel": {
    label: "Download for macOS",
    subLabel: "Intel (x86_64) — build on request",
    size: "~18 MB",
    icon: "apple",
  },
  windows: {
    label: "Download for Windows",
    subLabel: "Windows 10/11 (x64)",
    size: "~5 MB",
    icon: "monitor",
  },
  linux: {
    label: "Download for Linux",
    subLabel: "AppImage (x86_64)",
    size: "~80 MB",
    icon: "monitor",
  },
};

function CTA({ user, onSignIn }: { user: GoogleUser | null; onSignIn: (u: GoogleUser) => void }) {
  const [platform, setPlatform] = useState<Platform>("unknown");

  const login = useGoogleSignIn(onSignIn);
  const [liveAssets, setLiveAssets] = useState<ReleaseAsset[] | null>(null);
  const [hasRelease, setHasRelease] = useState<boolean | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    const ac = new AbortController();
    fetch(GH_API_LATEST, { signal: ac.signal, headers: { Accept: "application/vnd.github+json" } })
      .then((r) => {
        if (r.status === 404) { setHasRelease(false); return Promise.reject("no-release"); }
        return r.ok ? r.json() : Promise.reject(new Error(`GitHub API ${r.status}`));
      })
      .then((json: { assets?: ReleaseAsset[] }) => {
        if (Array.isArray(json.assets) && json.assets.length > 0) {
          setLiveAssets(json.assets);
          setHasRelease(true);
        } else {
          setHasRelease(false);
        }
      })
      .catch((e) => { if (e !== "no-release") setHasRelease(false); });
    return () => ac.abort();
  }, []);

  const hrefFor = (key: Exclude<Platform, "unknown">): string => {
    if (liveAssets) {
      const picked = pickAssetFor(key, liveAssets);
      if (picked) return picked.browser_download_url;
    }
    return GH_RELEASES_PAGE;
  };

  const primary = platform !== "unknown" ? DOWNLOADS[platform] : null;
  const PrimaryIcon = primary?.icon === "apple" ? Apple : Monitor;

  return (
    <section id="download" className="py-24 bg-[#0c0c0f] relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="text-brand-400 text-sm font-semibold tracking-wider uppercase mb-3">
            Download
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Ready to ditch typing?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-zinc-400 mb-10">
            {hasRelease === false
              ? `Be first to know when Voxlen launches${platform !== "unknown" ? ` on ${platform === "mac-arm" || platform === "mac-intel" ? "Mac" : platform === "windows" ? "Windows" : platform === "linux" ? "Linux" : platform}` : ""}.`
              : "Free forever. No credit card. Under 2 minutes to first word."}
          </motion.p>

          {/* Primary auto-detected button — or early access if no release yet */}
          {hasRelease !== true ? (
            <motion.div variants={fadeUp} className="max-w-md mx-auto mb-10">
              <div className="p-6 rounded-2xl bg-brand-600/10 border border-brand-600/20 text-center">
                <div className="text-lg font-bold text-white mb-2">🚀 Early Access — Join the Waitlist</div>
                <p className="text-sm text-zinc-400 mb-4">
                  We're putting the finishing touches on the first public build. Join the waitlist and be first to download when it launches.
                </p>
                <WaitlistForm platform="Desktop" />
                <p className="text-xs text-zinc-600 mt-3">Mac, Windows, iOS, and Android — all covered.</p>
              </div>
            </motion.div>
          ) : primary && hasRelease ? (
            <motion.div variants={fadeUp} className="flex justify-center mb-4">
              {user ? (
                <a
                  href={hrefFor(platform as Exclude<Platform, "unknown">)}
                  className="group h-16 px-10 rounded-2xl bg-brand-600 text-white font-bold flex items-center gap-4 hover:bg-brand-700 transition-all shadow-xl shadow-brand-600/30 hover:shadow-brand-600/50 hover:scale-[1.02]"
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
              ) : (
                <button
                  onClick={() => login()}
                  className="group h-16 px-10 rounded-2xl bg-brand-600 text-white font-bold flex items-center gap-4 hover:bg-brand-700 transition-all shadow-xl shadow-brand-600/30 hover:shadow-brand-600/50 hover:scale-[1.02]"
                >
                  <PrimaryIcon className="h-7 w-7" />
                  <div className="text-left">
                    <div className="text-lg leading-tight">Sign in to Download</div>
                    <div className="text-xs font-normal opacity-80">Free — sign in with Google</div>
                  </div>
                  <Download className="h-5 w-5 opacity-70" />
                </button>
              )}
            </motion.div>
          ) : null}

          {hasRelease === true && (
            <motion.p variants={fadeUp} className="text-xs text-zinc-500 mb-12">
              Version {APP_VERSION} · Signed & notarized · Auto-updates
            </motion.p>
          )}
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
              const platformLabel = d.label.replace("Download for ", "");
              if (hasRelease !== true) {
                return (
                  <motion.div
                    key={key}
                    variants={fadeUp}
                    className={`relative p-5 rounded-xl border transition-all ${
                      isDetected
                        ? "bg-brand-600/5 border-brand-600/40"
                        : "bg-white/[0.02] border-white/5"
                    }`}
                  >
                    {isDetected && (
                      <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wider">
                        Detected
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isDetected ? "bg-brand-600/20 text-brand-400" : "bg-white/5 text-zinc-400"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-white mb-1">{platformLabel}</div>
                    <div className="text-xs text-zinc-500 mb-3">{d.subLabel}</div>
                    <p className="text-xs text-zinc-500 mb-3">
                      Be first to know when Voxlen launches on {platformLabel}.
                    </p>
                    <WaitlistForm platform={platformLabel} />
                  </motion.div>
                );
              }
              return (
                <motion.a
                  key={key}
                  variants={fadeUp}
                  href={hrefFor(key)}
                  className={`group relative p-5 rounded-xl border transition-all ${
                    isDetected
                      ? "bg-brand-600/5 border-brand-600/40 hover:border-brand-600/60"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                  }`}
                >
                  {isDetected && (
                    <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wider">
                      Detected
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isDetected ? "bg-brand-600/20 text-brand-400" : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <Download className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-y-0.5 transition-all" />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">{platformLabel}</div>
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
          className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {/* iOS */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-600/10 to-transparent border border-brand-600/20 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center shrink-0">
                <Apple className="h-6 w-6 text-brand-400" />
              </div>
              <div>
                <div className="text-base font-bold text-white">iPhone & iPad Keyboard</div>
                <div className="text-xs text-zinc-500">iOS 16+ — Custom keyboard extension</div>
              </div>
            </div>
            <p className="text-sm text-zinc-400">Nova-3 streaming dictation with AI grammar correction. Works in every iOS app — iMessage, WhatsApp, Mail, legal apps. 20+ languages.</p>
            <WaitlistForm platform="iOS" />
          </div>
          {/* Android */}
          <div id="android-waitlist" className="p-6 rounded-2xl bg-gradient-to-br from-zinc-800/30 to-transparent border border-white/10 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Smartphone className="h-6 w-6 text-zinc-400" />
              </div>
              <div>
                <div className="text-base font-bold text-white">Android / Samsung Keyboard</div>
                <div className="text-xs text-zinc-500">Android 10+ — Samsung Galaxy optimised</div>
              </div>
            </div>
            <p className="text-sm text-zinc-400">Full custom Android keyboard with Nova-3 dictation and AI grammar polish. Galaxy S, Z Fold, and all Android devices. Join the waitlist for early access.</p>
            <WaitlistForm platform="Android" />
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
            className="hover:text-brand-400 transition-colors"
          >
            View all releases &amp; changelog →
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function WaitlistForm({ platform }: { platform: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted" | "error">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { setStatus("error"); return; }
    // Send to the backend; keep a localStorage copy as an offline fallback
    fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), platform }),
    }).catch(() => { /* recorded locally below regardless */ });
    try {
      type WaitlistEntry = { email: string; platform: string };
      const unified = JSON.parse(localStorage.getItem("voxlen_waitlist") || "[]") as WaitlistEntry[];
      if (!unified.some((e) => e.email === email && e.platform === platform)) {
        unified.push({ email, platform });
        localStorage.setItem("voxlen_waitlist", JSON.stringify(unified));
      }
    } catch { /* ignore */ }
    setStatus("submitted");
  };

  if (status === "submitted") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400 font-medium">
        <Check className="h-4 w-4" /> You're on the {platform} waitlist — we'll email you at launch.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
        placeholder="your@email.com"
        className="flex-1 h-9 px-3 rounded-lg bg-black/40 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-500 transition-colors"
      />
      <button
        type="submit"
        className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shrink-0"
      >
        Notify me
      </button>
    </form>
  );
}

const FOOTER_LINKS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "By profession",
    links: [
      { href: "/voice-dictation-for-lawyers", label: "Dictation for Lawyers" },
      { href: "/legal-dictation-software", label: "Legal Dictation Software" },
      { href: "/dictation-software-for-accountants", label: "Dictation for Accountants" },
      { href: "/voice-to-text-for-medical", label: "Medical Voice-to-Text" },
    ],
  },
  {
    heading: "By platform",
    links: [
      { href: "/voice-dictation-mac", label: "Dictation for Mac" },
      { href: "/voice-dictation-windows", label: "Dictation for Windows" },
      { href: "/voice-dictation-iphone", label: "Dictation for iPhone" },
      { href: "/voice-dictation-android", label: "Dictation for Android" },
    ],
  },
  {
    heading: "By region",
    links: [
      { href: "/dictation-software-for-solicitors-uk", label: "Solicitors (UK)" },
      { href: "/legal-dictation-software-australia", label: "Legal Dictation (Australia)" },
      { href: "/legal-voice-dictation-canada", label: "Legal Dictation (Canada)" },
      { href: "/legal-dictation-new-zealand", label: "Legal Dictation (NZ)" },
    ],
  },
  {
    heading: "Compare",
    links: [
      { href: "/voxlen-vs-dragon", label: "Voxlen vs Dragon" },
      { href: "/voxlen-vs-wispr-flow", label: "Voxlen vs Wispr Flow" },
      { href: "/voxlen-vs-otter", label: "Voxlen vs Otter.ai" },
      { href: "/dragon-naturallyspeaking-alternative", label: "Dragon Alternative" },
      { href: "/best-voice-to-text-software", label: "Best Voice-to-Text 2026" },
      { href: "/ai-dictation-software", label: "AI Dictation Software" },
    ],
  },
];

function Footer({ onOpenLegal }: { onOpenLegal: (type: "privacy" | "terms") => void }) {
  return (
    <footer className="py-16 border-t border-white/5 bg-[#09090b]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Logo + tagline + trust badges row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-10 mb-10 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <Mic className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-black tracking-tight">Voxlen</span>
              <span className="text-xs text-zinc-600">v{APP_VERSION}</span>
            </div>
            <p className="text-xs text-zinc-500 max-w-xs">The most advanced AI voice dictation for legal and accounting professionals.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Shield className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs font-semibold text-zinc-300">SOC 2 Type II</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Lock className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-zinc-300">GDPR Compliant</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Shield className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-zinc-300">Zero Retention</span>
            </div>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 mb-10 border-b border-white/5">
          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">{col.heading}</h4>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-xs text-zinc-500 hover:text-white transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} Voxlen. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <button onClick={() => onOpenLegal("privacy")} className="hover:text-white transition-colors">Privacy Policy</button>
            <button onClick={() => onOpenLegal("terms")} className="hover:text-white transition-colors">Terms of Service</button>
            <a href="/support" className="hover:text-white transition-colors">Support</a>
            <a href="mailto:hello@voxlen.ai" className="hover:text-white transition-colors">hello@voxlen.ai</a>
            <a href="https://github.com/ccantynz-alt/voxlen" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
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
        <li><strong className="text-zinc-200">Audio recordings</strong> — We never store, log, or retain your voice audio. Audio is streamed over zero-retention endpoints to the speech-to-text provider and immediately discarded after transcription.</li>
        <li><strong className="text-zinc-200">Transcribed text</strong> — Your dictated text stays on your device. We never transmit transcription content to our servers.</li>
        <li><strong className="text-zinc-200">Grammar-corrected content</strong> — Text sent for AI grammar correction passes through zero-retention endpoints to the grammar AI provider (Anthropic or OpenAI) — all AI costs are included in your subscription, no API keys to manage. We never store this content.</li>
        <li><strong className="text-zinc-200">Documents or files</strong> — Voxlen never reads, scans, or accesses any files on your device beyond its own configuration.</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">2. Data Processing Architecture</h2>
      <p className="text-zinc-300 leading-relaxed">
        Voxlen operates as a <strong>zero-retention pass-through</strong>. Paid plans include AI
        infrastructure as part of your subscription, and requests pass through zero-retention
        endpoints straight to the underlying AI providers — Voxlen never stores your audio or
        transcripts, and nothing is retained:
      </p>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li><strong className="text-zinc-200">Speech-to-Text:</strong> Audio streams from your device over zero-retention endpoints to the speech-to-text provider and is never stored. Privileged Mode (coming soon) will process everything on-device so audio never leaves your device.</li>
        <li><strong className="text-zinc-200">Grammar Correction:</strong> Text is sent from your device over zero-retention endpoints to the grammar AI provider (Anthropic or OpenAI). Nothing is stored or retained.</li>
        <li><strong className="text-zinc-200">Text Injection:</strong> All text injection happens locally via OS-level APIs. No network transmission involved.</li>
        <li><strong className="text-zinc-200">API credentials:</strong> Voxlen provisions provider access as part of your subscription. Requests are authenticated with your Voxlen account and pass through zero-retention endpoints straight to the providers — no API keys to manage.</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">3. Confidentiality for Legal &amp; Accounting Professionals</h2>
      <p className="text-zinc-300 leading-relaxed">
        We understand that attorneys, accountants, and other professionals using Voxlen may handle
        privileged or confidential information. Voxlen is designed to respect these obligations:
      </p>
      <ul className="text-zinc-400 space-y-2 list-disc pl-5">
        <li>Voxlen never stores your audio or transcripts — requests pass through zero-retention endpoints straight to the AI providers, and nothing is retained</li>
        <li>Session history is stored only on your local device and never synced to our infrastructure</li>
        <li>Custom vocabulary and dictionaries remain local to your device</li>
        <li>All AI provider traffic uses zero-retention endpoints</li>
        <li>Professional plan users get the strictest zero-retention guarantees enabled by default, plus per-matter / per-client vocabulary isolation</li>
        <li>Privileged Mode (coming soon) will process everything on-device for zero external data transmission</li>
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
        For privacy inquiries, contact us at <a href="mailto:privacy@voxlen.ai" className="text-brand-400 hover:underline">privacy@voxlen.ai</a>.
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
        on your device and connects to third-party AI providers through zero-retention
        endpoints included with your subscription.
      </p>

      <h2 className="text-lg font-bold mt-8">2. AI Services &amp; Third-Party Providers</h2>
      <p className="text-zinc-300 leading-relaxed">
        Paid plans include all AI infrastructure (speech-to-text and grammar correction) as part of
        your subscription. You do not need to provide your own API keys. Audio and text are sent
        from your device through zero-retention endpoints to the relevant AI providers — Voxlen
        never stores your audio or transcripts, and nothing is retained. Advanced users may
        optionally supply their own API keys.
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
        For questions about these terms, contact us at <a href="mailto:legal@voxlen.ai" className="text-brand-400 hover:underline">legal@voxlen.ai</a>.
      </p>
    </div>
  );
}

function LegalPage({ type }: { type: "privacy" | "terms" }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="border-b border-white/5 bg-[#0c0c0f]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold tracking-tight">Voxlen</span>
          </a>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 text-sm capitalize">{type === "privacy" ? "Privacy Policy" : "Terms of Service"}</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
        <div className="mt-12 pt-6 border-t border-white/10 flex gap-6 text-sm text-zinc-500">
          <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="/support" className="hover:text-white transition-colors">Support</a>
          <a href="/" className="hover:text-white transition-colors ml-auto">← Back to Voxlen</a>
        </div>
      </div>
    </div>
  );
}

function SupportPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="border-b border-white/5 bg-[#0c0c0f]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold tracking-tight">Voxlen</span>
          </a>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 text-sm">Support</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-black mb-2">Support</h1>
          <p className="text-zinc-400">We're here to help. Reach out through any of the channels below.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:support@voxlen.ai"
            className="block p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
          >
            <div className="text-lg font-bold mb-1 group-hover:text-brand-400 transition-colors">Email Support</div>
            <p className="text-zinc-400 text-sm mb-3">General help, billing questions, and account issues.</p>
            <span className="text-brand-400 text-sm font-medium">support@voxlen.ai →</span>
          </a>
          <a
            href="mailto:legal@voxlen.ai"
            className="block p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
          >
            <div className="text-lg font-bold mb-1 group-hover:text-brand-400 transition-colors">Legal &amp; Privacy</div>
            <p className="text-zinc-400 text-sm mb-3">Terms, privacy policy, and data handling enquiries.</p>
            <span className="text-brand-400 text-sm font-medium">legal@voxlen.ai →</span>
          </a>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
          <h2 className="text-lg font-bold">Frequently Asked Questions</h2>
          {[
            {
              q: "Do I need API keys?",
              a: "No. All AI costs (Deepgram transcription and Claude grammar correction) are included in your subscription — no API keys to manage. Just sign in and speak. Advanced users who prefer their own keys can optionally add them in Settings → API Keys; keys are stored securely on your device and never sent to Voxlen servers.",
            },
            {
              q: "The iOS keyboard isn't appearing.",
              a: "Go to iOS Settings → General → Keyboard → Keyboards → Add New Keyboard, then find Voxlen. After adding it, tap the keyboard and enable Full Access to allow microphone use.",
            },
            {
              q: "How do I cancel my subscription?",
              a: "Your subscription is managed through Stripe. Email support@voxlen.ai with your account email and we'll process the cancellation same-day. You keep access until the end of your billing period.",
            },
            {
              q: "Is my dictated text private?",
              a: "Yes. Voxlen never stores your audio or transcripts — requests pass through zero-retention endpoints straight to the AI providers, and nothing is retained. Session history is stored on your device only.",
            },
            {
              q: "Can I use Voxlen for privileged client communications?",
              a: "Yes. All session history and custom vocabulary is stored on your device only. Audio streams over zero-retention endpoints — nothing is stored by Voxlen or its providers. Fully offline on-device mode is coming soon.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="border-t border-white/5 pt-4 first:border-0 first:pt-0">
              <p className="font-semibold text-white mb-1">{q}</p>
              <p className="text-zinc-400 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex gap-6 text-sm text-zinc-500">
          <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="/" className="hover:text-white transition-colors ml-auto">← Back to Voxlen</a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SEO landing pages
// ---------------------------------------------------------------------------

interface SEOPageData {
  title: string;
  headline: string;
  subheadline: string;
  description: string;
  bullets: string[];
  faq: { q: string; a: string }[];
  cta: string;
}

function SEOPage({ title, headline, subheadline, description, bullets, faq, cta, onSignIn }: SEOPageData & { onSignIn: (u: GoogleUser) => void }) {
  const login = useGoogleSignIn(onSignIn);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <title>{title} | Voxlen</title>
      {/* Nav */}
      <div className="border-b border-white/5 bg-[#09090b]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">Voxlen</span>
          </a>
          <a href="/#pricing" className="px-4 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors">
            Get Started
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="mb-16">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-wider mb-4">Voxlen</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-5 leading-tight">{headline}</h1>
          <p className="text-xl text-zinc-400 mb-8 leading-relaxed">{subheadline}</p>
          <div className="flex flex-wrap gap-3">
            <a href="/#download" className="px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors">
              Download Free
            </a>
            <button
              onClick={() => login()}
              className="px-6 py-3 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/5 transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="mb-14">
          <p className="text-zinc-300 text-lg leading-relaxed">{description}</p>
        </div>

        {/* Bullets */}
        <div className="mb-16 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <h2 className="text-xl font-bold mb-6">{cta}</h2>
          <ul className="space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-zinc-300">
                <Check className="h-4 w-4 text-brand-400 mt-0.5 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            {faq.map(({ q, a }) => (
              <div key={q} className="border-t border-white/5 pt-5">
                <h3 className="font-semibold text-white mb-2">{q}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer nav */}
        <div className="pt-8 border-t border-white/5 flex gap-6 text-sm text-zinc-500">
          <a href="/" className="hover:text-white transition-colors">← Voxlen Home</a>
          <a href="/#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
        </div>
      </div>
    </div>
  );
}

const SEO_PAGES: Record<string, SEOPageData> = {
  "/voice-dictation-for-lawyers": {
    title: "Voice Dictation for Lawyers",
    headline: "Voice Dictation Built for Lawyers",
    subheadline: "Dictate briefs, contracts, and correspondence faster than you can type. AI grammar correction handles the rest.",
    description: "Voxlen is designed from the ground up for legal professionals. Dictate into any application — Word, your practice management software, email — with real-time Deepgram Nova-3 transcription and Claude AI grammar correction that understands legal language. Custom vocabulary preserves case names, Latin phrases, and client names exactly as spoken.",
    cta: "Why lawyers choose Voxlen",
    bullets: [
      "Real-time transcription directly into any app — briefs, contracts, emails",
      "Legal Mode: Latin phrase recognition, citation formatting, legal currency",
      "Custom vocabulary for case names, client names, and firm-specific terms",
      "AI grammar polish that preserves your voice — not generic rewrites",
      "Zero-retention endpoints — audio never stored by Voxlen or providers",
      "Per-client matter tracking with automatic billable time logging",
      "Works on macOS, Windows, and Linux — no browser required",
    ],
    faq: [
      { q: "Is Voxlen safe for privileged client communications?", a: "Yes. Audio streams directly from your device to the speech-to-text provider over zero-retention endpoints. Voxlen does not store or access your audio or transcripts. Fully offline mode is on the roadmap." },
      { q: "Does it work with practice management software like Clio or LEAP?", a: "Yes. Voxlen injects text at the cursor using OS-level keyboard simulation — it works in any app with a text field, including Clio, LEAP, Smokeball, and all major practice management platforms." },
      { q: "How does Legal Mode help?", a: "Legal Mode enables recognition of Latin legal phrases (habeas corpus, mens rea, etc.), legal citation formatting, and jurisdiction-specific smart formatting. Toggle it on in Settings." },
      { q: "Can I use my own microphone?", a: "Yes. Voxlen supports any connected microphone. External mics like the Blue Yeti or Rode NT-USB are automatically detected and prioritised for better accuracy." },
    ],
  },
  "/legal-dictation-software": {
    title: "Legal Dictation Software",
    headline: "The Best Legal Dictation Software in 2026",
    subheadline: "Professional-grade AI voice dictation for law firms, barristers, and in-house counsel.",
    description: "Voxlen combines Deepgram Nova-3 real-time transcription with Claude AI grammar correction to deliver the most accurate legal dictation software available. Unlike Dragon Legal, there's no per-seat licence, no training required, and no hardware lock-in. Works on any app, any platform.",
    cta: "What makes Voxlen the best legal dictation software",
    bullets: [
      "Deepgram Nova-3 — best-in-class accuracy for legal terminology",
      "Injects text directly into any application at cursor position",
      "Legal Mode with Latin phrase recognition and citation formatting",
      "Custom vocabulary for case names, opposing counsel, and firm terms",
      "AI grammar correction that preserves formal legal writing style",
      "macOS, Windows, Linux — plus iOS keyboard extension",
      "Fraction of the cost of Dragon Legal ($700+)",
    ],
    faq: [
      { q: "How does Voxlen compare to Dragon Legal?", a: "Voxlen is faster to set up (no voice training), works on any app without plugins, costs less, and has AI grammar correction Dragon doesn't offer. Dragon has an offline mode advantage — Voxlen's offline mode is coming soon." },
      { q: "Does it support multiple languages?", a: "Yes. Voxlen auto-detects your spoken language and supports transcription in 30+ languages via Deepgram Nova-3." },
      { q: "Is there a free trial?", a: "Download is free. Sign in with Google at voxlen.ai to get your account token — no credit card required to get started." },
    ],
  },
  "/dictation-software-for-accountants": {
    title: "Dictation Software for Accountants",
    headline: "Voice Dictation for Accountants & CPAs",
    subheadline: "Dictate client correspondence, advisory notes, and reports — faster than typing, more accurate than generic voice-to-text.",
    description: "Voxlen understands accounting and finance language. Custom vocabulary preserves client names, entity names, and technical terms like EBITDA, amortisation schedules, and tax codes exactly as spoken. Per-client matter tracking logs your billable dictation time automatically.",
    cta: "Why accountants choose Voxlen",
    bullets: [
      "Custom vocabulary for entity names, tax codes, and accounting terms",
      "Auto billable time tracking — logs dictation time per client matter",
      "AI grammar correction in professional, formal, or technical style",
      "Works in any app: accounting software, email, Word, Google Docs",
      "Speaker diarization — identify multiple speakers in client meetings",
      "Zero-retention endpoints — client data never stored",
      "iOS keyboard extension for dictating on iPhone or iPad",
    ],
    faq: [
      { q: "Does Voxlen understand accounting terminology?", a: "Yes. You can add any term to your custom vocabulary — entity names, tax codes, technical accounting terms — and Voxlen will never auto-correct them." },
      { q: "Can I track billable time automatically?", a: "Yes. Voxlen's per-client matter tracking logs every dictation session with duration, word count, and estimated billable amount at your configured hourly rate." },
      { q: "Is client financial information secure?", a: "Yes. Audio and transcripts stream directly to AI providers over zero-retention endpoints. Nothing is stored by Voxlen." },
    ],
  },
  "/voice-to-text-for-medical": {
    title: "Medical Voice-to-Text",
    headline: "Medical Voice-to-Text for Healthcare Professionals",
    subheadline: "Accurate, fast, and secure voice-to-text for clinical notes, referral letters, and patient correspondence.",
    description: "Voxlen's real-time transcription and AI grammar correction help clinicians, specialists, and allied health professionals document faster. Custom vocabulary handles medications, procedures, anatomical terms, and specialist language. Works directly in your EHR or any application.",
    cta: "Built for medical professionals",
    bullets: [
      "Custom vocabulary for medications, procedures, and diagnoses",
      "Real-time transcription into any EHR or clinical application",
      "AI grammar correction in clinical or formal writing style",
      "Zero-retention endpoints — patient audio never stored",
      "Speaker diarization for multi-party consultations",
      "iOS keyboard for mobile dictation",
      "macOS, Windows, Linux desktop app",
    ],
    faq: [
      { q: "Does it work with my EHR?", a: "Voxlen injects text at the cursor using OS-level keyboard simulation, so it works with any application — including Epic, Genie, Medical Director, Best Practice, and web-based EHRs." },
      { q: "Can it handle drug names and medical terminology?", a: "Yes. Add any term to your custom vocabulary and Voxlen will preserve it exactly. Deepgram Nova-3 also has strong out-of-the-box performance on medical terminology." },
    ],
  },
  "/voice-dictation-mac": {
    title: "Voice Dictation for Mac",
    headline: "The Best Voice Dictation App for Mac",
    subheadline: "Real-time AI dictation that works in any Mac app. Better than Apple Dictation, faster than typing.",
    description: "Voxlen is a native macOS app built with Tauri — lightweight, fast, and always available from the menu bar. Unlike Apple's built-in dictation, Voxlen adds AI grammar correction, custom vocabulary, voice commands, and per-client billing. Works on Apple Silicon and Intel Macs.",
    cta: "Why Mac users choose Voxlen over Apple Dictation",
    bullets: [
      "Native macOS app — Apple Silicon (M1–M4) and Intel",
      "Runs in the menu bar — always one shortcut away",
      "Works in every app via macOS keyboard simulation",
      "AI grammar correction Apple Dictation doesn't have",
      "Custom vocabulary, voice commands, translation",
      "Cmd+Shift+D to toggle, Cmd+Shift+Space for push-to-talk",
      "Light and dark mode",
    ],
    faq: [
      { q: "Does it work on Apple Silicon?", a: "Yes. Voxlen has a native ARM build for M1, M2, M3, and M4 Macs — no Rosetta required." },
      { q: "How is it different from Apple Dictation?", a: "Apple Dictation has no grammar correction, no custom vocabulary, no voice commands, and no billable time tracking. Voxlen has all of these, plus it works in every app without special configuration." },
      { q: "Will it slow down my Mac?", a: "No. Voxlen is built with Tauri (Rust + WebView), which uses far less memory and CPU than Electron apps. It sits silently in the menu bar when not recording." },
    ],
  },
  "/voice-dictation-windows": {
    title: "Voice Dictation for Windows",
    headline: "AI Voice Dictation for Windows 10 & 11",
    subheadline: "Professional dictation that works in every Windows app. Far more powerful than Windows Speech Recognition.",
    description: "Voxlen on Windows gives you real-time Deepgram transcription and Claude AI grammar correction, injected at the cursor in any app via the Windows SendInput API. Works in Word, Outlook, Edge, Chrome, practice management software, and every other Windows application.",
    cta: "Why Windows users switch to Voxlen",
    bullets: [
      "Native Windows 10 & 11 app (x64)",
      "Injects text at cursor in any Windows application",
      "AI grammar correction Windows Speech Recognition lacks",
      "Custom vocabulary and voice commands",
      "Ctrl+Shift+D to toggle, Ctrl+Shift+Space for push-to-talk",
      "Runs minimized to system tray",
      "No voice training required",
    ],
    faq: [
      { q: "Does it replace Windows Speech Recognition?", a: "It's a better alternative. Voxlen uses Deepgram Nova-3 (much higher accuracy), adds AI grammar correction, custom vocabulary, and voice commands that Windows Speech Recognition doesn't have." },
      { q: "Does it work with Microsoft Office?", a: "Yes. Voxlen injects text at the cursor in any application, including Word, Outlook, Excel, Teams, and all Office 365 apps." },
    ],
  },
  "/voice-dictation-iphone": {
    title: "Voice Dictation for iPhone",
    headline: "Voice Dictation Keyboard for iPhone",
    subheadline: "Dictate into any iPhone app with a custom AI keyboard extension. Works in iMessage, WhatsApp, Mail, and more.",
    description: "Voxlen's iOS keyboard extension lets you dictate into any app on your iPhone or iPad. Tap the mic, speak, and your text appears inline. Tap Polish to apply Claude AI grammar correction. Works anywhere the iOS keyboard appears — no app switching required.",
    cta: "What the Voxlen iPhone keyboard does",
    bullets: [
      "Custom keyboard extension for iOS 16+ (iPhone and iPad)",
      "Works in any app: iMessage, WhatsApp, Mail, legal apps",
      "Tap mic → dictate → text appears inline",
      "AI grammar polish with one tap",
      "Deepgram Nova-3 streaming accuracy",
      "No app switching — stays in your current app",
      "App Store listing coming soon — join the waitlist",
    ],
    faq: [
      { q: "How do I install the Voxlen keyboard?", a: "Download Voxlen from the App Store (coming soon), then go to Settings → General → Keyboard → Add New Keyboard and select Voxlen." },
      { q: "Does it work offline?", a: "Not yet — the keyboard currently requires an internet connection for transcription. Offline mode via on-device Whisper is on the roadmap." },
    ],
  },
  "/voice-dictation-android": {
    title: "Voice Dictation for Android",
    headline: "Voice Dictation for Android — Coming Soon",
    subheadline: "Join the waitlist for the Voxlen Android keyboard with Nova-3 AI dictation.",
    description: "The Voxlen Android keyboard extension is in development. It will bring the same real-time Deepgram Nova-3 transcription and Claude AI grammar correction to every Android app — Samsung Galaxy, Pixel, and all Android devices. Join the waitlist to be first in line.",
    cta: "What the Android keyboard will include",
    bullets: [
      "Custom keyboard extension for Samsung Galaxy, Pixel, and all Android devices",
      "Deepgram Nova-3 real-time transcription",
      "Claude AI grammar correction inline",
      "Works in any Android app with a text field",
      "Coming soon — join the waitlist at voxlen.ai",
    ],
    faq: [
      { q: "When will the Android keyboard be available?", a: "We're actively building it. Join the waitlist at voxlen.ai and we'll email you the moment it launches." },
      { q: "Will it work on Samsung Galaxy?", a: "Yes, Samsung Galaxy and all Android devices that support custom keyboards (Android 8+) are the target." },
    ],
  },
  "/dictation-software-for-solicitors-uk": {
    title: "Dictation Software for Solicitors UK",
    headline: "Voice Dictation for UK Solicitors",
    subheadline: "Professional AI dictation for solicitors, barristers, and legal executives in England, Wales, Scotland, and Northern Ireland.",
    description: "Voxlen is designed for UK legal professionals. Legal Mode understands English legal terminology, Latin phrases, court citation formats, and UK spelling conventions. Works in your practice management software, email, and any other application — on macOS, Windows, and Linux.",
    cta: "Built for UK legal practice",
    bullets: [
      "UK English spelling and legal terminology",
      "Latin phrase recognition — pro bono, without prejudice, inter alia",
      "Works with Osprey, Solcase, SOS, and all UK PMS platforms",
      "Per-matter billing time tracking",
      "Zero-retention — GDPR compliant audio pipeline",
      "iOS keyboard for dictating on iPhone in court or on the move",
    ],
    faq: [
      { q: "Is Voxlen GDPR compliant?", a: "Yes. Audio streams directly from your device to the STT provider over zero-retention endpoints. Voxlen does not store, process, or access your audio or transcripts." },
      { q: "Does it support UK spelling?", a: "Yes. Set your language to English (UK) and Voxlen will use UK spelling conventions. Custom vocabulary ensures firm-specific terms are preserved exactly." },
    ],
  },
  "/legal-dictation-software-australia": {
    title: "Legal Dictation Software Australia",
    headline: "Legal Dictation Software for Australian Lawyers",
    subheadline: "AI voice dictation for solicitors, barristers, and in-house counsel across Australia.",
    description: "Voxlen supports Australian English legal terminology, citation formats, and court naming conventions. Works with LEAP, Actionstep, Smokeball, and any other practice management software via OS-level text injection.",
    cta: "Built for Australian legal practice",
    bullets: [
      "Australian English spelling and legal terminology",
      "Works with LEAP, Actionstep, Smokeball, and all AU PMS",
      "Court citation formatting for Australian jurisdictions",
      "Zero-retention — Privacy Act compliant audio pipeline",
      "Per-client matter tracking and billable time logging",
    ],
    faq: [
      { q: "Does it work with LEAP or Smokeball?", a: "Yes. Voxlen injects text at the cursor via OS-level keyboard simulation — it works in any application including LEAP, Smokeball, Actionstep, and all web-based practice management platforms." },
      { q: "Does it support Australian English?", a: "Yes. Set your language to English (AU) for Australian spelling. Custom vocabulary handles AU-specific legal terms, court names, and jurisdictional references." },
    ],
  },
  "/legal-voice-dictation-canada": {
    title: "Legal Voice Dictation Canada",
    headline: "AI Legal Dictation for Canadian Lawyers",
    subheadline: "Voice dictation for lawyers, paralegals, and legal professionals across Canada.",
    description: "Voxlen supports both English (CA) and French (CA) legal terminology. Works with PCLaw, Clio, and all major Canadian practice management platforms. Custom vocabulary handles Canadian court names, citation formats, and bilingual terminology.",
    cta: "Built for Canadian legal practice",
    bullets: [
      "English (CA) and French (CA) language support",
      "Works with Clio, PCLaw, and all Canadian PMS",
      "Canadian court citation formatting",
      "Bilingual vocabulary — add French and English terms",
      "Zero-retention — PIPEDA compliant audio pipeline",
    ],
    faq: [
      { q: "Does it support French Canadian legal terminology?", a: "Yes. Set your dictation language to French (CA) or English (CA). You can switch languages per session and add bilingual terms to your custom vocabulary." },
      { q: "Does it work with Clio?", a: "Yes. Voxlen injects text at cursor in any application, including Clio Manage's web interface and desktop apps." },
    ],
  },
  "/legal-dictation-new-zealand": {
    title: "Legal Dictation New Zealand",
    headline: "AI Voice Dictation for New Zealand Lawyers",
    subheadline: "Professional legal dictation for solicitors and barristers in New Zealand.",
    description: "Voxlen supports New Zealand English legal terminology and citation formats. Works with LEAP NZ, Actionstep, and any other practice management software. Custom vocabulary handles NZ-specific legal terms, Māori legal concepts, and court naming conventions.",
    cta: "Built for New Zealand legal practice",
    bullets: [
      "New Zealand English spelling and terminology",
      "Works with LEAP NZ, Actionstep, and all NZ PMS",
      "Support for Māori legal terms and te reo Māori in custom vocabulary",
      "Per-matter billing and time tracking",
      "Zero-retention audio pipeline",
    ],
    faq: [
      { q: "Does it support te reo Māori terms?", a: "Yes. Add any Māori legal term or concept to your custom vocabulary and Voxlen will preserve it exactly as entered, never auto-correcting it." },
    ],
  },
  "/voxlen-vs-dragon": {
    title: "Voxlen vs Dragon NaturallySpeaking",
    headline: "Voxlen vs Dragon — Which is Better in 2026?",
    subheadline: "A direct comparison of Voxlen AI dictation and Dragon NaturallySpeaking for legal and professional use.",
    description: "Dragon NaturallySpeaking has been the standard for professional dictation for 25 years. But the landscape has changed — modern AI models like Deepgram Nova-3 match or exceed Dragon's accuracy without voice training, and at a fraction of the cost. Here's how they compare.",
    cta: "How Voxlen beats Dragon",
    bullets: [
      "No voice training required — works immediately out of the box",
      "Subscription from $29/mo vs Dragon Legal at $700 one-time (with annual support fees)",
      "AI grammar correction Dragon doesn't have",
      "Works on macOS, Windows, and Linux (Dragon is Windows-only for latest versions)",
      "iOS keyboard extension (Dragon has no mobile equivalent)",
      "No hardware lock-in — runs on any machine with your account",
      "Offline mode coming soon — Dragon's key advantage today",
    ],
    faq: [
      { q: "Is Voxlen as accurate as Dragon?", a: "Deepgram Nova-3 matches Dragon's accuracy for most use cases without any voice training. Dragon can edge ahead in very noisy environments — but Voxlen's noise gate and high-pass filter substantially close this gap." },
      { q: "What does Dragon have that Voxlen doesn't?", a: "Dragon has a mature offline mode. Voxlen's offline mode (Whisper Local) is on the roadmap. Dragon also has deeper macro/scripting features for power users." },
      { q: "Can I switch from Dragon to Voxlen without retraining?", a: "Yes. Voxlen requires no voice training at all. You can be dictating within minutes of downloading." },
    ],
  },
  "/voxlen-vs-wispr-flow": {
    title: "Voxlen vs Wispr Flow",
    headline: "Voxlen vs Wispr Flow — 2026 Comparison",
    subheadline: "Both are AI dictation tools for professionals. Here's how they differ.",
    description: "Wispr Flow is a well-designed dictation tool with good accuracy and a clean interface. Voxlen is built specifically for legal and accounting professionals with features Wispr Flow doesn't have.",
    cta: "Why professionals choose Voxlen over Wispr Flow",
    bullets: [
      "Legal Mode — Latin phrases, citation formatting, legal currency",
      "Per-client matter tracking with automatic billable time",
      "Custom vocabulary for case names and client-specific terms",
      "Speaker diarization (identify multiple speakers)",
      "iOS keyboard extension for mobile dictation",
      "Real-time translation into 50+ languages",
      "Voxlen is cheaper for professional teams",
    ],
    faq: [
      { q: "Which has better accuracy?", a: "Both use best-in-class STT models. Voxlen uses Deepgram Nova-3 which is purpose-built for professional and enterprise use cases." },
      { q: "Does Wispr Flow have billable time tracking?", a: "No. Voxlen's per-client matter tracking is unique — it automatically logs dictation time per client and calculates billable amounts." },
    ],
  },
  "/voxlen-vs-otter": {
    title: "Voxlen vs Otter.ai",
    headline: "Voxlen vs Otter.ai — Which Should You Use?",
    subheadline: "Otter.ai is great for meeting transcription. Voxlen is built for active dictation into any app.",
    description: "Otter.ai excels at transcribing recorded meetings and conversations after the fact. Voxlen is built for real-time active dictation — injecting text directly at the cursor as you speak, in any application. Different tools for different jobs.",
    cta: "When to choose Voxlen over Otter",
    bullets: [
      "Voxlen injects text directly at your cursor — Otter gives you a transcript to copy",
      "Voxlen works in any application — Otter is a standalone recorder",
      "AI grammar correction and custom vocabulary",
      "Legal Mode and billable time tracking for professionals",
      "Push-to-talk and global shortcuts for seamless workflow",
      "iOS keyboard for dictating in any iPhone app",
    ],
    faq: [
      { q: "Can I use both Otter and Voxlen?", a: "Yes — they serve different purposes. Use Otter for recording and transcribing meetings. Use Voxlen for active dictation while drafting documents, emails, and notes." },
      { q: "Does Voxlen record meetings?", a: "Not currently. Voxlen is focused on real-time active dictation. Meeting transcription may come in a future update." },
    ],
  },
  "/dragon-naturallyspeaking-alternative": {
    title: "Dragon NaturallySpeaking Alternative",
    headline: "The Best Dragon NaturallySpeaking Alternative in 2026",
    subheadline: "Modern AI dictation without Dragon's price tag, hardware lock-in, or mandatory voice training.",
    description: "Dragon NaturallySpeaking has served professionals well for decades. But at $700+ for Dragon Legal, requiring voice profile training, and being Windows-only in its latest versions, many professionals are looking for an alternative. Voxlen is the modern replacement.",
    cta: "Why Voxlen is the best Dragon alternative",
    bullets: [
      "No voice training — accurate immediately on first use",
      "Subscription from $29/mo — no $700 upfront cost",
      "macOS, Windows, and Linux (Dragon is Windows-only for latest)",
      "AI grammar correction Dragon doesn't have",
      "iOS keyboard for mobile dictation",
      "Custom vocabulary, voice commands, translation",
      "Cloud-based — works on any machine with your account",
    ],
    faq: [
      { q: "Will I lose accuracy switching from Dragon?", a: "Most users find Deepgram Nova-3 matches or exceeds Dragon's accuracy — especially for legal terminology — without any training period." },
      { q: "Can I import my Dragon vocabulary?", a: "Not directly, but you can manually add your most important terms to Voxlen's custom vocabulary. The import tool is on the roadmap." },
    ],
  },
  "/best-voice-to-text-software": {
    title: "Best Voice to Text Software 2026",
    headline: "The Best Voice-to-Text Software in 2026",
    subheadline: "A ranked guide to the top dictation tools for professionals, lawyers, and power users.",
    description: "The voice-to-text landscape has been transformed by AI. Deepgram, OpenAI Whisper, and large language models have made professional-grade transcription accessible to everyone. Here's our honest assessment of the best options in 2026.",
    cta: "What makes the best voice-to-text software",
    bullets: [
      "Accuracy on professional and domain-specific vocabulary",
      "Real-time vs batch transcription latency",
      "AI grammar correction and post-processing",
      "Integration with existing workflows and applications",
      "Privacy and data retention policies",
      "Platform support — macOS, Windows, Linux, iOS, Android",
      "Price vs value for professional use cases",
    ],
    faq: [
      { q: "What is the most accurate voice-to-text software?", a: "For professional use, Deepgram Nova-3 (used by Voxlen) and OpenAI Whisper are the most accurate models available. Deepgram is faster for real-time use; Whisper excels for batch accuracy." },
      { q: "Is free voice-to-text software good enough for professionals?", a: "Apple Dictation and Windows Speech Recognition are free but lack AI grammar correction, custom vocabulary, and professional workflow integration. For legal and accounting use, a professional tool like Voxlen delivers meaningfully better output." },
    ],
  },
  "/ai-dictation-software": {
    title: "AI Dictation Software",
    headline: "AI Dictation Software for Professionals",
    subheadline: "Real-time transcription and AI grammar correction in one tool. Dictate faster and smarter.",
    description: "Voxlen combines Deepgram Nova-3 real-time speech-to-text with Claude AI grammar correction to give you the most capable AI dictation software available. Speak naturally — Voxlen transcribes accurately and corrects grammar, punctuation, and style in real time.",
    cta: "What AI dictation software should do",
    bullets: [
      "Real-time transcription with Deepgram Nova-3 — lowest latency available",
      "Claude AI grammar correction — not just spellcheck, but full prose improvement",
      "Custom vocabulary — domain terms never get auto-corrected",
      "Tone preservation — fixes errors without changing your voice",
      "Voice commands — new line, delete that, correct grammar",
      "Works in any application on macOS, Windows, and Linux",
      "iOS keyboard for AI dictation on iPhone and iPad",
    ],
    faq: [
      { q: "What AI models does Voxlen use?", a: "Voxlen uses Deepgram Nova-3 for real-time speech-to-text (the most accurate STT model available) and Claude by Anthropic for AI grammar correction." },
      { q: "Does the AI change what I said?", a: "Only grammar, punctuation, and spelling — never substance. With Preserve Tone enabled, Voxlen only fixes errors and never rephrases or rewrites your content." },
    ],
  },
};
