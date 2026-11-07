// corpus-cases.ts — load the committed case definitions the recorder used.
//
// A fixture stores a setup *id*, not a file-tree recipe, so the recipe has to
// come from somewhere. Taking it from the same modules the recorder ran is the
// whole point: if the replay built its own tree, any divergence between the two
// trees would read as a behavior difference in the code under test.
//
// The modules are CommonJS because the recorder is, so they are loaded through
// a require bridge and then narrowed — an unchecked cast here would let a
// malformed case module fail later as a confusing runtime error instead of
// immediately as a load error.

import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');

/** Which implementation flavor the tree a setup builds into is holding. */
export type TreeFlavor = '.sh' | '.cjs';

export interface SetupContext {
  projectDir: string;
  home: string;
  ext: TreeFlavor;
}

/** The slice of a recorded case the replay needs: its name and its tree builder. */
export interface CorpusCase {
  name: string;
  setup: (ctx: SetupContext) => void;
}

const CASE_MODULES = [
  'hook-corpus-cases-gate1',
  'hook-corpus-cases-preship',
  'hook-corpus-cases-privacy',
  'hook-corpus-cases-feedback',
  'hook-corpus-cases-guards',
  'hook-corpus-cases-gate-helpers',
  'hook-corpus-cases-observers',
  'hook-corpus-cases-cli',
];

function isCorpusCase(value: unknown): value is CorpusCase {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.setup === 'function';
}

function loadCases(): CorpusCase[] {
  const out: CorpusCase[] = [];
  for (const mod of CASE_MODULES) {
    const loaded: unknown = require_(path.join(REPO_ROOT, 'scripts/lib', `${mod}.cjs`));
    if (!Array.isArray(loaded)) throw new Error(`${mod}.cjs did not export an array of cases`);
    for (const entry of loaded) {
      if (!isCorpusCase(entry)) throw new Error(`${mod}.cjs exported an entry with no name or setup`);
      out.push(entry);
    }
  }
  return out;
}

const CASES = loadCases();

export function caseFor(name: string): CorpusCase {
  const found = CASES.find((c) => c.name === name);
  if (!found) throw new Error(`no committed case definition for fixture: ${name}`);
  return found;
}

export type PinnedEnv = (home: string) => Record<string, string>;

/** The recorder's pinned environment, so the replay runs under the same one. */
export function loadPinnedEnv(): PinnedEnv {
  const mod: unknown = require_(path.join(REPO_ROOT, 'scripts/lib/hook-corpus-env.cjs'));
  if (typeof mod !== 'object' || mod === null) throw new Error('hook-corpus-env.cjs did not export an object');
  const fn = (mod as Record<string, unknown>).pinnedEnv;
  if (typeof fn !== 'function') throw new Error('hook-corpus-env.cjs exports no pinnedEnv');
  return fn as PinnedEnv;
}
