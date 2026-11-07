// replay-harness.ts — run a recorded fixture against the node hook tree.
//
// The fixture stores a setup *id*, not a file-tree recipe, so the recipe is
// taken from the same committed case definitions the recorder used. Reusing them
// is the point: if the replay built its own tree, a divergence between the two
// trees would read as a behavior difference in the code under test.
//
// The tree copied in here is the working tree's `.claude/`, not the pinned
// shell one, and no step spawns a shell: the entrypoint is this node binary
// running a `.cjs` file.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { REPO_ROOT, caseFor, loadPinnedEnv } from './corpus-cases';
import { dispatchedHandler, nodeEntrypoint, prepareDispatch } from './dispatch-replay';

export { REPO_ROOT, nodeEntrypoint };
export const GOLDEN_DIR = path.join(REPO_ROOT, 'tests/hooks/golden');

const pinnedEnv = loadPinnedEnv();

export interface Fixture {
  name: string;
  group: string;
  entrypoint: string;
  args: string[];
  stdin: string | null;
  env: Record<string, string>;
  setup: string;
  setupDescription: string;
  normalizers: string[];
  expect: { exit: number; signal: string | null; marker: string | null; stdout: string; stderr: string };
  sideEffects?: Record<string, string | null>;
}

export function loadFixtures(): Fixture[] {
  return fs
    .readdirSync(GOLDEN_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, f), 'utf8')) as Fixture);
}

/** The kit directories a hook under test may reach into. */
const TREE = [
  '.claude/hooks',
  '.claude/scripts',
  '.claude/skills/careful',
  '.claude/skills/freeze',
  '.claude/skills/investigate',
  '.claude/skills/sprint-contract',
  '.claude/skills/cook/scripts',
];

/**
 * Runtime state that lives inside the kit tree but is not part of it. The
 * recorder read the tree out of version control, which excluded these by
 * construction; copying them here would seed a throwaway project with this
 * machine's accumulated logs and a side-effect assertion would compare against
 * history instead of against what the run produced.
 */
const RUNTIME_STATE = ['.logs', 'session-state', '.venv'];

function copyTree(projectDir: string) {
  for (const rel of TREE) {
    const src = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(projectDir, rel), {
      recursive: true,
      filter: (from) => !RUNTIME_STATE.includes(path.basename(from)),
    });
  }
}

/**
 * A recorded stub path points at a shebang script. A shebang does not make a
 * file executable on Windows, so there the stub is re-emitted as a batch file
 * and the variable is pointed at that instead.
 */
function platformStub(projectDir: string, value: string): string {
  if (process.platform !== 'win32') return value;
  const rel = path.relative(projectDir, value);
  const source = fs.readFileSync(value, 'utf8').replace(/^#![^\n]*\n/, '');
  const cmd = `${value}.cmd`;
  fs.writeFileSync(path.join(projectDir, `${rel}.js`), source);
  fs.writeFileSync(cmd, `@echo off\r\nnode "%~dp0${path.basename(rel)}.js" %*\r\n`);
  return cmd;
}

const resolvePlaceholders = (value: string, projectDir: string) => value.split('{{TMP}}').join(projectDir);

export interface ReplayResult {
  exit: number;
  stdout: string;
  stderr: string;
  marker: string | null;
  sideEffects: Record<string, string | null>;
  projectDir: string;
}

const MARKERS = ['@@GATE_BLOCK@@', '@@CONTRACT_GATE_BLOCK@@', '@@PRIVACY_BLOCK@@'];

/**
 * Normalizers, by the names a fixture records. `tmpdir` is the only one the
 * safety corpus uses; the rest exist for fixtures whose BASE output embeds a
 * wall clock.
 */
export const NORMALIZERS: Record<string, (text: string, projectDir: string) => string> = {
  tmpdir: (text, projectDir) => text.split(projectDir).join('{{TMP}}'),
  isoTimestamp: (text) => text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, '{{TS}}'),
  homedir: (text, projectDir) => text.split(path.join(projectDir, 'home')).join('{{HOME}}'),
  isoDate: (text) => text.replace(/\d{4}-\d{2}-\d{2}/g, '{{DATE}}'),
  pid: (text) => text.replace(/\.approval\.\d+/g, '.approval.{{PID}}'),
};

/**
 * Rewrite a module's own filename back to the extension the recording named.
 *
 * A handful of diagnostics quote the implementation file they are about: "run
 * this validator for details", "this checker is missing", "usage: <this
 * script>". The port changes that filename, so the quoted name differs from the
 * recording even though the decision, the exit code and every other line are
 * identical. One substitution, applied only to the fixtures listed in the suite,
 * never corpus-wide.
 */
export const selfPath = (text: string) => text.replace(/([\w./-]+)\.cjs\b/g, '$1.sh');

export function replay(fixture: Fixture): ReplayResult {
  const testCase = caseFor(fixture.name);
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-hook-replay-'));
  copyTree(projectDir);
  const home = path.join(projectDir, 'home');
  fs.mkdirSync(home, { recursive: true });
  testCase.setup({ projectDir, home, ext: '.cjs' });

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(fixture.env)) {
    const resolved = resolvePlaceholders(v, projectDir);
    env[k] = k === 'MEOWKIT_CLI' ? platformStub(projectDir, resolved) : resolved;
  }

  // An observer is no longer a file the host launches, so it is replayed the
  // way it now runs: through the dispatcher, over a registry narrowed to the one
  // entry under test.
  const dispatched = dispatchedHandler(fixture.group);
  const invocation = dispatched
    ? prepareDispatch(projectDir, dispatched)
    : { script: path.join(projectDir, nodeEntrypoint(fixture.entrypoint)), args: [] };

  const r = spawnSync(process.execPath, [
    invocation.script,
    ...invocation.args,
    ...fixture.args.map((a) => resolvePlaceholders(a, projectDir)),
  ], {
    cwd: projectDir,
    input: fixture.stdin === null ? '' : resolvePlaceholders(fixture.stdin, projectDir),
    env: { ...pinnedEnv(home), ...env },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  const norm = (text: string) =>
    fixture.normalizers.reduce((acc, name) => NORMALIZERS[name](acc, projectDir), text ?? '');

  const sideEffects: Record<string, string | null> = {};
  for (const rel of Object.keys(fixture.sideEffects ?? {})) {
    const abs = path.join(projectDir, rel);
    sideEffects[rel] = fs.existsSync(abs) ? norm(fs.readFileSync(abs, 'utf8')) : null;
  }

  const stdout = norm(r.stdout ?? '');
  const stderr = norm(r.stderr ?? '');
  return {
    exit: r.status ?? -1,
    stdout,
    stderr,
    marker: MARKERS.find((m) => `${stdout}\n${stderr}`.includes(m)) ?? null,
    sideEffects,
    projectDir,
  };
}
