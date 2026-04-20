import { VoxlenDictation } from "./dictation";
import { VoxlenGrammar } from "./grammar";
import type { VoxlenConfig, DictationEvent } from "./types";

type InsertionRef =
  | { kind: "input"; element: HTMLInputElement | HTMLTextAreaElement; start: number; length: number }
  | { kind: "node"; node: Text };

const SVG_ATTRS =
  'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const MIC_ICON_SVG =
  `<svg ${SVG_ATTRS}>` +
  '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>' +
  '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
  '<line x1="12" x2="12" y1="19" y2="22"/>' +
  "</svg>";

const STOP_ICON_SVG =
  `<svg ${SVG_ATTRS}><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

/**
 * Voxlen Web SDK — main entry point.
 *
 * Provides voice dictation + AI grammar correction for any web text input.
 * Designed for integration with the AlecRae.com Email Client.
 *
 * @example
 * ```ts
 * const voxlen = new VoxlenSDK({
 *   grammarApiKey: 'sk-ant-...',
 *   writingStyle: 'professional',
 * });
 *
 * // Attach to any textarea or contenteditable element
 * voxlen.attachTo(document.querySelector('#email-compose'));
 *
 * // Or use programmatically
 * voxlen.startDictation();
 * voxlen.on('transcript', (e) => handleTranscript(e.text));
 * ```
 */
export class VoxlenSDK {
  private config: VoxlenConfig;
  private dictation: VoxlenDictation;
  private grammar: VoxlenGrammar;
  private targetElement: HTMLElement | null = null;
  private micButton: HTMLButtonElement | null = null;
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  constructor(config: VoxlenConfig = {}) {
    this.config = {
      language: "en-US",
      writingStyle: "professional",
      autoCorrect: false,
      buttonPosition: "top-right",
      ...config,
      onTranscript: (event) => {
        this.handleTranscript(event);
        config.onTranscript?.(event);
      },
      onError: (error) => {
        this.emit("error", error);
        config.onError?.(error);
      },
    };

    this.dictation = new VoxlenDictation(this.config);
    this.grammar = new VoxlenGrammar(this.config);
  }

  /**
   * Attach Voxlen to a text input element.
   * Adds a floating mic button and wires up dictation + grammar.
   */
  attachTo(element: HTMLElement): void {
    this.targetElement = element;
    this.createMicButton(element);
  }

  /** Detach from the current element and clean up */
  detach(): void {
    this.stop();
    if (this.micButton) {
      this.micButton.remove();
      this.micButton = null;
    }
    this.targetElement = null;
  }

  /** Start voice dictation */
  async startDictation(): Promise<void> {
    await this.dictation.start();
    this.updateButtonState(true);
    this.emit("dictation-start");
  }

  /** Stop voice dictation */
  stop(): void {
    this.dictation.stop();
    this.updateButtonState(false);
    this.emit("dictation-stop");
  }

  /** Correct grammar for the given text (or current element content) */
  async correctGrammar(text?: string): Promise<string> {
    const input = text || this.getElementText();
    if (!input) return "";

    const result = await this.grammar.correct(input);
    this.emit("grammar-result", result);
    this.config.onGrammarResult?.(result);
    return result.corrected;
  }

  /** Check if currently listening */
  get isListening(): boolean {
    return this.dictation.listening;
  }

  /** Register an event listener */
  on(event: string, callback: (...args: any[]) => void): void {
    const list = this.listeners.get(event) || [];
    list.push(callback);
    this.listeners.set(event, list);
  }

  /** Remove an event listener */
  off(event: string, callback: (...args: any[]) => void): void {
    const list = this.listeners.get(event) || [];
    this.listeners.set(event, list.filter((cb) => cb !== callback));
  }

  // ---------- Private ----------

  private emit(event: string, ...args: any[]): void {
    const list = this.listeners.get(event) || [];
    for (const cb of list) cb(...args);
  }

  private handleTranscript(event: DictationEvent): void {
    if (!event.isFinal) {
      this.emit("partial-transcript", event);
      return;
    }

    this.emit("transcript", event);

    let insertion: InsertionRef | null = null;
    if (this.targetElement) {
      insertion = this.insertText(event.text + " ");
    }

    if (this.config.autoCorrect && (this.config.grammarApiKey || this.config.openaiApiKey)) {
      this.grammar
        .correct(event.text)
        .then((result) => {
          if (result.corrected !== event.text && insertion) {
            this.replaceInsertion(insertion, result.corrected + " ");
          }
          this.emit("grammar-result", result);
        })
        .catch((err) => this.emit("error", err));
    }
  }

  private insertText(text: string): InsertionRef | null {
    if (!this.targetElement) return null;

    if (
      this.targetElement instanceof HTMLTextAreaElement ||
      this.targetElement instanceof HTMLInputElement
    ) {
      const el = this.targetElement;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      el.value = el.value.substring(0, start) + text + el.value.substring(end);
      el.selectionStart = el.selectionEnd = start + text.length;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return { kind: "input", element: el, start, length: text.length };
    }

    if (this.targetElement.contentEditable === "true") {
      const node = document.createTextNode(text);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.collapse(false);
      } else {
        this.targetElement.appendChild(node);
      }
      this.targetElement.dispatchEvent(new Event("input", { bubbles: true }));
      return { kind: "node", node };
    }

    return null;
  }

  private replaceInsertion(insertion: InsertionRef, replacement: string): void {
    if (!this.targetElement) return;

    if (insertion.kind === "input") {
      const el = insertion.element;
      if (el !== this.targetElement || !el.isConnected) return;
      const { start, length } = insertion;
      if (start + length > el.value.length) return;
      const before = el.value.substring(0, start);
      const after = el.value.substring(start + length);
      el.value = before + replacement + after;
      el.selectionStart = el.selectionEnd = start + replacement.length;
      insertion.length = replacement.length;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    // contenteditable: the original text node is still a reliable anchor.
    const { node } = insertion;
    if (!node.isConnected) return;
    node.nodeValue = replacement;
    this.targetElement.dispatchEvent(new Event("input", { bubbles: true }));
  }

  private getElementText(): string {
    if (!this.targetElement) return "";
    if (
      this.targetElement instanceof HTMLTextAreaElement ||
      this.targetElement instanceof HTMLInputElement
    ) {
      return this.targetElement.value;
    }
    return this.targetElement.textContent || "";
  }

  private createMicButton(element: HTMLElement): void {
    if (!element.isConnected) {
      this.emit("error", new Error("Target element is not in the DOM"));
      return;
    }

    const parent = element.parentElement;
    if (parent && parent.isConnected) {
      const position = getComputedStyle(parent).position;
      if (position === "static") {
        parent.style.position = "relative";
      }
    }

    this.micButton = document.createElement("button");
    this.micButton.type = "button";
    this.micButton.setAttribute("aria-label", "Toggle Voxlen voice dictation");
    this.micButton.innerHTML = MIC_ICON_SVG;

    // Positioning
    const pos = this.config.buttonPosition || "top-right";
    Object.assign(this.micButton.style, {
      position: "absolute",
      zIndex: "9999",
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      border: "1px solid #d4d4d8",
      backgroundColor: "#ffffff",
      color: "#3366ff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      transition: "all 0.15s ease",
      ...(pos.includes("top") ? { top: "8px" } : { bottom: "8px" }),
      ...(pos.includes("right") ? { right: "8px" } : { left: "8px" }),
    });

    if (this.config.buttonClassName) {
      this.micButton.className = this.config.buttonClassName;
    }

    this.micButton.addEventListener("click", () => {
      if (this.isListening) {
        this.stop();
      } else {
        this.startDictation();
      }
    });

    if (parent && parent.isConnected) {
      parent.appendChild(this.micButton);
    } else {
      element.appendChild(this.micButton);
    }
  }

  private updateButtonState(listening: boolean): void {
    if (!this.micButton) return;

    if (listening) {
      this.micButton.style.backgroundColor = "#ef4444";
      this.micButton.style.color = "#ffffff";
      this.micButton.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.3)";
      this.micButton.innerHTML = STOP_ICON_SVG;
    } else {
      this.micButton.style.backgroundColor = "#ffffff";
      this.micButton.style.color = "#3366ff";
      this.micButton.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
      this.micButton.innerHTML = MIC_ICON_SVG;
    }
  }
}
