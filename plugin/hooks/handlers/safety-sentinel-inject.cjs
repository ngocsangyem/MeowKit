// safety-sentinel-inject.cjs — UserPromptSubmit handler.
//
// Purpose: emit a compact "verified (cached)" marker when the safety-baseline
// and phase-zero rule sentinels for the current session are recorded. Marker
// is observed by `mk:agent-detector` step-0/step-0b inside the skill
// (Read-only context) to skip the 10-file rule load on turns 2..N.
//
// State format: single append-only JSONL log at
// `session-state/session-sentinels.jsonl`. Two line shapes for a session:
//
//   verification (Stop):   {"session_id":"<id>","safety":true,"phase_zero":true,"ts":"<iso>"}
//   re-arm (PreCompact):   {"session_id":"<id>","event":"precompact_rearm","ts":"<iso>"}
//
// Reader finds, for the current session, the latest verification line and the
// latest re-arm line, then emits a flag's cached marker ONLY when that
// verification is more recent than the last re-arm. The file is truncated by
// project-context-loader.sh on new-session detection (HOOK_SESSION_ID change),
// so it never accumulates state from prior sessions.
//
// Why the recency compare: compaction drops the safety-baseline rule TEXT from
// context but not this sentinel. A verification that PRE-DATES the latest re-arm
// is therefore stale (its rules are no longer in context), so the skip marker is
// withheld until a genuine re-read writes a newer verification. The Stop hook's
// unconditional `true` write is harmless: the post-re-read turn's verification
// legitimately post-dates the re-arm. The log is append-only within a session, so
// a later file position == a more recent event — file position is the recency
// signal (reliable for same-second ts ties).
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

  // Track, for this session, the latest verification line and the latest re-arm
  // line by file position (append order == time order within a session).
  const lines = raw.split('\n');
  let verifyIdx = -1;
  let verifyRow = null;
  let rearmIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (!row || row.session_id !== sessionId) continue;
    if (row.event === 'precompact_rearm') {
      rearmIdx = i;
    } else if ('safety' in row || 'phase_zero' in row) {
      verifyIdx = i;
      verifyRow = row;
    }
  }
  if (!verifyRow) return '';

  // A verification is trusted only if it is more recent than the last re-arm.
  // (rearmIdx === -1 → no re-arm this session → always trusted.)
  if (verifyIdx <= rearmIdx) return '';

  let out = '';
  if (verifyRow.safety) {
    out += `## Safety baseline: verified (cached, session ${sessionId})\n`;
  }
  if (verifyRow.phase_zero) {
    out += `## Phase-zero rules: verified (cached, session ${sessionId})\n`;
  }
  return out;
};
