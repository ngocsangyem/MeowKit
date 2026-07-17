#!/bin/bash
# MeowKit Gate Enforcement Hook
# PreToolUse: Block code writes before Gate 1 (plan approval) AND (Phase 4) before sprint contract sign.
# Upgrades gate-rules.md + Phase 4 sprint contract from behavioral to preventive.
#
# Matches: Edit, Write tool calls targeting source code files
# Blocks: if no approved plan in tasks/plans/ OR no signed contract in tasks/contracts/ AND target is source code
# Allows: plan files, test files, docs, config, contract files themselves, and any write after both gates pass
#
# Gate 1 bypass: /mk:fix --simple OR scale-routing one-shot
# Contract gate bypass: MEOWKIT_AUTOBUILD_MODE=LEAN env var (adaptive density for COMPLEX/Opus 4.6)
#
# Load .claude/.env (each hook is a separate subprocess)
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/load-dotenv.sh" 2>/dev/null || true
# Phase 4 extension (260408): also validates contract files on edit so hand-edits cannot
# break the schema. Triggered when $1 matches tasks/contracts/*.md.

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# Hook profile gating — safety-critical: NEVER skip regardless of profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"

# Phase 7 migration: hooks now source the JSON-on-stdin parser shim and prefer
# $HOOK_FILE_PATH from stdin. Falls back to $1 positional if stdin empty (back-compat).
# settings.json may still pass "$TOOL_INPUT_FILE_PATH" as positional — harmless either way.
if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh" ]; then
  . "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/read-hook-input.sh"
fi
FILE_PATH="${HOOK_FILE_PATH:-$1}"

