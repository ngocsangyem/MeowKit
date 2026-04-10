#!/usr/bin/env bash
# run-evaluator.sh — Subagent spawn wrapper for meow:evaluate.
# Usage:  run-evaluator.sh <target> [--rubric-preset NAME] [--no-boot] [--max-criteria N]
# Exit:   0 if verdict PASS, 1 if WARN, 2 if FAIL, 3 on internal error
# Reqs:   Bash 3.2+. Tested macOS BSD + GNU coreutils.
#
# This script:
#   1. Validates arguments
#   2. Resolves the rubric preset (default by target type if not given)
#   3. Composes the rubric library output (calls meow:rubric load-rubric.sh)
#   4. Builds the evaluator subagent prompt with composed rubrics + skeptic persona
#   5. Prints the dispatch instructions for the orchestrator
#
# It does NOT spawn the subagent itself — that's the orchestrator's responsibility
# (Task tool with subagent_type=evaluator). This script prepares the inputs.
set -u

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../../.." && pwd)"
rubric_loader="$repo_root/.claude/skills/meow:rubric/scripts/load-rubric.sh"
persona_file="$script_dir/../prompts/skeptic-persona.md"

if [ ! -x "$rubric_loader" ]; then
  echo "ERROR: rubric loader not found or not executable: $rubric_loader" >&2
  exit 3
fi
if [ ! -f "$persona_file" ]; then
  echo "ERROR: skeptic persona not found: $persona_file" >&2
  exit 3
fi

# ---- Parse args ----
target=""
preset=""
no_boot=0
max_criteria=15

while [ $# -gt 0 ]; do
  case "$1" in
    --rubric-preset)
      preset="$2"
      shift 2
      ;;
    --no-boot)
      no_boot=1
      shift
      ;;
    --max-criteria)
      max_criteria="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,11p' "$0"
      exit 0
      ;;
    *)
      if [ -z "$target" ]; then
        target="$1"
      else
        echo "ERROR: unexpected argument: $1" >&2
        exit 3
      fi
      shift
      ;;
  esac
done

if [ -z "$target" ]; then
  echo "ERROR: target argument required" >&2
  echo "usage: $0 <target> [--rubric-preset NAME] [--no-boot] [--max-criteria N]" >&2
  exit 3
fi

# ---- Detect target type ----
target_type=""
case "$target" in
  http://*|https://*)
    target_type="frontend-url"
    ;;
  *)
    if [ -d "$target" ]; then
      if [ -f "$target/package.json" ] || [ -f "$target/pnpm-lock.yaml" ] || [ -f "$target/bun.lockb" ]; then
        target_type="frontend-path"
      elif [ -f "$target/pyproject.toml" ] || [ -f "$target/Cargo.toml" ] || [ -f "$target/go.mod" ]; then
        target_type="backend-path"
      else
        echo "WARN: cannot detect target type from $target — assuming frontend-path" >&2
        target_type="frontend-path"
      fi
    elif [ -x "$target" ]; then
      target_type="cli-binary"
    else
      echo "ERROR: target $target is not a URL, directory, or executable" >&2
      exit 3
    fi
    ;;
esac

# ---- Default preset by target type ----
if [ -z "$preset" ]; then
  case "$target_type" in
    frontend-url|frontend-path) preset="frontend-app" ;;
    backend-url|backend-path)   preset="backend-api" ;;
    cli-binary)                  preset="cli-tool" ;;
    *)                           preset="frontend-app" ;;
  esac
fi

# ---- Compose the rubric ----
composed_rubric=$("$rubric_loader" --preset "$preset" 2>&1)
if [ $? -ne 0 ]; then
  echo "ERROR: rubric loader failed for preset $preset" >&2
  echo "$composed_rubric" >&2
  exit 3
fi

# ---- Emit dispatch instructions ----
cat <<EVAL_DISPATCH_9f3a
# meow:evaluate — Dispatch Instructions

## Target
- target: $target
- target_type: $target_type
- preset: $preset
- no_boot: $no_boot
- max_criteria: $max_criteria

## Subagent Spawn (orchestrator instruction)

The orchestrator should now spawn the evaluator subagent with these inputs:

\`\`\`
Task(
  subagent_type="evaluator",
  description="Evaluate $target",
  prompt="
    Read .claude/skills/meow:evaluate/workflow.md and follow it.

    Target: $target
    target_type: $target_type
    rubric_preset: $preset
    no_boot: $no_boot
    max_criteria: $max_criteria

    Skeptic persona (RELOAD before each criterion grading):
    $persona_file

    Composed rubric (use this verbatim):
    --- BEGIN COMPOSED RUBRIC ---
$composed_rubric
    --- END COMPOSED RUBRIC ---

    HARD GATE: every verdict must pass validate-verdict.sh.
    Empty evidence directory → automatic FAIL conversion.
  "
)
\`\`\`

## Post-dispatch

After the evaluator returns, run:
\`\`\`
.claude/skills/meow:evaluate/scripts/validate-verdict.sh tasks/reviews/{date}-{slug}-evalverdict.md
\`\`\`

If validator exits 0 → exit code matches verdict (PASS=0, WARN=1, FAIL=2).
If validator exits 1 → either fix the verdict or convert PASS/WARN → FAIL.
EVAL_DISPATCH_9f3a

exit 0
