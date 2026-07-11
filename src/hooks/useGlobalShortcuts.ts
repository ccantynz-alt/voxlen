import { useEffect } from "react";
import { useDictationStore } from "@/stores/dictation";
import { useSettingsStore } from "@/stores/settings";
import { useFlywheelStore } from "@/stores/flywheel";
import { useClientsStore, buildMatterContext } from "@/stores/clients";
import { collectVocabulary } from "@/lib/vocab";
import { toast } from "@/components/ui/Toast";

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
  // Cancel defaults to bare "Escape". Registering that permanently would
  // consume Esc system-wide (dialogs, games, IDEs) for as long as Voxlen
  // runs — so it is only registered while a dictation is in progress.
  const dictationActive = useDictationStore(
    (s) => s.status === "listening" || s.status === "processing" || s.status === "paused"
  );

  useEffect(() => {
    if (!enabled) return;

    let registered: string[] = [];
    let cancelled = false;

    async function registerAll() {
      let register: typeof import("@tauri-apps/plugin-global-shortcut").register;
      let unregister: typeof import("@tauri-apps/plugin-global-shortcut").unregister;
      try {
        ({ register, unregister } = await import(
          "@tauri-apps/plugin-global-shortcut"
        ));
      } catch {
        return; // Not running in Tauri — expected in browser/dev mode.
      }

      // Unregister anything we previously registered (best effort).
      for (const s of registered) {
        try {
          await unregister(s);
        } catch {
          // Ignore; may not have been registered.
        }
      }
      registered = [];

      // Each shortcut is registered independently — one failing must not prevent
      // the others. cancelled guard here covers all registrations.
      async function registerOne(shortcut: string, handler: Parameters<typeof register>[1]) {
        if (cancelled) return;
        try {
          await register(shortcut, handler);
          registered.push(shortcut);
        } catch (err) {
          console.error(`Failed to register shortcut '${shortcut}':`, err);
          toast(
            `Couldn't register shortcut "${shortcut}" — it may already be in use by another app.`,
            "error",
            6000
          );
        }
      }

      // Toggle — on Pressed, flip listening/idle. In Always-Ready mode the
      // supervisor owns start/stop, so the hotkey pauses/resumes instead.
      if (shortcutToggle) {
        await registerOne(shortcutToggle, (event) => {
          if (event.state !== "Pressed") return;
          const dictation = useDictationStore.getState();
          if (dictation.alwaysReadyPhase !== "off") {
            const resuming = dictation.status === "paused";
            dictation.setStatus(resuming ? "listening" : "paused");
            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke(resuming ? "resume_dictation" : "pause_dictation");
              } catch {
                // Non-Tauri / supervisor recovering.
              }
            })();
            return;
          }
          const status = dictation.status;
          if (status === "idle" || status === "paused" || status === "error") {
            useDictationStore.getState().setStatus("listening");
            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                try {
                  await invoke("start_dictation");
                } catch (err) {
                  useDictationStore.getState().setStatus("idle");
                  toast(
                    err instanceof Error ? err.message : String(err) || "Failed to start dictation",
                    "error"
                  );
                }
              } catch {
                // Not in Tauri (import failed) — expected in browser/dev.
              }
            })();
          } else {
            useDictationStore.getState().setStatus("idle");
            (async () => {
              try {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("stop_dictation");
              } catch {
                // Non-Tauri / ignore.
              }
            })();
          }
        });
      }

      // Push-to-talk — start on press, stop on release.
      if (shortcutPushToTalk) {
        await registerOne(shortcutPushToTalk, (event) => {
          if (event.state === "Pressed") {
            if (useDictationStore.getState().status !== "listening") {
              useDictationStore.getState().setStatus("listening");
              (async () => {
                try {
                  const { invoke } = await import("@tauri-apps/api/core");
                  try {
                    await invoke("start_dictation");
                  } catch (err) {
                    useDictationStore.getState().setStatus("idle");
                    toast(
                      err instanceof Error ? err.message : String(err) || "Failed to start dictation",
                      "error"
                    );
                  }
                } catch {
                  // Not in Tauri.
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
                  // Non-Tauri / ignore.
                }
              })();
            }
          }
        });
      }

      // Cancel is registered in its own effect below — only while dictation
      // is active — so a bare "Escape" binding doesn't hijack Esc globally.

      // Correct grammar — invoke `correct_grammar` on the last-dictated text
      // and inject the corrected version.
      if (shortcutCorrectGrammar) {
        await registerOne(shortcutCorrectGrammar, (event) => {
          if (event.state !== "Pressed") return;
          (async () => {
            let invoke: typeof import("@tauri-apps/api/core").invoke;
            try {
              ({ invoke } = await import("@tauri-apps/api/core"));
            } catch {
              return; // Not in Tauri.
            }

            try {
              const state = useDictationStore.getState();
              // Prefer selected text from the frontend; otherwise use
              // the last segment from the current session.
              const selection = window.getSelection()?.toString() ?? "";
              const lastSegment = state.segments[state.segments.length - 1];
              const textToCorrect = selection || lastSegment?.correctedText || lastSegment?.text || "";
              if (!textToCorrect.trim()) return;

              const { activeClientId, clients } = useClientsStore.getState();
              const activeClient = clients.find((c) => c.id === activeClientId);
              const mergedVocab = collectVocabulary();
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
            } catch (err) {
              // Show the user why grammar correction failed (no key, API error, etc.)
              toast(
                err instanceof Error ? err.message : String(err) || "Grammar correction failed",
                "error"
              );
            }
          })();
        });
      }

      // Session autosaving is handled by the status-subscription in
      // useTauriEvents — no-op here.
    }

    registerAll();

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
  }, [enabled, shortcutToggle, shortcutPushToTalk, shortcutCorrectGrammar]);

  // Cancel — registered only while dictation is active (see note above).
  useEffect(() => {
    if (!enabled || !shortcutCancel || !dictationActive) return;

    let registered = false;
    let cancelled = false;

    (async () => {
      let register: typeof import("@tauri-apps/plugin-global-shortcut").register;
      try {
        ({ register } = await import("@tauri-apps/plugin-global-shortcut"));
      } catch {
        return; // Not running in Tauri.
      }
      if (cancelled) return;
      try {
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
        registered = true;
        if (cancelled) {
          // Effect cleanup ran while we were awaiting — undo immediately.
          const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
          await unregister(shortcutCancel).catch(() => {});
          registered = false;
        }
      } catch (err) {
        console.error(`Failed to register cancel shortcut '${shortcutCancel}':`, err);
      }
    })();

    return () => {
      cancelled = true;
      if (!registered) return;
      (async () => {
        try {
          const { unregister } = await import("@tauri-apps/plugin-global-shortcut");
          await unregister(shortcutCancel);
        } catch {
          // Not in Tauri / already unregistered.
        }
      })();
    };
  }, [enabled, shortcutCancel, dictationActive]);
}
