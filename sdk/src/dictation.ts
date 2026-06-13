import type { DictationEvent, VoxlenConfig } from "./types";

/**
 * Voice dictation engine.
 * Routes through Voxlen API when voxlenApiKey is provided (preferred).
 * Falls back to Deepgram WebSocket streaming when a deepgramApiKey is provided.
 * Final fallback: Web Speech API (free, built into browsers).
 */
export class VoxlenDictation {
  private config: VoxlenConfig;
  private recognition: SpeechRecognition | null = null;
  private deepgramWs: WebSocket | null = null;
  private deepgramAudioContext: AudioContext | null = null;
  private deepgramProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isListening = false;
  private stopVoxlenStream: (() => void) | null = null;

  constructor(config: VoxlenConfig) {
    this.config = config;
  }

  /** Start listening for voice input */
  async start(): Promise<void> {
    if (this.isListening) return;

    if (this.config.voxlenApiKey) {
      await this.startVoxlenStream();
    } else if (this.config.deepgramApiKey) {
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

    if (this.deepgramProcessor) {
      this.deepgramProcessor.disconnect();
      this.deepgramProcessor = null;
    }

    if (this.deepgramAudioContext) {
      this.deepgramAudioContext.close();
      this.deepgramAudioContext = null;
    }

    if (this.stopVoxlenStream) {
      this.stopVoxlenStream();
      this.stopVoxlenStream = null;
    }

    const recorder = (this as any)._recorder as MediaRecorder | undefined;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      (this as any)._recorder = null;
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

    const rec = new SpeechRecognition();
    this.recognition = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.config.language || "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
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

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        this.config.onError?.(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    rec.onend = () => {
      if (this.isListening && this.recognition) {
        this.recognition.start();
      }
    };

    rec.start();
  }

  // ---------- Deepgram WebSocket (fallback, requires deepgramApiKey) ----------

  private async startDeepgram(): Promise<void> {
    const apiKey = this.config.deepgramApiKey!;
    const lang = this.config.language || "en-US";

    // Get microphone stream
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    // Connect to Deepgram
    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", "nova-3");
    url.searchParams.set("language", lang);
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("utterance_end_ms", "1000");
    url.searchParams.set("no_delay", "true");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("channels", "1");

    this.deepgramWs = new WebSocket(url.toString(), ["token", apiKey]);

    this.deepgramWs.onopen = () => {
      // Start streaming audio
      this.deepgramAudioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.deepgramAudioContext.createMediaStreamSource(this.mediaStream!);
      this.deepgramProcessor = this.deepgramAudioContext.createScriptProcessor(4096, 1, 1);

      this.deepgramProcessor.onaudioprocess = (e) => {
        if (this.deepgramWs?.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const clamped = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        this.deepgramWs!.send(int16.buffer);
      };

      source.connect(this.deepgramProcessor);
      this.deepgramProcessor.connect(this.deepgramAudioContext.destination);
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

  // ---------- Voxlen API streaming (primary, requires voxlenApiKey) ----------

  private async startVoxlenStream(): Promise<void> {
    const { VoxlenApiClient } = await import("./api-client");
    const client = new VoxlenApiClient({
      voxlenApiKey: this.config.voxlenApiKey!,
      voxlenApiBase: this.config.voxlenApiBase,
      tenantId: this.config.tenantId,
    });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    // Buffer audio chunks and stream to Voxlen API
    const audioChunks: Blob[] = [];
    const recorder = new MediaRecorder(this.mediaStream, { mimeType: "audio/webm" });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
        // Stream accumulated audio
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        this.stopVoxlenStream?.();
        this.stopVoxlenStream = client.streamTranscribe(
          blob,
          (chunk) => {
            if (chunk.text) {
              this.config.onTranscript?.({
                text: chunk.text,
                isFinal: chunk.is_final,
                confidence: 0.95,
                segmentIndex: chunk.segment_index,
              });
            }
          },
          (err) => this.config.onError?.(err)
        );
      }
    };

    recorder.start(500); // 500ms chunks
    (this as any)._recorder = recorder;
  }
}
