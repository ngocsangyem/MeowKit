#!/usr/bin/env bash
# git-index-audit.test.sh — tests .claude/skills/benchmark/scripts/git-index-audit.sh
# against throwaway fixture git repos.
#
# Cases:
#   1. identical repos       — equal path/index hashes, 0/0 only-counts, diff clean
#   2. divergent repos        — differing path hash, local_only_count=1, diff not clean
#   3. single-repo mode       — valid JSON, comparison:null, counts > 0
#   4. non-git path arg       — exits non-zero with a clear error
#   5. sha256 portability      — hash is bare 64-hex (no trailing "  -"/filename)

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/.claude/skills/benchmark/scripts/git-index-audit.sh"
PY="$ROOT/.claude/skills/.venv/bin/python3"; [ -x "$PY" ] || PY="python3"

PASS=0; FAIL=0; FAILED_NAMES=()
assert() {
  local name="$1" cond="$2"
  if [ "$cond" = "1" ]; then PASS=$((PASS+1)); printf "  ok   %s\n" "$name"
  else FAIL=$((FAIL+1)); FAILED_NAMES+=("$name"); printf "  FAIL %s\n" "$name"; fi
}

make_repo() {
  local d="$1"; shift
  mkdir -p "$d"
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t )
  for f in "$@"; do
    mkdir -p "$d/$(dirname "$f")"
    echo "content of $f" > "$d/$f"
  done
  ( cd "$d" && git add -A && git commit -qm init )
}

[ -f "$SCRIPT" ] || { echo "FATAL: $SCRIPT not found"; exit 1; }

WORK="$(mktemp -d)"
OUT="$WORK/out"; mkdir -p "$OUT"

# ---- Case 1: identical repos ----
make_repo "$WORK/a" "x.txt" "dir/y.txt"
make_repo "$WORK/b" "x.txt" "dir/y.txt"
J=$(cd "$WORK" && MEOWKIT_AUDIT_OUT_DIR="$OUT" bash "$SCRIPT" "$WORK/a" "$WORK/b" 2>/dev/null)
PA=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['tracked_path_sha256'])")
make_repo_b_path=$(cd "$WORK" && MEOWKIT_AUDIT_OUT_DIR="$OUT" bash "$SCRIPT" "$WORK/b" 2>/dev/null | "$PY" -c "import json,sys; print(json.load(sys.stdin)['tracked_path_sha256'])")
LO=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['comparison']['local_only_count'])")
RO=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['comparison']['remote_only_count'])")
DC=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['comparison']['recursive_diff_clean'])")
{ [ "$PA" = "$make_repo_b_path" ] && [ "$LO" = "0" ] && [ "$RO" = "0" ] && [ "$DC" = "True" ]; } \
  && assert "identical repos: equal hashes, 0/0, diff clean" 1 || assert "identical repos: equal hashes, 0/0, diff clean" 0

# ---- Case 2: divergent repos (a has an extra file) ----
make_repo "$WORK/c" "x.txt" "dir/y.txt" "extra/z.txt"
make_repo "$WORK/d" "x.txt" "dir/y.txt"
J=$(cd "$WORK" && MEOWKIT_AUDIT_OUT_DIR="$OUT" bash "$SCRIPT" "$WORK/c" "$WORK/d" 2>/dev/null)
PA_C=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['tracked_path_sha256'])")
PA_D=$(cd "$WORK" && MEOWKIT_AUDIT_OUT_DIR="$OUT" bash "$SCRIPT" "$WORK/d" 2>/dev/null | "$PY" -c "import json,sys; print(json.load(sys.stdin)['tracked_path_sha256'])")
LO=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['comparison']['local_only_count'])")
DC=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['comparison']['recursive_diff_clean'])")
{ [ "$PA_C" != "$PA_D" ] && [ "$LO" = "1" ] && [ "$DC" = "False" ]; } \
  && assert "divergent repos: differing path hash, local_only=1, diff not clean" 1 || assert "divergent repos: differing path hash, local_only=1, diff not clean" 0

# ---- Case 3: single-repo mode ----
J=$(cd "$WORK" && MEOWKIT_AUDIT_OUT_DIR="$OUT" bash "$SCRIPT" "$WORK/a" 2>/dev/null)
CMP=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['comparison'])")
FC=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['tracked_file_count'])")
VALID=$(echo "$J" | "$PY" -c "import json,sys; json.load(sys.stdin); print('ok')" 2>/dev/null)
{ [ "$VALID" = "ok" ] && [ "$CMP" = "None" ] && [ "$FC" -gt 0 ]; } \
  && assert "single-repo mode: valid JSON, comparison null, counts>0" 1 || assert "single-repo mode: valid JSON, comparison null, counts>0" 0

# ---- Case 4: non-git path arg ----
mkdir -p "$WORK/plain"
( cd "$WORK" && MEOWKIT_AUDIT_OUT_DIR="$OUT" bash "$SCRIPT" "$WORK/plain" >/dev/null 2>&1 ); rc=$?
[ "$rc" -ne 0 ] && assert "non-git path → exit non-zero" 1 || assert "non-git path → exit non-zero" 0

# ---- Case 5: sha256 portability (bare 64-hex) ----
J=$(cd "$WORK" && MEOWKIT_AUDIT_OUT_DIR="$OUT" bash "$SCRIPT" "$WORK/a" 2>/dev/null)
SHA=$(echo "$J" | "$PY" -c "import json,sys; print(json.load(sys.stdin)['tracked_index_sha256'])")
echo "$SHA" | grep -qE '^[0-9a-f]{64}$' && assert "sha256 is bare 64-hex (no trailing -/filename)" 1 || assert "sha256 is bare 64-hex (no trailing -/filename)" 0

rm -rf "$WORK"

echo
echo "------ summary ------"
echo "passed: $PASS"
echo "failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "failures:"; for n in "${FAILED_NAMES[@]}"; do echo "  - $n"; done
  exit 1
fi
exit 0
