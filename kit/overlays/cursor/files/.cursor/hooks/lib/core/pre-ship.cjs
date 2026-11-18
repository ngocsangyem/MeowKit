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
// Pure apart from the checks it runs: no stdin, stdout or exit code of its own. Result:
// `{ exit, stdout, stderr }`; only exit 2 blocks. Each stream keeps the order its checks wrote.

const { lintMemoryStore } = require('../memory-store-lint.cjs');
const { runPreShipChecks } = require('../preship-checks.cjs');
const { parseShipCommand } = require('../ship-command.cjs');
const { changedFiles } = require('../changed-files.cjs');
const { runOnce } = require('../ship-run-once.cjs');

/** A hook registration gives the ship check 300 s; the checks stop well before. */
const DEADLINE_MS = 270_000;

/** @param {{ root: string, command: string, env: object, deadlineMs?: number }} input */
function decidePreShip({ root, command, env, deadlineMs = DEADLINE_MS }) {
  const ship = parseShipCommand(command, { root });
  if (!ship) return { exit: 0, stdout: [], stderr: [] };

  return runOnce(root, command, deadlineMs, () => {
    const lint = lintMemoryStore({ root, env });
    if (lint.exit !== 0) return lint;
    const checks = runPreShipChecks(root, changedFiles(root, ship), { deadlineMs });
    return { exit: checks.exit, stdout: [...lint.stdout, ...checks.stdout], stderr: [...lint.stderr, ...checks.stderr] };
  });
}

module.exports = { decidePreShip };
