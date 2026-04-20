/**
 * FAQ entries rendered on the landing page. Strings are pre-split so no
 * individual source line exceeds the project's 200-char lint budget.
 */
export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    q: "How is this different from Windows+H or Apple Dictation?",
    a:
      "Those stop working the moment you switch apps or click somewhere else. " +
      "Voxlen runs as a background service — it NEVER gets interrupted. " +
      "Plus, it has AI grammar correction, works with your external mic, " +
      "and supports 20+ languages.",
  },
  {
    q: "Why is this better than Grammarly?",
    a:
      "Grammarly is a typing-focused tool that killed their voice features — " +
      "and their grammar engine is weaker than the frontier AI models we use. " +
      "Voxlen is built on Claude, the most capable language AI available, and " +
      "combines real-time dictation with grammar correction in a single product. " +
      "It is more advanced and more accurate, and it works everywhere you type — " +
      "not just inside Grammarly's browser extension.",
  },
  {
    q: "Do I need to set up API keys or separate accounts?",
    a:
      "No. Everything is included. Your subscription covers all the AI " +
      "infrastructure — speech-to-text, grammar correction, all of it. " +
      "Download, sign in, speak. There is nothing else to configure. " +
      "(Advanced users can optionally plug in their own API keys if they " +
      "prefer — but 99% of users will never need to.)",
  },
  {
    q: "What platforms does it run on?",
    a:
      "Everything. macOS (Apple Silicon and Intel), Windows 10/11, Linux, " +
      "iOS (keyboard extension), and Android (keyboard extension). " +
      "Your subscription covers every device you use. We will never lock " +
      "features behind a specific OS.",
  },
  {
    q: "Do I need an internet connection?",
    a:
      "Not always. Voxlen includes a fully offline mode that runs entirely on " +
      "your device — ideal for flights or sensitive work. Our cloud models give " +
      "higher accuracy and lower latency, but you always have the choice.",
  },
  {
    q: "Does it work with my external USB microphone?",
    a:
      "Yes. Voxlen auto-detects external mics (Razer, Blue Yeti, Rode, HyperX, " +
      "etc.) and prioritizes them over your built-in laptop mic. You will get a " +
      "warning if you are accidentally using the internal mic.",
  },
  {
    q: "Is my audio private? I handle privileged information.",
    a:
      "Yes. Even though we provide the AI infrastructure as part of your " +
      "subscription, your audio and transcripts are NEVER routed through or " +
      "stored on Voxlen-operated servers. Audio streams directly from your " +
      "device to the AI provider using zero-retention endpoints and is " +
      "discarded immediately after transcription. On the Professional plan, " +
      "we enable the strictest zero-retention guarantees from every AI provider. " +
      "Offline mode means nothing leaves your device at all. This is a hard " +
      "architectural rule we will never compromise.",
  },
  {
    q: "Can my firm get a team plan?",
    a:
      "Yes. The Professional plan includes SSO, team management, and " +
      "per-client / per-matter vocabulary isolation — designed specifically " +
      "for law firms and accounting practices. Contact us for firm-wide pricing.",
  },
];
