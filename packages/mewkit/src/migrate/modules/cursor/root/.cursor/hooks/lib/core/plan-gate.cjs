'use strict';
// plan-gate.cjs — the Gate 1 decision, shared by every runtime's write guard.
//
// A pure decision over the files one tool call writes: it reads the project tree but never
// touches stdin, stdout or the exit code. Each runtime's shell turns the result into its own
// block form. Result: `{ exit, stdout, stderr }`, where exit 2 is a block and the stderr lines
// are what Claude Code shows (the first is the marker).
//
// A call can write several files (a Codex `apply_patch`). Each path is classified on its own;
// one suspicious or invalid path blocks the call, and one source path puts the whole call
// behind the plan, receipt and contract checks, which then run once.

const path = require('node:path');
const { checkContractSigned } = require('../check-contract-signed.cjs');
const { validateContract } = require('../validate-contract.cjs');
const { verify, NO_RECEIPT, STALE } = require('../approval-receipt.cjs');
const { hasPlan, newestPlan } = require('../plan-discovery.cjs');
const rules = require('../gate1-path-rules.cjs');
const { resolveHatch } = require('../gate1-hatch.cjs');

const MARKER = '@@GATE_BLOCK@@';

/** The thin CLI a human runs for the same diagnostic the gate just applied. */
const CONTRACT_VALIDATOR_CLI = '.claude/skills/sprint-contract/scripts/validate-contract.cjs';

const block = (stderr) => ({ exit: 2, stdout: [], stderr });

const NO_PLAN = block([
  MARKER,
  'No approved plan found in tasks/plans/.',
  'Gate 1 requires an approved plan before source code changes.',
  'Create a plan first: /mk:plan-creator or /mk:fix for simple fixes.',
]);

function receiptBlock(plan, kind) {
  const detail = kind === 'stale'
    ? [
      `Plan '${plan}' was edited after approval — the receipt is stale.`,
      'Changed scope needs re-approval (gate-rules.md: Insert/Split ⇒ re-approve).',
      `Re-approve after the human confirms: mewkit plan approve ${plan}`,
    ]
    : [
      `Plan '${plan}' has no approval receipt.`,
      'Gate 1 requires a human-approved plan before source edits (anti-accidental).',
      `After the human approves, stamp it: mewkit plan approve ${plan}`,
    ];
  return block([MARKER, ...detail, 'Override (explicit downgrade): MEOWKIT_GATE1_PRESENCE_ONLY=1']);
}

/**
 * A plan merely existing is not enough: the newest plan must carry a receipt whose hash still
 * matches its body, so an approval can never silently carry over to scope that changed after
 * it was given. Any verify outcome other than "no receipt" or "stale" passes: a plan
 * demonstrably exists, so a tooling quirk must not manufacture a block.
 */
function receiptCheck(root) {
  const plan = newestPlan(root);
  if (!plan) return null;
  const { code } = verify(plan);
  if (code === NO_RECEIPT) return receiptBlock(plan, 'no-receipt');
  if (code === STALE) return receiptBlock(plan, 'stale');
  return null;
}

/** True when `normalized` sits in one of the runtime's own config trees (e.g. `.codex`). */
function inExtraTree(normalized, trees) {
  return trees.some((tree) => normalized.startsWith(`${tree}/`) || normalized.includes(`/${tree}/`));
}

/**
 * Classify one path. Returns a block result, 'gated' when the path needs an approved plan, or
 * null when this path alone allows the call.
 */
function classify(filePath, root, extraNonSource) {
  // Resolve against the root first: a docs path whose `..` climbs into src is a source file,
  // and a target outside the project (a home-directory hook, `/tmp/x.test.ts`) is never a
  // project doc, test or kit file, so no allow rule may reach it — it needs the plan like any
  // other source write.
  const relative = path.relative(root, path.resolve(root, filePath));
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return 'gated';
  const normalized = rules.normalizePath(relative.split(path.sep).join('/'), root);
  if (rules.isContractFile(normalized)) {
    if (validateContract(normalized).exit === 0) return null;
    return block([
      MARKER,
      `Contract file ${filePath} failed schema validation.`,
      `Run for diagnostics: ${CONTRACT_VALIDATOR_CLI} ${filePath}`,
    ]);
  }
  if (rules.isSuspiciousDir(normalized)) {
    return block([
      MARKER,
      `Suspicious backup/legacy directory in path: ${normalized}`,
      'Move the file to a clean location or rename the parent directory.',
    ]);
  }
  if (rules.isNonSource(normalized) || rules.isTestFile(normalized)) return null;
  if (inExtraTree(normalized, extraNonSource)) return null;
  return 'gated';
}

/**
 * @param {{ root: string, paths: string[], env: object, extraNonSource?: string[] }} input
 *   `extraNonSource` names a runtime's own config trees, which are kit files like `.claude/`.
 */
function decidePlanGate({ root, paths, env, extraNonSource = [] }) {
  let gated = false;
  for (const filePath of paths.filter(Boolean)) {
    const outcome = classify(filePath, root, extraNonSource);
    if (outcome === 'gated') gated = true;
    else if (outcome) return outcome;
  }
  if (!gated) return { exit: 0, stdout: [], stderr: [] };

  if (!hasPlan(root)) return NO_PLAN;

  // An invisible bypass is worse than no bypass, so every outcome the hatch reaches — applied,
  // or refused for one of its reasons — is announced, and recorded by the reader itself.
  const hatch = resolveHatch({ root, env });
  const notices = [...hatch.notices];
  if (!hatch.downgrade) {
    const receipt = receiptCheck(root);
    if (receipt) return block([...notices, ...receipt.stderr]);
  }

  const contract = checkContractSigned({ root, env });
  // The helper reports a non-blocking 1; it is a hard block here.
  if (contract.exit !== 0) return block([...notices, ...contract.stderr]);
  return { exit: 0, stdout: [], stderr: notices };
}

module.exports = { decidePlanGate };
