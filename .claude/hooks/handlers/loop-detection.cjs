// loop-detection.cjs — PostToolUse handler: warn when same file edited too many times.
// Ported from post-write-loop-detection.sh. Same logic:
//   track per-file edit count, warn at 4, escalate at 8.
//
// State: session-state/edit-counts.json keyed by {session_id}:{filepath}
// Env: MEOWKIT_LOOP_DETECT=off — skip entirely
//
// NOTE: Trace emission (append-trace.sh) intentionally omitted from Node.js port.
// Trace system will be redesigned as a dispatch.cjs handler in a later phase.
// Shell version's trace records are not consumed by any downstream system currently.

const path = require('path');

const WARN_THRESHOLD = 4;
const ESCALATE_THRESHOLD = 8;

module.exports = function loopDetection(ctx, state) {
  if (process.env.MEOWKIT_LOOP_DETECT === 'off') return '';

  const filePath = ctx.tool_input?.file_path;
  if (!filePath) return '';

  const sessionId = ctx.session_id || 'default';

  // Normalize path
  let normalized;
  try {
    normalized = require('fs').realpathSync(filePath);
  } catch {
    normalized = path.resolve(filePath);
  }

  const key = `${sessionId}:${normalized}`;

  // Load and increment
  const counts = state.load('edit-counts') || {};
  counts[key] = (counts[key] || 0) + 1;
  const count = counts[key];
  state.save('edit-counts', counts);

  // Emit warnings
  if (count >= ESCALATE_THRESHOLD) {
    return [
      '@@LOOP_DETECT_ESCALATE@@',
      `Max edit budget exceeded for ${filePath} (${count} edits this session).`,
      'Halt and re-plan. Repeated small variations to the same file almost always indicate a flawed approach.',
      'Re-read the plan/contract, challenge your assumptions, and consider a different strategy before the next edit.',
      '@@END_LOOP_DETECT@@',
      '',
    ].join('\n');
  }

  if (count >= WARN_THRESHOLD) {
    return [
      '@@LOOP_DETECT_WARN@@',
      `You have edited ${filePath} ${count} times this session.`,
      'Consider reconsidering your approach — repeated small variations often indicate a flawed plan.',
      'Re-read the plan/contract and challenge your assumptions before the next edit.',
      '@@END_LOOP_DETECT@@',
      '',
    ].join('\n');
  }

  return '';
};
