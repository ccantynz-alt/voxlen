/* Voxlen Word add-in taskpane.
 * Dictation streams mic audio to Deepgram via a short-lived token from the
 * Voxlen relay (mirrors sdk/src/dictation.ts startDeepgram). Polish sends the
 * Word selection through POST /api/grammar. No content is stored anywhere.
 * Hand-written ES2020 — no build step; served statically from voxlen.ai.
 */
"use strict";

const API_BASE = "https://www.voxlen.ai/api";
const KEY_STORAGE = "voxlen.word.key";

// ---------- DOM ----------
const el = (id) => document.getElementById(id);
const keySection = el("key-section");
const keyInput = el("key-input");
const keySave = el("key-save");
const keyStatus = el("key-status");
const accountBar = el("account-bar");
const accountLabel = el("account-label");
const keyChange = el("key-change");
const dictateSection = el("dictate-section");
const micButton = el("mic-button");
const micLabel = el("mic-label");
const interimBox = el("interim");
const polishSection = el("polish-section");
const polishButton = el("polish-button");
const polishResult = el("polish-result");
const polishBefore = el("polish-before");
const polishAfter = el("polish-after");
const statusLine = el("status-line");

// ---------- State ----------
let voxlenKey = null;
let officeReady = false;

function setStatus(message, kind) {
  statusLine.textContent = message || "";
  statusLine.className = "status" + (kind ? " " + kind : "");
}

function authHeader() {
  return { Authorization: "Bearer " + voxlenKey };
}

// ---------- Office bootstrap ----------
Office.onReady((info) => {
  officeReady = info.host === Office.HostType.Word;
  if (!officeReady) {
    setStatus("This pane must run inside Microsoft Word.", "error");
    micButton.disabled = true;
    polishButton.disabled = true;
    return;
  }
  const stored = localStorage.getItem(KEY_STORAGE);
  if (stored) {
    voxlenKey = stored;
    validateKey(stored, /* fromStorage */ true);
  }
});

// ---------- Key setup ----------
keySave.addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "Paste your Voxlen account key first.";
    keyStatus.className = "status error";
    return;
  }
  validateKey(key, false);
});

keyChange.addEventListener("click", () => {
  stopDictation();
  voxlenKey = null;
  localStorage.removeItem(KEY_STORAGE);
  keyInput.value = "";
  showKeyUi();
});

async function validateKey(key, fromStorage) {
  keyStatus.textContent = "Checking key…";
  keyStatus.className = "status";
  keySave.disabled = true;
  try {
    const res = await fetch(API_BASE + "/me", {
      headers: { Authorization: "Bearer " + key },
    });
    if (res.status === 401) {
      throw new Error(fromStorage
        ? "Your saved key is no longer valid. Copy a fresh key from voxlen.ai/dashboard."
        : "That key was rejected. Copy a fresh key from voxlen.ai/dashboard.");
    }
    if (!res.ok) throw new Error("Voxlen API error (" + res.status + "). Try again shortly.");
    const me = await res.json();
    voxlenKey = key;
    localStorage.setItem(KEY_STORAGE, key);
    showSignedInUi(me);
  } catch (err) {
    voxlenKey = null;
    localStorage.removeItem(KEY_STORAGE);
    showKeyUi();
    keyStatus.textContent = err instanceof TypeError
      ? "Could not reach voxlen.ai — check your connection."
      : err.message;
    keyStatus.className = "status error";
  } finally {
    keySave.disabled = false;
  }
}

function showSignedInUi(me) {
  keySection.hidden = true;
  accountBar.hidden = false;
  accountLabel.textContent = (me.email || "Signed in") + " · " + (me.plan || "free") + " plan";
  dictateSection.hidden = false;
  polishSection.hidden = false;
  keyStatus.textContent = "";
  setStatus("");
}

function showKeyUi() {
  keySection.hidden = false;
  accountBar.hidden = true;
  dictateSection.hidden = true;
  polishSection.hidden = true;
  keyStatus.textContent = "";
  setStatus("");
}

