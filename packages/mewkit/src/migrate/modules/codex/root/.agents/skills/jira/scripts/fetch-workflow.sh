#!/usr/bin/env bash
# fetch-workflow.sh — discover a Jira workflow definition and cache it.
#
# Usage:
#   bash $(git rev-parse --show-toplevel)/.agents/skills/jira/scripts/fetch-workflow.sh <ISSUE_KEY>
#       Discovers the workflow for the (project, issue-type) of <ISSUE_KEY>
#       via `admin workflow for-issue` (admin path). On 403 falls back to
#       `lifecycle transitions <ISSUE_KEY>` (non-admin path; partial).
#
# Cache layout (under $(git rev-parse --show-toplevel)/tasks/jira-workflows/):
#   _schemes/<PROJECT_KEY>.md       → project → workflow-name mapping
#   <workflow-name-slug>.md         → full workflow def (statuses + transitions)
#
# Output: prints the cache file path that was written/refreshed.
# Exit codes: 0=success, 2=auth, 3=permission, 4=not-found, 1=other.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel):-$(pwd)}"
WRAPPER="$ROOT/.agents/skills/jira/scripts/jira-as.sh"
CACHE_DIR="$ROOT/tasks/jira-workflows"
SCHEMES_DIR="$CACHE_DIR/_schemes"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ $# -lt 1 ]; then
  echo "Usage: fetch-workflow.sh <ISSUE_KEY>" >&2
  exit 1
fi

ISSUE_KEY="$1"
mkdir -p "$SCHEMES_DIR"

# Slugify a workflow name → kebab-case ascii filename
slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-80
}

# Try admin path: admin workflow for-issue <KEY>
WF_JSON="$(bash "$WRAPPER" admin workflow for-issue "$ISSUE_KEY" --output json 2>/dev/null)"
RC=$?

if [ $RC -eq 0 ] && [ -n "$WF_JSON" ]; then
  # Admin path succeeded — extract workflow name + project
  WF_NAME="$(echo "$WF_JSON" | jq -r '.name // empty')"
  if [ -z "$WF_NAME" ]; then
    echo "[fetch-workflow] admin path returned no workflow name for $ISSUE_KEY" >&2
    exit 1
  fi
  PROJECT_KEY="$(bash "$WRAPPER" issue get "$ISSUE_KEY" --output json 2>/dev/null \
    | jq -r '.fields.project.key // empty')"
  ITYPE_NAME="$(bash "$WRAPPER" issue get "$ISSUE_KEY" --output json 2>/dev/null \
    | jq -r '.fields.issuetype.name // empty')"
  WF_SLUG="$(slugify "$WF_NAME")"
  WF_FILE="$CACHE_DIR/$WF_SLUG.md"
  SCHEME_FILE="$SCHEMES_DIR/$PROJECT_KEY.md"

  # Write workflow definition (markdown with statuses + transitions tables)
  {
    echo "# Workflow: $WF_NAME"
    echo
    echo "<!-- managed by .agents/skills/jira/scripts/fetch-workflow.sh — manual edits will be overwritten on re-fetch -->"
    echo
    echo "- **Source**: \`admin workflow for-issue $ISSUE_KEY\` (admin path)"
    echo "- **Fetched**: $NOW"
    echo "- **Updated upstream**: $(echo "$WF_JSON" | jq -r '.updated // "n/a"')"
    echo "- **Discovery scope**: complete (full statuses + transitions)"
    echo
    echo "## Statuses"
    echo
    echo "| ID | Name | Category |"
    echo "|---|---|---|"
    echo "$WF_JSON" | jq -r '.statuses[]? | "| \(.id // "?") | \(.name // "?") | \(.statusCategory.key // .category.key // "?") |"'
    echo
    echo "## Transitions"
    echo
    echo "| ID | Name | From | To |"
    echo "|---|---|---|---|"
    echo "$WF_JSON" | jq -r '.transitions[]? | "| \(.id // "?") | \(.name // "?") | \((.from // [])|join(", ")) | \(.to // "?") |"'
  } > "$WF_FILE"

  # Write or update scheme file (project → workflow mapping)
  if [ -n "$PROJECT_KEY" ]; then
    {
      echo "# Workflow scheme: $PROJECT_KEY"
      echo
      echo "<!-- managed by fetch-workflow.sh — re-fetch to refresh -->"
      echo
      echo "- **Project**: $PROJECT_KEY"
      echo "- **Fetched**: $NOW"
      echo
      echo "## Issue-type → workflow mapping"
      echo
      echo "| Issue type | Workflow | Cache file |"
      echo "|---|---|---|"
      echo "| ${ITYPE_NAME:-?} | $WF_NAME | \`$WF_SLUG.md\` |"
      echo
      echo "Re-run \`fetch-workflow.sh <KEY>\` for one ticket of each issue-type to populate the rest of the mapping."
    } > "$SCHEME_FILE"
  fi

  echo "$WF_FILE"
  exit 0
fi

# Admin path failed — non-admin fallback via per-state transitions
TR_JSON="$(bash "$WRAPPER" lifecycle transitions "$ISSUE_KEY" --output json 2>/dev/null)"
RC=$?

if [ $RC -ne 0 ] || [ -z "$TR_JSON" ]; then
  echo "[fetch-workflow] both admin path and lifecycle transitions failed for $ISSUE_KEY" >&2
  exit $RC
fi

# Extract current status (best-effort)
CUR_STATUS="$(bash "$WRAPPER" issue get "$ISSUE_KEY" --output json 2>/dev/null \
  | jq -r '.fields.status.name // "Unknown"')"
PROJECT_KEY="$(bash "$WRAPPER" issue get "$ISSUE_KEY" --output json 2>/dev/null \
  | jq -r '.fields.project.key // empty')"

# Cache as a per-project partial discovery
PARTIAL_FILE="$CACHE_DIR/_partial-$PROJECT_KEY.md"
{
  if [ ! -f "$PARTIAL_FILE" ]; then
    echo "# Partial workflow discovery: $PROJECT_KEY"
    echo
    echo "<!-- accumulated from non-admin discovery — INCOMPLETE; only outgoing transitions from observed states -->"
    echo
    echo "- **Mode**: non-admin (per-ticket \`lifecycle transitions\`)"
    echo "- **First seen**: $NOW"
    echo
    echo "## Observed transitions"
    echo
    echo "| From state | To state | Transition name | First-seen ticket |"
    echo "|---|---|---|---|"
  fi
  # Append observed transitions
  echo "$TR_JSON" | jq -r --arg from "$CUR_STATUS" --arg key "$ISSUE_KEY" \
    '.[]? | "| \($from) | \(.to.name // "?") | \(.name // "?") | \($key) |"'
} >> "$PARTIAL_FILE"

echo "$PARTIAL_FILE"
echo "[fetch-workflow] non-admin partial discovery — full graph requires admin role" >&2
exit 0
