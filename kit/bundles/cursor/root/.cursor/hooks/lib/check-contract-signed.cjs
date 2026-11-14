'use strict';
// check-contract-signed.cjs — is there a signed sprint contract for the active task?
//
// Called by the write guard before a source edit, and by the thin CLI. Returns
// `{ exit, stdout, stderr }` line arrays: 0 when a signed contract exists or the
// check defers, 1 when the active task has none.
//
// Deferring matters as much as blocking. A project with no plans directory, or
// with only flat-file plans, has no sprint to hold a contract — claiming gate
// authority there would block every edit in a repo this check does not govern.

const fs = require('node:fs');
const path = require('node:path');

const PLAN_DIR_PREFIX = /^[0-9]{6}(-[0-9]{4})?-/;
const PLACEHOLDER_SIGNATURES = ['', 'null', 'pending', 'todo', 'TODO'];

/** Density modes in which the contract step is skipped by policy, with the bypass logged. */
const BYPASS_MODES = ['LEAN', 'MINIMAL'];

function firstFieldValue(content, field) {
  const re = new RegExp(`^${field}:[ \\t]*(.*)$`);
  for (const line of content.split('\n')) {
    const m = line.match(re);
    if (m) return m[1].replace(/[ \t]/g, '');
  }
  return '';
}

/** Strip quotes so a quoted placeholder cannot pass as a real signature. */
function signature(content, field) {
  return firstFieldValue(content, field).replace(/['"]/g, '');
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

/** Newest date-prefixed plan directory, by name — the names sort chronologically. */
function activePlanDir(root) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, 'tasks/plans'));
  } catch {
    return '';
  }
  return entries
    .filter((e) => PLAN_DIR_PREFIX.test(e))
    .sort()
    .reverse()
    .find((e) => isDir(path.join(root, 'tasks/plans', e))) || '';
}

const slugOf = (planDirName) => planDirName.replace(PLAN_DIR_PREFIX, '');

/** Contracts for this slug, in the order a sorted directory listing yields them. */
function contractsFor(root, slug) {
  const dir = path.join(root, 'tasks/contracts');
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return []; }
  const re = new RegExp(`^.*-${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-sprint-.*\\.md$`);
  return entries.filter((e) => re.test(e)).sort().map((e) => path.join(dir, e)).filter(isFile);
}

/**
 * `amended` requires both signatures to be real: appending an amendment without
 * re-signing would otherwise leave a window where unsigned scope reads as signed.
 */
function isSigned(file) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch { return false; }
  const status = firstFieldValue(content, 'status');
  if (status === 'signed') return true;
  if (status !== 'amended') return false;
  const gen = signature(content, 'generator_signed');
  const evaluator = signature(content, 'evaluator_signed');
  return !PLACEHOLDER_SIGNATURES.includes(gen) && !PLACEHOLDER_SIGNATURES.includes(evaluator);
}

function logBypass(root, now) {
  // Only log inside a managed project; elsewhere there is no telemetry tree to own.
  if (!isDir(path.join(root, '.claude'))) return;
  const logFile = path.join(root, '.meowkit/telemetry/lean-bypass.log');
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const ts = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    // The line names LEAN for either bypass mode. That under-reports a MINIMAL
    // bypass, but the audit trail is append-only and read by date, so changing
    // the wording here would split one log into two formats mid-file.
    fs.appendFileSync(logFile, `${ts} MEOWKIT_AUTOBUILD_MODE=LEAN bypassed contract gate\n`);
  } catch {
    // A telemetry write must never decide a gate.
  }
}

function blockNoContractsDir(planDirName, slug) {
  return [
    '@@CONTRACT_GATE_BLOCK@@',
    'No tasks/contracts/ directory exists.',
    `Phase 4 sprint contract is required for source code edits on plan: ${planDirName}`,
    '',
    'To proceed, do ONE of:',
    `  1. Run: /mk:sprint-contract propose ${slug}`,
    '  2. Set: export MEOWKIT_AUTOBUILD_MODE=LEAN  (skips contract for Opus 4.6 tier)',
  ];
}

function blockUnsigned(planDirName, slug) {
  return [
    '@@CONTRACT_GATE_BLOCK@@',
    `No signed sprint contract found for task '${slug}'.`,
    `Active plan: tasks/plans/${planDirName}/plan.md`,
    '',
    'Phase 4 sprint contract gate requires a signed contract before source edits.',
    '',
    'To proceed, do ONE of:',
    `  1. Run: /mk:sprint-contract propose ${slug}`,
    '     Then: /mk:sprint-contract sign (after evaluator review)',
    '  2. Set: export MEOWKIT_AUTOBUILD_MODE=LEAN  (Opus 4.6 LEAN mode bypass)',
  ];
}

function checkContractSigned({ root = process.cwd(), env = process.env, now = new Date() } = {}) {
  const allow = { exit: 0, stdout: [], stderr: [] };

  const mode = env.MEOWKIT_AUTOBUILD_MODE || '';
  if (BYPASS_MODES.includes(mode)) {
    logBypass(root, now);
    return allow;
  }

  if (!isDir(path.join(root, 'tasks/plans'))) return allow;
  const planDirName = activePlanDir(root);
  if (!planDirName) return allow;
  const slug = slugOf(planDirName);

  if (!isDir(path.join(root, 'tasks/contracts'))) {
    return { exit: 1, stdout: [], stderr: blockNoContractsDir(planDirName, slug) };
  }
  if (contractsFor(root, slug).some(isSigned)) return allow;
  return { exit: 1, stdout: [], stderr: blockUnsigned(planDirName, slug) };
}

module.exports = { checkContractSigned, activePlanDir, isSigned, slugOf };
