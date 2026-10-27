# Voxlen Dictation — Microsoft Word Add-in (MVP)

An Office JS taskpane add-in that lets you dictate directly into the open Word
document and polish selected text with AI grammar, using your Voxlen account
key from the [voxlen.ai dashboard](https://www.voxlen.ai/dashboard).

## How it works

- The manifest (`manifest.xml`) points at the taskpane hosted on the landing
  site: `https://www.voxlen.ai/word-addin/taskpane.html`. The taskpane source
  lives in this repo at `landing/public/word-addin/` (plain ES2020, no build
  step) and deploys with the landing site on Vercel — **the add-in only works
  once the landing site has been deployed with those files**.
- **Dictate:** the pane exchanges your Voxlen key for a short-lived (30 s)
  Deepgram token via `POST /api/deepgram-token`, streams mic audio to Deepgram
  (nova-3, linear16 @ 16 kHz — same pipeline as the Web SDK), shows interim
  text in the pane, and inserts each final phrase at your Word cursor.
- **Polish:** reads the current Word selection, sends it to
  `POST /api/grammar` (`writingStyle: "professional"`), and replaces the
  selection with the corrected text. Word's native Undo (Ctrl+Z) restores the
  original.
- **Privacy:** audio goes only to Deepgram; polish text passes only through
  the Voxlen zero-retention relay. Nothing is stored on Voxlen servers. The
  account key is kept in the taskpane's localStorage on your machine.

## Sideload

### Word on Windows / Mac (desktop)

1. Open Word → **Insert** tab → **Add-ins** (or **Get Add-ins** → **My Add-ins**).
2. Choose **Upload My Add-in** and select `manifest.xml` from this folder.
3. A **Voxlen Dictation** button appears on the Home tab; click it to open the pane.

(On Windows, if Upload My Add-in is not visible, enable it via a shared-folder
catalog: File → Options → Trust Center → Trust Center Settings → Trusted
Add-in Catalogs, add a network share containing `manifest.xml`, tick "Show in
Menu", restart Word, then Insert → My Add-ins → Shared Folder.)

### Word on the web

1. Open a document on word.new / OneDrive.
2. **Insert** → **Add-ins** → **Upload My Add-in** → select `manifest.xml`.

## Current limitations

- **Word on the web microphone:** the taskpane runs in a sandboxed iframe;
  some browsers/tenants block `getUserMedia` there, in which case dictation
  reports "Microphone access was denied". Word desktop on Windows uses Edge
  WebView2, which supports the microphone (Word prompts for permission on
  first use). Polish works everywhere.
- Dictation language is fixed to `en-US` for now (the SDK's language/
  vocabulary options are not yet surfaced in the pane).
- Requires a paid or trial Voxlen plan for dictation/grammar (the API returns
  402 otherwise; the pane shows the upgrade message).
- Not yet in AppSource — sideload only.
- Icons are served from `https://www.voxlen.ai/word-addin/icon-{16,32,80}.png`
  (checked into `landing/public/word-addin/`).
