#!/usr/bin/env node
// output-injection-audit.cjs — Phase 0 Gate Check: Audit B (RT2-01)
// Tests which hook output path reaches the model's context.
//
// Emits 3 markers via different mechanisms:
//   a) stdout plain text
//   b) stdout JSON with systemMessage field
//   c) stderr (for logging only — not expected to reach model)
//
// After running a session with this hook, ask the agent:
//   "What markers did you receive from hooks? Look for GATE_AUDIT strings."
//
// Usage in settings.json (PostToolUse only):
//   "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/output-injection-audit.cjs\""

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_DIR = path.join(ROOT, 'session-state');
const COUNTER_FILE = path.join(STATE_DIR, 'audit-injection-counter.json');

// Read and increment counter to make each marker unique
let counter = 0;
try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
  counter = (data.count || 0) + 1;
} catch {
  counter = 1;
}
fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count: counter }));

const ts = Date.now();

// Marker A: plain stdout
const stdoutMarker = `GATE_AUDIT_STDOUT_${counter}_${ts}`;
process.stdout.write(stdoutMarker + '\n');

// Marker B: JSON systemMessage on stdout
const sysMsg = `GATE_AUDIT_SYSMSG_${counter}_${ts}`;
process.stdout.write(JSON.stringify({ systemMessage: sysMsg }) + '\n');

// Marker C: stderr (control — should NOT reach model)
process.stderr.write(`GATE_AUDIT_STDERR_${counter}_${ts}\n`);

// Log what we emitted for later analysis
const logEntry = {
  timestamp: new Date().toISOString(),
  counter,
  markers: {
    stdout: stdoutMarker,
    systemMessage: sysMsg,
    stderr: `GATE_AUDIT_STDERR_${counter}_${ts}`,
  },
};

const LOG_FILE = path.join(STATE_DIR, 'audit-injection-log.jsonl');
fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
