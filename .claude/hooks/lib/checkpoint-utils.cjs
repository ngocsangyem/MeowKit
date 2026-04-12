// checkpoint-utils.cjs — Shared utilities for checkpoint handlers.
// Used by checkpoint-writer.cjs, auto-checkpoint.cjs, orientation-ritual.cjs.
// Uses O_EXCL atomic lock to prevent TOCTOU race between concurrent callers.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CHECKPOINT_DIR = path.join(ROOT, 'session-state', 'checkpoints');
const LATEST_FILE = path.join(CHECKPOINT_DIR, 'checkpoint-latest.json');

// Serialized via O_EXCL lock file — prevents TOCTOU race between concurrent callers
function nextSequence() {
  const seqFile = path.join(CHECKPOINT_DIR, '.next-seq');
  const lockFile = path.join(CHECKPOINT_DIR, '.seq.lock');

  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });

  let fd;
  try {
    fd = fs.openSync(lockFile, 'wx'); // O_CREAT | O_EXCL — atomic, fails if exists
  } catch (e) {
    if (e.code === 'EEXIST') {
      try {
        const stat = fs.statSync(lockFile);
        if (Date.now() - stat.mtimeMs > 60000) {
          fs.unlinkSync(lockFile);
          return nextSequence(); // retry once after stale lock cleanup
        }
      } catch { /* stat failed — lock may already be gone */ }
      return null; // lock held by another process — caller should skip
    }
    throw e;
  }

  try {
    let current = 0;
    try { current = parseInt(fs.readFileSync(seqFile, 'utf8'), 10) || 0; } catch { /* first run */ }
    const next = current + 1;
    fs.writeFileSync(seqFile, String(next));
    return next;
  } finally {
    fs.closeSync(fd);
    try { fs.unlinkSync(lockFile); } catch { /* cleanup best-effort */ }
  }
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT, timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function gitBranch() {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd: ROOT, timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function gitStatus() {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: ROOT, timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    return { clean: output.length === 0, changes: output.split('\n').filter(Boolean).length };
  } catch {
    return { clean: null, changes: null };
  }
}

function writeCheckpoint(checkpoint, seq) {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const seqStr = String(seq).padStart(3, '0');
  const checkpointFile = path.join(CHECKPOINT_DIR, `checkpoint-${seqStr}.json`);

  const tmp = checkpointFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2));
  fs.renameSync(tmp, checkpointFile);

  const latestTmp = LATEST_FILE + '.tmp';
  fs.writeFileSync(latestTmp, JSON.stringify({ sequence: seq, file: `checkpoint-${seqStr}.json` }));
  fs.renameSync(latestTmp, LATEST_FILE);
}

function isValidCheckpointFile(filename) {
  return /^checkpoint-\d{3}\.json$/.test(filename);
}

module.exports = {
  CHECKPOINT_DIR,
  LATEST_FILE,
  nextSequence,
  gitHead,
  gitBranch,
  gitStatus,
  writeCheckpoint,
  isValidCheckpointFile,
};