# If no file path provided, allow (safety fallback)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalize the file path: strip leading $CLAUDE_PROJECT_DIR (or current pwd) so
# absolute paths get treated identically to relative paths in the matchers below.
# Closes red-team C1: case-glob `tasks/contracts/*.md` previously failed on abs paths.
NORMALIZED_PATH="$FILE_PATH"
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  case "$NORMALIZED_PATH" in
    "$CLAUDE_PROJECT_DIR"/*) NORMALIZED_PATH="${NORMALIZED_PATH#"$CLAUDE_PROJECT_DIR"/}" ;;
  esac
fi
# Also strip leading "./"
NORMALIZED_PATH="${NORMALIZED_PATH#./}"

# Phase 4 extension: contract files themselves get schema-validated on edit.
# Match both `tasks/contracts/foo.md` AND any path ending in that segment.
# Closes C1 (abs paths) and C2 (substring leak — anchor on segment boundaries).
case "$NORMALIZED_PATH" in
  tasks/contracts/*.md|*/tasks/contracts/*.md)
    validator=".claude/skills/sprint-contract/scripts/validate-contract.sh"
    if [ -x "$validator" ]; then
      if ! "$validator" "$FILE_PATH" >/dev/null 2>&1; then
        {
          echo "@@GATE_BLOCK@@"
          echo "Contract file $FILE_PATH failed schema validation."
          echo "Run for diagnostics: $validator $FILE_PATH"
        } >&2
        exit 2
      fi
    fi
    # Contract file edits are otherwise allowed (validator passed or not installed yet)
    exit 0
    ;;
esac

# Reject suspicious backup/legacy directories BEFORE any allow rule.
# Closes red-team C3+C4: `tasks/contracts.bak/foo.ts` and `tasks/contracts.bak/foo.md`
# previously bypassed the gate via substring or extension allowlists.
case "$NORMALIZED_PATH" in
  *.bak/*|*_legacy/*|*_old/*|*.tmp/*|*.backup/*)
    {
      echo "@@GATE_BLOCK@@"
      echo "Suspicious backup/legacy directory in path: $NORMALIZED_PATH"
      echo "Move the file to a clean location or rename the parent directory."
    } >&2
    exit 2
    ;;
esac

# Allow writes to non-source files. Use anchored segment matchers to prevent
# substring leaks like `tasks/plansold/foo.ts` or `srctasks/plans/foo.ts`.
# (Round 1 closed C2 via case patterns; round 2 dropped the bare `plans/*` branch
# that was a residual substring-leak vector — canonical path is `tasks/plans/`.)
case "$NORMALIZED_PATH" in
  tasks/plans/*|*/tasks/plans/*) exit 0 ;;
  tasks/reviews/*|*/tasks/reviews/*) exit 0 ;;
  tasks/contracts/*|*/tasks/contracts/*) exit 0 ;;
  docs/*|*/docs/*) exit 0 ;;
  .claude/*|*/.claude/*) exit 0 ;;
esac

# Allow writes to test files (extension/path-marker checks).
# Note: blanket markdown/JSON/YAML allowlist DROPPED in round 2 (was C4 bypass vector).
# Root-level config files (README.md, package.json, etc.) are not pre-allowed —
# they fall through to Gate 1 check below, which is satisfied once a plan exists.
# This means: writing root configs requires Gate 1 first, which is the intended discipline.
case "$NORMALIZED_PATH" in
  *.test.*|*.spec.*|*/__tests__/*|*/test/*|*/tests/*) exit 0 ;;
esac

# Gate 1: a real plan file must exist before source writes are allowed.
# A bare `ls <glob> | head` pipeline returns head's exit status (0) even on empty
# input, so using it as an `if` condition false-passes when no plan exists. Test
# each candidate with `[ -f ]` instead: that proves a regular file is present (a
# directory literally named plan.md cannot satisfy it), and an unmatched glob stays
# a literal pattern that fails the test. Covers both the nested
# (tasks/plans/YYMMDD-name/plan.md) and the flat (tasks/plans/*.md) layouts.
gate1_passed=0
for _plan in tasks/plans/*/plan.md tasks/plans/*.md; do
  if [ -f "$_plan" ]; then
    gate1_passed=1
    break
  fi
done

if [ "$gate1_passed" -eq 0 ]; then
  # Hard block: emit on stderr and exit 2 so Claude Code STOPS the write and feeds
  # the message back to the model. exit 1 is advisory (the write would proceed).
  {
    echo "@@GATE_BLOCK@@"
    echo "No approved plan found in tasks/plans/."
    echo "Gate 1 requires an approved plan before source code changes."
    echo "Create a plan first: /mk:plan-creator or /mk:fix for simple fixes."
  } >&2
  exit 2
fi

# Gate 1 approval receipt — DEFAULT ON (anti-accidental threat model).
# A plan file merely existing is not enough: the newest plan must carry a fresh
# approval receipt (an `approval:` block whose plan_hash still matches the plan
# body). Editing the plan body after approval invalidates the receipt ⇒ re-approval,
# so an approval can never silently carry over to changed scope.
#
# This proves "an approval was stamped against THIS plan revision", NOT "a human
# approved" — the receipt is agent-writable (ADR 260715). The binding is the value.
#
# Escape hatch: MEOWKIT_GATE1_PRESENCE_ONLY=1 downgrades to the old presence check
# (an explicit, logged opt-out). The former opt-in MEOWKIT_GATE1_REQUIRE_APPROVED
# is now the default and needs no flag.
if [ "${MEOWKIT_GATE1_PRESENCE_ONLY:-0}" = "1" ]; then
  # No Silent Override (intervention-recording-rules.md Rule 1): announce the downgrade
  # on stderr so the bypass is never invisible.
  echo "Gate 1: downgraded to presence-only via MEOWKIT_GATE1_PRESENCE_ONLY=1 (approval receipt NOT verified)." >&2
fi
if [ "${MEOWKIT_GATE1_PRESENCE_ONLY:-0}" != "1" ]; then
  # Newest plan file by mtime (same `[ -f ]`/`-nt` per-candidate test as the existence
  # gate — no `ls | head` pipeline whose exit code could mislead).
  _latest_plan=""
  for _p in tasks/plans/*/plan.md tasks/plans/*.md; do
    [ -f "$_p" ] || continue
    if [ -z "$_latest_plan" ] || [ "$_p" -nt "$_latest_plan" ]; then
      _latest_plan="$_p"
    fi
  done

  _receipt_lib=".claude/hooks/lib/approval-receipt.sh"
  # Enforce only when both the plan and the receipt helper are present. A missing
  # helper is an install problem, not a licence to ship — but the presence gate above
  # already passed, so degrade to presence-only rather than blocking every write on a
  # tooling gap the user cannot see. (Phase 8's drift check guards helper presence.)
  if [ -n "$_latest_plan" ] && [ -f "$_receipt_lib" ]; then
    sh "$_receipt_lib" verify "$_latest_plan" >/dev/null 2>&1
    _rc=$?
    if [ "$_rc" -eq 10 ]; then
      {
        echo "@@GATE_BLOCK@@"
        echo "Plan '$_latest_plan' has no approval receipt."
        echo "Gate 1 requires a human-approved plan before source edits (anti-accidental)."
        echo "After the human approves, stamp it: npx mewkit plan approve $_latest_plan"
        echo "Override (explicit downgrade): MEOWKIT_GATE1_PRESENCE_ONLY=1"
      } >&2
      exit 2
    elif [ "$_rc" -eq 11 ]; then
      {
        echo "@@GATE_BLOCK@@"
        echo "Plan '$_latest_plan' was edited after approval — the receipt is stale."
        echo "Changed scope needs re-approval (gate-rules.md: Insert/Split ⇒ re-approve)."
        echo "Re-approve after the human confirms: npx mewkit plan approve $_latest_plan"
        echo "Override (explicit downgrade): MEOWKIT_GATE1_PRESENCE_ONLY=1"
      } >&2
      exit 2
    fi
    # _rc 0 (fresh) ⇒ allow; any other code (helper error) ⇒ presence-only, do not
    # manufacture a block on a tooling quirk when a plan demonstrably exists.
  fi
fi

# Phase 4: Sprint contract gate. Only runs if a plan-creator-style date-prefixed plan dir exists
# (otherwise check-contract-signed.sh defers and exits 0 — no false blocks on legacy plans).
contract_check=".claude/skills/sprint-contract/scripts/check-contract-signed.sh"
if [ -x "$contract_check" ]; then
  if ! "$contract_check"; then
    # check-contract-signed.sh already prints @@CONTRACT_GATE_BLOCK@@ + diagnostics on stderr.
    # Propagate as a hard block (exit 2) so the unsigned-contract write is stopped, not merely flagged.
    exit 2
  fi
fi

exit 0
