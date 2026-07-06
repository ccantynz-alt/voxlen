# @voxlen/sdk

Embeddable voice dictation + AI grammar correction for any web app. Attach a mic
button to a `<textarea>`, `<input>`, or contenteditable element and get live
transcription plus optional AI grammar polishing.

## Install

```sh
npm install @voxlen/sdk
```

## Quick start

```ts
import { VoxlenSDK } from "@voxlen/sdk";

const voxlen = new VoxlenSDK({
  voxlenApiKey: "vx_...",        // recommended mode — see "Modes" below
  context: "legal_correspondence",
  writingStyle: "professional",
});

voxlen.attachTo(document.querySelector("#email-compose"));

voxlen.on("transcript", (e) => console.log(e.text));
voxlen.on("error", (err) => console.error(err));
```

## Modes

The SDK picks a transcription backend based on which keys you configure, in
this order:

| Mode | Config | Where keys live | Status |
|---|---|---|---|
| **Voxlen API** (recommended) | `voxlenApiKey` | Provider keys stay on Voxlen servers; the browser only holds your revocable Voxlen key | **Backend in development** — the SDK targets `https://www.voxlen.ai/api`, but the api.voxlen.com backend has not shipped yet. Requests in this mode will fail until it does. |
| **Direct Deepgram** | `deepgramApiKey` | Raw Deepgram key in the browser | Works today — trusted environments only (see Security) |
| **Web Speech API** | no keys | n/a (built into the browser) | Works today in browsers that support it (Chrome, Edge, Safari) |

Grammar correction is independent of dictation mode:

- `grammarApiKey` (Anthropic, Claude Sonnet — default provider) or
- `openaiApiKey` with `grammarProvider: "openai"` (GPT-4o-mini)

Both call the provider directly from the browser — trusted environments only.

## Security — read this before shipping

**Any API key delivered to a browser is public.** Every visitor can open
DevTools, watch the network tab, or read the page source and extract it. There
is no way to hide a key in client-side code.

- `deepgramApiKey` is sent as a WebSocket subprotocol from the browser.
- `grammarApiKey` is sent in an `x-api-key` header (with
  `anthropic-dangerous-direct-browser-access`) from the browser.
- `openaiApiKey` is sent as a Bearer token from the browser.

These direct-key modes exist for **trusted environments only**: internal tools
behind auth, kiosks, local prototypes, Electron-style apps you control. Never
use them on a public website — anyone could take the key and spend your quota.
The SDK emits a one-time `console.warn` whenever a provider key is used in a
browser context.

For public deployments, use **Voxlen API mode** (`voxlenApiKey`): provider keys
stay server-side, and the Voxlen key is scoped, metered, and revocable. Note
that this mode depends on the api.voxlen.com backend, which is currently in
development.

The SDK never sends audio or text to any server other than the one implied by
your configuration (Voxlen API, Deepgram, Anthropic, or OpenAI).

## API surface

### `new VoxlenSDK(config?: VoxlenConfig)`

Key config fields (see `src/types.ts` for the full list):

| Field | Description |
|---|---|
| `voxlenApiKey` | Voxlen platform key (recommended mode) |
| `voxlenApiBase` | API base override (default `https://www.voxlen.ai/api`) |
| `tenantId` | Organisation ID for usage reporting |
| `context` | Formatting context, e.g. `"legal_contract"`, `"accounting_tax"` |
| `vocabularyHints` | Case names, client names, unusual terms |
| `deepgramApiKey` | Direct Deepgram streaming (trusted environments only) |
| `grammarApiKey` / `openaiApiKey` | Direct grammar keys (trusted environments only) |
| `grammarProvider` | `"claude"` (default) or `"openai"` |
| `language` | BCP-47 code, default `"en-US"` |
| `writingStyle` | `"professional"`, `"casual"`, `"academic"`, `"creative"`, `"technical"` |
| `autoCorrect` | Run grammar correction after each final utterance |
| `speakerLabels` | Speaker diarisation (Voxlen API mode) |
| `buttonPosition` / `buttonClassName` | Mic button placement/styling |
| `onTranscript` / `onGrammarResult` / `onError` | Callbacks |

### `VoxlenSDK` methods

- `attachTo(element)` / `detach()` — add/remove the floating mic button on a
  textarea, input, or contenteditable element.
- `startDictation(): Promise<void>` / `stop()` — programmatic control.
- `isListening: boolean`
- `correctGrammar(text?): Promise<string>` — corrects the given text (or the
  attached element's content) and returns the corrected string.
- `transcribeFile(audio: Blob)` — one-shot file transcription (Voxlen API mode).
- `getApi(): Promise<VoxlenApiClient | null>` — low-level Voxlen API client;
  resolves once the client module loads, `null` without a `voxlenApiKey`.
- `api` getter — **deprecated**: returns `null` until the client module has
  loaded (the first access always misses). Use `await getApi()` instead.
- `on(event, cb)` / `off(event, cb)` — events: `transcript`,
  `partial-transcript`, `grammar-result`, `dictation-start`, `dictation-stop`,
  `error`.

### `VoxlenApiClient` (Voxlen API mode — backend in development)

Authenticates with `Authorization: Bearer <voxlenApiKey>`.

- `transcribe(audio, opts)` — sync transcription (< 60s audio).
- `transcribeAsync(audio, opts)` / `getTranscription(id)` /
  `waitForTranscription(id)` — async jobs for longer audio, with optional
  `webhookUrl`.
- `streamTranscribe(blob, onChunk, onError)` — SSE transcription of a complete
  blob; returns a cancel function.
- `listVocabularyLists()` / `createVocabularyList()` / `updateVocabularyList()`
  / `deleteVocabularyList()` — custom vocabulary management.
- `healthCheck()`

### `VoxlenDictation` / `VoxlenGrammar`

Lower-level engines used by `VoxlenSDK`, exported for advanced use. Same key
semantics and security caveats as above.

## Known limitations

- **Voxlen API mode is not live yet** — the backend (api.voxlen.com) is in
  development. The SDK is wired to the final contract (`Authorization: Bearer`,
  `https://www.voxlen.ai/api`) so it will work unchanged when the backend ships.
- **Live streaming in Voxlen API mode is interim**: until a WebSocket streaming
  endpoint exists, the SDK re-uploads the accumulated audio every 3 seconds and
  caps live sessions at ~60 seconds. Use `transcribeFile()` or
  `transcribeAsync()` for longer recordings.
- Web Speech API availability and quality vary by browser; unsupported browsers
  surface an error via `onError` without any key configured.

## Development

```sh
npm run build   # tsup — CJS + ESM + d.ts
npm test        # vitest
```

## License

MIT
