# Voxlen Landing Page

A standalone Vite + React marketing site for Voxlen. Deployed independently from the desktop app.

## Local development

```bash
cd landing
npm install
npm run dev
```

The dev server runs on the default Vite port (http://localhost:5173).

## Production build

```bash
npm run build     # typechecks and emits to landing/dist
npm run preview   # serves the production bundle locally
```

## Deploying to Vercel

This directory ships a `vercel.json` that Vercel reads automatically:

- `framework`: `vite`
- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`

### Option 1: CLI

```bash
npm i -g vercel
cd landing
vercel        # first deploy (preview)
vercel --prod # promote to production
```

### Option 2: Git integration

1. Import the repository into Vercel.
2. Set **Root Directory** to `landing`.
3. Leave build/output settings on defaults — they are picked up from `vercel.json`.
4. Pushes to `main` will trigger production deploys.

## Notes

- The landing site has no runtime API keys; it is fully static.
- Assets live in `landing/src/` and the Vite entry is `landing/index.html`.
