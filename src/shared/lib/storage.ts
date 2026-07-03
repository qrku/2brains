import type { Section } from '@/entities/section';

// Legacy keys from the single-pack era — migrated to per-pack on first load
const LEGACY_SECTIONS = 'prep_sections_v3';
const LEGACY_DONE     = 'prep_done_v3';

function sectionsKey(packId: string) { return `prep_sections_${packId}`; }
function doneKey(packId: string)     { return `prep_done_${packId}`; }

export function loadStorage(
  packId: string,
  defaultSections: Section[],
  defaultDoneIds: string[],
): { sections: Section[]; doneIds: string[] } {
  if (typeof window === 'undefined') {
    return { sections: defaultSections, doneIds: defaultDoneIds };
  }
  try {
    let rawSections = localStorage.getItem(sectionsKey(packId));
    let rawDone     = localStorage.getItem(doneKey(packId));

    // One-time migration from old single-pack storage to the 'frontend' pack
    if (packId === 'frontend') {
      if (!rawSections) rawSections = localStorage.getItem(LEGACY_SECTIONS);
      if (!rawDone)     rawDone     = localStorage.getItem(LEGACY_DONE);
      // Write migrated data under the new key so future reads are fast
      if (rawSections && !localStorage.getItem(sectionsKey(packId)))
        localStorage.setItem(sectionsKey(packId), rawSections);
      if (rawDone && !localStorage.getItem(doneKey(packId)))
        localStorage.setItem(doneKey(packId), rawDone);
    }

    return {
      sections: rawSections ? (JSON.parse(rawSections) as Section[]) : defaultSections,
      doneIds:  rawDone     ? (JSON.parse(rawDone)     as string[])  : defaultDoneIds,
    };
  } catch {
    return { sections: defaultSections, doneIds: defaultDoneIds };
  }
}

export function saveStorage(packId: string, sections: Section[], doneIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(sectionsKey(packId), JSON.stringify(sections));
    localStorage.setItem(doneKey(packId),     JSON.stringify(doneIds));
  } catch {
    // quota exceeded — silently ignore
  }
}

/** Read just the done-IDs for a pack (used on pack list cards). */
export function readPackProgress(
  packId: string,
  builtinTopicIds: string[],
  builtinDefaultDone: string[],
): { done: number; total: number; pct: number } {
  if (typeof window === 'undefined') return { done: 0, total: builtinTopicIds.length, pct: 0 };
  try {
    let rawSections = localStorage.getItem(sectionsKey(packId));
    if (!rawSections && packId === 'frontend') rawSections = localStorage.getItem(LEGACY_SECTIONS);

    let topicIds: string[];
    if (rawSections) {
      const secs = JSON.parse(rawSections) as Section[];
      topicIds = secs.flatMap((s) => s.topics.map((t) => t.id));
    } else {
      topicIds = builtinTopicIds;
    }

    let rawDone = localStorage.getItem(doneKey(packId));
    if (!rawDone && packId === 'frontend') rawDone = localStorage.getItem(LEGACY_DONE);

    const done: string[] = rawDone ? JSON.parse(rawDone) : builtinDefaultDone;
    const doneSet = new Set(done);
    const doneCount = topicIds.filter((id) => doneSet.has(id)).length;
    const total = topicIds.length;
    return { done: doneCount, total, pct: total ? Math.round((doneCount / total) * 100) : 0 };
  } catch {
    return { done: 0, total: builtinTopicIds.length, pct: 0 };
  }
}
