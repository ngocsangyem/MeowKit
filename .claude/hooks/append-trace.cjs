#!/usr/bin/env node
'use strict';
// append-trace.cjs — write one record to the shared trace history.
//
//   node append-trace.cjs <event-type> '<json-payload>'
//
// Invoked with arguments by other hooks and by harness steps, never by an event.
// Always exits 0: a lost trace record must never break the chain that produced
// it, which is why every failure inside the writer is swallowed rather than
// reported upward.

const { appendTrace } = require('./lib/trace-log.cjs');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
appendTrace({ root, event: process.argv[2] || 'unknown', payload: process.argv[3] || '' });
process.exit(0);
