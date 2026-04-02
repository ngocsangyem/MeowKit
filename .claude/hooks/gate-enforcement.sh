#!/bin/bash
# MeowKit Gate Enforcement Hook
# PreToolUse: Block code writes before Gate 1 (plan approval).
# Upgrades gate-rules.md from behavioral to preventive.
#
# Matches: Edit, Write tool calls targeting source code files
# Blocks: if no approved plan exists in tasks/plans/ AND target is source code
# Allows: plan files, test files, docs, config, and any write after Gate 1 approval
#
# Gate 1 bypass: /meow:fix --simple OR scale-routing one-shot

# Ensure CWD is project root for relative paths
if [ -n "$CLAUDE_PROJECT_DIR" ]; then cd "$CLAUDE_PROJECT_DIR" || exit 0; fi

# settings.json matcher already filters to Edit|Write — no need to check tool name
# $1 = file path passed via $TOOL_INPUT_FILE_PATH
FILE_PATH="$1"

# If no file path provided, allow (safety fallback)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Allow writes to non-source files (plans, reviews, docs, tests, config)
if echo "$FILE_PATH" | grep -qiE 'tasks/plans|tasks/reviews|docs/|\.claude/|\.test\.|\.spec\.|__tests__|plans/|\.md$|\.json$|\.yaml$|\.yml$|\.toml$'; then
  exit 0
fi

# Check if any approved plan exists (directory structure: tasks/plans/YYMMDD-name/plan.md)
if ls tasks/plans/*/plan.md 2>/dev/null | head -1 > /dev/null 2>&1; then
  # Plan files exist — Gate 1 is satisfied
  exit 0
fi
# Also check flat file format for backward compatibility
if ls tasks/plans/*.md 2>/dev/null | head -1 > /dev/null 2>&1; then
  exit 0
fi

# No plan found and target is source code — block
echo "@@GATE_BLOCK@@"
echo "No approved plan found in tasks/plans/."
echo "Gate 1 requires an approved plan before source code changes."
echo "Create a plan first: /meow:plan-creator or /meow:fix for simple fixes."
exit 1
