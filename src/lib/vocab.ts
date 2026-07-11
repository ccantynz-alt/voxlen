/**
 * Single source of truth for the vocabulary fed to STT and grammar
 * correction: global custom vocabulary + active client's matter
 * vocabulary + flywheel-learned words (frequency >= 2, gated on the
 * flywheelAutoVocab setting). Previously this merge was hand-rolled in
 * four places — and the STT path forgot the flywheel entirely.
 */

import { useSettingsStore } from "@/stores/settings";
import { useClientsStore } from "@/stores/clients";
import { useFlywheelStore } from "@/stores/flywheel";

export function collectVocabulary(): string[] {
  const settings = useSettingsStore.getState();
  const { activeClientId, clients } = useClientsStore.getState();
  const client = clients.find((c) => c.id === activeClientId);
  const clientVocab = client?.vocabulary ?? [];
  const flywheelVocab = settings.flywheelAutoVocab
    ? useFlywheelStore
        .getState()
        .vocabulary.filter((v) => v.frequency >= 2)
        .map((v) => v.word)
    : [];
  return Array.from(
    new Set([...settings.customVocabulary, ...clientVocab, ...flywheelVocab])
  );
}

/** Convenience for `correct_grammar` calls: undefined when empty. */
export function collectVocabularyOrUndefined(): string[] | undefined {
  const vocab = collectVocabulary();
  return vocab.length > 0 ? vocab : undefined;
}
