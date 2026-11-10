#!/usr/bin/env node
'use strict';
// gate-enforcement.cjs — block source writes before the plan is approved and
// before the sprint contract is signed.
//
// Matches Edit and Write. Allows plan files, review files, contract files,
// docs, kit files and test files; blocks a source write when no approved plan
// exists or the active sprint has no signed contract.
//
// Only exit 2 blocks the tool call. Exit 1 is advisory — the write proceeds —
// so a blocking path here must never use it. That cuts both ways: a crash, a
// syntax error in a library, or a missing library also exits non-2 by default,
// which fails OPEN at the exact moment the guard is needed. The handlers below
// are installed BEFORE anything is required so that any such failure still
// lands on exit 2 with the marker. They are written inline, not imported,
// because importing them would reintroduce the very dependency they exist to
// survive.

const MARKER = '@@GATE_BLOCK@@';

function failClosed(err) {
  try {
    process.stderr.write(`${MARKER}\nGate 1 could not run: ${err && err.message ? err.message : String(err)}\n`);
    process.stderr.write('A write guard that cannot evaluate must not allow the write.\n');
  } catch {
    // Nothing left to report with; the exit code is the decision.
  }
  process.exit(2);
}

process.on('uncaughtException', failClosed);
process.on('unhandledRejection', failClosed);

const { readHookInput } = require('./lib/parse-stdin.cjs');
const { checkContractSigned } = require('./lib/check-contract-signed.cjs');
const { validateContract } = require('./lib/validate-contract.cjs');
const { verify, NO_RECEIPT, STALE } = require('./lib/approval-receipt.cjs');
const { hasPlan, newestPlan } = require('./lib/plan-discovery.cjs');
const rules = require('./lib/gate1-path-rules.cjs');
const { resolveHatch } = require('./lib/gate1-hatch.cjs');

/** The thin CLI a human runs for the same diagnostic the gate just applied. */
const CONTRACT_VALIDATOR_CLI = '.claude/skills/sprint-contract/scripts/validate-contract.cjs';

const emit = (lines) => process.stderr.write(`${lines.join('\n')}\n`);

function blockNoPlan() {
  emit([
    MARKER,
    'No approved plan found in tasks/plans/.',
    'Gate 1 requires an approved plan before source code changes.',
    'Create a plan first: /mk:plan-creator or /mk:fix for simple fixes.',
  ]);
  return 2;
}

function blockReceipt(plan, kind) {
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
  emit([MARKER, ...detail, 'Override (explicit downgrade): MEOWKIT_GATE1_PRESENCE_ONLY=1']);
  return 2;
}

/**
 * A plan merely existing is not enough: the newest plan must carry a receipt
 * whose hash still matches its body, so an approval can never silently carry
 * over to scope that changed after it was given.
 *
 * A missing receipt helper is an install problem, not a licence to ship — but
 * the existence check above has already passed, so this degrades to
 * presence-only rather than blocking every write on a tooling gap the user
 * cannot see. Any verify outcome other than "no receipt" or "stale" is treated
 * the same way: a plan demonstrably exists, so do not manufacture a block out
 * of a tooling quirk.
 */
function checkReceipt(root) {
  const plan = newestPlan(root);
  if (!plan) return 0;
  const { code } = verify(plan);
  if (code === NO_RECEIPT) return blockReceipt(plan, 'no-receipt');
  if (code === STALE) return blockReceipt(plan, 'stale');
  return 0;
}

function checkContractFile(filePath, normalized) {
  const result = validateContract(normalized);
  if (result.exit === 0) return 0;
  emit([
    MARKER,
    `Contract file ${filePath} failed schema validation.`,
    `Run for diagnostics: ${CONTRACT_VALIDATOR_CLI} ${filePath}`,
  ]);
  return 2;
}

function decide(root, filePath, env) {
  // No target path means nothing to classify; a valid payload that names no file
  // is not a source write.
  if (!filePath) return 0;

  const normalized = rules.normalizePath(filePath, root);

  if (rules.isContractFile(normalized)) return checkContractFile(filePath, normalized);

  if (rules.isSuspiciousDir(normalized)) {
    emit([
      MARKER,
      `Suspicious backup/legacy directory in path: ${normalized}`,
      'Move the file to a clean location or rename the parent directory.',
    ]);
    return 2;
  }

  if (rules.isNonSource(normalized) || rules.isTestFile(normalized)) return 0;

  if (!hasPlan(root)) return blockNoPlan();

  // An invisible bypass is worse than no bypass, so every outcome the hatch
  // reaches — applied, or refused for one of its three reasons — is announced
  // here and recorded in the security log by the reader itself.
  const hatch = resolveHatch({ root, env });
  for (const notice of hatch.notices) process.stderr.write(`${notice}\n`);
  if (!hatch.downgrade) {
    const receiptExit = checkReceipt(root);
    if (receiptExit !== 0) return receiptExit;
  }

  const contract = checkContractSigned({ root, env });
  if (contract.exit !== 0) {
    emit(contract.stderr);
    // The helper reports a non-blocking 1; propagate it as a hard block so the
    // unsigned-contract write is stopped rather than merely flagged.
    return 2;
  }
  return 0;
}

async function main() {
  const input = await readHookInput();
  if (!input.ok) {
    emit([
      MARKER,
      `Gate 1 received unreadable hook input (${input.reason}).`,
      'A write guard that cannot read what is being written must not allow it.',
    ]);
    process.exit(2);
  }

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    process.chdir(root);
  } catch {
    // An unreachable project root is reported by the host, and every rule below
    // is relative to it, so there is nothing left to evaluate.
    process.exit(0);
  }

  // argv is the back-compatible fallback for a registration that still passes
  // the target as a positional argument.
  const filePath = input.filePath || process.argv[2] || '';
  process.exit(decide(root, filePath, process.env));
}

main();
