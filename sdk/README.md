# @voxlen/sdk

Embeddable voice dictation and AI grammar correction for web apps.

## Install

```sh
npm install @voxlen/sdk
```

## Quick start

Copy your Voxlen desktop key from the [voxlen.ai dashboard](https://www.voxlen.ai/dashboard), then configure it as `voxlenKey`:

```ts
import { VoxlenSDK } from "@voxlen/sdk";

const voxlen = new VoxlenSDK({
  voxlenKey: "your-dashboard-jwt",
  language: "en-NZ",
  vocabularyHints: ["AlecRae", "Voxlen"],
  autoCorrect: true,
});

voxlen.attachTo(document.querySelector("#email-compose"));
```

The dashboard key is a Voxlen-issued HS256 JWT. Voxlen API calls use it as
`Authorization: Bearer <voxlenKey>` against `https://www.voxlen.ai/api`.

## Modes

| Mode | Config | Behavior |
|---|---|---|
| Voxlen API (recommended) | `voxlenKey` | Uses deployed voxlen.ai services. Live dictation obtains a short-lived Deepgram key from `/deepgram-token`. |
| Direct Deepgram | `deepgramApiKey` | Connects directly to Deepgram; for trusted environments only. |
| Web Speech | no key | Uses the browser Web Speech API. |

Direct `deepgramApiKey`, `grammarApiKey`, and `openaiApiKey` values are exposed
to browser users. Use those modes only in trusted environments. Voxlen API mode
keeps provider credentials server-side, although your dashboard JWT must still
be handled as a credential.

## Main SDK

Important `VoxlenConfig` fields:

- `voxlenKey`: Voxlen dashboard JWT.
- `voxlenApiBase`: optional API base override.
- `language`, `vocabularyHints`, `speakerLabels`: transcription settings.
- `writingStyle`, `autoCorrect`: grammar settings.
- `deepgramApiKey`: unchanged direct Deepgram mode.

`VoxlenSDK` provides `attachTo()`, `detach()`, `startDictation()`, `stop()`,
`correctGrammar()`, `transcribeFile()`, and `getApi()`.

## Low-level API client

```ts
import { VoxlenApiClient } from "@voxlen/sdk";

const api = new VoxlenApiClient({ voxlenKey: "your-dashboard-jwt" });
const transcript = await api.transcribe(audioBlob, {
  language: "en-NZ",
  vocabularyHints: ["Voxlen"],
});
```

The client matches the deployed functions:

- `transcribe(audio, options)` → `POST /stt` with raw audio.
- `polishGrammar(text, options)` → `POST /grammar`.
- `translate(text, targetLanguage)` → `POST /translate`.
- `validateKey()` → `GET /me`.
- `getDeepgramToken()` → `POST /deepgram-token`.
- `saveVocabulary(terms, name?)` → `POST /vocabulary`.

There are no async transcription jobs, Voxlen SSE transcription route, health
route, or vocabulary GET/PUT/DELETE endpoints in the deployed API.

## Development

```sh
npm run build
npx vitest run
```
