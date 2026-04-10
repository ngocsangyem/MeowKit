#!/usr/bin/env node
// stdin-audit.cjs — Phase 0 Gate Check: Audit A
// Logs full stdin JSON per hook event to session-state/hook-stdin-audit.jsonl
// Register for ALL events to discover what Claude Code exposes.
//
// Usage in settings.json:
//   "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/stdin-audit.cjs\" <EventName>"

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_DIR = path.join(ROOT, 'session-state');
const LOG_FILE = path.join(STATE_DIR, 'hook-stdin-audit.jsonl');

const eventName = process.argv[2] || 'unknown';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });

    let parsed = null;
    try {
      parsed = JSON.parse(input || '{}');
    } catch {
      // raw input not valid JSON — log as-is
    }

    const entry = {
      timestamp: new Date().toISOString(),
      event: eventName,
      stdin_length: input.length,
      parsed: parsed,
      raw_preview: parsed ? undefined : input.slice(0, 2000),
      env_snapshot: {
        CLAUDE_MODEL: process.env.CLAUDE_MODEL || null,
        CLAUDE_MODEL_ID: process.env.CLAUDE_MODEL_ID || null,
        CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR || null,
        MEOWKIT_MODEL_HINT: process.env.MEOWKIT_MODEL_HINT || null,
        CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID || null,
      },
      argv: process.argv.slice(2),
    };

    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    process.stderr.write(`stdin-audit: ${err.message}\n`);
  }
});
