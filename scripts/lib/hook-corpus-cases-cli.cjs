'use strict';
// hook-corpus-cases-cli.cjs — cases for the two CLI modules: scripts an
// agent or another module invokes with argv, never a hook event.
//
//   pre-implement.cjs — invoked by .claude/agents/developer.md:29. Fail-CLOSED in
//                      strict TDD mode, fail-open by default.
//   append-trace.cjs  — invoked by post-session.cjs and learning-observer.cjs with
//                      `<event-type> '<json-payload>'`.

const F = require('./hook-corpus-fs.cjs');
const { PROJECT_DIR_ENV: PROJ } = require('./hook-corpus-payload.cjs');

const H = '.claude/hooks';
const TRACE_LOG = '.meowkit/telemetry/trace-log.jsonl';
const STRICT = { ...PROJ, MEOWKIT_TDD: '1' };

const cases = [
  {
    group: 'cli-pre-implement',
    entrypoint: `${H}/pre-implement.sh`,
    name: 'preimplement-tdd-off-default',
    args: ['parser'],
    setupDescription: 'no MEOWKIT_TDD, no tdd-mode sentinel — the default-off path',
    setup: () => {},
  },
  {
    group: 'cli-pre-implement',
    entrypoint: `${H}/pre-implement.sh`,
    name: 'preimplement-strict-tdd-no-tests',
    args: ['parser'],
    env: STRICT,
    setupDescription: 'strict TDD mode with no test file naming the feature',
    setup: () => {},
  },
  {
    group: 'cli-pre-implement',
    entrypoint: `${H}/pre-implement.sh`,
    name: 'preimplement-strict-tdd-sentinel-on',
    args: ['parser'],
    setupDescription: 'TDD enabled via the .claude/session-state/tdd-mode sentinel rather than the env var',
    setup: (ctx) => F.writeFile(ctx.projectDir, '.claude/session-state/tdd-mode', 'on\n'),
  },
  {
    group: 'cli-pre-implement',
    entrypoint: `${H}/pre-implement.sh`,
    name: 'preimplement-strict-tdd-helper-missing',
    args: ['parser'],
    env: STRICT,
    setupDescription: 'strict TDD mode with lib/tdd-detect.sh deleted — the fail-closed path',
    setup: (ctx) => F.removeLib(ctx, '.claude/hooks/lib/tdd-detect'),
  },
  {
    group: 'cli-pre-implement',
    entrypoint: `${H}/pre-implement.sh`,
    name: 'preimplement-no-feature-argument',
    args: [],
    env: STRICT,
    setupDescription: 'strict TDD mode, no feature argument',
    setup: () => {},
  },
  {
    group: 'cli-append-trace',
    entrypoint: `${H}/append-trace.sh`,
    name: 'appendtrace-file-edited',
    args: ['file_edited', '{"file":"src/app.ts","edit_count":3}'],
    setupDescription: 'BASE hook tree only; no prior trace log',
    setup: () => {},
    normalizers: ['tmpdir', 'isoTimestamp'],
    sideEffects: [TRACE_LOG],
  },
  {
    group: 'cli-append-trace',
    entrypoint: `${H}/append-trace.sh`,
    name: 'appendtrace-scrubs-secret',
    args: ['tool_run', '{"cmd":"deploy --token=ghp_0123456789abcdefghijklmnopqrstuvwxyzAB"}'],
    setupDescription: 'a payload carrying a secret-shaped token, to record the scrub',
    setup: () => {},
    normalizers: ['tmpdir', 'isoTimestamp'],
    sideEffects: [TRACE_LOG],
  },
  {
    group: 'cli-append-trace',
    entrypoint: `${H}/append-trace.sh`,
    name: 'appendtrace-no-arguments',
    args: [],
    setupDescription: 'no event type and no payload',
    setup: () => {},
    normalizers: ['tmpdir', 'isoTimestamp'],
    sideEffects: [TRACE_LOG],
  },
];

module.exports = cases.map((c) => ({ env: PROJ, stdin: null, ...c }));
