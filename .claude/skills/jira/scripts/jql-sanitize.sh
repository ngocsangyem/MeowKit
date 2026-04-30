#!/usr/bin/env bash
# jql-sanitize.sh — Deterministic JQL escaping for user-derived terms
# Usage: bash .claude/skills/jira/scripts/jql-sanitize.sh '<term>'
# Returns sanitized term safe for JQL queries.

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: jql-sanitize.sh '<term>'" >&2
  exit 1
fi

input="$1"

# Strip JQL reserved operators (case-insensitive via character classes for macOS compat)
# Operators: AND, OR, NOT, IN, IS, WAS, CHANGED, ORDER, BY, ASC, DESC, EMPTY, NULL
sanitized=$(echo "$input" | sed -E \
  -e 's/[[:space:]]([Aa][Nn][Dd]|[Oo][Rr]|[Nn][Oo][Tt]|[Ii][Nn]|[Ii][Ss]|[Ww][Aa][Ss]|[Cc][Hh][Aa][Nn][Gg][Ee][Dd]|[Oo][Rr][Dd][Ee][Rr]|[Bb][Yy]|[Aa][Ss][Cc]|[Dd][Ee][Ss][Cc]|[Ee][Mm][Pp][Tt][Yy]|[Nn][Uu][Ll][Ll])[[:space:]]/ /g' \
  -e 's/^([Aa][Nn][Dd]|[Oo][Rr]|[Nn][Oo][Tt]|[Ii][Nn]|[Ii][Ss]|[Ww][Aa][Ss])[[:space:]]/ /g' \
  -e 's/[[:space:]]([Aa][Nn][Dd]|[Oo][Rr]|[Nn][Oo][Tt]|[Ii][Nn]|[Ii][Ss]|[Ww][Aa][Ss])$/ /g')

# Strip known JQL functions only (not arbitrary word(...) patterns)
# This preserves legitimate text like "fix(login)" while stripping JQL functions
sanitized=$(echo "$sanitized" | sed -E \
  -e 's/(currentUser|openSprints|closedSprints|futureSprints|membersOf|now|startOfDay|endOfDay|startOfWeek|endOfWeek|startOfMonth|endOfMonth|startOfYear|endOfYear|linkedIssues|unreleasedVersions|releasedVersions|hasSubtasks|subtasksOf)\([^)]*\)//g')

# Strip special JQL characters that could alter query semantics
sanitized=$(echo "$sanitized" | sed -E \
  -e 's/[~!^*{}|\\]//g' \
  -e 's/[<>=]+//g' \
  -e 's/[[:space:]]+/ /g' \
  -e 's/^ +//;s/ +$//')

# Quote-wrap the result for safe JQL embedding
if [ -z "$sanitized" ]; then
  echo '""'
else
  # Escape internal double quotes
  escaped=$(echo "$sanitized" | sed 's/"/\\"/g')
  echo "\"$escaped\""
fi
