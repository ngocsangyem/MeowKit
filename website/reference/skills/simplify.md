---
title: "mk:simplify"
description: "Post-implementation simplification pass — reduces complexity without changing behavior. Runs after Phase 3 GREEN, before Phase 4 Review."
---

# mk:simplify

Runs after implementation, before review. Behavior-preserving simplification: reduces complexity while passing the exact same tests. Scoped to the current diff only. For ad-hoc code quality review, use `mk:clean-code` instead.

## Iron Rule

Behavior must not change. Every simplification must pass the exact same tests. If tests fail after simplification, the simplification was wrong — revert it.

## What to look for

**Remove:**
- Dead code — functions never called, variables never read, unreachable branches, imports never used
- Commented-out code — if it's in git history, delete from source
- Unnecessary abstractions — wrapper adding no value, interface with one implementation
- Redundant null checks — checking null after a guard already prevents it
- Boolean traps — function with 4 boolean params where names hide meaning

**Simplify:**
- Nested conditionals → early returns or guard clauses (fundamental pattern, not style preference)
- Complex boolean expressions → named intermediate variables
- Inline once-called abstractions into their single call site

## Process

1. Read the current diff (`git diff`)
2. For each file: look for patterns, suggest removals
3. User accepts/rejects each suggestion via `AskUserQuestion`
4. Apply changes, run validator via `mk:lint-and-validate`
5. Run tests — if any fail, revert that change
6. Confirmation: summarize what was simplified

## Hard constraint

Never simplify across file boundaries. If two files are coupled in a way that makes simplifications unsafe, flag them as "coupled" and stop — don't attempt cleanup.

## Phase anchor

Phase: 3→4 transition (Build → Review). Auto-called by `mk:cook`. Handoff: if PASS → proceed to `mk:review`.
