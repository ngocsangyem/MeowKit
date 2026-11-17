// loop-detection.cjs — PostToolUse handler: warn when same file edited too many times.
// Advisory: the reminder reaches the model as context (the dispatcher turns `context`
// into the host's model-visible field) and suggests a change of approach; no edit is refused.
// Ported from post-write-loop-detection.sh. Same logic:
//   track per-file edit count, warn at 4, escalate at 8.
//
// State: edit-counts.json in the session-marker state class, keyed by {session_id}:{filepath}
// Off switch: `hooks.loop-detection: false` in the project config.
//
// NOTE: Trace emission (append-trace.cjs) intentionally omitted from Node.js port.
// Shell version's trace records are not consumed by any downstream system currently.

const path = require('path');

const WARN_THRESHOLD = 4;
const ESCALATE_THRESHOLD = 8;

// Switching this observer off is the dispatcher's job: `hooks.loop-detection:
// false` removes the registration before the handler is ever loaded.
module.exports = function loopDetection(ctx, state) {
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

  // Speak at the thresholds and every WARN_THRESHOLD edits after, not on every edit:
  // one reminder per stretch is enough, and each one costs context.
  const speaks = count === ESCALATE_THRESHOLD || (count >= WARN_THRESHOLD && count % WARN_THRESHOLD === 0);
  if (!speaks) return '';

  if (count >= ESCALATE_THRESHOLD) {
    return {
      context: `${filePath} has now been edited ${count} times this session. Pause edits to it and re-plan: `
        + 'list what each attempt changed and why it did not work, then choose a different approach '
        + 'or ask the user. Repeated small variations on one file rarely converge.',
    };
  }
  return {
    context: `${filePath} has been edited ${count} times this session. Before the next edit, re-read `
      + 'the plan and the latest failing output and check the assumption behind the last change, '
      + 'since repeated small edits often mean the approach is wrong.',
  };
};
