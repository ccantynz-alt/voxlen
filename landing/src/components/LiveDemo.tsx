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

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript((prev) => prev + final || interim);
    };

    rec.onend = () => {
      if (state === "listening") {
        setState("processing");
        setTimeout(() => {
          // Use the demo correction since we have no auth token here
          const phrase = DEMO_PHRASES[demoIndex % DEMO_PHRASES.length];
          setCorrected(phrase.corrected);
          setState("done");
        }, 800);
      }
    };

    rec.onerror = () => { setState("idle"); };
    rec.start();
  }, [hasSTT, useRealSTT, runSimulatedDemo, state, demoIndex]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (state === "listening") {
      setState("processing");
      setTimeout(() => {
        const phrase = DEMO_PHRASES[demoIndex % DEMO_PHRASES.length];
        setCorrected(phrase.corrected);
        setState("done");
      }, 800);
    }
  }, [state, demoIndex]);

  const reset = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setState("idle");
    setTranscript("");
    setCorrected("");
    setDemoIndex((i) => i + 1);
  }, []);

  return (
    <section id="live-demo" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-marcoreid-600/10 border border-marcoreid-600/20 text-marcoreid-400 text-xs font-medium mb-4">
            <Play className="h-3 w-3" />
            Live Demo — No account needed
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Try it right now
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Watch AI grammar correction transform raw dictation into polished legal prose in real-time.
          </p>
        </motion.div>

        {/* Demo card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-[#111114] border border-white/10 overflow-hidden shadow-2xl"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#0c0c0f] border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <div className="w-4 h-4 rounded bg-marcoreid-600 flex items-center justify-center">
                  <Mic className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="font-medium text-zinc-300">Voxlen</span>
                <span className="text-zinc-600">— Dictation</span>
              </div>
            </div>
            <AnimatePresence>
              {state === "listening" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20"
                >
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-red-400 text-xs font-medium">Listening</span>
                </motion.div>
              )}
              {state === "processing" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-marcoreid-600/10 border border-marcoreid-600/20"
                >
                  <Sparkles className="h-3 w-3 text-marcoreid-400 animate-pulse" />
                  <span className="text-marcoreid-400 text-xs font-medium">AI correcting…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-6 min-h-[280px]">
            {/* Waveform */}
            <div className="flex items-center justify-center gap-[3px] h-10">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 rounded-full ${state === "listening" ? "bg-marcoreid-500" : "bg-white/10"}`}
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
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 min-h-[100px]">
                <div className="text-[10px] font-mono text-zinc-600 mb-2 uppercase tracking-wider">Raw dictation</div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {transcript || (
                    <span className="text-zinc-600 italic">
                      {state === "idle"
                        ? "Your words will appear here…"
                        : "Listening for speech…"}
                    </span>
                  )}
                  {state === "listening" && transcript && (
                    <span className="inline-block w-0.5 h-3.5 bg-marcoreid-400 ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </p>
              </div>

              {/* Corrected */}
              <div className="rounded-xl bg-marcoreid-600/5 border border-marcoreid-600/15 p-4 min-h-[100px]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3 w-3 text-marcoreid-400" />
                  <span className="text-[10px] font-mono text-marcoreid-500 uppercase tracking-wider">AI-corrected</span>
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed">
                  {correctedDisplayed || (
                    <span className="text-zinc-600 italic">
                      {state === "processing" ? (
                        <span className="text-marcoreid-400">Applying grammar correction…</span>
                      ) : (
                        "Polished output will appear here…"
                      )}
                    </span>
                  )}
                  {state === "done" && correctedDisplayed.length < corrected.length && (
                    <span className="inline-block w-0.5 h-3.5 bg-marcoreid-400 ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </p>
              </div>
            </div>

            {/* What got fixed */}
            <AnimatePresence>
              {state === "done" && (
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
                      className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium"
                    >
                      ✓ {tag}
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
                      className="h-11 px-6 rounded-xl bg-marcoreid-600 text-white font-semibold flex items-center gap-2 hover:bg-marcoreid-700 transition-all shadow-lg shadow-marcoreid-600/25 hover:scale-[1.02]"
                    >
                      <Play className="h-4 w-4" />
                      Watch demo
                    </button>
                    {hasSTT && (
                      <button
                        onClick={() => { setUseRealSTT(true); startListening(); }}
                        className="h-11 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-medium flex items-center gap-2 hover:bg-white/10 transition-all"
                      >
                        <Mic className="h-4 w-4" />
                        Use my microphone
                      </button>
                    )}
                  </>
                )}
                {state === "listening" && useRealSTT && (
                  <button
                    onClick={stopListening}
                    className="h-11 px-6 rounded-xl bg-red-600/90 text-white font-semibold flex items-center gap-2 hover:bg-red-600 transition-all animate-pulse"
                  >
                    <MicOff className="h-4 w-4" />
                    Stop recording
                  </button>
                )}
                {(state === "done" || state === "processing") && (
                  <button
                    onClick={reset}
                    className="h-11 px-6 rounded-xl bg-white/5 border border-white/10 text-white font-medium flex items-center gap-2 hover:bg-white/10 transition-all"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Try another
                  </button>
                )}
              </div>

              {state === "done" && (
                <motion.a
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  href="#download"
                  className="h-11 px-6 rounded-xl bg-marcoreid-600 text-white font-semibold flex items-center gap-2 hover:bg-marcoreid-700 transition-all shadow-lg shadow-marcoreid-600/25"
                >
                  Get the app
                  <span className="text-marcoreid-300 text-sm">→</span>
                </motion.a>
              )}
            </div>
          </div>
        </motion.div>

        {/* Fine print */}
        <p className="text-center text-xs text-zinc-600 mt-4">
          Demo uses simulated AI correction. The real app applies Claude AI grammar correction instantly to every sentence.
          {hasSTT && " Microphone mode uses your browser's built-in speech recognition."}
        </p>
      </div>
    </section>
  );
}
