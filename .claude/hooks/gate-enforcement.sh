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

# Typed-event emission (fire-and-forget; never alters exit/stream). Installs an
# ERR trap that records hook.failed on unhandled non-zero commands (bash only).
# NOTE: install activates `set -E` in THIS shell — any future bare command that can
# exit non-zero outside a conditional must append `|| true` (see emit-event.sh).
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/lib/emit-event.sh" 2>/dev/null || emit_event() { :; }
install_hook_failed_trap "gate-enforcement.sh" 2>/dev/null || true

# Hook profile gating — safety-critical: NEVER skip regardless of profile
MEOW_PROFILE="${MEOW_HOOK_PROFILE:-standard}"

# Gate policy profile. Missing policy keeps legacy behavior for backward
# compatibility; malformed policy fails safe as strict.
POLICY_PROFILE="legacy"
POLICY_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/policy.json"
if [ -f "$POLICY_FILE" ]; then
  POLICY_PROFILE="$(python3 - "$POLICY_FILE" <<'PY' 2>/dev/null || printf 'strict'
import json, sys
try:
    profile = json.load(open(sys.argv[1], encoding="utf-8")).get("profile", "strict")
    print(profile if profile in {"strict", "balanced", "lightweight"} else "strict")
except Exception:
    print("strict")
PY
)"
fi
PLAN_GATE_MODE="hard"
CONTRACT_GATE_MODE="legacy"
POLICY_REQUIRE_APPROVED="0"
case "$POLICY_PROFILE" in
  strict)
    PLAN_GATE_MODE="hard"
    CONTRACT_GATE_MODE="hard"
    POLICY_REQUIRE_APPROVED="1"
    ;;
  balanced)
    PLAN_GATE_MODE="hard"
    CONTRACT_GATE_MODE="optional"
    POLICY_REQUIRE_APPROVED="0"
    ;;
  lightweight)
    PLAN_GATE_MODE="advisory"
    CONTRACT_GATE_MODE="off"
    POLICY_REQUIRE_APPROVED="0"
    ;;
esac

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
        emit_event gate.blocked "{\"gate\":\"contract-schema\",\"reason\":\"contract file failed schema validation\",\"file\":\"$FILE_PATH\"}"
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
    emit_event gate.blocked "{\"gate\":\"suspicious-path\",\"reason\":\"backup/legacy directory in path\",\"file\":\"$NORMALIZED_PATH\"}"
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
  emit_event gate.blocked "{\"gate\":\"gate1-no-plan\",\"reason\":\"no approved plan in tasks/plans/\",\"file\":\"$NORMALIZED_PATH\"}"
  if [ "$PLAN_GATE_MODE" = "advisory" ]; then
    {
      echo "@@GATE_ADVISORY@@"
      echo "No approved plan found in tasks/plans/ (policy: lightweight advisory)."
    } >&2
  else
    {
      echo "@@GATE_BLOCK@@"
      echo "No approved plan found in tasks/plans/."
      echo "Gate 1 requires an approved plan before source code changes."
      echo "Create a plan first: /mk:plan-creator or /mk:fix for simple fixes."
    } >&2
    exit 2
  fi
fi

# Opt-in stricter Gate 1: when MEOWKIT_GATE1_REQUIRE_APPROVED=1, a plan file merely
# existing is not enough — the most recent plan must also carry an approval marker
# (frontmatter `status: approved` or an Agent-State `Approved by: human` line).
# Default off: the standard plan/cook flow records approval only later, so requiring
# it unconditionally would block legitimate writes.
if [ "${MEOWKIT_GATE1_REQUIRE_APPROVED:-$POLICY_REQUIRE_APPROVED}" = "1" ]; then
  approved=0
  # Newest plan file by mtime, selected with the same `[ -f ]` per-candidate test as the
  # existence gate (no `ls | head` pipeline whose exit code could mislead). `-nt` is a
  # regular-file comparison supported by both bash and dash test builtins.
  _latest_plan=""
  for _p in tasks/plans/*/plan.md tasks/plans/*.md; do
    [ -f "$_p" ] || continue
    if [ -z "$_latest_plan" ] || [ "$_p" -nt "$_latest_plan" ]; then
      _latest_plan="$_p"
    fi
  done
  if [ -n "$_latest_plan" ]; then
    if grep -qiE '^[[:space:]]*status:[[:space:]]*approved' "$_latest_plan" \
       || grep -qiE 'approved by:[[:space:]]*human' "$_latest_plan"; then
      approved=1
    fi
  fi
  if [ "$approved" -eq 0 ]; then
    {
      echo "@@GATE_BLOCK@@"
      echo "A plan exists but is not marked approved (MEOWKIT_GATE1_REQUIRE_APPROVED=1)."
      echo "Add 'status: approved' to the plan frontmatter, or unset the flag."
    } >&2
    emit_event gate.blocked "{\"gate\":\"gate1-not-approved\",\"reason\":\"plan exists but not marked approved\",\"file\":\"$NORMALIZED_PATH\"}"
    exit 2
  fi
fi

# Phase 4: Sprint contract gate. Only runs if a plan-creator-style date-prefixed plan dir exists
# (otherwise check-contract-signed.sh defers and exits 0 — no false blocks on legacy plans).
contract_check=".claude/skills/sprint-contract/scripts/check-contract-signed.sh"
if [ "$CONTRACT_GATE_MODE" != "off" ] && [ "$CONTRACT_GATE_MODE" != "optional" ] && [ -x "$contract_check" ]; then
  if ! "$contract_check"; then
    # check-contract-signed.sh already prints @@CONTRACT_GATE_BLOCK@@ + diagnostics on stderr.
    # Propagate as a hard block (exit 2) so the unsigned-contract write is stopped, not merely flagged.
    emit_event gate.blocked "{\"gate\":\"contract-unsigned\",\"reason\":\"sprint contract not signed\",\"file\":\"$NORMALIZED_PATH\"}"
    exit 2
  fi
fi

exit 0
