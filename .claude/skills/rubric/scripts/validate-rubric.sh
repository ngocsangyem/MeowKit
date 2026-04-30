#!/usr/bin/env bash
# validate-rubric.sh — Schema validator for the meowkit rubric library.
# Usage:  validate-rubric.sh [<rubric.md> | --preset <path> | --presets-only]
#         (no args validates all rubrics + all presets)
# Exit:   0 if all PASS, 1 if any FAIL (diagnostics on stderr)
# Reqs:   Bash 3.2+. Tested macOS BSD + GNU coreutils.
set -u
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../../.." && pwd)"
rubrics_dir="$repo_root/.claude/rubrics"
[ -d "$rubrics_dir" ] || { echo "FAIL: rubrics directory not found at $rubrics_dir" >&2; exit 2; }
fail=0
pass_count=0

# ---- Single rubric validator ----
validate_rubric() {
  local file="$1"
  local name
  name=$(basename "$file" .md)

  if [ ! -f "$file" ]; then
    echo "FAIL [$name]: file not found: $file" >&2
    return 1
  fi

  local file_fail=0

  # 1. File ≤200 lines.
  local lines
  lines=$(wc -l < "$file" | tr -d ' ')
  [ "$lines" -gt 200 ] && { echo "FAIL [$name]: file is $lines lines (max 200)" >&2; file_fail=1; }

  # 2. Required frontmatter fields.
  for field in "name:" "version:" "weight_default:" "applies_to:" "hard_fail_threshold:"; do
    head -20 "$file" | grep -q "^$field" || { echo "FAIL [$name]: missing frontmatter field: $field" >&2; file_fail=1; }
  done

  # 3. name field must match filename.
  local name_field
  name_field=$(grep -E '^name:[[:space:]]*' "$file" | head -1 | sed -E 's/^name:[[:space:]]*//' | tr -d ' ')
  if [ "$name_field" != "$name" ]; then
    echo "FAIL [$name]: frontmatter name '$name_field' != filename '$name'" >&2
    file_fail=1
  fi

  # 4. Required sections present.
  for section in "## Intent" "## Criteria" "## Grading" "## Anti-patterns" "## Few-Shot Examples"; do
    grep -qF "$section" "$file" || { echo "FAIL [$name]: missing section: $section" >&2; file_fail=1; }
  done

  # 5. Anchor balance — ≥1 PASS + ≥1 FAIL; ±1 if total<4, exact if total≥4.
  local pass_anchors fail_anchors total diff
  pass_anchors=$(grep -cE '^### Example [0-9]+ — PASS' "$file" || true)
  fail_anchors=$(grep -cE '^### Example [0-9]+ — FAIL' "$file" || true)
  total=$((pass_anchors + fail_anchors))
  diff=$((pass_anchors - fail_anchors))
  [ "$pass_anchors" -lt 1 ] && { echo "FAIL [$name]: needs ≥1 PASS anchor (found $pass_anchors)" >&2; file_fail=1; }
  [ "$fail_anchors" -lt 1 ] && { echo "FAIL [$name]: needs ≥1 FAIL anchor (found $fail_anchors)" >&2; file_fail=1; }
  if [ "$total" -ge 4 ] && [ "$diff" -ne 0 ]; then
    echo "FAIL [$name]: with $total anchors, PASS/FAIL must be exactly equal ($pass_anchors/$fail_anchors)" >&2
    file_fail=1
  elif [ "$diff" -gt 1 ] || [ "$diff" -lt -1 ]; then
    echo "FAIL [$name]: PASS/FAIL imbalanced ($pass_anchors/$fail_anchors); ±1 max when total<4" >&2
    file_fail=1
  fi

  # 6. applies_to values must be from canonical list.
  local applies_raw
  applies_raw=$(grep -E '^applies_to:' "$file" | head -1 | sed -E 's/^applies_to:[[:space:]]*//' | tr -d '[]' | tr ',' ' ')
  for value in $applies_raw; do
    case "$value" in
      frontend|backend|fullstack|cli|library|data-pipeline|"") ;;
      *)
        echo "FAIL [$name]: applies_to value '$value' not in canonical list" >&2
        file_fail=1
        ;;
    esac
  done

  if [ "$file_fail" -eq 0 ]; then
    pass_count=$((pass_count + 1))
    echo "PASS [$name]"
    return 0
  else
    return 1
  fi
}

