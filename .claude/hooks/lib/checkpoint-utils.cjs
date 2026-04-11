// checkpoint-utils.cjs — Shared utilities for checkpoint handlers.
// Used by checkpoint-writer.cjs, auto-checkpoint.cjs, orientation-ritual.cjs.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CHECKPOINT_DIR = path.join(ROOT, 'session-state', 'checkpoints');
const LATEST_FILE = path.join(CHECKPOINT_DIR, 'checkpoint-latest.json');

// Derive next sequence from directory listing (TOCTOU-safe)
function nextSequence() {
  try {
    const files = fs.readdirSync(CHECKPOINT_DIR)
      .filter((f) => /^checkpoint-\d{3}\.json$/.test(f))
      .sort();
    if (files.length === 0) return 1;
    const last = files[files.length - 1];
    return parseInt(last.match(/(\d{3})/)[1], 10) + 1;
  } catch {
    return 1;
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
    return { clean: null, changes: null }; // Unknown — not falsely clean
  }
}

// Write checkpoint file + update latest pointer (atomic)
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

// Validate checkpoint filename format
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
