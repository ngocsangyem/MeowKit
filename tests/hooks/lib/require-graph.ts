// require-graph.ts — what a hook entrypoint can actually reach.
//
// Both the environment-set proof and the isolation proof need the same answer:
// the full set of files one entrypoint pulls in. Reading that from the source
// rather than from a runtime trace is deliberate — a runtime trace only shows
// the branches that particular input took, and the branch that matters is
// usually the one the test did not exercise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '../../..');

/** Every `require('…')` target spelled as a string literal. */
const REQUIRE_CALL = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

export interface GraphFile {
  /** Repo-relative path. */
  rel: string;
  source: string;
}

/**
 * Walk the graph from `entryRel`, following only relative requires. A bare
 * specifier is either a node built-in or a package; built-ins are reported
 * separately because the isolation proof cares which ones appear, and a hook
 * tree has no package dependencies to follow.
 */
export function requireGraph(entryRel: string): { files: GraphFile[]; builtins: Set<string> } {
  const files: GraphFile[] = [];
  const builtins = new Set<string>();
  const seen = new Set<string>();
  const queue = [entryRel];

  while (queue.length > 0) {
    const rel = queue.shift() as string;
    if (seen.has(rel)) continue;
    seen.add(rel);

    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const source = fs.readFileSync(abs, 'utf8');
    files.push({ rel, source });

    for (const match of source.matchAll(REQUIRE_CALL)) {
      const target = match[1];
      if (target.startsWith('.')) {
        queue.push(path.posix.join(path.posix.dirname(rel), target));
      } else {
        builtins.add(target.replace(/^node:/, ''));
      }
    }
  }
  return { files, builtins };
}

/**
 * Environment variables a file reads. Covers both the direct form and the
 * injected form, where an entrypoint hands `process.env` to a library as an
 * `env` argument — a scan for only the direct form would miss every variable a
 * library consults on the entrypoint's behalf.
 */
export function envReads(source: string): Set<string> {
  const found = new Set<string>();
  const patterns = [
    /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
    /\bprocess\.env\[\s*['"]([^'"]+)['"]\s*\]/g,
    /(?<![.\w])env\.([A-Z][A-Z0-9_]{2,})/g,
    /(?<![.\w])env\[\s*['"]([A-Z][A-Z0-9_]{2,})['"]\s*\]/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) found.add(m[1]);
  }
  return found;
}

/** Child-process entry points, with the first argument as written. */
const SPAWN_CALL = /\b(spawnSync|spawn|execFileSync|execFile|execSync|exec|fork)\s*\(\s*([^,)]+)/g;

export interface SpawnSite {
  rel: string;
  fn: string;
  /** The first argument's source text: a quoted literal, or an expression. */
  target: string;
}

export function spawnSites(files: GraphFile[]): SpawnSite[] {
  const sites: SpawnSite[] = [];
  for (const { rel, source } of files) {
    for (const m of source.matchAll(SPAWN_CALL)) {
      sites.push({ rel, fn: m[1], target: m[2].trim() });
    }
  }
  return sites;
}

/** The literal value of a spawn target, or null when it is an expression. */
export function literalTarget(target: string): string | null {
  const m = target.match(/^['"]([^'"]*)['"]$/);
  return m ? m[1] : null;
}

/** Every string literal in a file that could name an executable. */
export function commandLiterals(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/['"]([A-Za-z][\w.@/-]*)['"]/g)) out.push(m[1]);
  return out;
}
