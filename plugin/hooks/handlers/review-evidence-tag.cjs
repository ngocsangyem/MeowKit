'use strict';

/**
 * review-evidence-tag — PostToolUse:Bash handler (registered alongside the existing
 * Bash handler; NO new matcher). When the driving session runs `mewkit review read
 * --session <id> … <target>`, the host fires this hook independently of the CLI, so
 * appending a hook-side EvidenceEvent lets `mewkit review coverage` CORROBORATE the
 * CLI receipt and upgrade the read to `session-observed`.
 *
 * Session-gated + fail-open: it acts ONLY when the command is a review-read for an
 * existing session dir (cheap stat). It records NOTHING for any other Bash work —
 * no ambient logging. It never blocks (errors are swallowed by dispatch.cjs).
 *
 * NOTE (phase-04-capability-spike): this fires only for the DRIVING session's own
 * Bash. Subagent Bash does not reach the parent dispatcher, so subagent-driven
 * reviews stay `attested`. The handler carries no agent id — it proves session-level
 * observed access, never individual-reviewer provenance.
 */

const fs = require('fs');
const path = require('path');

const SESSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

module.exports = function reviewEvidenceTag(ctx) {
  const command = ctx && ctx.tool_input && typeof ctx.tool_input.command === 'string' ? ctx.tool_input.command : '';
  if (!command || !/\breview\s+read\b/.test(command) || !/\bmewkit\b|review\/read|index\.(c|m)?js/.test(command)) return;

  const tokens = command.trim().split(/\s+/);
  const ri = tokens.findIndex((t, i) => t === 'read' && tokens[i - 1] === 'review');
  if (ri === -1) return;
  const rest = tokens.slice(ri + 1);

  // Support both `--session X` and `--session=X`.
  let session = null;
  const si = rest.indexOf('--session');
  if (si !== -1) session = rest[si + 1];
  else { const eq = rest.find((t) => t.startsWith('--session=')); if (eq) session = eq.slice('--session='.length); }
  if (!session || session.includes('..') || !SESSION_RE.test(session)) return; // gate: valid session only

  // target = the last non-flag token that is not itself a flag value.
  const flagVals = new Set();
  for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) flagVals.add(i + 1);
  let target = null;
  for (let i = rest.length - 1; i >= 0; i--) {
    if (rest[i].startsWith('-') || flagVals.has(i)) continue;
    target = rest[i];
    break;
  }
  if (!target) return;

  const cwd = (ctx && ctx.cwd) || process.cwd();
  const sessionDir = path.join(cwd, 'tasks', 'reviews', session);
  if (!fs.existsSync(sessionDir)) return; // fail-open: no active session → no-op

  try {
    const event = { session, kind: 'read', target, at: new Date().toISOString(), source: 'hook' };
    fs.appendFileSync(path.join(sessionDir, 'hook-evidence.jsonl'), `${JSON.stringify(event)}\n`);
  } catch (_) {
    /* never block the hook */
  }
};
