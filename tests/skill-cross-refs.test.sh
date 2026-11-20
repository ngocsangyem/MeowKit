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

mkdir -p "$seed/.claude/skills/demo/references"
printf 'See `.claude/skills/review/gone-format.md`.\n' > "$seed/.claude/skills/demo/references/notes.md"
if out=$(bash "$CHECK" "$seed" 2>&1); then
  echo "FAIL: a dead path in a reference passed"; fail=1
elif grep -q "DEAD_PATH: .claude/skills/demo/references/notes.md -> .claude/skills/review/gone-format.md" <<<"$out"; then
  echo "PASS: a dead path in a reference fails the check"
else
  echo "FAIL: the reference dead path was not named: $out"; fail=1
fi
rm "$seed/.claude/skills/demo/references/notes.md"

# In an installed tree, a path the install does not write fails; a file the user creates at
# run time does not.
installed="$seed/installed-codex"
mkdir -p "$installed/.agents/skills/mk-demo/scripts"
touch "$installed/.agents/skills/mk-demo/scripts/run.sh"
printf 'Run `.agents/skills/mk-demo/scripts/run.sh`; keys live in `.codex/.env`.\n' > "$installed/.agents/skills/mk-demo/SKILL.md"
if bash "$CHECK" "$seed" "$installed" >/dev/null 2>&1; then echo "PASS: an installed path and a run-time file pass"; else echo "FAIL: valid installed paths flagged"; fail=1; fi
printf 'Run `.agents/skills/jira/scripts/jira-as.sh`.\n' > "$installed/.agents/skills/mk-demo/SKILL.md"
if out=$(bash "$CHECK" "$seed" "$installed" 2>&1); then
  echo "FAIL: a dead installed path passed"; fail=1
elif grep -q "DEAD_PATH: installed installed-codex: .agents/skills/mk-demo/SKILL.md -> .agents/skills/jira/scripts/jira-as.sh" <<<"$out"; then
  echo "PASS: a dead installed path fails the check"
else
  echo "FAIL: the installed dead path was not named: $out"; fail=1
fi
rm -r "$installed"

if bash "$CHECK" "$REPO" >/dev/null 2>&1; then echo "PASS: the real tree is clean"; else echo "FAIL: the real tree has dead refs"; fail=1; fi
exit $fail
