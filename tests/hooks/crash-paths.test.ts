// crash-paths.test.ts — a guard that cannot evaluate must block, not stand aside.
//
// Only exit 2 stops a tool call. Every other exit, including the one node uses
// for an uncaught error, is advisory: the host logs it and the call proceeds. So
// the dangerous failure for a write guard is not "it decided wrong", it is "it
// crashed" — which by default reads as permission.
//
// Each scenario here breaks the guard a different way and demands the same
// answer: exit 2, with the guard's marker on stderr so the model is told why.
// The damage is done to a throwaway copy of the hook tree; nothing in the
// repository is modified, and no scenario needs a shipped switch to simulate it.

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

interface Entrypoint {
  name: string;
  file: string;
  marker: string;
  /** A library this entrypoint reaches, used by the break-a-dependency scenarios. */
  lib: string;
  /** A function in that library whose failure the entrypoint must survive as a block. */
  libExport: string;
  stdin: string;
}

const PAYLOAD = JSON.stringify({
  session_id: 'crash-path',
  hook_event_name: 'PreToolUse',
  tool_name: 'Edit',
  tool_input: { file_path: 'src/app.ts', command: 'git commit -m "feat: thing"' },
});

const ENTRYPOINTS: Entrypoint[] = [
  {
    name: 'gate-enforcement',
    file: '.claude/hooks/gate-enforcement.cjs',
    marker: '@@GATE_BLOCK@@',
    lib: '.claude/hooks/lib/gate1-path-rules.cjs',
    libExport: 'isContractFile',
    stdin: PAYLOAD,
  },
  {
    name: 'privacy-block',
    file: '.claude/hooks/privacy-block.cjs',
    marker: '@@PRIVACY_BLOCK@@',
    lib: '.claude/hooks/lib/parse-stdin.cjs',
    libExport: 'readHookInput',
    stdin: PAYLOAD,
  },
  {
    name: 'pre-ship',
    file: '.claude/hooks/pre-ship.cjs',
    marker: '@@GATE_BLOCK@@',
    lib: '.claude/hooks/lib/gate2-check.cjs',
    libExport: 'gate2Check',
    stdin: PAYLOAD,
  },
];

function scratchTree(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-hook-crash-'));
  fs.cpSync(path.join(REPO_ROOT, '.claude/hooks'), path.join(dir, '.claude/hooks'), { recursive: true });
  return dir;
}

function run(dir: string, entry: Entrypoint, stdin: string) {
  const r = spawnSync(process.execPath, [path.join(dir, entry.file)], {
    cwd: dir,
    input: stdin,
    // A closed environment: only the project root, so no scenario can be rescued
    // by something the recording host happened to export.
    env: { CLAUDE_PROJECT_DIR: dir, HOME: dir, PATH: process.env.PATH ?? '' },
    encoding: 'utf8',
  });
  return { exit: r.status ?? -1, stderr: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** Make the library unparseable, the way a bad edit or a truncated write would. */
function injectSyntaxError(dir: string, entry: Entrypoint) {
  fs.appendFileSync(path.join(dir, entry.lib), '\nthis is not valid javascript (\n');
}

/** Replace one exported function with one that throws, in the throwaway copy only. */
function patchExportToThrow(dir: string, entry: Entrypoint) {
  const file = path.join(dir, entry.lib);
  fs.appendFileSync(
    file,
    `\nmodule.exports.${entry.libExport} = () => { throw new Error('patched to throw'); };\n`,
  );
}

const SCENARIOS: Array<{ label: string; prepare: (dir: string, e: Entrypoint) => void; stdin: (e: Entrypoint) => string }> = [
  { label: 'a library it requires has a syntax error', prepare: injectSyntaxError, stdin: (e) => e.stdin },
  { label: 'a library it requires is deleted', prepare: (d, e) => fs.rmSync(path.join(d, e.lib)), stdin: (e) => e.stdin },
  { label: 'stdin is empty', prepare: () => {}, stdin: () => '' },
  { label: 'stdin is not JSON', prepare: () => {}, stdin: () => 'not json at all\n' },
  { label: 'a library function throws', prepare: patchExportToThrow, stdin: (e) => e.stdin },
];

describe('safety entrypoints fail closed on every crash path', () => {
  for (const entry of ENTRYPOINTS) {
    for (const scenario of SCENARIOS) {
      it(`${entry.name}: ${scenario.label}`, () => {
        const dir = scratchTree();
        scenario.prepare(dir, entry);
        const { exit, stderr } = run(dir, entry, scenario.stdin(entry));
        expect(exit, `${entry.name} exit for "${scenario.label}"`).toBe(2);
        expect(stderr, `${entry.name} marker for "${scenario.label}"`).toContain(entry.marker);
      });
    }
  }

  it('covers every entrypoint against every scenario', () => {
    // Guards the shape of the matrix: dropping an entrypoint or a scenario would
    // otherwise quietly shrink the proof rather than fail.
    expect(ENTRYPOINTS).toHaveLength(3);
    expect(SCENARIOS).toHaveLength(5);
  });
});
