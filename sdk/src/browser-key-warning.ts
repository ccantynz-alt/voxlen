/**
 * One-time console warning for raw provider API keys used in a browser.
 *
 * Any key that reaches the browser is readable by every visitor of the page
 * (DevTools, network tab, bundle inspection) and can be extracted and abused.
 * Direct provider keys are therefore acceptable ONLY in trusted environments:
 * internal tools, kiosks, local prototypes — never on a public site.
 *
 * The safe alternative for public deployments is Voxlen-API mode
 * (`voxlenKey`), where provider keys stay on the Voxlen server and the
 * browser only ever holds a revocable, metered Voxlen platform key.
 */

const warned = new Set<string>();

export type BrowserKeyProvider = "anthropic" | "openai" | "deepgram";

/** @internal Test-only: clear the warn-once state. */
export function resetBrowserKeyWarnings(): void {
  warned.clear();
}

export function warnBrowserKeyUse(provider: BrowserKeyProvider): void {
  // Not a browser (Node/SSR/tests) — the key never leaves the server, no exposure.
  if (typeof window === "undefined") return;
  if (warned.has(provider)) return;
  warned.add(provider);
  // eslint-disable-next-line no-console
  console.warn(
    `[Voxlen SDK] SECURITY: a ${provider} API key is being used directly from the browser. ` +
      "Every visitor to this page can extract this key (DevTools > Network) and spend your quota with it. " +
      "This mode is intended for trusted environments only (internal tools, prototypes). " +
      "For public sites, configure `voxlenKey` instead so provider keys stay server-side " +
      "(see the Voxlen SDK README, Security section)."
  );
}
