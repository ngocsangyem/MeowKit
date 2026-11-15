'use strict';
// pre-completion-check.cjs — the opt-in Stop-time check for edits left unverified.
//
// Off unless `hooks.pre-completion-check: true` is set. When on, a stop with files changed
// since the session's last passing test, build, lint or type-check run is answered with a
// block decision whose reason Claude Code feeds back as the next turn; after two reminders
// the session ends with a notice. Rule, evidence and limits: lib/core/completion-check.cjs.
//
// Advisory evidence of effort, not proof: a trivial passing command satisfies it.

const path = require('node:path');

const { configValue } = require('../lib/read-config.cjs');
const { sessionStateDir } = require('../lib/meowkit-paths.cjs');
const { STATE_FILE, decideStop } = require('../lib/core/completion-check.cjs');

module.exports = function preCompletionCheck(ctx) {
  if (configValue('hooks.pre-completion-check', false, { root: ctx.root }).value !== true) return null;
  const decision = decideStop({
    root: ctx.root,
    stateFile: path.join(sessionStateDir(ctx.root), STATE_FILE),
    sessionId: ctx.session_id || '',
    stopHookActive: ctx.stop_hook_active === true,
  });
  if (decision.action === 'block') {
    return { stdout: `${JSON.stringify({ decision: 'block', reason: decision.reason })}\n`, feedback: true };
  }
  if (decision.action === 'notice') {
    return { stdout: `${JSON.stringify({ systemMessage: decision.message })}\n`, feedback: true };
  }
  return null;
};
