'use strict';
// pre-ship.cjs — the ship-boundary decision, shared by every runtime's shell guard.
//
// Order: decide whether the command ships at all (lib/ship-command.cjs) and leave every other
// command alone; lint the team memory store; then lint the changed files, run the tests related
// to them and type-check the project (lib/preship-checks.cjs). The hook profile is not consulted:
// the fast profile trades speed for checks elsewhere, never at the point code leaves the machine.
//
// When one project carries the kit for more than one runtime, a host can reach two ship-check
// hooks with one command; lib/ship-run-once.cjs makes the second report the first one's result.
//
// Outcomes: `passed`; `failed` (a check ran and reported a problem); `could_not_run` (a check
// gave no verdict, or this decision itself threw). Both blocking outcomes exit 2, and each shell
// renders them in its host's form. The only way past a block is the host's own permission
// prompt answered by a person: no command token and no environment variable skips a check, and
// one that looks like it tries is named in the output as refused.
//
// Each ship decision appends one `ship_check` trace record with the outcome and cause and never
// the command text. Apart from that, the checks it runs and one advisory line when a changed
// plan's state lags its checkboxes (lib/core/plan-state-sync.cjs, read-only here), it has no
// stdin, stdout or exit code of its own. Result: `{ exit, stdout, stderr, outcome, cause }`; only exit 2 blocks.

const { lintMemoryStore } = require('../memory-store-lint.cjs');
const { runPreShipChecks } = require('../preship-checks.cjs');
const { parseShipCommand } = require('../ship-command.cjs');
const { changedFiles } = require('../changed-files.cjs');
const { runOnce } = require('../ship-run-once.cjs');
const { appendTrace } = require('../trace-log.cjs');
const { syncChangedPlans, driftLine } = require('./plan-state-sync.cjs');

/** A hook registration gives the ship check 300 s; the checks stop well before. */
const DEADLINE_MS = 270_000;

/** Variable names that read as a request to skip a check. */
const SKIP_WORD = /SKIP|BYPASS|DISABLE|NO_?VERIFY|KILL_SWITCH/i;
const CHECK_WORD = /SHIP|HOOK|GATE|VERIFY|CHECK|MEOW|MEWKIT|HUSKY/i;
const looksLikeSkip = (name) => (SKIP_WORD.test(name) && CHECK_WORD.test(name)) || name === 'HUSKY';

/**
 * Each command token or set environment variable that looks like an attempt to skip the
 * check, as a line saying it was refused. Reading it is only to report it: none changes the
 * decision.
 */
function refusedOverrides(ship, env) {
  const found = [];
  const flags = ship.args.filter((a) => a === '--no-verify' || (ship.kind === 'commit' && a === '-n'));
  for (const flag of new Set(flags)) found.push(flag);
  for (const word of ship.assignments || []) if (looksLikeSkip(word.slice(0, word.indexOf('=')))) found.push(word);
  for (const [name, value] of Object.entries(env || {})) if (value && looksLikeSkip(name)) found.push(`${name} (environment)`);
  return found.map((what) => `Refused: ${what} does not skip the MeowKit ship check; the checks ran as usual.`);
}

/** A blocking result for a check that gave no verdict. */
function couldNotRun(cause, detail) {
  return { exit: 2, stdout: [], stderr: [`PRE-SHIP COULD NOT RUN: ${detail}`, 'The change is unverified.'], outcome: 'could_not_run', cause };
}

/** Append the one `ship_check` record for a run. Telemetry never decides a ship. */
function recordShipCheck(root, { outcome, cause, action }, env = process.env) {
  try {
    const data = { outcome };
    if (cause) data.cause = cause;
    if (action) data.action = action;
    appendTrace({ root, event: 'ship_check', signal: 'ship_check_result', payload: JSON.stringify(data), env });
  } catch {
    // A dropped record is reported nowhere; the decision stands either way.
  }
}

function runChecks(root, ship, env, deadlineMs) {
  const lint = lintMemoryStore({ root, env });
  if (lint.exit !== 0) return { ...lint, outcome: 'failed', cause: 'memory_lint' };
  const checks = runPreShipChecks(root, changedFiles(root, ship), { deadlineMs });
  return { ...checks, stdout: [...lint.stdout, ...checks.stdout], stderr: [...lint.stderr, ...checks.stderr] };
}

/**
 * One advisory line when a changed plan's derived state lags its checkboxes, or it is complete
 * and waiting to be archived. Read-only: the runtimes without a Stop hook have no other point
 * where this is noticed, and the ship check is the one hook all of them run. Never throws.
 */
function planDrift(root) {
  try {
    return driftLine(syncChangedPlans(root, { write: false }));
  } catch {
    return '';
  }
}

/** @param {{ root: string, command: string, env: object, deadlineMs?: number }} input */
function decidePreShip({ root, command, env, deadlineMs = DEADLINE_MS }) {
  let ship = null;
  let result;
  try {
    ship = parseShipCommand(command, { root });
    if (!ship) return { exit: 0, stdout: [], stderr: [], outcome: '', cause: '' };
    result = runOnce(root, command, deadlineMs, () => runChecks(root, ship, env, deadlineMs));
  } catch (err) {
    result = couldNotRun('crash', `the ship check crashed (${err && err.message ? err.message : String(err)}).`);
  }
  const refused = ship ? refusedOverrides(ship, env) : [];
  if (refused.length) {
    result = { ...result, stdout: [...refused, ...result.stdout], stderr: result.exit === 0 ? result.stderr : [...result.stderr, ...refused] };
  }
  // Advisory only: the line joins stdout and nothing else about the result changes.
  const drift = ship ? planDrift(root) : '';
  if (drift) result = { ...result, stdout: [drift, ...result.stdout] };
  recordShipCheck(root, { outcome: result.outcome, cause: result.cause, action: ship && ship.kind }, env);
  return result;
}

module.exports = { decidePreShip, recordShipCheck, DEADLINE_MS };
