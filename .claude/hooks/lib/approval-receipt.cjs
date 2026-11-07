'use strict';
// approval-receipt.cjs — the single home for the plan-approval receipt.
//
// Threat model: ANTI-ACCIDENTAL (deter/detect, not unforgeable). The receipt is
// agent-writable by design — it proves "an approval was stamped against THIS
// plan revision", never "a human approved". The value is the revision BINDING:
// editing the plan body after approval invalidates the stamp, so an approval
// can never silently carry over to changed scope.
//
// One home, two callers: the write path (`mewkit plan approve` -> stamp) and the
// write guard (-> verify) both use THIS module, so the hash can never drift
// between writer and verifier.
//
// The body hash EXCLUDES YAML frontmatter on purpose: the stamp lives IN the
// frontmatter, so hashing the body means stamping never invalidates itself,
// while any edit to the plan's actual content does — which is the whole point.

const crypto = require('node:crypto');
const fs = require('node:fs');

/** Verify outcomes. The numbers are the contract with the guard, not an enum detail. */
const FRESH = 0;
const NO_RECEIPT = 10;
const STALE = 11;
const UNREADABLE = 12;

/**
 * Split a file into the lines a line-oriented reader would see: a trailing
 * newline terminates the last line rather than starting an empty one.
 */
function toLines(content) {
  const lines = content.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Everything after the closing `---` of YAML frontmatter. A file with no
 * frontmatter is entirely body, which keeps a plan that predates the stamp
 * hashable rather than unreadable.
 */
function planBody(content) {
  const out = [];
  let inFrontmatter = false;
  toLines(content).forEach((line, i) => {
    if (i === 0 && line === '---') { inFrontmatter = true; return; }
    if (inFrontmatter && line === '---') { inFrontmatter = false; return; }
    if (inFrontmatter) return;
    out.push(line);
  });
  // Every emitted line is newline-terminated, matching what a line printer feeds a digest.
  return out.map((l) => `${l}\n`).join('');
}

function planHash(content) {
  return crypto.createHash('sha256').update(planBody(content), 'utf8').digest('hex');
}

/** The `plan_hash` recorded in an existing `approval:` block, or '' when there is none. */
function storedHash(content) {
  let inApproval = false;
  for (const line of toLines(content)) {
    if (/^approval:[ \t]*$/.test(line)) { inApproval = true; continue; }
    if (inApproval) {
      const m = line.match(/^[ \t]+plan_hash:[ \t]*(.*)$/);
      if (m) return m[1].replace(/\s/g, '');
      // A key at column zero ends the block, so a later `plan_hash:` elsewhere is not ours.
      if (/^[^\s]/.test(line)) inApproval = false;
    }
  }
  return '';
}

function readPlan(file) {
  try {
    if (!fs.statSync(file).isFile()) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** `{ code, status }` — fresh, no-receipt, stale or unreadable. */
function verify(file) {
  const content = readPlan(file);
  if (content === null) return { code: UNREADABLE, status: `unreadable: ${file}` };
  const stored = storedHash(content);
  if (!stored) return { code: NO_RECEIPT, status: 'no-receipt' };
  return stored === planHash(content)
    ? { code: FRESH, status: 'fresh' }
    : { code: STALE, status: 'stale' };
}

function hash(file) {
  const content = readPlan(file);
  if (content === null) return { code: UNREADABLE, status: `not a file: ${file}` };
  return { code: FRESH, status: planHash(content) };
}

/**
 * Write (or replace) the `approval:` block inside the plan's frontmatter.
 *
 * Refuses a plan with no closing frontmatter fence rather than reporting
 * success on an unstamped file: an unstamped plan reads back as no-receipt and
 * blocks, which is safe, but a success message would be a lie.
 */
function stamp(file, approver = 'human', today = new Date()) {
  const content = readPlan(file);
  if (content === null) return { code: UNREADABLE, status: `not a file: ${file}` };
  const lines = toLines(content);
  if (lines[0] !== '---') {
    return { code: UNREADABLE, status: `${file} has no YAML frontmatter to stamp` };
  }

  const digest = planHash(content);
  const date = today.toISOString().slice(0, 10);
  const out = [];
  let inFrontmatter = false;
  let skippingOldBlock = false;
  let stamped = false;

  lines.forEach((line, i) => {
    if (i === 0 && line === '---') { inFrontmatter = true; out.push(line); return; }
    if (inFrontmatter && line === '---') {
      out.push('approval:', `  approved_by: ${approver}`, `  date: ${date}`, `  plan_hash: ${digest}`, line);
      inFrontmatter = false;
      stamped = true;
      return;
    }
    if (inFrontmatter && skippingOldBlock && /^[ \t]/.test(line)) return;
    if (inFrontmatter && skippingOldBlock && /^[^\s]/.test(line)) skippingOldBlock = false;
    if (inFrontmatter && /^approval:[ \t]*$/.test(line)) { skippingOldBlock = true; return; }
    out.push(line);
  });

  if (!stamped) {
    return { code: UNREADABLE, status: `${file} has no closing frontmatter fence — nothing stamped` };
  }
  fs.writeFileSync(file, `${out.join('\n')}\n`);
  return {
    code: FRESH,
    status: `Stamped approval on ${file} (plan_hash ${digest.slice(0, 10)}…, approved_by: ${approver}, date: ${date})`,
  };
}

module.exports = { FRESH, NO_RECEIPT, STALE, UNREADABLE, hash, planBody, planHash, stamp, storedHash, verify };
