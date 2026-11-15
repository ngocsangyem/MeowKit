#!/bin/bash
# skill-cross-refs.test.sh — the cross-reference checker fails on a seeded dead path and
# passes on the real tree.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$REPO/scripts/check-skill-cross-refs.sh"
fail=0

seed=$(mktemp -d)
trap 'rm -r "$seed"' EXIT
mkdir -p "$seed/.claude/skills/demo" "$seed/.claude/rules" "$seed/.claude/agents"
printf -- '---\nname: mk:demo\n---\nRead `.claude/rules/gone-rules.md` first.\n' > "$seed/.claude/skills/demo/SKILL.md"
if out=$(bash "$CHECK" "$seed" 2>&1); then
  echo "FAIL: a dead .claude path passed"; fail=1
elif ! grep -q "DEAD_PATH: .claude/skills/demo/SKILL.md -> .claude/rules/gone-rules.md" <<<"$out"; then
  echo "FAIL: the dead path was not named: $out"; fail=1
else
  echo "PASS: a dead .claude path fails the check"
fi

printf -- '---\nname: mk:demo\n---\nOptional: `.claude/mcp.json`.\n' > "$seed/.claude/skills/demo/SKILL.md"
if bash "$CHECK" "$seed" >/dev/null 2>&1; then echo "PASS: an optional runtime file is exempt"; else echo "FAIL: optional path flagged"; fail=1; fi

if bash "$CHECK" "$REPO" >/dev/null 2>&1; then echo "PASS: the real tree is clean"; else echo "FAIL: the real tree has dead refs"; fail=1; fi
exit $fail
