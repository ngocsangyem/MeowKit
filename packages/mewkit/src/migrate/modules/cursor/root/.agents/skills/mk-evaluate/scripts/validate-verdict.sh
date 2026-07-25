#!/usr/bin/env bash
# validate-verdict.sh — Enforces the active-verification HARD GATE on evaluator verdict files.
# Usage:  validate-verdict.sh <path-to-evalverdict.md>
# Exit:   0 if valid, 1 if FAIL (with diagnostics on stderr), 2 on usage error
# Reqs:   Bash 3.2+. Tested macOS BSD + GNU coreutils.
#
# Per Phase 3 spec: a verdict with empty evidence/ directory is rejected.
# A PASS verdict on functionality rubric without runtime evidence is converted to FAIL.
set -u

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <path-to-evalverdict.md>" >&2
  exit 2
fi

verdict="$1"

if [ ! -f "$verdict" ]; then
  echo "FAIL: verdict file not found: $verdict" >&2
  exit 1
fi

fail=0

# ---- Extract a frontmatter field ----
get_field() {
  awk -v field="$1" '
    /^---$/{f++; next}
    f==1 && $0 ~ "^"field":" {
      sub("^"field":[[:space:]]*", "", $0)
      print $0
      exit
    }
  ' "$verdict"
}

# 1. Required frontmatter fields. `evaluator` (identity: agent/session/date) is required
#    as of validator v2 — anti-accidental provenance (not claimed unforgeable; consistent
#    with Gate 2's authority note). A verdict with no evaluator identity is rejected.
for field in "task" "evaluator_run" "rubric_preset" "overall" "weighted_score" "hard_fail_triggered" "evaluator"; do
  if [ -z "$(get_field "$field")" ]; then
    echo "VERDICT_INVALID: missing required frontmatter field: $field" >&2
    fail=1
  fi
done

overall=$(get_field "overall")
case "$overall" in
  PASS|WARN|FAIL) ;;
  *)
    echo "FAIL: overall verdict must be PASS|WARN|FAIL (got: $overall)" >&2
    fail=1
    ;;
esac

# 2. Locate the evidence directory.
# Convention: tasks/reviews/{name}-evalverdict.md → tasks/reviews/{name}-evalverdict-evidence/
verdict_dir=$(dirname "$verdict")
verdict_base=$(basename "$verdict" .md)
evidence_dir="$verdict_dir/${verdict_base}-evidence"

if [ ! -d "$evidence_dir" ]; then
  echo "FAIL: evidence directory does not exist: $evidence_dir" >&2
  echo "       (active-verification gate per Phase 3 spec — every verdict needs an evidence/ directory)" >&2
  fail=1
fi

# 3. Evidence directory must be non-empty (HARD GATE).
if [ -d "$evidence_dir" ]; then
  evidence_count=$(find "$evidence_dir" -type f | wc -l | tr -d ' ')
  if [ "$evidence_count" -eq 0 ]; then
    echo "FAIL: evidence directory is empty: $evidence_dir" >&2
    echo "       no active verification performed — verdict cannot be PASS or WARN" >&2
    fail=1
  fi
else
  evidence_count=0
fi

# 4. PASS/WARN verdict requires at least 1 evidence file. Convert to FAIL if violated.
if [ "$overall" = "PASS" ] || [ "$overall" = "WARN" ]; then
  if [ "$evidence_count" -eq 0 ]; then
    echo "FAIL: $overall verdict with empty evidence — converting to FAIL per active-verification gate" >&2
    fail=1
  fi
fi