// ---------- Word document insertion ----------
// Serialize Word.run calls so rapid final transcripts insert in order.
let insertChain = Promise.resolve();

function insertAtCursor(text) {
  insertChain = insertChain
    .then(() =>
      Word.run(async (context) => {
        context.document.getSelection().insertText(text + " ", Word.InsertLocation.end);
        await context.sync();
      })
    )
    .catch((err) => {
      console.error("Word insert failed", err);
      setStatus("Could not insert text into the document: " + (err.message || err), "error");
    });
  return insertChain;
}

// ---------- Dictation (mirrors sdk/src/dictation.ts startDeepgram) ----------
let isListening = false;
let deepgramWs = null;
let deepgramAudioContext = null;
let deepgramProcessor = null;
let mediaStream = null;

micButton.addEventListener("click", () => {
  if (isListening) {
    stopDictation();
    setStatus("Dictation stopped.");
  } else {
    startDictation();
  }
});

async function startDictation() {
  if (isListening || !voxlenKey) return;
  isListening = true; // set eagerly to prevent concurrent starts
  setMicUi(true, "Connecting…");
  setStatus("");

  try {
    // 1. Exchange the Voxlen key for a short-lived (30s TTL) Deepgram token.
    const tokenRes = await fetch(API_BASE + "/deepgram-token", {
      method: "POST",
      headers: authHeader(),
    });
    if (tokenRes.status === 401) throw new Error("Your Voxlen key was rejected. Re-enter it via “Change key”.");
    if (tokenRes.status === 402) {
      const body = await tokenRes.json().catch(() => ({}));
      throw new Error(body.error || "Your plan does not include dictation. Upgrade at voxlen.ai/dashboard.");
    }
    if (!tokenRes.ok) throw new Error("Speech service unavailable (" + tokenRes.status + "). Try again shortly.");
    const { key: tempKey } = await tokenRes.json();
    if (!tempKey) throw new Error("Speech service returned no token. Try again shortly.");

    // 2. Microphone.
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (micErr) {
      if (micErr && (micErr.name === "NotAllowedError" || micErr.name === "SecurityError")) {
        throw new Error("Microphone access was denied. Allow the microphone for this add-in and try again.");
      }
      if (micErr && micErr.name === "NotFoundError") {
        throw new Error("No microphone found. Connect one and try again.");
      }
      throw new Error("Could not open the microphone: " + (micErr.message || micErr.name || micErr));
    }

    // 3. Deepgram streaming WebSocket — same parameters as the Voxlen SDK.
    const url = new URL("wss://api.deepgram.com/v1/listen");
    url.searchParams.set("model", "nova-3");
    // Opt out of Deepgram's Model Improvement Program — never let customer
    // audio be retained for training.
    url.searchParams.set("mip_opt_out", "true");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("utterance_end_ms", "1000");
    url.searchParams.set("no_delay", "true");
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("channels", "1");

    deepgramWs = new WebSocket(url.toString(), ["token", tempKey]);

    deepgramWs.onopen = () => {
      setMicUi(true, "Listening… tap to stop");
      setStatus("Dictating — speak, and final phrases land at your cursor.", "ok");

      deepgramAudioContext = new AudioContext({ sampleRate: 16000 });
      const source = deepgramAudioContext.createMediaStreamSource(mediaStream);
      deepgramProcessor = deepgramAudioContext.createScriptProcessor(4096, 1, 1);

      deepgramProcessor.onaudioprocess = (e) => {
        if (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const clamped = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        try {
          deepgramWs.send(int16.buffer);
        } catch {
          // WebSocket closed between readyState check and send — harmless
        }
      };

      source.connect(deepgramProcessor);
      deepgramProcessor.connect(deepgramAudioContext.destination);
    };

    deepgramWs.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type !== "Results") return;
      const alt = data.channel && data.channel.alternatives && data.channel.alternatives[0];
      if (!alt || !alt.transcript) return;
      if (data.is_final) {
        showInterim("");
        insertAtCursor(alt.transcript);
      } else {
        showInterim(alt.transcript);
      }
    };

    deepgramWs.onerror = () => {
      // Connection failed — tear everything down (media stream, audio context,
      // processor) so pane state matches reality.
      stopDictation();
      setStatus("Speech connection failed. Check your network and try again.", "error");
    };

    deepgramWs.onclose = () => {
      // Server-side close (inactivity, quota, token expiry) while we still
      // think we're listening. stopDictation() nulls deepgramWs before
      // closing, so a close we initiated never reaches this branch.
      if (isListening) {
        stopDictation();
        setStatus("Speech connection closed by the server. Tap the mic to resume.", "error");
      }
    };
  } catch (err) {
    stopDictation();
    setStatus(
      err instanceof TypeError
        ? "Could not reach voxlen.ai — check your connection."
        : err.message || String(err),
      "error"
    );
  }
}

