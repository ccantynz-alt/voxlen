/** Parse Dragon .txt/.voc vocabulary exports into written-form terms. */
export function parseVocabularyFile(content: string): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (let line of content.split(/\r?\n/)) {
    // Dragon exports may begin with a UTF-8 BOM.
    line = line.replace(/^\uFEFF/, "");
    if (line.length > 200) continue;

    line = line.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    const separator = line.indexOf("\\");
    const term = (separator === -1 ? line : line.slice(0, separator)).trim().slice(0, 100);
    if (!term) continue;

    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }

  return terms;
}

export function mergeVocabulary(
  existing: string[],
  imported: string[]
): { merged: string[]; added: number; addedTerms: string[] } {
  const addedTerms: string[] = [];
  const seen = new Set(existing.map((term) => term.toLocaleLowerCase()));

  for (const term of imported) {
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addedTerms.push(term);
  }

  return { merged: [...existing, ...addedTerms], added: addedTerms.length, addedTerms };
}
