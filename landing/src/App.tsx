import { useEffect, useState, useCallback, type ReactNode } from "react";
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
  PRICE_PROFESSIONAL_MONTHLY,
  PRICE_PRIVILEGED_MONTHLY,
  PRICE_FIRM_SEAT_MONTHLY,
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
    <div className="min-h-screen bg-paper text-ink font-sans">
      <Navbar user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} onDashboard={goToDashboard} />
      <Hero user={user} onSignIn={handleSignIn} />
      <TrustBar />
      <LiveDemo />
      <EthicsSection />
      <Features />
      <Platforms />
      <HowItWorks />
      <DesignedFor />
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
    <nav className="fixed top-0 w-full z-50 bg-paper/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-baseline gap-2" aria-label="Voxlen home">
          <span className="font-display text-[22px] leading-none text-ink tracking-tight">
            Vox<span className="italic text-brass">len</span>
          </span>
          <span className="hidden sm:inline font-mono text-[10px] text-ink-faint tracking-caps uppercase">
            Dictation for the professions
          </span>
        </a>
        <div className="hidden md:flex items-center gap-7 text-[13px] text-ink-soft">
          <a href="#features" className="hover:text-ink transition-colors">Capabilities</a>
          <a href="#platforms" className="hover:text-ink transition-colors">Platforms</a>
          <a href="#pricing" className="hover:text-ink transition-colors">Fees</a>
          <a href="#faq" className="hover:text-ink transition-colors">Questions</a>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 h-9 px-2.5 rounded-md hover:bg-paper-deep transition-colors"
              >
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-rule"
                  referrerPolicy="no-referrer"
                />
                <span className="text-sm text-ink hidden sm:block">{user.name.split(" ")[0]}</span>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-52 rounded-md border border-rule bg-white shadow-sheet py-1 z-50"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-rule">
                    <p className="text-xs font-medium text-ink truncate">{user.name}</p>
                    <p className="text-[11px] text-ink-soft truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); onDashboard(); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                  >
                    Dashboard
                  </button>
                  <a
                    href="/#download"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                  >
                    Open App
                  </a>
                  <button
                    onClick={() => { setMenuOpen(false); onSignOut(); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => login()}
              className="h-9 px-3 rounded-md text-[13px] text-ink-soft hover:text-ink hover:bg-paper-deep transition-colors hidden sm:flex items-center gap-1.5"
            >
              Sign in
            </button>
          )}
          <a
            href="#download"
            className="h-9 px-4 rounded-md bg-brass text-paper text-[13px] font-semibold flex items-center gap-2 hover:bg-brass-deep transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      </div>
      {/* Letterhead double rule under the masthead */}
      <div className="rule-double h-[5px]" />
    </nav>
  );
}

/** Shared section heading — clause-numbered like the documents this
 *  audience reads all day. */
function SectionHead({
  clause,
  eyebrow,
  title,
  sub,
}: {
  clause: string;
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={stagger}
      className="text-center mb-14"
    >
      <motion.p variants={fadeUp} className="font-mono text-brass text-sm mb-2">
        {clause}
      </motion.p>
      <motion.p variants={fadeUp} className="text-[11px] font-semibold tracking-caps uppercase text-ink-faint mb-4">
        {eyebrow}
      </motion.p>
      <motion.h2 variants={fadeUp} className="font-display text-4xl md:text-5xl text-ink leading-[1.1]">
        {title}
      </motion.h2>
      {sub && (
        <motion.p variants={fadeUp} className="mt-4 text-ink-soft max-w-xl mx-auto leading-relaxed">
          {sub}
        </motion.p>
      )}
    </motion.div>
  );
}

/**
 * The signature: a dictation record, typed in Courier like a court
 * transcript, with the AI's corrections applied as a legal redline —
 * struck in proofreader's red, inserted in brass. The product's promise,
 * rendered in the audience's own vernacular.
 */
function DictationRecord() {
  return (
    <div className="relative bg-white border border-rule rounded-md shadow-sheet p-6 sm:p-8 text-left" aria-hidden="true">
      <div className="flex items-baseline justify-between border-b border-rule pb-3 mb-5">
        <span className="text-[10px] font-semibold tracking-caps uppercase text-ink-faint">
          Dictation record
        </span>
        <span className="font-mono text-[11px] text-ink-faint">Matter 2026-041 · Advice</span>
      </div>

      <div className="space-y-4 font-mono text-[13px] leading-relaxed text-ink">
        <p className="record-line" style={{ animationDelay: "0.3s" }}>
          <span className="text-ink-faint text-[11px] mr-3">10:32:04</span>
          Further to our conference of yesterday&rsquo;s date, we advise as follows.
        </p>
        <p className="record-line" style={{ animationDelay: "0.9s" }}>
          <span className="text-ink-faint text-[11px] mr-3">10:32:11</span>
          We recommend the client{" "}
          <span className="correction" style={{ animationDelay: "2.2s" }}>
            <span className="redline-strike">except</span>{" "}
            <span className="redline-insert">accept</span>
          </span>{" "}
          the settlement offer
        </p>
        <p className="record-line" style={{ animationDelay: "1.5s" }}>
          <span className="text-ink-faint text-[11px] mr-3">10:32:19</span>
          in the amount of{" "}
          <span className="correction" style={{ animationDelay: "2.7s" }}>
            <span className="redline-strike">forty two thousand dollars</span>{" "}
            <span className="redline-insert">$42,000</span>
          </span>
          , payable within 14 days.
        </p>
        <p className="record-line text-ink-soft" style={{ animationDelay: "3.2s" }}>
          <span className="text-ink-faint text-[11px] mr-3">10:32:26</span>
          This advice is privileged and
          <span className="inline-block w-[7px] h-[15px] bg-brass ml-1 align-text-bottom animate-pulse" />
        </p>
      </div>

      <div className="flex justify-end mt-6">
        <span className="stamp stamp-animate" style={{ animationDelay: "3.8s" }}>
          Processed on device
        </span>
      </div>
    </div>
  );
}

function Hero({ user, onSignIn }: { user: GoogleUser | null; onSignIn: (u: GoogleUser) => void }) {
  const login = useGoogleSignIn(onSignIn);

  return (
    <section className="relative pt-36 pb-20">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="text-left">
          <motion.p
            variants={fadeUp}
            className="text-[11px] font-semibold tracking-caps uppercase text-brass mb-6"
          >
            For lawyers &amp; accountants
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="font-display text-5xl md:text-[64px] text-ink leading-[1.05] tracking-tight"
          >
            Every word,
            <br />
            on the record.
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-6 text-lg text-ink-soft max-w-md leading-relaxed">
            Speak; Voxlen writes. Real-time dictation with AI grammar, typed
            straight into Word, Outlook, or any application — with on-device
            privacy for privileged work and billable time captured as you
            speak.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {user ? (
              <a
                href="#download"
                className="h-12 px-7 rounded-md bg-brass text-paper font-semibold text-[15px] flex items-center gap-2.5 hover:bg-brass-deep transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Voxlen
              </a>
            ) : (
              <button
                onClick={() => login()}
                className="h-12 px-7 rounded-md bg-brass text-paper font-semibold text-[15px] flex items-center gap-2.5 hover:bg-brass-deep transition-colors"
              >
                <Download className="h-4 w-4" />
                Start free trial
              </button>
            )}
            <a
              href="#pricing"
              className="h-12 px-6 rounded-md border border-rule text-ink font-medium text-[15px] flex items-center gap-2 hover:border-brass transition-colors"
            >
              Schedule of fees
              <ArrowRight className="h-4 w-4 text-brass" />
            </a>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-7 font-mono text-[12px] text-ink-faint">
            macOS &nbsp;·&nbsp; Windows &nbsp;·&nbsp; Linux &nbsp;·&nbsp; iPhone coming soon
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          <DictationRecord />
        </motion.div>
      </div>
    </section>
  );
}