# 5. PER-RUBRIC HARD GATE — every rubric whose hard_fail_threshold is FAIL
#    must have at least one cited evidence file when its verdict is PASS or WARN.
#    This generalizes the previous functionality-only check to ALL hard-fail rubrics
#    (closes red-team C2 — frontend-app preset has 4 hard-fail rubrics, not just functionality).
#    Walk per-rubric `### {name} (...)` headers and check for >=1 cited evidence in their body.
awk '
  BEGIN { current=""; current_verdict=""; has_evidence=0; fail_state=0 }

  # Detect rubric section header: "### {name} (weight ..., hard_fail FAIL) — {VERDICT}"
  # Use simple PASS/WARN/FAIL trailing match instead of em-dash anchor
  # (BSD awk treats em-dash as multibyte and breaks substr offsets — C1-followup fix).
  /^### / {
    # Flush previous rubric
    if (current != "" && (current_verdict == "PASS" || current_verdict == "WARN") && has_evidence == 0) {
      print "FAIL: rubric \"" current "\" marked " current_verdict " but no evidence file cited in its section" > "/dev/stderr"
      fail_state=1
    }
    current=""; current_verdict=""; has_evidence=0
    if (match($0, /^### [a-z][a-z0-9-]*/)) {
      current = substr($0, RSTART+4, RLENGTH-4)
    }
    # Check for verdict token anywhere in the header line (avoid em-dash positioning).
    if ($0 ~ / PASS$/ || $0 ~ / PASS[[:space:]]*$/) current_verdict = "PASS"
    else if ($0 ~ / WARN$/ || $0 ~ / WARN[[:space:]]*$/) current_verdict = "WARN"
    else if ($0 ~ / FAIL$/ || $0 ~ / FAIL[[:space:]]*$/) current_verdict = "FAIL"
  }

  # Match list-item Evidence: citations only (start-of-line list marker)
  # Closes red-team C1 — was matching prose containing "Evidence:" anywhere.
  /^[[:space:]]*-[[:space:]]+\*?\*?Evidence:?\*?\*?[[:space:]]+`?[^`[:space:]]+/ {
    if (current != "") has_evidence=1
  }

  END {
    if (current != "" && (current_verdict == "PASS" || current_verdict == "WARN") && has_evidence == 0) {
      print "FAIL: rubric \"" current "\" marked " current_verdict " but no evidence file cited in its section" > "/dev/stderr"
      fail_state=1
    }
    exit fail_state
  }
' "$verdict" || fail=1