# ---- Single preset validator ----
validate_preset() {
  local file="$1"
  local name
  name=$(basename "$file" .md)

  if [ ! -f "$file" ]; then
    echo "FAIL [preset $name]: file not found: $file" >&2
    return 1
  fi

  local file_fail=0

  # Frontmatter required fields
  for field in "name:" "version:" "applies_to:" "rubrics:"; do
    if ! head -30 "$file" | grep -q "^$field"; then
      echo "FAIL [preset $name]: missing frontmatter field: $field" >&2
      file_fail=1
    fi
  done

  # Sum weights — extract `weight: 0.NN` lines from frontmatter section.
  # Strips inline `# comment` segments before parsing (M4 hardening).
  local sum
  sum=$(awk '
    /^---$/{f++; next}
    f==1 {
      sub(/[[:space:]]+#.*$/, "")  # require whitespace BEFORE # so URL fragments survive
    }
    f==1 && /^[[:space:]]+weight:/ {
      gsub(/[^0-9.]/, "", $2)
      print $2
    }
  ' "$file" | awk '{s+=$1} END {printf "%.4f", s}')

  # Check sum is within 0.99-1.01
  local sum_ok
  sum_ok=$(awk -v s="$sum" 'BEGIN {if (s >= 0.99 && s <= 1.01) print "ok"; else print "bad"}')
  if [ "$sum_ok" != "ok" ]; then
    echo "FAIL [preset $name]: weights sum to $sum (must be 1.0 ±0.01)" >&2
    file_fail=1
  fi

  if [ "$file_fail" -eq 0 ]; then
    pass_count=$((pass_count + 1))
    echo "PASS [preset $name] (weights sum: $sum)"
    return 0
  else
    return 1
  fi
}

# ---- Argument dispatch ----
case "${1:-}" in
  -h|--help)
    cat <<'EOF'
validate-rubric.sh — Schema validator for the meowkit rubric library

Usage:
  validate-rubric.sh                 Validate all rubrics + all presets
  validate-rubric.sh <rubric.md>     Validate a single rubric file
  validate-rubric.sh --preset <path> Validate a single composition preset
  validate-rubric.sh --presets-only  Validate only composition presets
  validate-rubric.sh -h | --help     Show this help

Exit: 0 if all PASS, 1 if any FAIL, 2 on bad invocation.
EOF
    exit 0
    ;;
  --preset)
    shift
    if [ -z "${1:-}" ]; then
      echo "usage: validate-rubric.sh --preset <path>" >&2
      exit 2
    fi
    validate_preset "$1" || fail=1
    ;;
  --presets-only)
    for f in "$rubrics_dir"/composition-presets/*.md; do
      [ -f "$f" ] || continue
      validate_preset "$f" || fail=1
    done
    ;;
  "")
    # Validate all rubrics + all presets.
    # Track count to catch empty-glob silent-pass (M3 fix).
    rubric_files_seen=0
    for f in "$rubrics_dir"/*.md; do
      [ -f "$f" ] || continue
      basename_f=$(basename "$f")
      [ "$basename_f" = "schema.md" ] && continue
      [ "$basename_f" = "RUBRICS_INDEX.md" ] && continue
      rubric_files_seen=$((rubric_files_seen + 1))
      validate_rubric "$f" || fail=1
    done
    if [ "$rubric_files_seen" -eq 0 ]; then
      echo "FAIL: no rubric files found in $rubrics_dir (excluding schema.md, RUBRICS_INDEX.md)" >&2
      fail=1
    fi

    preset_files_seen=0
    for f in "$rubrics_dir"/composition-presets/*.md; do
      [ -f "$f" ] || continue
      preset_files_seen=$((preset_files_seen + 1))
      validate_preset "$f" || fail=1
    done
    if [ "$preset_files_seen" -eq 0 ]; then
      echo "FAIL: no preset files found in $rubrics_dir/composition-presets/" >&2
      fail=1
    fi
    ;;
  *)
    validate_rubric "$1" || fail=1
    ;;
esac

if [ "$fail" -eq 0 ]; then
  echo ""
  echo "ALL_RUBRICS_VALID: $pass_count file(s) passed"
  exit 0
fi

echo ""
echo "VALIDATION_FAILED" >&2
exit 1
