'use strict';
// verification-evidence.cjs — record what the opt-in completion check compares against.
//
// SessionStart: the tree the session starts from, so changes already present never arm it.
// PostToolUse(Bash): after a test, build, lint or type-check command, the tree at that pass.
// Claude Code runs PostToolUse only for a tool call that succeeded (a failed one goes to
// PostToolUseFailure), so reaching this handler on Bash means the command exited 0.
//
// Does nothing unless `hooks.pre-completion-check: true` is set: the check is off by default
// and its evidence costs a git diff per verification command. Rule and limits:
// lib/core/completion-check.cjs.

const path = require('node:path');

const { configValue } = require('../lib/read-config.cjs');
const { sessionStateDir } = require('../lib/meowkit-paths.cjs');
const { STATE_FILE, recordPass, recordBaseline } = require('../lib/core/completion-check.cjs');

module.exports = function verificationEvidence(ctx) {
  if (configValue('hooks.pre-completion-check', false, { root: ctx.root }).value !== true) return null;
  const stateFile = path.join(sessionStateDir(ctx.root), STATE_FILE);
  const sessionId = ctx.session_id || '';
  if (ctx.event === 'SessionStart') {
    recordBaseline({ root: ctx.root, stateFile, sessionId });
    return null;
  }
  const command = ctx.tool_input && typeof ctx.tool_input.command === 'string' ? ctx.tool_input.command : '';
  recordPass({ root: ctx.root, stateFile, sessionId, command });
  return null;
};
