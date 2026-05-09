#!/bin/bash
# rules-audit.sh — per-rule ablation harness for Phase 3 measured audit.
#
# The script disables ONE rule (rename `.md` → `.md.disabled` so it stays on
# disk for restore) and prints a banner instructing the orchestrator to run
# `mk:benchmark`. The driver intentionally does NOT invoke mk:benchmark
# directly — `mk:benchmark/scripts/run-canary.sh` already documents that the
# canary loop requires fresh subagent contexts only an orchestrator can spawn,
# not a shell process.
#
# Usage:
#   bash .claude/scripts/rules-audit.sh disable <rule-name>     # rename rule.md → rule.md.disabled
#   bash .claude/scripts/rules-audit.sh restore <rule-name>     # rename back
#   bash .claude/scripts/rules-audit.sh list-eligible           # echo rules with coverage_count >= 3
#   bash .claude/scripts/rules-audit.sh status                  # show which rules are currently disabled
#
# Safety:
#   - Refuses to disable any rule in the safety baseline (security, injection,
#     gate, core-behaviors, development) regardless of coverage. These are
#     EXEMPT per Phase 3 step 2.
#   - Refuses to disable a rule whose `coverage_count < 3` per the canary
#     coverage matrix.
#   - Idempotent: disable on already-disabled is a no-op; restore on already-
#     restored is a no-op.

set -uo pipefail
ROOT="${PROJECT_ROOT:-$(pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT" >&2; exit 1; }

RULES_DIR=".claude/rules"
SAFETY_BASELINE=("security-rules" "injection-rules" "gate-rules" "core-behaviors" "development-rules")
# Rules with coverage_count >= 3 per canary-coverage-matrix.md (Phase 0 V3 deliverable).
# Update this list when a new audit cycle re-runs the coverage matrix.
ELIGIBLE_RULES=("agent-routing" "naming-rules" "phase-contracts")

is_safety() {
	local r="$1"
	for s in "${SAFETY_BASELINE[@]}"; do
		[ "$r" = "$s" ] && return 0
	done
	return 1
}

is_eligible() {
	local r="$1"
	for e in "${ELIGIBLE_RULES[@]}"; do
		[ "$r" = "$e" ] && return 0
	done
	return 1
}

cmd_disable() {
	local rule="${1:?rule name required}"
	local src="${RULES_DIR}/${rule}.md"
	local dst="${RULES_DIR}/${rule}.md.disabled"

	if is_safety "$rule"; then
		echo "REFUSED: $rule is in the safety baseline (EXEMPT from ablation)." >&2
		exit 2
	fi
	if ! is_eligible "$rule"; then
		echo "REFUSED: $rule has coverage_count < 3 (KEEP-by-default; not eligible for ablation)." >&2
		echo "Eligible rules: ${ELIGIBLE_RULES[*]}" >&2
		exit 2
	fi
	if [ ! -f "$src" ]; then
		if [ -f "$dst" ]; then
			echo "OK: $rule already disabled."
			return 0
		fi
		echo "ERROR: $src not found (and not already disabled)." >&2
		exit 1
	fi

	mv "$src" "$dst"
	echo "DISABLED: $rule"
	echo
	echo "Next: run mk:benchmark canary. Median of 3 runs preferred."
	echo "  /mk:benchmark run --full"
	echo "Record per-task verdict + score → .claude/benchmarks/rules-audit-\$(date +%y%m%d).jsonl"
	echo
	echo "Restore when done:"
	echo "  bash .claude/scripts/rules-audit.sh restore $rule"
}

cmd_restore() {
	local rule="${1:?rule name required}"
	local src="${RULES_DIR}/${rule}.md"
	local dst="${RULES_DIR}/${rule}.md.disabled"

	if [ ! -f "$dst" ]; then
		if [ -f "$src" ]; then
			echo "OK: $rule already restored."
			return 0
		fi
		echo "ERROR: $dst not found (rule never disabled or already restored)." >&2
		exit 1
	fi
	mv "$dst" "$src"
	echo "RESTORED: $rule"
}

cmd_list_eligible() {
	echo "Eligible for ablation (coverage_count >= 3):"
	for e in "${ELIGIBLE_RULES[@]}"; do
		echo "  - $e"
	done
	echo
	echo "Safety baseline (EXEMPT):"
	for s in "${SAFETY_BASELINE[@]}"; do
		echo "  - $s"
	done
}

cmd_status() {
	local found=0
	for f in "${RULES_DIR}"/*.md.disabled; do
		[ -e "$f" ] || continue
		echo "DISABLED: $(basename "${f%.md.disabled}")"
		found=1
	done
	[ "$found" -eq 0 ] && echo "OK: no rules currently disabled."
}

case "${1:-}" in
	disable)  shift; cmd_disable "$@" ;;
	restore)  shift; cmd_restore "$@" ;;
	list-eligible) cmd_list_eligible ;;
	status)   cmd_status ;;
	*)
		echo "Usage:"
		echo "  $0 disable <rule-name>"
		echo "  $0 restore <rule-name>"
		echo "  $0 list-eligible"
		echo "  $0 status"
		exit 1
		;;
esac
