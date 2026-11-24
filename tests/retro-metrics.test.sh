#!/usr/bin/env bash
# retro-metrics.test.sh: the retro metrics script counts commits, authors, sessions
# and test LOC from a small throwaway repo, and reports zero commits cleanly.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/.claude/skills/retro/scripts/retro-metrics.cjs"
PASS=0; FAIL=0
check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); printf '  ok   %s\n' "$1"
  else FAIL=$((FAIL+1)); printf '  FAIL %s (want %s, got %s)\n' "$1" "$3" "$2"; fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q
git -C "$TMP" config user.name "Alice"
git -C "$TMP" config user.email "alice@example.com"
mkdir -p "$TMP/src" "$TMP/tests"
printf 'a\nb\nc\n' > "$TMP/src/app.js"
git -C "$TMP" add -A
GIT_COMMITTER_DATE="2026-03-01T10:00:00" git -C "$TMP" commit -q -m "feat: add app" --date "2026-03-01T10:00:00"
printf 'x\ny\n' > "$TMP/tests/app.test.js"
git -C "$TMP" add -A
GIT_COMMITTER_DATE="2026-03-01T10:20:00" git -C "$TMP" commit -q -m "test: cover app" --date "2026-03-01T10:20:00"
printf 'd\n' >> "$TMP/src/app.js"
git -C "$TMP" add -A
GIT_COMMITTER_DATE="2026-03-01T13:00:00" git -C "$TMP" commit -q -m "fix: tweak app (#7)" --date "2026-03-01T13:00:00"

OUT="$(node "$SCRIPT" --repo "$TMP" --since "2026-02-28T00:00:00")"
field() { printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(String(eval("j."+process.argv[1])))})' "$1"; }

check "counts commits" "$(field commits)" "3"
check "one contributor" "$(field contributors)" "1"
check "insertions" "$(field insertions)" "6"
check "test insertions" "$(field test_insertions)" "2"
check "two sessions at a 45 minute gap" "$(field sessions.count)" "2"
check "reads a PR number from a subject" "$(field 'pr_numbers[0]')" "#7"
check "conventional commit types" "$(field commit_types.feat)" "1"

EMPTY="$(node "$SCRIPT" --repo "$TMP" --since "2020-01-01T00:00:00" --until "2020-01-02T00:00:00")"
check "zero commits is reported, not an error" "$(printf '%s' "$EMPTY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).commits))')" "0"

echo
echo "Results: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
