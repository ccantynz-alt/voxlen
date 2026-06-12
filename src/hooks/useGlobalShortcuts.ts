import { useEffect } from "react";
import { useDictationStore } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { useFlywheelStore } from "@/stores/flywheel";
import { useClientsStore, buildMatterContext } from "@/stores/clients";

/**
 * Registers all four configured global shortcuts with the Tauri
 * global-shortcut plugin. Re-registers whenever the user changes
 * shortcut strings in settings. Gracefully no-ops outside Tauri.
 */
export function useGlobalShortcuts(enabled: boolean): void {
  const shortcutToggle = useSettingsStore((s) => s.shortcutToggle);
  const shortcutPushToTalk = useSettingsStore((s) => s.shortcutPushToTalk);
  const shortcutCancel = useSettingsStore((s) => s.shortcutCancel);
  const shortcutCorrectGrammar = useSettingsStore((s) => s.shortcutCorrectGrammar);

  useEffect(() => {
    if (!enabled) return;

    let registered: string[] = [];
    let cancelled = false;

    async function register() {
      try {
        const { register, unregister } = await import(
          "@tauri-apps/plugin-global-shortcut"
        );

        // Unregister anything we previously registered (best effort).
        for (const s of registered) {
          try {
            await unregister(s);
          } catch {
            // Ignore; may not have been registered.
          }
        }
        registered = [];

        // Toggle — on Pressed, flip listening/idle.
        if (shortcutToggle) {
          await register(shortcutToggle, (event) => {
            if (event.state !== "Pressed") return;
            const status = useDictationStore.getState().status;
            if (status === "idle" || status === "paused") {
              useDictationStore.getState().setStatus("listening");
              (async () => {
                try {
                  const { invoke } = await import("@tauri-apps/api/core");
                  await invoke("start_dictation");
                } catch {
                  // Demo / non-Tauri.
                }
              })();
            } else {
              useDictationStore.getState().setStatus("idle");
              (async () => {
                try {
                  const { invoke } = await import("@tauri-apps/api/core");
                  await invoke("stop_dictation");
                } catch {
                  // Demo / non-Tauri.
                }
              })();
            }
          });
          registered.push(shortcutToggle);
        }

        // Push-to-talk — start on press, stop on release.
        if (shortcutPushToTalk) {
          await register(shortcutPushToTalk, (event) => {
            if (event.state === "Pressed") {
              if (useDictationStore.getState().status !== "listening") {
                useDictationStore.getState().setStatus("listening");
                (async () => {
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("start_dictation");
                  } catch {
                    // Demo / non-Tauri.
                  }
                })();
              }
            } else if (event.state === "Released") {
              if (useDictationStore.getState().status === "listening") {
                useDictationStore.getState().setStatus("idle");
                (async () => {
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("stop_dictation");
                  } catch {
                    // Demo / non-Tauri.
                  }
                })();
              }
            }
          });
          registered.push(shortcutPushToTalk);
        }

        // Cancel — stop dictation + clear current in-progress transcript.
        if (shortcutCancel) {
          await register(shortcutCancel, (event) => {
            if (event.state !== "Pressed") return;
            const dictation = useDictationStore.getState();
            dictation.setStatus("idle");
            dictation.clearCurrentTranscript();
            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("stop_dictation");
              } catch {
                // Demo / non-Tauri.
              }
            })();
          });
          registered.push(shortcutCancel);
        }

        // Correct grammar — invoke `correct_grammar` on the last-dictated text
        // and inject the corrected version.
        if (shortcutCorrectGrammar) {
          await register(shortcutCorrectGrammar, (event) => {
            if (event.state !== "Pressed") return;
            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                const state = useDictationStore.getState();
                // Prefer selected text from the frontend; otherwise use
                // the last segment from the current session.
                const selection = window.getSelection()?.toString() ?? "";
                const lastSegment = state.segments[state.segments.length - 1];
                const textToCorrect = selection || lastSegment?.correctedText || lastSegment?.text || "";
                if (!textToCorrect.trim()) return;

                const flyVocab = useFlywheelStore.getState().vocabulary
                  .filter((v) => v.frequency >= 2)
                  .map((v) => v.word);
                const { activeClientId, clients } = useClientsStore.getState();
                const activeClient = clients.find((c) => c.id === activeClientId);
                const clientVocab = activeClient?.vocabulary ?? [];
                const globalVocab = useSettingsStore.getState().customVocabulary;
                const mergedVocab = Array.from(new Set([...flyVocab, ...clientVocab, ...globalVocab]));
                const matterContext = buildMatterContext(activeClient) || undefined;

                const result = await invoke<{
                  corrected: string;
                  changes: Array<{ original: string; corrected: string; reason: string; category: string }>;
                  score: number;
                }>(
                  "correct_grammar",
                  {
                    text: textToCorrect,
                    customVocabulary: mergedVocab.length > 0 ? mergedVocab : undefined,
                    matterContext,
                  }
                );

                if (lastSegment && !selection) {
                  useDictationStore.getState().updateSegment(lastSegment.id, {
                    correctedText: result.corrected,
                    grammarApplied: true,
                  });
                }

                // Feed corrections back into flywheel (same as auto-grammar path)
                if (result.changes?.length) {
                  const fw = useFlywheelStore.getState();
                  for (const c of result.changes) {
                    if (c.original && c.corrected && c.original !== c.corrected) {
                      fw.recordCorrection(
                        c.original,
                        c.corrected,
                        (c.category as "grammar" | "spelling" | "punctuation" | "style") ?? "grammar"
                      );
                    }
                  }
                  fw.recordCorrectionFeedback(true);
                }

                // Inject corrected text into the focused app.
                try {
                  await invoke("inject_text", { text: result.corrected });
                } catch {
                  // Fallback: clipboard.
                  await navigator.clipboard.writeText(result.corrected);
                }
              } catch {
                // Non-Tauri / no backend — silently skip.
              }
            })();
          });
          registered.push(shortcutCorrectGrammar);
        }

        // Session autosaving is handled by the status-subscription in
        // useTauriEvents — no-op here.
      } catch {
        // Not running in Tauri.
      }
    }

    register();

    return () => {
      cancelled = true;
      (async () => {
        try {
          const { unregister } = await import(
            "@tauri-apps/plugin-global-shortcut"
          );
          for (const s of registered) {
            try {
              await unregister(s);
            } catch {
              // Ignore
            }
          }
        } catch {
          // Not in Tauri.
        }
        if (cancelled) registered = [];
      })();
    };
  }, [enabled, shortcutToggle, shortcutPushToTalk, shortcutCancel, shortcutCorrectGrammar]);
}