function stopDictation() {
  if (deepgramWs) {
    const ws = deepgramWs;
    deepgramWs = null; // null before close so onclose knows we initiated it
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "CloseStream" })); } catch { /* closing anyway */ }
    }
    ws.close();
  }
  if (deepgramProcessor) {
    deepgramProcessor.disconnect();
    deepgramProcessor = null;
  }
  if (deepgramAudioContext) {
    deepgramAudioContext.close();
    deepgramAudioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  isListening = false;
  showInterim("");
  setMicUi(false, "Start dictation");
}

function setMicUi(recording, label) {
  micButton.classList.toggle("recording", recording);
  micButton.setAttribute("aria-pressed", String(recording));
  micLabel.textContent = label;
}

function showInterim(text) {
  interimBox.textContent = text;
  interimBox.hidden = !text;
}

// ---------- Polish (grammar) ----------
polishButton.addEventListener("click", polishSelection);

async function polishSelection() {
  if (!voxlenKey) return;
  polishButton.disabled = true;
  polishResult.hidden = true;
  setStatus("Reading selection…");

  try {
    // 1. Read the current selection from the document.
    let original = "";
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load("text");
      await context.sync();
      original = selection.text;
    });
    original = original || "";
    if (!original.trim()) {
      setStatus("Select some text in the document first, then click Polish.", "error");
      return;
    }

    // 2. Correct it via the Voxlen grammar relay.
    setStatus("Polishing…");
    const res = await fetch(API_BASE + "/grammar", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeader()),
      body: JSON.stringify({ text: original, writingStyle: "professional" }),
    });
    if (res.status === 401) throw new Error("Your Voxlen key was rejected. Re-enter it via “Change key”.");
    if (res.status === 402) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Your plan does not include AI grammar. Upgrade at voxlen.ai/dashboard.");
    }
    if (!res.ok) throw new Error("Grammar service failed (" + res.status + "). Your text was not changed.");
    const data = await res.json();
    const corrected = data.corrected;
    if (!corrected || typeof corrected !== "string") {
      throw new Error("Grammar service returned no correction. Your text was not changed.");
    }

    if (corrected === original) {
      setStatus("Already polished — no changes needed.", "ok");
      return;
    }

    // 3. Replace the selection. If the user moved the selection while we were
    // waiting, verify it still holds the same text before overwriting.
    let replaced = false;
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load("text");
      await context.sync();
      if (selection.text !== original) return; // selection changed under us
      selection.insertText(corrected, Word.InsertLocation.replace);
      await context.sync();
      replaced = true;
    });
    if (!replaced) {
      setStatus("The selection changed while polishing, so nothing was replaced. Re-select and try again.", "error");
      return;
    }

    polishBefore.textContent = original;
    polishAfter.textContent = corrected;
    polishResult.hidden = false;
    setStatus("Selection polished.", "ok");
  } catch (err) {
    setStatus(
      err instanceof TypeError
        ? "Could not reach voxlen.ai — check your connection."
        : err.message || String(err),
      "error"
    );
  } finally {
    polishButton.disabled = false;
  }
}
