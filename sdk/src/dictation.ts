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

    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    if (this.deepgramWs) {
      this.deepgramWs.send(JSON.stringify({ type: "CloseStream" }));
      this.deepgramWs.close();
      this.deepgramWs = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    this.isListening = false;
  }

  get listening(): boolean {
    return this.isListening;
  }

  // ---------- Web Speech API (free, no API key needed) ----------

  private startWebSpeech(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.config.onError?.(new Error("Web Speech API not supported in this browser"));
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.config.language || "en-US";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;

        const dictEvent: DictationEvent = {
          text: transcript,
          isFinal,
          confidence: result[0].confidence || 0.85,
        };

        this.config.onTranscript?.(dictEvent);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        this.config.onError?.(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if still supposed to be listening (Web Speech stops after silence)
      if (this.isListening && this.recognition) {
        this.recognition.start();
      }
    };

    this.recognition.start();
  }

  // ---------- Deepgram WebSocket (premium, requires API key) ----------

  private async startDeepgram(): Promise<void> {
    const apiKey = this.config.deepgramApiKey!;
    const lang = this.config.language || "en-US";

    // Get microphone stream
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    // Connect to Deepgram
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

    this.deepgramWs = new WebSocket(url.toString(), ["token", apiKey]);

    this.deepgramWs.onopen = () => {
      // Start streaming audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(this.mediaStream!);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (this.deepgramWs?.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const clamped = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        this.deepgramWs!.send(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    };

    this.deepgramWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
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

    this.deepgramWs.onerror = () => {
      this.config.onError?.(new Error("Deepgram WebSocket connection failed"));
    };
  }
}
