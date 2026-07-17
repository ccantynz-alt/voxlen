import type { DictationEvent, VoxlenConfig } from "./types";
import { warnBrowserKeyUse } from "./browser-key-warning";

/**
 * Voice dictation engine.
 * Routes through Voxlen API when voxlenKey is provided (preferred).
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
    this.isListening = true; // set eagerly to prevent concurrent start() calls

    try {
      if (this.config.voxlenKey) {
        await this.startVoxlenStream();
      } else if (this.config.deepgramApiKey) {
        await this.startDeepgram();
      } else {
        this.startWebSpeech();
      }
    } catch (err) {
      this.isListening = false;
      throw err;
    }
  }

  /** Stop listening */
  stop(): void {
    if (!this.isListening) return;

    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    if (this.deepgramWs) {
      if (this.deepgramWs.readyState === WebSocket.OPEN) {
        this.deepgramWs.send(JSON.stringify({ type: "CloseStream" }));
      }
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
      // We never actually started listening — reset state before surfacing the
      // error, otherwise `listening` stays true and stop()/start() misbehave.
      this.isListening = false;
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
      if (event.error === "no-speech") return; // transient — onend will restart

      // Fatal errors mean recognition cannot continue; clear listening state so
      // onend doesn't restart in a permission-denied loop.
      const fatal =
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture";
      if (fatal) {
        this.isListening = false;
        this.recognition = null;
      }
      this.config.onError?.(new Error(`Speech recognition error: ${event.error}`));
    };

    rec.onend = () => {
      if (this.isListening && this.recognition) {
        this.recognition.start();
      }
    };

    rec.start();
  }

  // ---------- Deepgram WebSocket (fallback, requires deepgramApiKey) ----------

  private async startDeepgram(apiKey = this.config.deepgramApiKey!, warn = true): Promise<void> {
    const lang = this.config.language || "en-US";

    // The key is sent as a WebSocket subprotocol — visible to anyone inspecting
    // the page. Trusted environments only; warn once so integrators know.
    if (warn) warnBrowserKeyUse("deepgram");

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
        try {
          this.deepgramWs!.send(int16.buffer);
        } catch {
          // WebSocket closed between readyState check and send — harmless
        }
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
      // Connection failed — tear everything down (media stream, audio context,
      // processor) and clear isListening so SDK state matches reality.
      this.stop();
      this.config.onError?.(new Error("Deepgram WebSocket connection failed"));
    };
  }

  // ---------- Voxlen API streaming (primary, requires voxlenKey) ----------

  private async startVoxlenStream(): Promise<void> {
    const { VoxlenApiClient } = await import("./api-client");
    const client = new VoxlenApiClient({
      voxlenKey: this.config.voxlenKey!,
      voxlenApiBase: this.config.voxlenApiBase,
    });

    const token = await client.getDeepgramToken();
    await this.startDeepgram(token.key, false);
    return;

    /* Legacy implementation removed in 0.2.0.

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    // INTERIM DESIGN — replace when the Voxlen WebSocket streaming endpoint ships.
    // The old REST streaming design accepted a complete blob,
    // so "streaming" here means periodically re-uploading the full accumulated
    // audio (O(n^2) total bytes). To bound the damage until a true WS stream
    // exists we (a) upload every 3s instead of 500ms and (b) cap the session at
    // MAX_INTERIM_UPLOADS re-uploads (~60s of audio, matching the sync
    // transcription limit). Longer recordings should use transcribeFile() /
    // file transcription instead.
    const INTERIM_UPLOAD_MS = 3000;
    const MAX_INTERIM_UPLOADS = 20; // 20 * 3s = ~60s session cap

    const audioChunks: Blob[] = [];
    let uploadCount = 0;
    const recorder = new MediaRecorder(this.mediaStream, { mimeType: "audio/webm" });

    recorder.ondataavailable = (e) => {
      // Ignore the final flush after stop() — nothing should be uploaded then.
      if (!this.isListening || e.data.size === 0) return;

      audioChunks.push(e.data);
      uploadCount++;

      if (uploadCount > MAX_INTERIM_UPLOADS) {
        // Session cap reached: stop capture instead of re-uploading unbounded
        // audio quadratically. stop() sets isListening=false, so the recorder's
        // final dataavailable event is ignored above.
        this.stop();
        this.config.onError?.(
          new Error(
            `Voxlen live-streaming session limit reached (~${(MAX_INTERIM_UPLOADS * INTERIM_UPLOAD_MS) / 1000}s). ` +
              "Restart dictation, or use transcribeFile() for longer recordings."
          )
        );
        return;
      }

      // Re-upload the full accumulated audio (see INTERIM DESIGN note above).
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
    };

    recorder.start(INTERIM_UPLOAD_MS);
    (this as any)._recorder = recorder;
    */
  }
}
