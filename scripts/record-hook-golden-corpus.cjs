#!/usr/bin/env node
'use strict';
// record-hook-golden-corpus.cjs — record the the contract golden corpus by running the
// BASE (pre-port) bash hooks and capturing exactly what they do.
//
//   node scripts/record-hook-golden-corpus.cjs [--out <dir>] [--base <sha>] [--filter <substr>]
//
// Default --out is tests/hooks/golden (the committed corpus). Point --out at a
// temp directory and diff the result against the committed corpus to prove the
// recording is deterministic — that diff is the contract's verification step.
//
// This script is the ONE place that still runs bash on purpose (the contract excludes
// it from the CI suites). Everything it records is replayed against the node
// ports by tests/hooks/golden, which spawns no shell.
//
// Determinism: every case runs in a fresh throwaway project under a pinned
// environment (see lib/hook-corpus-env.cjs). The only value that cannot be
// pinned is the temp directory path, which is normalized to {{TMP}} — the one
// substitution the contract allows.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { applyNormalizers, extractBase, runScript } = require('./lib/hook-corpus-env.cjs');
const { newProject } = require('./lib/hook-corpus-fs.cjs');

const BASE_SHA = 'b8556870d9f9f65ff82ececec44f9d2a751b2e37';
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'tests/hooks/golden');
const MARKERS = ['@@GATE_BLOCK@@', '@@CONTRACT_GATE_BLOCK@@', '@@PRIVACY_BLOCK@@'];

const CASES = [
  ...require('./lib/hook-corpus-cases-gate1.cjs'),
  ...require('./lib/hook-corpus-cases-preship.cjs'),
  ...require('./lib/hook-corpus-cases-privacy.cjs'),
  ...require('./lib/hook-corpus-cases-feedback.cjs'),
  ...require('./lib/hook-corpus-cases-guards.cjs'),
  ...require('./lib/hook-corpus-cases-gate-helpers.cjs'),
  ...require('./lib/hook-corpus-cases-observers.cjs'),
  ...require('./lib/hook-corpus-cases-cli.cjs'),
];

/** Observers whose BASE output cannot be pinned, recorded as a reason rather than faked. */
const SKIPPED = {
  'post-session': 'reads the live transcript path and writes duration/token fields derived from it; no fixture can supply a transcript whose derived numbers are stable across runs',
  'project-context-loader': 'emits the repo-relative content of docs/ and .claude/rules/ at BASE, so its output is a copy of files this sprint is also changing; verified by a node unit test over a pinned fixture tree instead',
};

function parseArgs(argv) {
  const out = { outDir: DEFAULT_OUT, base: BASE_SHA, filter: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') out.outDir = path.resolve(argv[++i]);
    else if (argv[i] === '--base') out.base = argv[++i];
    else if (argv[i] === '--filter') out.filter = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return out;
}

/** Replace the {{TMP}} placeholder in a recorded input with the real project path. */
function resolvePlaceholders(value, projectDir) {
  if (typeof value === 'string') return value.split('{{TMP}}').join(projectDir);
  if (Array.isArray(value)) return value.map((v) => resolvePlaceholders(v, projectDir));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolvePlaceholders(v, projectDir)]));
  }
  return value;
}

function detectMarker(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`;
  return MARKERS.find((m) => combined.includes(m)) || null;
}

function recordCase(testCase, baseTree, workRoot) {
  const projectDir = path.join(workRoot, testCase.name);
  newProject(baseTree, projectDir);
  const home = path.join(projectDir, 'home');
  // `ext` tells a setup which implementation flavor the tree under it holds, so
  // "this library is absent" deletes the right file here and in the replay.
  const ctx = { projectDir, home, ext: '.sh' };
  testCase.setup(ctx);

  const normalizers = testCase.normalizers || ['tmpdir'];
  const args = resolvePlaceholders(testCase.args || [], projectDir);
  const env = resolvePlaceholders(testCase.env || {}, projectDir);
  const stdin = testCase.stdin === null || testCase.stdin === undefined
    ? null
    : resolvePlaceholders(testCase.stdin, projectDir);

  const result = runScript({
    script: path.join(projectDir, testCase.entrypoint),
    args,
    cwd: projectDir,
    stdin,
    env,
    home,
  });

  const norm = (text) => applyNormalizers(text, normalizers, ctx);
  const sideEffects = {};
  for (const rel of testCase.sideEffects || []) {
    const abs = path.join(projectDir, rel);
    sideEffects[rel] = fs.existsSync(abs) ? norm(fs.readFileSync(abs, 'utf8')) : null;
  }

  return {
    name: testCase.name,
    group: testCase.group,
    base: BASE_SHA,
    entrypoint: testCase.entrypoint,
    args: testCase.args || [],
    stdin: testCase.stdin === null || testCase.stdin === undefined ? null : testCase.stdin,
    env: testCase.env || {},
    setup: testCase.name,
    setupDescription: testCase.setupDescription,
    normalizers,
    expect: {
      exit: result.exit,
      signal: result.signal,
      marker: detectMarker(result.stdout, result.stderr),
      stdout: norm(result.stdout),
      stderr: norm(result.stderr),
    },
    sideEffects: Object.keys(sideEffects).length ? sideEffects : undefined,
  };
}

function main() {
  const { outDir, base, filter } = parseArgs(process.argv.slice(2));
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-hook-corpus-'));
  const baseTree = extractBase(REPO_ROOT, base, path.join(workRoot, '_base'));

  const cases = filter ? CASES.filter((c) => c.name.includes(filter)) : CASES;
  const names = new Set();
  for (const c of cases) {
    if (names.has(c.name)) throw new Error(`duplicate case name: ${c.name}`);
    names.add(c.name);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const testCase of cases) {
    const fixture = recordCase(testCase, baseTree, workRoot);
    fs.writeFileSync(path.join(outDir, `${testCase.name}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
    written.push(fixture);
    process.stderr.write(`recorded ${testCase.name} (exit ${fixture.expect.exit}${fixture.expect.marker ? `, ${fixture.expect.marker}` : ''})\n`);
  }

  const groups = {};
  for (const f of written) groups[f.group] = (groups[f.group] || 0) + 1;
  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    `${JSON.stringify(
      {
        base: BASE_SHA,
        recorder: 'scripts/record-hook-golden-corpus.cjs',
        fixtureCount: written.length,
        groups,
        fixtures: written.map((f) => ({ name: f.name, group: f.group, entrypoint: f.entrypoint, exit: f.expect.exit, marker: f.expect.marker })),
        notRecorded: SKIPPED,
      },
      null,
      2,
    )}\n`,
  );
  process.stderr.write(`\n${written.length} fixtures -> ${outDir}\nwork tree: ${workRoot}\n`);
}

if (require.main === module) main();
module.exports = { CASES, SKIPPED, recordCase };
