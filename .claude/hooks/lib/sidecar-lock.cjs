'use strict';
// sidecar-lock.cjs — mutual exclusion on a log file shared with another writer.
//
// The lock is a separate file holding `<pid>\n<ms-epoch>\n`, created
// exclusively. That shape is the contract: a second writer in another language
// contends on the SAME lock file with the SAME reclaim rule, so the two
// mutually exclude. Locking a file descriptor instead would lock a different
// object and the two writers would not see each other at all.
//
// Advisory by design: a caller that cannot take the lock within the timeout
// drops its record rather than stalling the hook chain.

const fs = require('node:fs');

const STALE_MS = 60_000;
const TIMEOUT_MS = 10_000;
const RETRY_MS = 100;

const nowMs = () => Date.now();

/** Busy-wait without a timer, since the whole caller is synchronous. */
function sleep(ms) {
  const until = nowMs() + ms;
  while (nowMs() < until) {
    // Intentionally tight: the wait is bounded and the alternative is an async
    // rewrite of every caller for a lock held for microseconds.
  }
}

const isAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

/**
 * Reclaim a lock without ever deleting one we have not verified. Move it to a
 * private name — only one racer wins that — then confirm the moved file is the
 * same stale content we read. If it changed under us a fresh owner took it, so
 * put it back with a link, which fails rather than clobbers.
 */
function reclaim(lockFile, content) {
  const privateName = `${lockFile}.${process.pid}.reclaim`;
  try {
    fs.renameSync(lockFile, privateName);
  } catch {
    return;
  }
  try {
    if (fs.readFileSync(privateName, 'utf8') === content) {
      fs.rmSync(privateName, { force: true });
      return;
    }
    try { fs.linkSync(privateName, lockFile); } catch { /* a fresh owner already holds it */ }
  } catch {
    // Unreadable: leave the private copy for the cleanup below.
  }
  fs.rmSync(privateName, { force: true });
}

function isStale(content) {
  const [pidLine, tsLine] = content.split('\n');
  const pid = Number(pidLine);
  if (Number.isInteger(pid) && pid > 0 && isAlive(pid)) {
    const ts = Number(tsLine);
    return Number.isFinite(ts) && nowMs() - ts > STALE_MS;
  }
  return true;
}

/** True when the lock was taken. The caller must release it. */
function acquire(lockFile) {
  const deadline = nowMs() + TIMEOUT_MS;
  for (;;) {
    try {
      // Exclusive create is the whole mechanism: it fails when someone holds it.
      fs.writeFileSync(lockFile, `${process.pid}\n${nowMs()}\n`, { flag: 'wx' });
      return true;
    } catch {
      let content;
      try { content = fs.readFileSync(lockFile, 'utf8'); } catch { content = null; }
      if (content !== null && isStale(content)) {
        reclaim(lockFile, content);
        continue;
      }
    }
    if (nowMs() >= deadline) return false;
    sleep(RETRY_MS);
  }
}

const release = (lockFile) => fs.rmSync(lockFile, { force: true });

/** Run `fn` under the lock. Returns false when the lock could not be taken. */
function withLock(lockFile, fn) {
  if (!acquire(lockFile)) return false;
  try {
    fn();
  } finally {
    release(lockFile);
  }
  return true;
}

module.exports = { acquire, release, withLock, STALE_MS, TIMEOUT_MS };
