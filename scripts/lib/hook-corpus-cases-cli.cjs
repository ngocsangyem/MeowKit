'use strict';
// hook-corpus-cases-cli.cjs — cases for the CLI module append-trace.cjs, which
// another module invokes with argv, never a hook event: post-session.cjs and
// learning-observer.cjs call it with `<event-type> '<json-payload>'`.

const F = require('./hook-corpus-fs.cjs');
const { PROJECT_DIR_ENV: PROJ } = require('./hook-corpus-payload.cjs');

const H = '.claude/hooks';
const TRACE_LOG = '.meowkit/telemetry/trace-log.jsonl';

const cases = [
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