function TrustBar() {
  const stats = [
    { value: "99.2%", label: "Accuracy" },
    { value: "<300ms", label: "Latency" },
    { value: "0 bytes", label: "Retained by Voxlen" },
    { value: "20+", label: "Languages" },
  ];
  return (
    <section className="py-6">
      <div className="max-w-5xl mx-auto px-6">
        <div className="rule-double pt-7 pb-2">
          <div className="flex flex-wrap items-baseline justify-center gap-x-12 gap-y-4">
            {stats.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2.5">
                <span className="font-mono text-xl text-ink">{s.value}</span>
                <span className="text-[10px] tracking-caps uppercase text-ink-faint">{s.label}</span>
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
      badge: "Available now",
      available: true,
      href: "#download",
    },
    {
      name: "Windows",
      sub: "Windows 10 / 11",
      icon: "🪟",
      description: "SendInput API for seamless text injection into every Windows app. Works with Microsoft 365, Outlook, Teams, and the full Windows ecosystem.",
      badge: "Available now",
      available: true,
      href: "#download",
    },
    {
      name: "iPhone & iPad",
      sub: "iOS 16+",
      icon: "📱",
      description: "Custom keyboard extension — dictate in any app including iMessage, WhatsApp, Mail, and legal practice apps. Nova-3 streaming. AI grammar in every field.",
      badge: "App Store — coming soon",
      available: false,
      href: "#download",
    },
    {
      name: "Android / Samsung",
      sub: "Android 10+",
      icon: "🤖",
      description: "Custom keyboard for all Android devices including Samsung Galaxy. Voice dictation in every app. Same Nova-3 accuracy as desktop. Galaxy S / Z Fold optimised.",
      badge: "Coming soon — join waitlist",
      available: false,
      href: "#android-waitlist",
    },
  ];

  return (
    <section id="platforms" className="py-24 bg-paper-deep/60">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead
          clause="§ 2"
          eyebrow="Every platform"
          title={
            <>
              One subscription.
              <br />
              <span className="italic text-ink-soft">Every device you own.</span>
            </>
          }
          sub="Unlike Dragon (Windows-only) or Wispr Flow (Mac/iOS-only), Voxlen supports macOS, Windows, and Linux. iPhone, iPad, and Android keyboards are coming soon — join the waitlist."
        />

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
              className="p-6 rounded-md bg-white border border-rule shadow-card"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl" aria-hidden="true">{p.icon}</div>
                <span
                  className={`text-[10px] font-semibold tracking-caps uppercase px-2 py-1 rounded-sm border ${
                    p.available
                      ? "border-brass/40 text-brass bg-brass-wash/60"
                      : "border-rule text-ink-faint"
                  }`}
                >
                  {p.badge}
                </span>
              </div>
              <h3 className="font-serif text-lg text-ink mb-0.5">{p.name}</h3>
              <p className="font-mono text-[11px] text-ink-faint mb-3">{p.sub}</p>
              <p className="text-sm text-ink-soft leading-relaxed">{p.description}</p>
              <a href={p.href} className="mt-4 inline-flex items-center gap-1.5 text-xs text-brass hover:text-brass-deep transition-colors font-semibold">
                {p.available ? "Download" : "Join waitlist"} <ArrowRight className="h-3 w-3" />
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function DesignedFor() {
  const useCases = [
    {
      title: "Commercial litigation",
      description: "Briefs, correspondence, and deposition summaries — with Latin phrase recognition and citation formatting built in.",
    },
    {
      title: "Firms switching from Dragon",
      description: "No voice training, works on Mac, Windows, and Linux, and costs a fraction of a Dragon Legal licence.",
    },
    {
      title: "Sensitive & privileged matters",
      description: "Zero-retention architecture — audio streams directly to the STT provider and nothing is stored on Voxlen servers.",
    },
    {
      title: "Tax & advisory work",
      description: "Dictate client advisory letters, audit notes, and board reports. Custom vocabulary handles EBITDA, amortisation schedules, and entity names.",
    },
    {
      title: "Billable time capture",
      description: "Per-matter tracking logs every dictation session automatically — duration, word count, and billable amount at your rate.",
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead
          clause="§ 4"
          eyebrow="Areas of practice"
          title={
            <>
              Lawyers. Accountants.
              <br />
              <span className="italic text-ink-soft">Built for how you work.</span>
            </>
          }
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {useCases.map((u) => (
            <motion.div
              key={u.title}
              variants={fadeUp}
              className="p-6 rounded-md bg-white border border-rule shadow-card"
            >
              <div className="font-serif text-[15px] text-ink mb-2">{u.title}</div>
              <p className="text-sm text-ink-soft leading-relaxed">{u.description}</p>
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
      title: "Real-time streaming",
      description: "Words appear on screen as you speak. Sub-300ms latency powered by Deepgram Nova-3. No more waiting for batch processing.",
    },
    {
      icon: Sparkles,
      title: "AI grammar engine",
      description: "Every sentence is polished by Claude — grammar, punctuation, and style corrected instantly, in your chosen writing voice.",
    },
    {
      icon: Keyboard,
      title: "Types into any application",
      description: "Dictated text goes directly to your cursor — Word, Outlook, your practice system, any browser. No copy-paste.",
    },
    {
      icon: Shield,
      title: "Never interrupted",
      description: "Unlike Windows+H or Apple Dictation, Voxlen never stops when you switch apps. It runs as a background service with its own audio pipeline.",
    },
    {
      icon: Cpu,
      title: "Offline mode — on-device Whisper",
      description: "Download a local model and audio never leaves your machine. Built for privileged and maximally sensitive work; works on a flight.",
    },
    {
      icon: DollarSign,
      title: "Billable time, captured",
      description: "Every dictation session is logged per client and matter — duration, word count, and amount at your rate. Nothing slips.",
    },
    {
      icon: Mic,
      title: "Smart microphone handling",
      description: "Auto-detects external USB mics and prefers them over the laptop mic. Survives mute buttons, unplugs, and sleep without dropping a session.",
    },
    {
      icon: Globe,
      title: "20+ languages",
      description: "Auto-detects the language you're speaking, with full support for accents and dialects. Real-time translation included.",
    },
    {
      icon: Volume2,
      title: "Voice commands",
      description: "Say ‘new line’, ‘period’, ‘delete that’, ‘stop listening’ — plus clause-library triggers that insert standard text on command.",
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead
          clause="§ 1"
          eyebrow="Capabilities"
          title={
            <>
              Everything you need.
              <br />
              <span className="italic text-ink-soft">Nothing you don&rsquo;t.</span>
            </>
          }
        />

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
                className="p-6 rounded-md bg-white border border-rule shadow-card hover:border-brass/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-sm bg-brass-wash border border-rule flex items-center justify-center mb-4">
                  <Icon className="h-4 w-4 text-brass" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-[17px] text-ink mb-2">{feature.title}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">
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
    <section className="py-24 bg-paper-deep/60">
      <div className="max-w-4xl mx-auto px-6">
        <SectionHead
          clause="§ 3"
          eyebrow="Procedure"
          title="Four steps. Zero friction."
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="bg-white border border-rule rounded-md shadow-card divide-y divide-rule"
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              variants={fadeUp}
              className="flex items-start gap-6 p-6"
            >
              <span className="shrink-0 font-mono text-sm text-brass pt-0.5 w-8">{`${i + 1}.`}</span>
              <div>
                <h3 className="font-serif text-[17px] text-ink mb-1">{step.title}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{step.desc}</p>
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
    { name: "Grammarly", price: "$12/mo", realtime: false, neverInterrupts: false, grammar: true, anyApp: false, offline: false, extMic: false, android: true, legalMode: false },
    { name: "Dragon", price: "$700", realtime: true, neverInterrupts: false, grammar: false, anyApp: true, offline: true, extMic: false, android: false, legalMode: true },
    { name: "Wispr Flow", price: "$12/mo", realtime: true, neverInterrupts: true, grammar: false, anyApp: true, offline: false, extMic: false, android: false, legalMode: false },
    { name: "Voxlen", price: "$29/mo", realtime: true, neverInterrupts: true, grammar: true, anyApp: true, offline: true, extMic: true, android: "soon", legalMode: true, highlight: true },
  ];

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead
          clause="§ 5"
          eyebrow="The alternatives, considered"
          title="A fair comparison."
        />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="overflow-x-auto bg-white border border-rule rounded-md shadow-card"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule bg-paper-deep/50">
                <th className="text-left py-4 px-4 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Product</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Price</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Real-time</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Never interrupts</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">AI grammar</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Any app</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Offline</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Smart mic</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Android</th>
                <th className="text-center py-4 px-3 text-[11px] tracking-caps uppercase font-semibold text-ink-faint">Legal mode</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => (
                <tr
                  key={c.name}
                  className={`border-b border-rule last:border-b-0 ${c.highlight ? "bg-brass-wash/40" : ""}`}
                >
                  <td className={`py-4 px-4 ${c.highlight ? "font-serif text-brass-deep" : "font-medium text-ink"}`}>
                    {c.name}
                  </td>
                  <td className="text-center py-4 px-3 font-mono text-[13px] text-ink-soft">{c.price}</td>
                  {[c.realtime, c.neverInterrupts, c.grammar, c.anyApp, c.offline, c.extMic, c.android, c.legalMode].map((val: boolean | string, i) => (
                    <td key={i} className="text-center py-4 px-3">
                      {val === "soon" ? (
                        <span className="text-[11px] text-ink-faint whitespace-nowrap">soon</span>
                      ) : val ? (
                        <Check className={`h-4 w-4 mx-auto ${c.highlight ? "text-brass" : "text-ink-soft"}`} aria-label="yes" />
                      ) : (
                        <span className="text-rule" aria-label="no">—</span>
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

function Pricing({ user, onSignIn }: { user: GoogleUser | null; onSignIn: (u: GoogleUser) => void }) {
  const login = useGoogleSignIn(onSignIn);
  const [checkoutNotice, setCheckoutNotice] = useState(false);

  const handleCta = async (priceId: string) => {
    if (!user) {
      login();
      return;
    }
    const redirected = await redirectToCheckout(priceId, user.email);
    if (!redirected) setCheckoutNotice(true);
  };
  const tiers = [
    {
      name: "Professional",
      tagline: "For daily dictation",
      price: "$29",
      period: "/month",
      features: [
        "Unlimited real-time dictation",
        "AI grammar (Claude / GPT-4o) — all AI costs included",
        "Types into any application",
        "Voice commands & smart formatting",
        "20+ languages, live translation",
        "macOS, Windows, Linux",
        "Optional BYOK (your own API keys)",
        "Priority email support",
      ],
      cta: "Start 14-day trial",
      highlight: false,
      badge: null as string | null,
      priceId: PRICE_PROFESSIONAL_MONTHLY as string | null,
      contact: false,
    },
    {
      name: "Privileged",
      tagline: "For privileged & confidential work",
      price: "$59",
      period: "/month",
      features: [
        "Everything in Professional",
        "Offline mode — on-device Whisper, audio never leaves your machine",
        "Client & matter billing with billable-time capture",
        "Clause library & voice-triggered templates",
        "Per-client vocabulary isolation",
        "Legal & accounting terminology packs",
        "Local-only learning (nothing synced)",
      ],
      cta: "Start 14-day trial",
      highlight: true,
      badge: "For the professions",
      priceId: PRICE_PRIVILEGED_MONTHLY as string | null,
      contact: false,
    },
    {
      name: "Firm",
      tagline: "Five seats or more",
      price: "$49",
      period: "/seat/month",
      features: [
        "Everything in Privileged, per seat",
        "Central billing & seat management",
        "Shared clause libraries across the firm",
        "Deployment & onboarding assistance",
        "Dedicated support",
      ],
      cta: "Enquire",
      highlight: false,
      badge: null as string | null,
      priceId: PRICE_FIRM_SEAT_MONTHLY as string | null,
      contact: true,
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-paper-deep/60">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead
          clause="§ 6"
          eyebrow="Schedule of fees"
          title="Priced against billable time."
          sub="A lawyer billing $400 an hour who saves twenty minutes a day recovers the annual fee in the first week. Every plan includes all AI costs — no API keys to manage."
        />

        {checkoutNotice && (
          <div className="mb-10 max-w-xl mx-auto p-4 rounded-md bg-brass-wash border border-brass/30 text-center">
            <p className="text-sm text-brass-deep font-medium">
              Payments are launching soon — join the waitlist below and we&rsquo;ll email you the moment checkout opens.
            </p>
          </div>
        )}

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start"
        >
          {tiers.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              className={`p-7 rounded-md bg-white relative ${
                t.highlight
                  ? "border-2 border-brass shadow-sheet"
                  : "border border-rule shadow-card"
              }`}
            >
              {t.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-sm bg-brass text-paper text-[10px] font-semibold tracking-caps uppercase whitespace-nowrap">
                  {t.badge}
                </div>
              )}
              <h3 className="font-serif text-xl text-ink mb-1">{t.name}</h3>
              <p className="text-xs text-ink-faint mb-6">{t.tagline}</p>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="font-mono text-[40px] leading-none text-ink">{t.price}</span>
                <span className="font-mono text-sm text-ink-faint">{t.period}</span>
              </div>
              <ul className="space-y-2.5 mb-7 border-t border-rule pt-5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-brass" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div>
                {t.contact ? (
                  <a
                    href="mailto:hello@voxlen.ai?subject=Firm%20plan%20enquiry"
                    className="block text-center h-11 leading-[42px] rounded-md text-sm font-semibold border border-rule text-ink hover:border-brass transition-colors"
                  >
                    {t.cta}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCta(t.priceId!)}
                    className={`w-full h-11 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                      t.highlight
                        ? "bg-brass text-paper hover:bg-brass-deep"
                        : "border border-rule text-ink hover:border-brass"
                    }`}
                  >
                    {!user ? "Sign in to begin" : t.cta}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-2 mt-8 text-xs text-ink-faint"
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Secure payment by <span className="text-ink-soft font-medium">Stripe</span> — your card details never touch our servers</span>
        </motion.div>

        <p className="text-center text-xs text-ink-faint mt-4 max-w-2xl mx-auto leading-relaxed">
          Professional and Privileged include a 14-day free trial. No credit card required; cancel
          anytime. Prefer your own API keys from Deepgram, OpenAI, or Anthropic? Bring-your-own-keys
          is fully supported. Your audio streams from your device to the AI providers — or, in
          offline mode, never leaves it at all.
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
      a: "No. Paid subscriptions include all AI costs — speech-to-text and grammar correction — so there are no API keys to manage. If you prefer to use your own keys from Deepgram, Anthropic, or OpenAI, that's fully supported as an optional alternative in Settings. Either way, your audio and text go directly from your device to the AI provider, never touching our servers.",
    },
    {
      q: "What platforms does it run on?",
      a: "The desktop app runs on macOS (Apple Silicon and Intel), Windows 10/11, and Linux. An iPhone/iPad keyboard is coming soon — join the waitlist to be notified when it ships. We will never lock features behind a specific OS.",
    },
    {
      q: "Do I need an internet connection?",
      a: "Not necessarily. Cloud dictation (Deepgram + grammar AI) requires a connection, but the Privileged plan includes a fully offline mode: download a local Whisper model inside the app and transcription runs entirely on your device — on a flight, in a secure facility, anywhere.",
    },
    {
      q: "Does it work with my external USB microphone?",
      a: "Yes. Voxlen auto-detects external mics (Razer, Blue Yeti, Rode, HyperX, etc.) and prioritizes them over your built-in laptop mic. You will get a warning if you are accidentally using the internal mic.",
    },
    {
      q: "Is my audio private? I handle privileged information.",
      a: "Yes. Your audio and transcripts are never stored on Voxlen-operated servers. Streaming dictation goes from your device to the speech provider on zero-retention endpoints and is discarded after transcription. And on the Privileged plan, offline mode means nothing leaves your device at all — transcription runs on your own hardware. For privileged work, that is the strongest guarantee any dictation product can make.",
    },
    {
      q: "Can my law firm or accounting practice get a team plan?",
      a: "Yes. The Firm plan ($49/seat/month, five seats or more) includes central billing, seat management, shared clause libraries, and onboarding assistance — designed specifically for law firms and accounting practices. Contact hello@voxlen.ai to arrange it.",
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHead clause="§ 7" eyebrow="Questions" title="Asked and answered." />

        <div className="bg-white border border-rule rounded-md shadow-card divide-y divide-rule">
          {faqs.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex items-center justify-between w-full p-5 text-left hover:bg-paper/60 transition-colors"
                aria-expanded={openIndex === i}
              >
                <span className="font-serif text-[15px] text-ink pr-4">{faq.q}</span>
                {openIndex === i ? (
                  <ChevronUp className="h-4 w-4 text-brass shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-ink-faint shrink-0" aria-hidden="true" />
                )}
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 -mt-1">
                  <p className="text-sm text-ink-soft leading-relaxed">{faq.a}</p>
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
const APP_VERSION = "1.1.0";

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
    // Native Apple Silicon browsers don't include "Intel" in their UA string
    if (/Intel/i.test(ua)) return "mac-intel";
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
    <section id="download" className="py-24 bg-paper-deep/60 relative">
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="font-mono text-brass text-sm mb-2">
            § 8
          </motion.p>
          <motion.p variants={fadeUp} className="text-[11px] font-semibold tracking-caps uppercase text-ink-faint mb-4">
            Execution
          </motion.p>
          <motion.h2 variants={fadeUp} className="font-display text-4xl md:text-5xl text-ink mb-4">
            Put it in writing.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg text-ink-soft mb-10">
            {hasRelease === false
              ? `Be first to know when Voxlen launches${platform !== "unknown" ? ` on ${platform === "mac-arm" || platform === "mac-intel" ? "Mac" : platform === "windows" ? "Windows" : platform === "linux" ? "Linux" : platform}` : ""}.`
              : "Free 14-day trial. No credit card. Under two minutes to first word."}
          </motion.p>

          {/* Primary auto-detected button — or early access if no release yet */}
          {hasRelease !== true ? (
            <motion.div variants={fadeUp} className="max-w-md mx-auto mb-10">
              <div className="p-6 rounded-md bg-white border border-rule shadow-card text-center">
                <div className="font-serif text-lg text-ink mb-2">Early access — join the waitlist</div>
                <p className="text-sm text-ink-soft mb-4">
                  We&rsquo;re putting the finishing touches on the first public build. Join the waitlist and be first to download when it launches.
                </p>
                <WaitlistForm platform="Desktop" />
                <p className="text-xs text-ink-faint mt-3">macOS, Windows, and Linux today. Mobile keyboards coming soon.</p>
              </div>
            </motion.div>
          ) : primary && hasRelease ? (
            <motion.div variants={fadeUp} className="flex justify-center mb-4">
              {user ? (
                <a
                  href={hrefFor(platform as Exclude<Platform, "unknown">)}
                  className="group h-16 px-9 rounded-md bg-brass text-paper font-semibold flex items-center gap-4 hover:bg-brass-deep transition-colors"
                >
                  <PrimaryIcon className="h-6 w-6" aria-hidden="true" />
                  <div className="text-left">
                    <div className="text-lg leading-tight">{primary.label}</div>
                    <div className="text-xs font-normal opacity-85">
                      {primary.subLabel} · {primary.size}
                    </div>
                  </div>
                  <Download className="h-5 w-5 opacity-80 group-hover:translate-y-0.5 transition-transform" aria-hidden="true" />
                </a>
              ) : (
                <button
                  onClick={() => login()}
                  className="group h-16 px-9 rounded-md bg-brass text-paper font-semibold flex items-center gap-4 hover:bg-brass-deep transition-colors"
                >
                  <PrimaryIcon className="h-6 w-6" aria-hidden="true" />
                  <div className="text-left">
                    <div className="text-lg leading-tight">Sign in to download</div>
                    <div className="text-xs font-normal opacity-85">Free — sign in with Google</div>
                  </div>
                  <Download className="h-5 w-5 opacity-80" aria-hidden="true" />
                </button>
              )}
            </motion.div>
          ) : null}

          <motion.p variants={fadeUp} className="font-mono text-xs text-ink-faint mb-12">
            Version {APP_VERSION} · Free to download · No credit card
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
              const platformLabel = d.label.replace("Download for ", "");
              if (hasRelease !== true) {
                return (
                  <motion.div
                    key={key}
                    variants={fadeUp}
                    className={`relative p-5 rounded-md bg-white border transition-colors ${
                      isDetected ? "border-brass" : "border-rule"
                    }`}
                  >
                    {isDetected && (
                      <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-sm bg-brass text-paper text-[10px] font-semibold uppercase tracking-caps">
                        Detected
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-sm bg-brass-wash border border-rule flex items-center justify-center text-brass">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-ink mb-1">{platformLabel}</div>
                    <div className="font-mono text-[11px] text-ink-faint mb-3">{d.subLabel}</div>
                    <p className="text-xs text-ink-soft mb-3">
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
                  className={`group relative p-5 rounded-md bg-white border transition-colors ${
                    isDetected ? "border-brass" : "border-rule hover:border-brass/50"
                  }`}
                >
                  {isDetected && (
                    <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-sm bg-brass text-paper text-[10px] font-semibold uppercase tracking-caps">
                      Detected
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-sm bg-brass-wash border border-rule flex items-center justify-center text-brass">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <Download className="h-4 w-4 text-ink-faint group-hover:text-brass group-hover:translate-y-0.5 transition-all" aria-hidden="true" />
                  </div>
                  <div className="text-sm font-semibold text-ink mb-1">{platformLabel}</div>
                  <div className="font-mono text-[11px] text-ink-faint mb-3">{d.subLabel}</div>
                  <div className="font-mono text-[10px] text-ink-faint">{d.size}</div>
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
          <div id="ios-waitlist" className="p-6 rounded-md bg-white border border-rule shadow-card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-sm bg-brass-wash border border-rule flex items-center justify-center shrink-0">
                <Apple className="h-6 w-6 text-brass" aria-hidden="true" />
              </div>
              <div>
                <div className="font-serif text-base text-ink">iPhone &amp; iPad keyboard</div>
                <div className="font-mono text-[11px] text-ink-faint">iOS 16+ — custom keyboard extension</div>
              </div>
            </div>
            <p className="text-sm text-ink-soft">Nova-3 streaming dictation with AI grammar correction. Works in every iOS app — iMessage, WhatsApp, Mail, legal apps. 20+ languages.</p>
            <WaitlistForm platform="iOS" />
          </div>
          {/* Android */}
          <div id="android-waitlist" className="p-6 rounded-md bg-white border border-rule shadow-card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-sm bg-paper-deep border border-rule flex items-center justify-center shrink-0">
                <Smartphone className="h-6 w-6 text-ink-soft" aria-hidden="true" />
              </div>
              <div>
                <div className="font-serif text-base text-ink">Android / Samsung keyboard</div>
                <div className="font-mono text-[11px] text-ink-faint">Android 10+ — Samsung Galaxy optimised</div>
              </div>
            </div>
            <p className="text-sm text-ink-soft">Full custom Android keyboard with Nova-3 dictation and AI grammar polish. Galaxy S, Z Fold, and all Android devices. Join the waitlist for early access.</p>
            <WaitlistForm platform="Android" />
          </div>
        </motion.div>

        {/* Checksums / integrity footer */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-8 text-center text-xs text-ink-faint"
        >
          <a
            href="https://github.com/ccantynz-alt/voxlen/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brass transition-colors"
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
  const [status, setStatus] = useState<"idle" | "invalid" | "submitting" | "submitted" | "failed">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setStatus("invalid"); return; }
    setStatus("submitting");
    // Keep a localStorage copy as a backup regardless of network outcome
    try {
      type WaitlistEntry = { email: string; platform: string };
      const unified = JSON.parse(localStorage.getItem("voxlen_waitlist") || "[]") as WaitlistEntry[];
      if (!unified.some((e) => e.email === trimmed && e.platform === platform)) {
        unified.push({ email: trimmed, platform });
        localStorage.setItem("voxlen_waitlist", JSON.stringify(unified));
      }
    } catch { /* ignore */ }
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, platform }),
      });
      if (!res.ok) throw new Error(`Waitlist API ${res.status}`);
      setStatus("submitted");
    } catch {
      setStatus("failed");
    }
  };

  if (status === "submitted") {
    return (
      <div className="flex items-center gap-2 text-sm text-brass-deep font-medium">
        <Check className="h-4 w-4" aria-hidden="true" /> You&rsquo;re on the {platform} waitlist — we&rsquo;ll email you at launch.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
          placeholder="your@email.com"
          disabled={status === "submitting"}
          className={`flex-1 min-w-0 h-9 px-3 rounded-md bg-paper border text-sm text-ink placeholder:text-ink-faint focus:outline-none transition-colors disabled:opacity-60 ${status === "invalid" || status === "failed" ? "border-redline focus:border-redline" : "border-rule focus:border-brass"}`}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="h-9 px-4 rounded-md bg-brass text-paper text-sm font-semibold hover:bg-brass-deep transition-colors shrink-0 disabled:opacity-60 disabled:cursor-wait"
        >
          {status === "submitting" ? "Adding…" : status === "failed" ? "Retry" : "Notify me"}
        </button>
      </form>
      {status === "invalid" && (
        <p className="text-xs text-redline">Please enter a valid email address.</p>
      )}
      {status === "failed" && (
        <p className="text-xs text-redline">Couldn&rsquo;t reach the waitlist server — please try again. Your email is saved locally in the meantime.</p>
      )}
    </div>
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
    <footer className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="rule-double pt-10" />

        {/* Letterhead block */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-10 mb-10 border-b border-rule">
          <div>
            <div className="flex items-baseline gap-2.5 mb-2">
              <span className="font-display text-2xl text-ink tracking-tight">
                Vox<span className="italic text-brass">len</span>
              </span>
              <span className="font-mono text-[11px] text-ink-faint">v{APP_VERSION}</span>
            </div>
            <p className="text-xs text-ink-soft max-w-xs leading-relaxed">
              Dictation crafted for legal and accounting professionals. On-device
              privacy. Billable-time precision.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] tracking-caps uppercase text-ink-faint">
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3 text-brass" aria-hidden="true" /> Local-first storage</span>
            <span className="flex items-center gap-1.5"><Lock className="h-3 w-3 text-brass" aria-hidden="true" /> GDPR compliant</span>
            <span className="flex items-center gap-1.5"><Cpu className="h-3 w-3 text-brass" aria-hidden="true" /> On-device mode</span>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 mb-10 border-b border-rule">
          {FOOTER_LINKS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-[11px] font-semibold text-ink tracking-caps uppercase mb-3">{col.heading}</h4>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-xs text-ink-soft hover:text-brass transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ink-faint">
            &copy; {new Date().getFullYear()} Voxlen. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-soft">
            <button onClick={() => onOpenLegal("privacy")} className="hover:text-brass transition-colors">Privacy Policy</button>
            <button onClick={() => onOpenLegal("terms")} className="hover:text-brass transition-colors">Terms of Service</button>
            <a href="/support" className="hover:text-brass transition-colors">Support</a>
            <a href="mailto:hello@voxlen.ai" className="hover:text-brass transition-colors">hello@voxlen.ai</a>
            <a href="https://github.com/ccantynz-alt/voxlen" target="_blank" rel="noopener noreferrer" className="hover:text-brass transition-colors">GitHub</a>
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
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white border border-rule p-8 md:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-paper-deep hover:bg-paper-deep flex items-center justify-center text-ink-soft hover:text-ink transition-colors"
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
      <p className="text-xs text-ink-soft">Last updated: April 2026</p>

      <p className="text-ink-soft leading-relaxed">
        Voxlen ("we", "us", "our") is committed to protecting your privacy. This policy explains
        how our voice dictation application handles your data. We designed Voxlen with
        privacy-first principles, especially for professionals handling sensitive information.
      </p>

      <h2 className="text-lg font-bold mt-8">1. Data We Do NOT Collect</h2>
      <ul className="text-ink-soft space-y-2 list-disc pl-5">
        <li><strong className="text-ink">Audio recordings</strong> — We never store, log, or retain your voice audio.</li>
        <li><strong className="text-ink">Dictation content</strong> — We never store your dictated or grammar-corrected text. Local session history remains on your device.</li>
        <li><strong className="text-ink">Cloud processing</strong> — Included AI uses Voxlen-provisioned providers through the voxlen.ai proxy with zero content retention. Optional BYOK requests go directly from your device to your selected provider.</li>
        <li><strong className="text-ink">Documents or files</strong> — Voxlen never reads, scans, or accesses any files on your device beyond its own configuration.</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">2. Data Processing Architecture</h2>
      <p className="text-ink-soft leading-relaxed">
        Plans include all AI processing costs. By default, Voxlen provisions the relevant providers
        and routes requests through the voxlen.ai proxy solely to authenticate and relay them for
        zero-content-retention processing. Voxlen does not persist, train on, or otherwise retain
        dictation content. You may optionally use your own provider keys instead:
      </p>
      <ul className="text-ink-soft space-y-2 list-disc pl-5">
        <li><strong className="text-ink">Included cloud AI:</strong> Audio and text pass through the voxlen.ai proxy to the applicable provider under zero-content-retention controls. Voxlen never stores the content.</li>
        <li><strong className="text-ink">Optional BYOK:</strong> If you supply your own Deepgram, OpenAI, or Anthropic key, requests for that provider are sent directly from your device and are governed by your agreement and settings with that provider.</li>
        <li><strong className="text-ink">Privileged Mode:</strong> On-device Whisper transcription, local grammar rules, and Qwen3-4B processing run fully on your machine. Nothing leaves the machine.</li>
        <li><strong className="text-ink">Text Injection:</strong> All text injection happens locally via OS-level APIs. No network transmission involved.</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">3. Confidentiality for Legal &amp; Accounting Professionals</h2>
      <p className="text-ink-soft leading-relaxed">
        We understand that attorneys, accountants, and other professionals using Voxlen may handle
        privileged or confidential information. Voxlen is designed to respect these obligations:
      </p>
      <ul className="text-ink-soft space-y-2 list-disc pl-5">
        <li>Voxlen never stores dictation content; the proxy relays cloud requests without content retention</li>
        <li>Session history is stored only on your local device and never synced to our infrastructure</li>
        <li>Custom vocabulary and dictionaries remain local to your device</li>
        <li>Voxlen-provisioned AI processing uses zero-content-retention controls</li>
        <li>Privileged plan users can use per-matter / per-client vocabulary and billing tools</li>
        <li>Privileged Mode processes transcription and grammar on-device with zero external content transmission</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">4. Analytics &amp; Telemetry</h2>
      <p className="text-ink-soft leading-relaxed">
        Voxlen collects minimal, anonymous usage telemetry to improve the product:
      </p>
      <ul className="text-ink-soft space-y-2 list-disc pl-5">
        <li>Application launch and feature usage counts (no content)</li>
        <li>Crash reports with stack traces (no user content)</li>
        <li>OS platform and app version</li>
      </ul>
      <p className="text-ink-soft leading-relaxed">
        You can disable all telemetry in Settings &gt; Privacy. When disabled, zero data is transmitted.
      </p>

      <h2 className="text-lg font-bold mt-8">5. Third-Party Services</h2>
      <p className="text-ink-soft leading-relaxed">
        Voxlen includes AI costs as part of every paid plan. For included cloud AI, the voxlen.ai
        proxy relays audio or text to the applicable provider under zero-content-retention controls:
      </p>
      <ul className="text-ink-soft space-y-2 list-disc pl-5">
        <li>Deepgram — processes audio for transcription</li>
        <li>OpenAI — processes audio (Whisper) or text (grammar correction)</li>
        <li>Anthropic — processes text for grammar correction</li>
      </ul>
      <p className="text-ink-soft leading-relaxed">
        Voxlen never stores dictation content. BYOK is optional: users who supply their own
        Deepgram, OpenAI, or Anthropic credentials connect directly from their device and control
        those provider accounts. Privileged Mode uses only local models and sends no content off-device.
      </p>

      <h2 className="text-lg font-bold mt-8">6. Contact</h2>
      <p className="text-ink-soft leading-relaxed">
        For privacy inquiries, contact us at <a href="mailto:privacy@voxlen.ai" className="text-brass hover:underline">privacy@voxlen.ai</a>.
      </p>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="max-w-none space-y-6">
      <h1 className="text-2xl font-black">Terms of Service</h1>
      <p className="text-xs text-ink-soft">Last updated: April 2026</p>

      <p className="text-ink-soft leading-relaxed">
        By downloading or using Voxlen, you agree to these terms. Please read them carefully.
      </p>

      <h2 className="text-lg font-bold mt-8">1. Service Description</h2>
      <p className="text-ink-soft leading-relaxed">
        Voxlen is a desktop application (with mobile keyboards in development) that provides voice-to-text dictation with
        AI-powered grammar correction and universal text injection. The application runs locally
        on your device and connects to third-party AI providers through zero-retention
        endpoints included with your subscription.
      </p>

      <h2 className="text-lg font-bold mt-8">2. AI Services &amp; Third-Party Providers</h2>
      <p className="text-ink-soft leading-relaxed">
        Paid plans include all AI infrastructure (speech-to-text and grammar correction) as part of
        your subscription. You do not need to provide your own API keys. Audio streams directly
        through the voxlen.ai proxy to the relevant providers under zero-content-retention controls.
        Voxlen never stores dictation content. Advanced users may optionally supply their own
        Deepgram, OpenAI, or Anthropic keys for direct device-to-provider requests. Privileged Mode
        runs fully on-device and sends no content off the machine.
      </p>

      <h2 className="text-lg font-bold mt-8">3. Subscription Plans</h2>
      <p className="text-ink-soft leading-relaxed">
        Voxlen offers Professional ($29/month), Privileged ($59/month), and Firm
        ($49 per seat/month, for 5 or more seats) plans. Professional includes unlimited dictation,
        AI grammar, and optional BYOK. Privileged adds offline on-device Whisper, on-device grammar,
        client/matter billing, and the clause library. Firm includes Privileged features per seat.
        All plans include AI costs. Subscriptions can be cancelled at any time. A 14-day free trial
        is available with no credit card required.
      </p>

      <h2 className="text-lg font-bold mt-8">4. Acceptable Use</h2>
      <p className="text-ink-soft leading-relaxed">You agree not to:</p>
      <ul className="text-ink-soft space-y-2 list-disc pl-5">
        <li>Reverse-engineer, decompile, or disassemble the application</li>
        <li>Use the application for any unlawful purpose</li>
        <li>Redistribute, sublicense, or resell the application</li>
        <li>Attempt to bypass subscription or usage limitations</li>
      </ul>

      <h2 className="text-lg font-bold mt-8">5. Intellectual Property</h2>
      <p className="text-ink-soft leading-relaxed">
        Voxlen and its original content, features, and functionality are owned by Voxlen and are
        protected by international copyright and trademark laws. Your transcribed content remains
        entirely yours — we claim no rights over content you create using Voxlen.
      </p>

      <h2 className="text-lg font-bold mt-8">6. Disclaimer of Warranties</h2>
      <p className="text-ink-soft leading-relaxed">
        Voxlen is provided "as is" without warranties of any kind. We do not guarantee that
        transcriptions or grammar corrections will be error-free. You should review all output,
        especially for legal, medical, or financial documents.
      </p>

      <h2 className="text-lg font-bold mt-8">7. Limitation of Liability</h2>
      <p className="text-ink-soft leading-relaxed">
        Voxlen shall not be liable for any indirect, incidental, special, consequential, or punitive
        damages resulting from your use of the application, including but not limited to errors in
        transcription or grammar correction.
      </p>

      <h2 className="text-lg font-bold mt-8">8. Changes to Terms</h2>
      <p className="text-ink-soft leading-relaxed">
        We may update these terms from time to time. Continued use of Voxlen after changes
        constitutes acceptance of the new terms. We will notify users of significant changes
        through the application.
      </p>

      <h2 className="text-lg font-bold mt-8">9. Contact</h2>
      <p className="text-ink-soft leading-relaxed">
        For questions about these terms, contact us at <a href="mailto:legal@voxlen.ai" className="text-brass hover:underline">legal@voxlen.ai</a>.
      </p>
    </div>
  );
}

function LegalPage({ type }: { type: "privacy" | "terms" }) {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <div className="border-b border-rule bg-paper-deep/60">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-brass flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-ink" />
            </div>
            <span className="font-bold tracking-tight">Voxlen</span>
          </a>
          <span className="text-ink-faint">/</span>
          <span className="text-ink-soft text-sm capitalize">{type === "privacy" ? "Privacy Policy" : "Terms of Service"}</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
        <div className="mt-12 pt-6 border-t border-rule flex gap-6 text-sm text-ink-soft">
          <a href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-ink transition-colors">Terms of Service</a>
          <a href="/support" className="hover:text-ink transition-colors">Support</a>
          <a href="/" className="hover:text-ink transition-colors ml-auto">← Back to Voxlen</a>
        </div>
      </div>
    </div>
  );
}

function SupportPage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <div className="border-b border-rule bg-paper-deep/60">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-brass flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-ink" />
            </div>
            <span className="font-bold tracking-tight">Voxlen</span>
          </a>
          <span className="text-ink-faint">/</span>
          <span className="text-ink-soft text-sm">Support</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-black mb-2">Support</h1>
          <p className="text-ink-soft">We're here to help. Reach out through any of the channels below.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:support@voxlen.ai"
            className="block p-6 rounded-2xl border border-rule bg-white hover:bg-white/[0.05] transition-colors group"
          >
            <div className="text-lg font-bold mb-1 group-hover:text-brass transition-colors">Email Support</div>
            <p className="text-ink-soft text-sm mb-3">General help, billing questions, and account issues.</p>
            <span className="text-brass text-sm font-medium">support@voxlen.ai →</span>
          </a>
          <a
            href="mailto:legal@voxlen.ai"
            className="block p-6 rounded-2xl border border-rule bg-white hover:bg-white/[0.05] transition-colors group"
          >
            <div className="text-lg font-bold mb-1 group-hover:text-brass transition-colors">Legal &amp; Privacy</div>
            <p className="text-ink-soft text-sm mb-3">Terms, privacy policy, and data handling enquiries.</p>
            <span className="text-brass text-sm font-medium">legal@voxlen.ai →</span>
          </a>
        </div>

        <div className="rounded-2xl border border-rule bg-white p-6 space-y-5">
          <h2 className="text-lg font-bold">Frequently Asked Questions</h2>
          {[
            {
              q: "Do I need API keys?",
              a: "No. All AI costs (Deepgram transcription and Claude grammar correction) are included in your subscription — no API keys to manage. Just sign in and speak. Advanced users who prefer their own keys can optionally add them in Settings → API Keys; keys are stored securely on your device and never sent to Voxlen servers.",
            },
            {
              q: "When will the iPhone and iPad keyboard be available?",
              a: "It is coming soon. Join the waitlist and we will notify you when the keyboard ships.",
            },
            {
              q: "How do I cancel my subscription?",
              a: "Your subscription is managed through Stripe. Email support@voxlen.ai with your account email and we'll process the cancellation same-day. You keep access until the end of your billing period.",
            },
            {
              q: "Is my dictated text private?",
              a: "Yes. Voxlen never stores your audio or transcripts — requests pass through the voxlen.ai proxy to AI providers under zero-content-retention controls, and nothing is retained. Session history is stored on your device only.",
            },
            {
              q: "Can I use Voxlen for privileged client communications?",
              a: "Yes. All session history and custom vocabulary is stored on your device only. Audio streams over zero-retention endpoints — nothing is stored by Voxlen or its providers. Privileged Mode is available now and runs fully on-device, so nothing leaves the machine.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="border-t border-rule pt-4 first:border-0 first:pt-0">
              <p className="font-semibold text-ink mb-1">{q}</p>
              <p className="text-ink-soft text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-rule flex gap-6 text-sm text-ink-soft">
          <a href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-ink transition-colors">Terms of Service</a>
          <a href="/" className="hover:text-ink transition-colors ml-auto">← Back to Voxlen</a>
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

  useEffect(() => {
    const prev = document.title;
    document.title = `${title} | Voxlen`;
    return () => { document.title = prev; };
  }, [title]);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      {/* Nav */}
      <div className="border-b border-rule bg-paper/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-brass flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-ink" />
            </div>
            <span className="font-bold text-sm tracking-tight">Voxlen</span>
          </a>
          <a href="/#pricing" className="px-4 py-1.5 rounded-lg bg-brass text-ink text-sm font-semibold hover:bg-brass-deep transition-colors">
            Get Started
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="mb-16">
          <p className="text-brass text-sm font-semibold uppercase tracking-wider mb-4">Voxlen</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-5 leading-tight">{headline}</h1>
          <p className="text-xl text-ink-soft mb-8 leading-relaxed">{subheadline}</p>
          <div className="flex flex-wrap gap-3">
            <a href="/#download" className="px-6 py-3 rounded-xl bg-brass text-ink font-semibold hover:bg-brass-deep transition-colors">
              Download Free
            </a>
            <button
              onClick={() => login()}
              className="px-6 py-3 rounded-xl border border-rule text-ink font-semibold hover:bg-paper-deep transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="mb-14">
          <p className="text-ink-soft text-lg leading-relaxed">{description}</p>
        </div>

        {/* Bullets */}
        <div className="mb-16 rounded-2xl border border-rule bg-white p-8">
          <h2 className="text-xl font-bold mb-6">{cta}</h2>
          <ul className="space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-ink-soft">
                <Check className="h-4 w-4 text-brass mt-0.5 shrink-0" />
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
              <div key={q} className="border-t border-rule pt-5">
                <h3 className="font-semibold text-ink mb-2">{q}</h3>
                <p className="text-ink-soft text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer nav */}
        <div className="pt-8 border-t border-rule flex gap-6 text-sm text-ink-soft">
          <a href="/" className="hover:text-ink transition-colors">← Voxlen Home</a>
          <a href="/#pricing" className="hover:text-ink transition-colors">Pricing</a>
          <a href="/privacy" className="hover:text-ink transition-colors">Privacy</a>
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
      { q: "Is Voxlen safe for privileged client communications?", a: "Yes. Audio streams directly from your device to the speech-to-text provider over zero-retention endpoints. Voxlen does not store or access your audio or transcripts. Fully offline mode is available now on the Privileged desktop plan." },
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
      "macOS, Windows, and Linux — iPhone and iPad keyboard coming soon (join the waitlist)",
      "Fraction of the cost of Dragon Legal ($700+)",
    ],
    faq: [
      { q: "How does Voxlen compare to Dragon Legal?", a: "Voxlen is faster to set up (no voice training), works on any app without plugins, costs less, and has AI grammar correction Dragon doesn't offer. Like Dragon, Voxlen dictates fully offline — on-device Whisper is included in the Privileged plan." },
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
      "Windows meeting capture with speaker diarization",
      "Zero-retention endpoints — client data never stored",
      "iPhone and iPad keyboard coming soon — join the waitlist",
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
      "Windows meeting capture with speaker diarization",
      "iPhone and iPad keyboard coming soon — join the waitlist",
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
    headline: "Voice Dictation Keyboard for iPhone — Coming Soon",
    subheadline: "Join the waitlist for the Voxlen keyboard for iPhone and iPad.",
    description: "The Voxlen iPhone and iPad keyboard is in development and has not shipped yet. Join the waitlist to be notified when it becomes available.",
    cta: "What the Voxlen iPhone keyboard will include",
    bullets: [
      "Planned custom keyboard for iOS 16+ (iPhone and iPad)",
      "Designed for apps including iMessage, WhatsApp, Mail, and legal apps",
      "Planned inline dictation and AI grammar polish",
      "App Store listing coming soon — join the waitlist",
    ],
    faq: [
      { q: "How do I install the Voxlen keyboard?", a: "Download Voxlen from the App Store (coming soon), then go to Settings → General → Keyboard → Add New Keyboard and select Voxlen." },
      { q: "Does it work offline?", a: "The iPhone and iPad keyboard is not yet shipped; join the waitlist. Offline Privileged Mode is available now in the desktop app." },
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
      "iPhone keyboard coming soon — join the waitlist for dictating on iPhone in court or on the move",
    ],
    faq: [
      { q: "Is Voxlen GDPR compliant?", a: "Yes. Included cloud processing is relayed through the voxlen.ai proxy under zero-content-retention controls. Voxlen never stores dictation content; optional BYOK requests go directly from your device to the selected provider." },
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
      "Subscription from $29/mo vs Dragon Legal's $700 one-time licence (plus paid version upgrades)",
      "AI grammar correction Dragon doesn't have",
      "Works on macOS, Windows, and Linux (Dragon is Windows-only for latest versions)",
      "iPhone and iPad keyboard coming soon — join the waitlist",
      "No hardware lock-in — runs on any machine with your account",
      "Fully offline dictation on the Privileged plan — matching Dragon's traditional advantage",
    ],
    faq: [
      { q: "Is Voxlen as accurate as Dragon?", a: "Deepgram Nova-3 matches Dragon's accuracy for most use cases without any voice training. Dragon can edge ahead in very noisy environments — but Voxlen's noise gate and high-pass filter substantially close this gap." },
      { q: "What does Dragon have that Voxlen doesn't?", a: "Dragon has deeper macro/scripting features for power users and a longer track record with legal IT departments. Offline dictation is no longer a differentiator — Voxlen's Privileged plan runs Whisper entirely on-device." },
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
      "Windows meeting capture with speaker diarization",
      "iPhone and iPad keyboard coming soon — join the waitlist",
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
      "iPhone keyboard coming soon — join the waitlist for dictating in any iPhone app",
    ],
    faq: [
      { q: "Can I use both Otter and Voxlen?", a: "Yes — they serve different purposes. Use Otter for recording and transcribing meetings. Use Voxlen for active dictation while drafting documents, emails, and notes." },
      { q: "Does Voxlen record meetings?", a: "Yes, on Windows. Voxlen provides bot-free meeting capture and transcription on Windows; a macOS meeting-capture backend is not available today." },
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
      "iPhone and iPad keyboard coming soon — join the waitlist",
      "Custom vocabulary, voice commands, translation",
      "Cloud-based — works on any machine with your account",
    ],
    faq: [
      { q: "Will I lose accuracy switching from Dragon?", a: "Most users find Deepgram Nova-3 matches or exceeds Dragon's accuracy — especially for legal terminology — without any training period." },
      { q: "Can I import my Dragon vocabulary?", a: "Voxlen does not currently provide a Dragon vocabulary import tool. You can maintain per-client custom vocabulary for important names and terms." },
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
      "Desktop support — macOS, Windows, and Linux; mobile keyboards are coming soon",
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
      "iPhone and iPad keyboard coming soon — join the waitlist for AI dictation on iPhone and iPad",
    ],
    faq: [
      { q: "What AI models does Voxlen use?", a: "Voxlen uses Deepgram Nova-3 for real-time speech-to-text (the most accurate STT model available) and Claude by Anthropic for AI grammar correction." },
      { q: "Does the AI change what I said?", a: "Only grammar, punctuation, and spelling — never substance. With Preserve Tone enabled, Voxlen only fixes errors and never rephrases or rewrites your content." },
    ],
  },
};
