#!/usr/bin/env node
'use strict';
// record-port-golden-corpus.cjs — record what the two interpreter-dependent
// CLIs do, by running them, before either is reimplemented on node.
//
//   node scripts/record-port-golden-corpus.cjs [--out <dir>] [--base <sha>] [--filter <substr>]
//
// Default --out is tests/ports/golden (the committed corpus). Point --out at a
// temp directory and diff the result against the committed corpus to show the
// recording is deterministic; that diff is the verification step.
//
// Subjects: `.claude/scripts/injection-audit.py` (Python) and
// `.claude/scripts/bin/workflow-config` (bash + two `python3 -c` heredocs). Both
// are read out of the pinned commit through `git archive`, never out of the
// working tree, so the corpus can be re-recorded after the working tree no
// longer contains them.
//
// This script and the hook corpus recorder are the only two places that run a
// shell or an interpreter on purpose. Everything recorded here is replayed
// against the ports by tests/ports, which spawns neither.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PINNED_PATH } = require('./lib/hook-corpus-env.cjs');
const { applyNormalizers, extractBase, newProject, resolvePython } = require('./lib/port-corpus-env.cjs');
const { invokeBase } = require('./lib/port-corpus-invoke.cjs');

const BASE_SHA = 'a190cc91692acf90fb3bfde4c3aee2479f717d9e';
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'tests/ports/golden');

const CASES = [
  ...require('./lib/port-corpus-cases-injection-audit.cjs'),
  ...require('./lib/port-corpus-cases-injection-audit-paths.cjs'),
  ...require('./lib/port-corpus-cases-workflow-config.cjs'),
];

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

/** Read a side-effect path, or null when the case expects it not to exist. */
function readSideEffect(projectDir, rel) {
  try {
    return fs.readFileSync(path.join(projectDir, rel), 'utf8');
  } catch {
    return null;
  }
}

function recordCase(baseTree, kase, baseSha, python) {
  const caseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-port-'));
  const projectDir = newProject(baseTree, path.join(caseRoot, 'project'));
  const ctx = {
    projectDir,
    caseRoot,
    home: path.join(projectDir, 'home'),
    python,
    pathWithPython: [python.dir, PINNED_PATH].join(path.delimiter),
  };

  kase.setup(ctx);
  const result = invokeBase(ctx, kase.invocation);
  const norm = (text) => applyNormalizers(text, kase.normalizers, ctx);

  const sideEffects = {};
  for (const rel of kase.sideEffectPaths || []) {
    const body = readSideEffect(projectDir, rel);
    sideEffects[rel] = body === null ? null : norm(body);
  }

  fs.rmSync(caseRoot, { recursive: true, force: true });

  return {
    name: kase.name,
    group: kase.group,
    base: baseSha,
    invocation: kase.invocation,
    setup: kase.name,
    setupDescription: kase.setupDescription,
    normalizers: kase.normalizers,
    expect: {
      exit: result.exit,
      signal: result.signal,
      stdout: norm(result.stdout),
      stderr: norm(result.stderr),
    },
    sideEffects,
  };
}

function main(argv) {
  const { outDir, base, filter } = parseArgs(argv);
  const selected = filter ? CASES.filter((c) => c.name.includes(filter)) : CASES;
  if (!selected.length) throw new Error(`no case matched filter: ${filter}`);

  const names = new Set();
  for (const kase of CASES) {
    if (names.has(kase.name)) throw new Error(`duplicate case name: ${kase.name}`);
    names.add(kase.name);
  }

  const python = resolvePython();
  process.stdout.write(`interpreter: ${python.bin} (${python.version})\n\n`);

  const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-port-base-'));
  const baseTree = extractBase(REPO_ROOT, base, path.join(extractRoot, 'tree'));

  fs.mkdirSync(outDir, { recursive: true });
  const groups = {};
  for (const kase of selected) {
    const fixture = recordCase(baseTree, kase, base, python);
    const file = path.join(outDir, `${kase.name}.json`);
    fs.writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
    groups[kase.group] = (groups[kase.group] || 0) + 1;
    process.stdout.write(`recorded ${kase.name} (exit ${fixture.expect.exit})\n`);
  }

  fs.rmSync(extractRoot, { recursive: true, force: true });

  if (!filter) {
    const index = {
      base,
      recorder: 'scripts/record-port-golden-corpus.cjs',
      fixtureCount: selected.length,
      groups,
      subjects: {
        'injection-audit': '.claude/scripts/injection-audit.py',
        'workflow-config': '.claude/scripts/bin/workflow-config',
      },
      // Recorded because the subject does not run on every interpreter that
      // satisfies its own stated floor: its annotations need 3.10, so a rerun
      // under an older python3 would produce tracebacks instead of decisions.
      pythonVersion: python.version,
    };
    fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  }
  process.stdout.write(`\n${selected.length} fixtures → ${outDir}\n`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
