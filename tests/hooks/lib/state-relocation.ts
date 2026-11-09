// state-relocation.ts — read a recorded side effect from wherever that state now lives.
//
// Runtime state moved out of the project root and out of the kit tree into the
// `.meowkit/` taxonomy after the golden corpus was recorded. WHAT a hook writes is
// unchanged, so the recordings stay byte-identical and the side-effect READ is
// redirected here instead — the same treatment `selfPath` gives a diagnostic that
// quotes its own filename, and the only other deviation from whole-stream parity
// in the suite.

import fs from 'node:fs';
import path from 'node:path';

/** Recorded prefix → the class that prefix's content lives in now. */
const STATE_RELOCATIONS: Array<[string, string]> = [
  ['.claude/session-state/', '.meowkit/state/'],
  ['session-state/', '.meowkit/state/'],
  ['.claude/hooks/.logs/', '.meowkit/telemetry/'],
];

const relocate = (rel: string): string => {
  for (const [from, to] of STATE_RELOCATIONS) {
    if (rel.startsWith(from)) return `${to}${rel.slice(from.length)}`;
  }
  return rel;
};

/**
 * Move state a fixture's setup seeded at a pre-move location into the class it
 * now lives in, before the hook runs.
 *
 * A setup recipe is shared with the recorder, so it still seeds the tree the
 * recording was made against. Running a hook over that tree unmigrated would
 * compare a hook that reads one directory against a ledger seeded in another — a
 * difference in the fixture's inputs, not in the code under test. Migrating first
 * models the only state an upgraded install can be in: the content is where the
 * current hook looks for it, and nothing about the recorded expectation changes.
 */
export function migrateSeededState(projectDir: string): void {
  for (const [from, to] of STATE_RELOCATIONS) {
    const src = path.join(projectDir, from);
    if (!fs.existsSync(src)) continue;
    const target = path.join(projectDir, to);
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(src, target, { recursive: true, force: false, errorOnExist: false });
    fs.rmSync(src, { recursive: true, force: true });
  }
}

/**
 * The content recorded at `rel`, read from wherever that state now lives.
 *
 * A write still landing at the recorded location resolves to a sentinel instead of
 * to the file's content, so the relocation cannot hide the regression it exists to
 * accommodate: a hook that kept writing the old path fails the comparison rather
 * than passing on the old file.
 */
export function sideEffectContent(projectDir: string, rel: string): string | null {
  const current = relocate(rel);
  const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  if (current === rel) return read(path.join(projectDir, rel));
  if (fs.existsSync(path.join(projectDir, rel))) return `[write landed at the pre-move path ${rel}]`;
  return read(path.join(projectDir, current));
}