# 6. Cited evidence files must exist on disk.
# Only consider lines that look like list-item citations (closes C1 false-positive).
missing_count=0
while IFS= read -r evidence_line; do
  # Extract the path token after "Evidence:" — handle both backtick-wrapped and plain.
  evidence_path=$(echo "$evidence_line" | sed -E 's/.*Evidence:?\*?\*?[[:space:]]+`?([^`[:space:]]+)`?.*/\1/' | tr -d ' ')
  [ -z "$evidence_path" ] && continue
  case "$evidence_path" in
    /*) full_path="$evidence_path" ;;
    *)  full_path="$verdict_dir/$evidence_path" ;;
  esac
  if [ ! -f "$full_path" ] && [ ! -f "$evidence_path" ]; then
    echo "FAIL: cited evidence file not found: $evidence_path" >&2
    missing_count=$((missing_count + 1))
    fail=1
  fi
done < <(grep -E '^[[:space:]]*-[[:space:]]+\*?\*?Evidence:?\*?\*?[[:space:]]+`?[^`[:space:]]+' "$verdict" 2>/dev/null || true)

# 7. weighted_score sanity check (0.0 - 1.0)
score=$(get_field "weighted_score")
if [ -n "$score" ]; then
  ok=$(awk -v s="$score" 'BEGIN { if (s >= 0 && s <= 1) print "ok"; else print "bad" }')
  if [ "$ok" != "ok" ]; then
    echo "VERDICT_INVALID: weighted_score $score out of range [0.0, 1.0]" >&2
    fail=1
  fi
fi

# 8. RECOMPUTE (validator v2) — the declared score/overall/coverage must FOLLOW from the
#    per-rubric verdicts and the canonical preset weights. This is what closes the forged-PASS
#    path: a verdict that declares PASS + weighted_score 0.01 (or whose rubric set does not
#    cover the preset) is rejected even though every field is individually well-formed.
PY=".agents/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="$(command -v python3 || true)"
recompute_script="$(dirname "$0")/recompute-score.py"
recomputed_ran=0
if [ -z "$PY" ]; then
  # python3 is a hard dependency of the recompute gate. No interpreter ⇒ cannot verify the
  # score is honest ⇒ fail closed rather than accept an unverifiable PASS/WARN.
  if [ "$overall" = "PASS" ] || [ "$overall" = "WARN" ]; then
    echo "VERDICT_INVALID: python3 not found — cannot recompute the weighted score for a $overall verdict" >&2
    fail=1
  fi
elif [ ! -f "$recompute_script" ]; then
  # Same principle: the recompute script missing (partial install / mirror drift) means the
  # score cannot be verified. Fail closed for PASS/WARN rather than accept it AND falsely stamp
  # score_recomputed:true. A missing checker at the one moment it matters is a block, not a pass.
  if [ "$overall" = "PASS" ] || [ "$overall" = "WARN" ]; then
    echo "VERDICT_INVALID: recompute-score.py not found at $recompute_script — cannot verify the score for a $overall verdict" >&2
    fail=1
  fi
else
  recompute_out=$("$PY" "$recompute_script" "$verdict" 2>&1)
  recompute_rc=$?
  recomputed_ran=1
  if [ "$recompute_rc" -ne 0 ]; then
    echo "VERDICT_INVALID: recomputation rejected the verdict:" >&2
    printf '%s\n' "$recompute_out" | "$PY" -c "import sys,json
try:
    d=json.load(sys.stdin)
    for r in d.get('reasons',[]): print('  - '+r)
except Exception:
    print('  '+sys.stdin.read())" >&2 2>/dev/null || printf '%s\n' "$recompute_out" >&2
    fail=1
  fi
fi

# 9. EVIDENCE MANIFEST (validator v2) — record a per-file SHA-256 + inferred type next to the
#    evidence dir so a later reader can tell WHAT was captured, not just that files exist. An
#    all-unknown-type evidence set for a PASS/WARN verdict is a WARN (advisory) — diverse projects
#    carry evidence types this allowlist does not know; only EMPTY evidence blocks (handled above).
if [ -d "$evidence_dir" ] && [ "$evidence_count" -gt 0 ]; then
  manifest="$verdict_dir/${verdict_base}-evidence.manifest.json"
  sha() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'; elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else echo "unavailable"; fi; }
  classify() {
    case "$1" in
      *.txt|*.log|*.md) echo transcript ;;
      *.png|*.jpg|*.jpeg|*.gif|*.webp|*.svg) echo screenshot ;;
      *.json|*.html|*.csv|*.xml|*.yaml|*.yml|*.har) echo command-output ;;
      *) echo unknown ;;
    esac
  }
  {
    echo "["
    _first=1
    find "$evidence_dir" -type f | while IFS= read -r _f; do
      _type=$(classify "$_f")
      [ "$_first" -eq 0 ] && echo ","
      _first=0
      printf '  {"file": "%s", "sha256": "%s", "type": "%s"}' "$_f" "$(sha "$_f")" "$_type"
    done
    echo ""
    echo "]"
  } > "$manifest"
  # All-unknown-type evidence for a PASS/WARN verdict is a WARN (advisory), not a block.
  if ! find "$evidence_dir" -type f | grep -qE '\.(txt|log|md|png|jpg|jpeg|gif|webp|svg|json|html|csv|xml|yaml|yml|har)$'; then
    if [ "$overall" = "PASS" ] || [ "$overall" = "WARN" ]; then
      echo "VERDICT_WARN: evidence has no recognized type (transcript/screenshot/command-output) — cannot confirm active verification captured a usable artifact." >&2
    fi
  fi
fi

# 10. Stamp the verdict if it passed validation.
if [ "$fail" -eq 0 ]; then
  # score_recomputed reflects whether recompute ACTUALLY ran — never a fixed "true". A FAIL verdict
  # accepted without an interpreter/script stamps false, so the attestation is honest.
  if [ "$recomputed_ran" -eq 1 ]; then score_recomputed="true"; else score_recomputed="false"; fi
  stamp_block=$(printf "\n## Validator Stamp\n\n- validator_version: 2.0.0\n- validated_at: %s\n- evidence_files_counted: %d\n- score_recomputed: %s\n- verdict_accepted: true\n" \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$evidence_count" "$score_recomputed")

  # Only append the stamp if not already present.
  if ! grep -q "^## Validator Stamp" "$verdict"; then
    printf '%s\n' "$stamp_block" >> "$verdict"
  fi

  echo "VERDICT_VALID: $verdict ($evidence_count evidence files, overall=$overall, score recomputed)"
  exit 0
fi

echo "" >&2
echo "VALIDATION_FAILED: $verdict" >&2
echo "  → If overall was PASS or WARN with empty evidence, convert to FAIL and re-run." >&2
echo "  → Missing evidence files: $missing_count" >&2
exit 1
