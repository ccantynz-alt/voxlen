import type { DictationEvent, VoxlenConfig } from "./types";

/**
 * Voice dictation engine.
 * Uses Web Speech API (free, built into browsers) as default.
 * Upgrades to Deepgram WebSocket streaming when a Deepgram API key is provided.
 */
export class VoxlenDictation {
  private config: VoxlenConfig;
  private recognition: SpeechRecognition | null = null;
  private deepgramWs: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private isListening = false;

  constructor(config: VoxlenConfig) {
    this.config = config;
  }

  /** Start listening for voice input */
  async start(): Promise<void> {
    if (this.isListening) return;

    if (this.config.deepgramApiKey) {
      await this.startDeepgram();
    } else {
      this.startWebSpeech();
    }

    this.isListening = true;
  }

  /** Stop listening */
  stop(): void {
    if (!this.isListening) return;

    // Flip first so async handlers (onend, onopen) see we've stopped.
    this.isListening = false;

    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      try {
        rec.stop();
      } catch {
        // stop() throws if recognition is already stopped — safe to ignore.
      }
    }

    this.teardownAudioGraph();

    if (this.deepgramWs) {
      const ws = this.deepgramWs;
      this.deepgramWs = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "CloseStream" }));
        }
      } catch {
        // Ignore send failures during teardown.
      }
      ws.close();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  get listening(): boolean {
    return this.isListening;
  }

  // ---------- Web Speech API (free, no API key needed) ----------

  private startWebSpeech(): void {
    const Ctor =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;

    if (!Ctor) {
      this.config.onError?.(new Error("Web Speech API not supported in this browser"));
      return;
    }

    const rec = new Ctor();
    this.recognition = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.config.language || "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;

        this.config.onTranscript?.({
          text: transcript,
          isFinal,
          confidence: result[0].confidence || 0.85,
        });
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        this.config.onError?.(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    rec.onend = () => {
      // Only restart if still listening AND this handler still belongs to the
      // active recognition instance (stop() clears this.recognition).
      if (this.isListening && this.recognition === rec) {
        try {
          rec.start();
        } catch {
          // Already started or in an invalid state — nothing to do.
        }
      }
    };

    rec.start();
  }

  // ---------- Deepgram WebSocket (premium, requires API key) ----------

  private async startDeepgram(): Promise<void> {
    const apiKey = this.config.deepgramApiKey!;
    const lang = this.config.language || "en-US";

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", "nova-2");
    url.searchParams.set("language", lang);
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("utterance_end_ms", "1500");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("channels", "1");

    const ws = new WebSocket(url.toString(), ["token", apiKey]);
    this.deepgramWs = ws;

    ws.onopen = () => {
      if (!this.isListening || this.deepgramWs !== ws || !this.mediaStream) {
        ws.close();
        return;
      }

      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(this.mediaStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      this.audioContext = audioContext;
      this.audioSource = source;
      this.audioProcessor = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const clamped = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        ws.send(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    };

    ws.onmessage = (event) => {
      let data: {
        type?: string;
        is_final?: boolean;
        channel?: {
          alternatives?: Array<{ transcript?: string; confidence?: number }>;
          detected_language?: string;
        };
      };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === "Results") {
        const alt = data.channel?.alternatives?.[0];
        if (alt?.transcript) {
          const dictEvent: DictationEvent = {
            text: alt.transcript,
            isFinal: data.is_final || false,
            confidence: alt.confidence || 0.9,
            language: data.channel?.detected_language,
          };
          this.config.onTranscript?.(dictEvent);
        }
      }
    };

    ws.onerror = () => {
      this.config.onError?.(new Error("Deepgram WebSocket connection failed"));
      // Release mic + audio nodes even if the connection never opened.
      this.teardownAudioGraph();
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop());
        this.mediaStream = null;
      }
      this.isListening = false;
    };

    ws.onclose = () => {
      if (this.deepgramWs === ws) {
        this.deepgramWs = null;
      }
      this.teardownAudioGraph();
    };
  }

  private teardownAudioGraph(): void {
    if (this.audioProcessor) {
      try {
        this.audioProcessor.disconnect();
      } catch {
        // Already disconnected.
      }
      this.audioProcessor.onaudioprocess = null;
      this.audioProcessor = null;
    }
    if (this.audioSource) {
      try {
        this.audioSource.disconnect();
      } catch {
        // Already disconnected.
      }
      this.audioSource = null;
    }
    if (this.audioContext) {
      const ctx = this.audioContext;
      this.audioContext = null;
      ctx.close().catch(() => {
        // Ignore close errors; context may already be closed.
      });
    }
  }
}
