// checkpoint-utils.cjs — Shared utilities for checkpoint handlers.
// Single-file checkpoint: writes data directly to checkpoint-latest.json via .tmp + rename
// (POSIX-atomic). Two writers (PostToolUse + Stop) race to overwrite — last writer wins.
// Sequence is display-only; collisions across concurrent writers are acceptable.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CHECKPOINT_DIR = path.join(ROOT, 'session-state', 'checkpoints');
const LATEST_FILE = path.join(CHECKPOINT_DIR, 'checkpoint-latest.json');

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

// Read previous sequence (if file exists) and return next monotonic value.
// Best-effort under contention: two writers may both compute the same N+1.
// Sequence is display-only; collisions are acceptable.
function readPreviousSequence() {
  try {
    const prev = JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8'));
    return typeof prev.sequence === 'number' ? prev.sequence : 0;
  } catch {
    return 0;
  }
}

function writeCheckpoint(checkpoint) {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  if (checkpoint.sequence === undefined || checkpoint.sequence === null) {
    checkpoint.sequence = readPreviousSequence() + 1;
  }
  const tmp = LATEST_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2));
  fs.renameSync(tmp, LATEST_FILE);
}

module.exports = {
  CHECKPOINT_DIR,
  LATEST_FILE,
  gitHead,
  gitBranch,
  gitStatus,
  readPreviousSequence,
  writeCheckpoint,
};
