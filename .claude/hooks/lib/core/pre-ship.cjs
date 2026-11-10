'use strict';
// pre-ship.cjs — the ship-boundary decision, shared by every runtime's shell guard.
//
// Order is load-bearing. The structural ship proof and the team-memory lint run ABOVE the
// profile check on purpose: the ship gate has no exceptions, "even fast mode", and fast is
// exactly the profile under which someone is most tempted to ship unreviewed. The build, lint
// and test block stays profile-gated, because those are speed trade-offs and these two are not.
//
// Pure apart from the checks it runs: no stdin, stdout or exit code of its own. Result:
// `{ exit, stdout, stderr }`; only exit 2 blocks. Each stream keeps the order its checks wrote.

const path = require('node:path');
const { lintMemoryStore } = require('../memory-store-lint.cjs');
const { runPreShipChecks } = require('../preship-checks.cjs');

const MARKER = '@@GATE_BLOCK@@';

const SHIP_COMMAND = /git commit|git push|git merge/;

/**
 * Load the structural checker. A missing checker is NOT a quiet pass: a broken install must not
 * silently downgrade to "no ship gate", because at a ship boundary that is indistinguishable
 * from a passing gate at the one moment it matters.
 */
function loadGate2Check() {
  try {
    return require('../gate2-check.cjs').gate2Check;
  } catch {
    return null;
  }
}

/** @param {{ root: string, command: string, env: object }} input */
function decidePreShip({ root, command, env }) {
  const out = { exit: 0, stdout: [], stderr: [] };
  const take = (result) => {
    out.stdout.push(...result.stdout);
    out.stderr.push(...result.stderr);
    return result.exit;
  };

  const gate2Check = loadGate2Check();
  if (!gate2Check) {
    const modulePath = path.join(root, '.claude/hooks/lib/gate2-check.cjs');
    out.stderr.push(
      MARKER,
      `Gate 2 checker ${modulePath} not found — Gate 2 cannot be enforced.`,
      'A ship with no enforceable Gate 2 is blocked, not waved through.',
      'Fix: reinstall or restore the hook library, then retry.',
    );
    return { ...out, exit: 2 };
  }

  if (take(gate2Check({ root, command })) !== 0) return { ...out, exit: 2 };

  // Not a ship command: the checks below are none of this guard's business.
  if (!SHIP_COMMAND.test(command)) return out;

  const lintExit = take(lintMemoryStore({ root, env }));
  if (lintExit !== 0) return { ...out, exit: lintExit };

  const profile = env.MEOWKIT_HOOK_PROFILE || env.MEOW_HOOK_PROFILE || 'standard';
  if (profile === 'fast') return out;

  return { ...out, exit: take(runPreShipChecks(root)) };
}

module.exports = { decidePreShip };
