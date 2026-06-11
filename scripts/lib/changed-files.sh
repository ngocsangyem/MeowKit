#!/bin/bash
# changed-files.sh — base-ref resolution + changed-file listing for diff-mode lints.
#
# Sourced (not executed) by lint wrappers that want to scope checks to files changed
# against a base ref. Two functions:
#
#   resolve_base_ref   prints the resolved base ref, or returns 2 (prints nothing)
#                      when no base can be resolved.
#   changed_files      prints files changed vs the base ref under the given pathspec(s),
#                      or returns 2 (prints nothing) when no base is resolvable.
#
# Resolution order (resolve_base_ref):
#   1. LINT_BASE_REF env var          — explicit override (local default: HEAD~1)
#   2. origin/$GITHUB_BASE_REF merge  — CI PR events set GITHUB_BASE_REF
#   3. unresolvable                   — return 2
#
# These functions do not decide severity — the caller maps "no base" to a warn-only
# local fallback or a hard CI error per its own contract.

# Prints the base ref on stdout; returns 2 with no output when unresolvable.
resolve_base_ref() {
	if [ -n "${LINT_BASE_REF:-}" ]; then
		printf '%s\n' "$LINT_BASE_REF"
		return 0
	fi
	if [ -n "${GITHUB_BASE_REF:-}" ]; then
		local mb
		mb="$(git merge-base "origin/${GITHUB_BASE_REF}" HEAD 2>/dev/null)" || mb=""
		if [ -n "$mb" ]; then
			printf '%s\n' "$mb"
			return 0
		fi
	fi
	return 2
}

# changed_files <pathspec> [<pathspec>...]
# Prints changed file paths (added/copied/modified/renamed) vs the base ref.
# Returns 2 with no output when no base ref is resolvable.
changed_files() {
	local base
	base="$(resolve_base_ref)" || return 2
	# Two-dot diff: base → working tree. On a clean CI checkout this equals
	# base...HEAD; locally it also captures uncommitted edits, which is desirable
	# for pre-commit use.
	git diff --name-only --diff-filter=ACMR "$base" -- "$@" 2>/dev/null
}
