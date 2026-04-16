#!/usr/bin/env node
// Rasterise public/og-image.svg to public/og-image.png at 1200x630.
// Run via `npm run og`. Runs again automatically on `npm run build`.
// Intentionally zero-config: the SVG is the source of truth; the PNG is a
// generated artefact so LinkedIn/Twitter/Facebook (which don't accept SVG
// og:image) get a proper preview.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const svgPath = resolve(root, "public", "og-image.svg");
const pngPath = resolve(root, "public", "og-image.png");

const svg = readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  background: "#09090b",
  font: { loadSystemFonts: true },
});
const png = resvg.render().asPng();
writeFileSync(pngPath, png);
console.log(`Wrote ${pngPath} (${png.length.toLocaleString()} bytes).`);
