'use strict';
// precompact-probe.cjs — re-arm the safety baseline before context is compacted.
//
// Compaction drops the baseline rule TEXT from context but leaves the
// per-session "already verified" marker in place, so the next turn would skip
// the re-read and run with no baseline loaded. Appending a recency marker here
// forces that re-read: the reader treats any verification older than the latest
// re-arm as stale and withholds the skip until a genuine re-read writes a newer
// line.
//
// Ordering is load-bearing. The host fires this AFTER the current turn has
// written its verification line, so the re-arm post-dates it and the next prompt
// re-reads. After that re-read, the turn's own verification legitimately
// post-dates the re-arm and the skip resumes. If the order ever inverted, the
// skip would resume too early.
//
// Never blocks. The re-arm runs before the optional telemetry below so a broken
// logger cannot suppress it.

const fs = require('node:fs');
const path = require('node:path');

const { logHookEvent } = require('../lib/hook-logger.cjs');
const { sessionStateDir } = require('../lib/meowkit-paths.cjs');

/** Host session identifiers are UUID-shaped; anything else could break the record. */
const SAFE_SESSION_ID = /^[A-Za-z0-9_.-]+$/;

module.exports = function precompactProbe(ctx) {
  const sessionId = ctx.session_id || '';
  const cachingDisabled = process.env.MEOWKIT_SKIP_SAFETY_SENTINEL === 'off';

  // With caching off the reader emits nothing regardless, so the re-arm is moot.
  if (!cachingDisabled && sessionId && SAFE_SESSION_ID.test(sessionId)) {
    try {
      const dir = sessionStateDir(ctx.root);
      fs.mkdirSync(dir, { recursive: true });
      const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      fs.appendFileSync(
        path.join(dir, 'session-sentinels.jsonl'),
        `{"session_id":"${sessionId}","event":"precompact_rearm","ts":"${ts}"}\n`,
      );
    } catch {
      // An unwritable marker costs a re-read, not correctness.
    }
  }

  logHookEvent({ root: ctx.root, hook: 'precompact-probe', event: 'fired', sessionId });
  return null;
};
