#!/usr/bin/env bash
# git-index-audit.sh — record a reproducible git tracked-state fingerprint as a JSON
# artifact, optionally comparing two checkouts of the same repo.
#
# Modes:
#   git-index-audit.sh [repo-path]            single-repo snapshot (default: .)
#   git-index-audit.sh <local> <remote>       comparison (adds local/remote-only counts
#                                              + recursive diff status)
#
# Artifact: .claude/benchmarks/audits/{YYMMDD-HHMMSS}-audit.json  (override dir with
# MEOWKIT_AUDIT_OUT_DIR). Artifacts live in a SIBLING dir to results/ on purpose:
# compare-runs.sh prefix-globs results/*.json and assumes a "tier" key — an audit
# artifact in results/ would crash it. A top-level "type":"audit" discriminator marks
# these files for any future reader.
#
# Index-hash definition (meowkit canonical; the source report did not specify one):
#   tracked_index_sha256 = sha256( sort( git ls-files -s ) )
# `-s` includes mode + blob hash + stage, so the index hash captures tracked CONTENT,
# not just paths. tracked_path_sha256 = sha256( sort( git ls-files ) ) captures paths.
#
# Exit: 0 on success; non-zero with a clear error for a non-git path / missing sha tool.

set -euo pipefail

# Portable sha256 → ALWAYS bare 64-hex (awk strips the trailing "  -"/filename that
# sha256sum and shasum append to stdin hashes; storing raw output makes cross-platform
# comparison permanently unequal).
sha256_cmd() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  else
    echo "ERROR: no sha256 tool (need sha256sum or shasum)" >&2
    return 1
  fi
}

require_git_repo() {
  local p="$1"
  [ -d "$p" ] || { echo "ERROR: not a directory: $p" >&2; exit 1; }
  git -C "$p" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || { echo "ERROR: not a git work tree: $p" >&2; exit 1; }
}

tracked_path_hash() { git -C "$1" ls-files | sort | sha256_cmd; }
tracked_index_hash() { git -C "$1" ls-files -s | sort | sha256_cmd; }
tracked_count() { git -C "$1" ls-files | wc -l | tr -d ' '; }
dir_count() {
  # Distinct ancestor directories containing tracked files (excludes repo root + .git).
  git -C "$1" ls-files | awk -F/ '{ p=""; for (i=1;i<NF;i++){ p=(i==1?$i:p"/"$i); print p } }' \
    | sort -u | wc -l | tr -d ' '
}
work_tree_clean() { [ -z "$(git -C "$1" status --porcelain)" ] && echo true || echo false; }

LOCAL="${1:-.}"
REMOTE="${2:-}"
require_git_repo "$LOCAL"

RUN_ID="$(date +%y%m%d-%H%M%S)-audit"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OUT_DIR="${MEOWKIT_AUDIT_OUT_DIR:-.claude/benchmarks/audits}"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/${RUN_ID}.json"

FILE_COUNT="$(tracked_count "$LOCAL")"
DIR_COUNT="$(dir_count "$LOCAL")"
PATH_SHA="$(tracked_path_hash "$LOCAL")"
INDEX_SHA="$(tracked_index_hash "$LOCAL")"
WT_CLEAN="$(work_tree_clean "$LOCAL")"

CMP_REMOTE="" ; LOCAL_ONLY="" ; REMOTE_ONLY="" ; DIFF_CLEAN=""
if [ -n "$REMOTE" ]; then
  require_git_repo "$REMOTE"
  CMP_REMOTE="$REMOTE"
  LOCAL_ONLY="$(comm -23 <(git -C "$LOCAL" ls-files | sort) <(git -C "$REMOTE" ls-files | sort) | wc -l | tr -d ' ')"
  REMOTE_ONLY="$(comm -13 <(git -C "$LOCAL" ls-files | sort) <(git -C "$REMOTE" ls-files | sort) | wc -l | tr -d ' ')"
  if diff -qr --exclude=.git "$LOCAL" "$REMOTE" >/dev/null 2>&1; then DIFF_CLEAN=true; else DIFF_CLEAN=false; fi
fi

PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"

RUN_ID="$RUN_ID" TS="$TS" REPO="$LOCAL" OUT_FILE="$OUT_FILE" \
FILE_COUNT="$FILE_COUNT" DIR_COUNT="$DIR_COUNT" PATH_SHA="$PATH_SHA" INDEX_SHA="$INDEX_SHA" \
WT_CLEAN="$WT_CLEAN" CMP_REMOTE="$CMP_REMOTE" LOCAL_ONLY="$LOCAL_ONLY" REMOTE_ONLY="$REMOTE_ONLY" \
DIFF_CLEAN="$DIFF_CLEAN" "$PY" - <<'PY'
import json, os

def as_bool(s):
    return s == "true"

comparison = None
if os.environ.get("CMP_REMOTE"):
    comparison = {
        "remote": os.environ["CMP_REMOTE"],
        "local_only_count": int(os.environ["LOCAL_ONLY"]),
        "remote_only_count": int(os.environ["REMOTE_ONLY"]),
        "recursive_diff_clean": as_bool(os.environ["DIFF_CLEAN"]),
    }

artifact = {
    "type": "audit",
    "run_id": os.environ["RUN_ID"],
    "ts": os.environ["TS"],
    "repo": os.environ["REPO"],
    "tracked_file_count": int(os.environ["FILE_COUNT"]),
    "directory_count_excl_git": int(os.environ["DIR_COUNT"]),
    "tracked_path_sha256": os.environ["PATH_SHA"],
    "tracked_index_sha256": os.environ["INDEX_SHA"],
    "comparison": comparison,
    "working_tree_clean": as_bool(os.environ["WT_CLEAN"]),
}

with open(os.environ["OUT_FILE"], "w") as f:
    json.dump(artifact, f, indent=2)
print(json.dumps(artifact, separators=(",", ":")))
PY

# Best-effort trace event — never fail the audit if the trace writer is absent/errors.
if [ -x ".claude/hooks/append-trace.sh" ]; then
  TRACE_JSON="$(RUN_ID="$RUN_ID" REPO="$LOCAL" FILE_COUNT="$FILE_COUNT" OUT_FILE="$OUT_FILE" "$PY" -c 'import json,os; print(json.dumps({"run_id":os.environ["RUN_ID"],"repo":os.environ["REPO"],"tracked_file_count":int(os.environ["FILE_COUNT"]),"artifact":os.environ["OUT_FILE"]}))' 2>/dev/null || echo '{}')"
  bash .claude/hooks/append-trace.sh audit_result "$TRACE_JSON" 2>/dev/null || true
fi

echo "Audit artifact: $OUT_FILE" >&2
