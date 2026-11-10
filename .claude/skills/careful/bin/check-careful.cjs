#!/usr/bin/env node
'use strict';
// check-careful.cjs — ask before running a destructive command.
//
// Answers with a permission decision, not an exit code: the host turns a
// decision into a prompt the user can approve or refuse, which is the point. A
// failing exit is a flat refusal and cannot express "ask", so it would turn a
// confirmable warning into a block.//
// The decision is returned inside `hookSpecificOutput`, which is the form this
// event reads. A top-level `permissionDecision` — the shape the shell guard
// printed — is not a recognised field for it, so that output was read as "no
// decision" and the guard enforced nothing even once it was registered.
//
// In a production context a CRITICAL command is refused outright rather than
// prompted, because that is the one context where "approve to continue" is the
// wrong affordance — the override has to be a deliberate act outside the prompt.
//
// Every warning is logged before the answer is printed, so the record exists
// whether or not the user then approves.

const fs = require('node:fs');
const path = require('node:path');

const { classify, isDisposableCleanup } = require('../references/destructive-command-patterns.cjs');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const allow = () => {
  process.stdout.write('{}\n');
  process.exit(0);
};

const answer = (decision, reason) => {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
  })}\n`);
  process.exit(0);
};

/** Any of these naming a production-like environment escalates a refusal. */
function inProduction(env) {
  const combined = `${env.NODE_ENV || ''}${env.APP_ENV || ''}${env.ENVIRONMENT || ''}`;
  return /production|prod|staging/.test(combined);
}

/**
 * Append the warning to the override log. The user's actual decision happens at
 * the host's permission prompt, which this process never sees, so the entry
 * records the request rather than the outcome.
 */
function logOverrideRequest({ command, id, severity, now }) {
  const dir = process.env.CLAUDE_PLUGIN_DATA || path.join(root, '.meowkit/telemetry');
  const file = path.join(dir, 'security-log.md');
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, [
        '# Security Override Log',
        '',
        '| Timestamp | Pattern | Severity | Action | Command |',
        '|-----------|---------|----------|--------|---------|',
        '',
      ].join('\n'));
    }
    // One line per entry, so a multi-line command cannot break the table.
    const oneLine = command.replace(/\n/g, ' ').replace(/\|/g, '\\|');
    const ts = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    fs.appendFileSync(file, `| ${ts} | ${id || 'unknown'} | ${severity || 'UNKNOWN'} | override-request | ${oneLine} |\n`);
  } catch {
    // An unwritable log must not turn into a refusal.
  }
}

const { readHookInput } = require(path.join(root, '.claude/hooks/lib/parse-stdin.cjs'));

readHookInput().then((input) => {
  const command = input.command;
  if (!command) allow();

  if (isDisposableCleanup(command)) allow();

  const finding = classify(command);
  if (!finding) allow();

  logOverrideRequest({ command, id: finding.id, severity: finding.severity, now: new Date() });

  if (inProduction(process.env) && finding.severity === 'CRITICAL') {
    answer('block', `[careful] PRODUCTION BLOCK: ${finding.warning} Override requires a human to unset NODE_ENV/APP_ENV/ENVIRONMENT.`);
  }
  answer('ask', `[careful] ${finding.warning}`);
});
