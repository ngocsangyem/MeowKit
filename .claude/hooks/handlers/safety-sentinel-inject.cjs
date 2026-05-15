// safety-sentinel-inject.cjs — UserPromptSubmit handler.
//
// Purpose: emit a compact "verified (cached)" marker when the safety-baseline
// and phase-zero rule sentinels for the current session are recorded. Marker
// is observed by `mk:agent-detector` step-0/step-0b inside the skill
// (Read-only context) to skip the 10-file rule load on turns 2..N.
//
// State format: single append-only JSONL log at
// `session-state/session-sentinels.jsonl`. One line per Stop event:
//
//   {"session_id":"<id>","safety":true,"phase_zero":true,"ts":"<iso>"}
//
// Reader scans the file for the latest line matching ctx.session_id and emits
// markers for whichever flags are true on that line. The file is truncated by
// project-context-loader.sh on new-session detection (HOOK_SESSION_ID change),
// so it never accumulates state from prior sessions.
//
// Architectural notes:
//  - The skill is `allowed-tools: [Read]`. Filesystem ops live in hook
//    context (here / post-session.sh), not in the skill.
//  - HOOK_SESSION_ID arrives via ctx.session_id (parsed by dispatch.cjs).
//  - Sentinel WRITE happens in post-session.sh (Stop event), not here.
//  - This hook only READS the JSONL and emits markers. No state mutation.
//
// Bypass: MEOWKIT_SKIP_SAFETY_SENTINEL=off disables marker injection.
//         The skill then runs the full 10-file load every turn.

'use strict';
const fs = require('fs');
const path = require('path');

const STATE_FILE = 'session-sentinels.jsonl';

module.exports = async function (ctx /*, state */) {
  if ((process.env.MEOWKIT_SKIP_SAFETY_SENTINEL || 'on') === 'off') {
    return '';
  }

  const sessionId = (ctx && ctx.session_id) || process.env.HOOK_SESSION_ID || '';
  if (!sessionId) return '';

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const stateFile = path.join(root, 'session-state', STATE_FILE);

  let raw;
  try {
    raw = fs.readFileSync(stateFile, 'utf8');
  } catch {
    // Missing file = first turn of session, nothing verified yet.
    return '';
  }

  // Scan bottom-up: most recent entry for this session wins.
  const lines = raw.split('\n');
  let entry = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row && row.session_id === sessionId) { entry = row; break; }
  }
  if (!entry) return '';

  let out = '';
  if (entry.safety) {
    out += `## Safety baseline: verified (cached, session ${sessionId})\n`;
  }
  if (entry.phase_zero) {
    out += `## Phase-zero rules: verified (cached, session ${sessionId})\n`;
  }
  return out;
};
