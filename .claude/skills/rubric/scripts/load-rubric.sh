#!/usr/bin/env bash
#
# load-rubric.sh — Load rubrics and emit prompt-ready fragments.
#
# Usage:
#   load-rubric.sh --list                  # List all rubrics + presets
#   load-rubric.sh <rubric-name>           # Load one rubric, strip frontmatter, emit body
#   load-rubric.sh --preset <preset-name>  # Load a composition preset + all member rubrics
#
# Used by:
#   - mk:rubric SKILL.md as the implementation of list/load/compose subcommands
#   - evaluator subagent (via mk:evaluate, shipped Phase 3) to inject rubrics into its grading prompt
#
# Exit: 0 on success, 1 if rubric/preset not found, 2 on usage error
#
# Requires Bash 3.2+ (uses `local` and process substitution).
# Tested on macOS BSD coreutils + GNU coreutils.

set -u

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../../.." && pwd)"
rubrics_dir="$repo_root/.claude/rubrics"
presets_dir="$rubrics_dir/composition-presets"

if [ ! -d "$rubrics_dir" ]; then
  echo "ERROR: rubrics directory not found at $rubrics_dir" >&2
  exit 2
fi

# ---- Strip YAML frontmatter from a markdown file ----
strip_frontmatter() {
  awk 'BEGIN{f=0} /^---$/{f++; next} f>=2 {print}' "$1"
}

# ---- Extract a frontmatter field value ----
get_field() {
  local file="$1"
  local field="$2"
  awk -v field="$field" '
    /^---$/{f++; next}
    f==1 && $0 ~ "^"field":" {
      sub("^"field":[[:space:]]*", "", $0)
      print $0
      exit
    }
  ' "$file"
}

# ---- List all rubrics + presets ----
cmd_list() {
  echo "## Available Rubrics"
  echo ""
  echo "| Rubric | Weight | Hard-Fail | Applies To |"
  echo "|---|---|---|---|"
  for f in "$rubrics_dir"/*.md; do
    [ -f "$f" ] || continue
    local basename_f
    basename_f=$(basename "$f" .md)
    [ "$basename_f" = "schema" ] && continue
    [ "$basename_f" = "RUBRICS_INDEX" ] && continue
    local weight applies hard_fail
    weight=$(get_field "$f" "weight_default")
    applies=$(get_field "$f" "applies_to")
    hard_fail=$(get_field "$f" "hard_fail_threshold")
    echo "| $basename_f | $weight | $hard_fail | $applies |"
  done

  echo ""
  echo "## Available Presets"
  echo ""
  echo "| Preset | Description |"
  echo "|---|---|"
  for f in "$presets_dir"/*.md; do
    [ -f "$f" ] || continue
    local basename_f desc
    basename_f=$(basename "$f" .md)
    desc=$(get_field "$f" "description")
    echo "| $basename_f | $desc |"
  done
}

# ---- Load one rubric and emit prompt fragment ----
cmd_load() {
  local name="$1"
  local file="$rubrics_dir/$name.md"

  if [ ! -f "$file" ]; then
    echo "ERROR: rubric not found: $name (looked at $file)" >&2
    exit 1
  fi

  local weight hard_fail
  weight=$(get_field "$file" "weight_default")
  hard_fail=$(get_field "$file" "hard_fail_threshold")

  echo "## Rubric: $name (weight: $weight, hard_fail: $hard_fail)"
  echo ""
  strip_frontmatter "$file"
}

# ---- Load a composition preset (all member rubrics) ----
cmd_preset() {
  local name="$1"
  local file="$presets_dir/$name.md"

  if [ ! -f "$file" ]; then
    echo "ERROR: preset not found: $name (looked at $file)" >&2
    exit 1
  fi

  local desc
  desc=$(get_field "$file" "description")

  echo "## Composition: $name"
  echo ""
  echo "$desc"
  echo ""
  echo "| Rubric | Weight | Hard-Fail Threshold |"
  echo "|---|---|---|"

  # Extract rubric names + weights from the preset frontmatter.
  # Strip inline `# comment` segments before parsing (M4 hardening).
  # Use process substitution (not pipe) so the loop runs in the parent shell —
  # avoids subshell `local` brittleness on hardened bash builds (C4 fix).
  while IFS='|' read -r rubric_name weight; do
    [ -z "$rubric_name" ] && continue
    local rubric_file="$rubrics_dir/$rubric_name.md"
    if [ -f "$rubric_file" ]; then
      local hard_fail
      hard_fail=$(get_field "$rubric_file" "hard_fail_threshold")
      echo "| $rubric_name | $weight | $hard_fail |"
    else
      echo "| $rubric_name | $weight | (NOT FOUND) |"
    fi
  done < <(awk '
    /^---$/{f++; next}
    f==1 {
      sub(/[[:space:]]+#.*$/, "")  # strip inline comments (require whitespace BEFORE # so URL fragments survive)
    }
    f==1 && /^[[:space:]]+- name:/ {
      gsub(/[[:space:]]+- name:[[:space:]]*/, "")
      name=$0
      next
    }
    f==1 && /^[[:space:]]+weight:/ && name != "" {
      gsub(/[[:space:]]+weight:[[:space:]]*/, "")
      print name "|" $0
      name=""
    }
  ' "$file")

  echo ""
  echo "---"
  echo ""
  echo "## Member Rubrics (full body)"

  while read -r rubric_name; do
    [ -z "$rubric_name" ] && continue
    local rubric_file="$rubrics_dir/$rubric_name.md"
    if [ -f "$rubric_file" ]; then
      echo ""
      cmd_load "$rubric_name"
    fi
  done < <(awk '
    /^---$/{f++; next}
    f==1 {
      sub(/[[:space:]]+#.*$/, "")  # strip inline comments (require whitespace BEFORE # so URL fragments survive)
    }
    f==1 && /^[[:space:]]+- name:/ {
      gsub(/[[:space:]]+- name:[[:space:]]*/, "")
      print $0
    }
  ' "$file")
}

# ---- Argument dispatch ----
case "${1:-}" in
  --list|"")
    cmd_list
    ;;
  --preset)
    shift
    if [ -z "${1:-}" ]; then
      echo "usage: load-rubric.sh --preset <preset-name>" >&2
      exit 2
    fi
    cmd_preset "$1"
    ;;
  -h|--help)
    sed -n '3,12p' "$0"
    ;;
  *)
    cmd_load "$1"
    ;;
esac
