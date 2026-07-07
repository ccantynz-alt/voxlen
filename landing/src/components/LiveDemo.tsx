import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles, RotateCcw, Play } from "lucide-react";

const DEMO_PHRASES = [
  {
    raw: "the plaintiff alleged that defendant breached the contract by failing to deliver goods on the agreed upon date of january fifteen two thousand twenty four",
    corrected: "The plaintiff alleged that the defendant breached the contract by failing to deliver goods on the agreed-upon date of January 15, 2024.",
  },
  {
    raw: "i advised my client that pursuant to section four of the partnership agreement they are entitled to thirty percent of all distributable profits for fiscal year twenty twenty three",
    corrected: "I advised my client that, pursuant to Section 4 of the Partnership Agreement, they are entitled to thirty percent (30%) of all distributable profits for fiscal year 2023.",
  },
  {
    raw: "the deposition revealed that the witness had no recollection of the meeting that took place on march third despite the contemporaneous email chain",
    corrected: "The deposition revealed that the witness had no recollection of the meeting that took place on March 3rd, despite the contemporaneous email chain.",
  },
  {
    raw: "the company reported ebitda of four point two million for the quarter representing a twelve percent improvement over the prior year period after adjusting for one off restructuring charges",
    corrected: "The company reported EBITDA of $4.2 million for the quarter, representing a 12% improvement over the prior year period after adjusting for one-off restructuring charges.",
  },
  {
    raw: "pursuant to rule ten b five of the securities exchange act of nineteen thirty four we recommend the board adopt a written trading policy prohibiting insider transactions during blackout periods",
    corrected: "Pursuant to Rule 10b-5 of the Securities Exchange Act of 1934, we recommend the board adopt a written trading policy prohibiting insider transactions during blackout periods.",
  },
];

type DemoState = "idle" | "listening" | "processing" | "done";

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

function useTypewriter(text: string, speed = 18, enabled = false) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!enabled || !text) { setDisplayed(""); return; }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, enabled]);
  return displayed;
}

export default function LiveDemo() {
  const [state, setState] = useState<DemoState>("idle");
  const [transcript, setTranscript] = useState("");
  const [corrected, setCorrected] = useState("");
  const [demoIndex, setDemoIndex] = useState(0);
  const [useRealSTT, setUseRealSTT] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const hasSTT = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const correctedDisplayed = useTypewriter(corrected, 14, state === "done");

  const runSimulatedDemo = useCallback(() => {
    const phrase = DEMO_PHRASES[demoIndex % DEMO_PHRASES.length];
    setState("listening");
    setTranscript("");
    setCorrected("");

    // Simulate typing transcript
    let i = 0;
    const words = phrase.raw.split(" ");
    const id = setInterval(() => {
      i++;
      setTranscript(words.slice(0, i).join(" "));
      if (i >= words.length) {
        clearInterval(id);
        setTimeout(() => {
          setState("processing");
          setTimeout(() => {
            setCorrected(phrase.corrected);
            setState("done");
          }, 900);
        }, 400);
      }
    }, 80);
  }, [demoIndex]);

  const startListening = useCallback(() => {
    if (!hasSTT || !useRealSTT) { runSimulatedDemo(); return; }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { runSimulatedDemo(); return; }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recognitionRef.current = rec;

    setState("listening");
    setTranscript("");
    setCorrected("");
    finalTranscriptRef.current = "";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscriptRef.current += t;
        else interim += t;
      }
      setTranscript(finalTranscriptRef.current + interim);
    };

    // Mic mode is honest: we show only your real transcript. The AI grammar
    // correction runs in the full app — we never fake a correction of real speech.
    rec.onend = () => {
      setState((s) => (s === "listening" ? "done" : s));
    };

    rec.onerror = () => { setState("idle"); };
    rec.start();
  }, [hasSTT, useRealSTT, runSimulatedDemo]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState((s) => (s === "listening" ? "done" : s));
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    finalTranscriptRef.current = "";
    setUseRealSTT(false);
    setState("idle");
    setTranscript("");
    setCorrected("");
    setDemoIndex((i) => i + 1);
  }, []);

  return (
    <section id="live-demo" className="py-24 px-6 bg-paper">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 uppercase tracking-[0.18em] text-[11px] font-sans font-semibold text-brass mb-4">
            <Play className="h-3 w-3" aria-hidden="true" />
            Live Demonstration — No Account Needed
          </div>
          <h2 className="font-display text-4xl md:text-5xl tracking-tight text-ink mb-4">
            Try it right now
          </h2>
          <p className="font-sans text-ink-soft text-lg max-w-xl mx-auto">
            Watch AI grammar correction transform raw dictation into polished legal prose in real-time.
          </p>
        </motion.div>

        {/* Demo card — a sheet of paper */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="rounded-md bg-white border border-rule overflow-hidden shadow-[0_1px_3px_rgba(29,26,21,0.06)]"
        >
          {/* Letterhead bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-paper-deep border-b border-rule">
            <div className="flex items-center gap-2 text-xs text-ink-soft">
              <div className="w-4 h-4 rounded-sm bg-brass flex items-center justify-center">
                <Mic className="h-2.5 w-2.5 text-paper" aria-hidden="true" />
              </div>
              <span className="font-sans font-semibold text-ink">Voxlen</span>
              <span className="font-mono text-ink-soft">— Dictation</span>
            </div>
            <AnimatePresence>
              {state === "listening" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-sm border border-rule bg-white"
                >
                  <div className="w-2 h-2 rounded-full bg-brass animate-pulse motion-reduce:animate-none" />
                  <span className="font-mono text-ink text-xs">Listening</span>
                </motion.div>
              )}
              {state === "processing" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-sm border border-rule bg-white"
                >
                  <Sparkles className="h-3 w-3 text-brass animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                  <span className="font-mono text-brass text-xs">AI correcting…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-6 min-h-[280px]">
            {/* Waveform */}
            <div className="flex items-center justify-center gap-[3px] h-10" aria-hidden="true">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 rounded-full ${state === "listening" ? "bg-brass" : "bg-rule"}`}
                  animate={
                    state === "listening"
                      ? {
                          height: [
                            `${6 + Math.sin(i * 0.5) * 8}px`,
                            `${6 + Math.sin(i * 0.5 + 1) * 18}px`,
                            `${6 + Math.sin(i * 0.5) * 8}px`,
                          ],
                        }
                      : { height: "4px" }
                  }
                  transition={
                    state === "listening"
                      ? { duration: 0.6 + (i % 5) * 0.1, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                />
              ))}
            </div>

            {/* Transcript panels */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Raw transcript */}
              <div className="rounded-md bg-paper border border-rule p-4 min-h-[100px]">
                <div className="text-[10px] font-mono text-ink-soft mb-2 uppercase tracking-wider">Raw dictation</div>
                <p className="font-mono text-sm text-ink-soft leading-relaxed">
                  {transcript || (
                    <span className="italic text-ink-soft/60">
                      {state === "idle"
                        ? "Your words will appear here…"
                        : "Listening for speech…"}
                    </span>
                  )}
                  {state === "listening" && transcript && (
                    <span className="inline-block w-0.5 h-3.5 bg-brass ml-0.5 animate-pulse motion-reduce:animate-none align-text-bottom" />
                  )}
                </p>
              </div>

              {/* Corrected */}
              <div className="rounded-md bg-white border border-brass/40 p-4 min-h-[100px]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3 w-3 text-brass" aria-hidden="true" />
                  <span className="text-[10px] font-mono text-brass uppercase tracking-wider">AI-corrected</span>
                </div>
                <p className="font-mono text-sm text-ink leading-relaxed">
                  {correctedDisplayed || (
                    <span className="italic text-ink-soft/60">
                      {state === "processing" ? (
                        <span className="text-brass">Applying grammar correction…</span>
                      ) : state === "done" && useRealSTT ? (
                        "AI grammar correction runs in the full app — this browser demo shows only your raw transcript. Download Voxlen to see Claude polish your real dictation."
                      ) : (
                        "Polished output will appear here…"
                      )}
                    </span>
                  )}
                  {state === "done" && correctedDisplayed.length < corrected.length && (
                    <span className="inline-block w-0.5 h-3.5 bg-brass ml-0.5 animate-pulse motion-reduce:animate-none align-text-bottom" />
                  )}
                </p>
              </div>
            </div>

            {/* What got fixed */}
            <AnimatePresence>
              {state === "done" && corrected && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  {[
                    "Capitalisation",
                    "Punctuation",
                    "Number formatting",
                    "Legal citations",
                    "Sentence structure",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-sm bg-paper-deep border border-rule text-ink-soft text-xs font-sans font-medium"
                    >
                      <span className="text-brass">✓</span> {tag}
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                {state === "idle" && (
                  <>
                    <button
                      onClick={runSimulatedDemo}
                      className="h-11 px-6 rounded-md bg-brass text-paper font-sans font-semibold flex items-center gap-2 hover:bg-brass-deep transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Watch demo
                    </button>
                    {hasSTT && (
                      <button
                        onClick={() => { setUseRealSTT(true); startListening(); }}
                        className="h-11 px-6 rounded-md border border-rule text-ink font-sans font-medium flex items-center gap-2 hover:border-brass transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        <Mic className="h-4 w-4" aria-hidden="true" />
                        Use my microphone
                      </button>
                    )}
                  </>
                )}
                {state === "listening" && useRealSTT && (
                  <button
                    onClick={stopListening}
                    className="h-11 px-6 rounded-md bg-brass text-paper font-sans font-semibold flex items-center gap-2 hover:bg-brass-deep transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <MicOff className="h-4 w-4" aria-hidden="true" />
                    Stop recording
                  </button>
                )}
                {(state === "done" || state === "processing") && (
                  <button
                    onClick={reset}
                    className="h-11 px-6 rounded-md border border-rule text-ink font-sans font-medium flex items-center gap-2 hover:border-brass transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Try another
                  </button>
                )}
              </div>

              {state === "done" && (
                <motion.a
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  href="#download"
                  className="h-11 px-6 rounded-md bg-brass text-paper font-sans font-semibold flex items-center gap-2 hover:bg-brass-deep transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Get the app
                  <span className="text-sm" aria-hidden="true">→</span>
                </motion.a>
              )}
            </div>
          </div>
        </motion.div>

        {/* Fine print */}
        <p className="text-center text-xs font-sans text-ink-soft mt-4">
          "Watch demo" plays example phrases with a simulated correction. The real app applies Claude AI grammar correction instantly to every sentence.
          {hasSTT && " Microphone mode uses your browser's built-in speech recognition and shows your raw transcript only — no simulated correction."}
        </p>
      </div>
    </section>
  );
}
