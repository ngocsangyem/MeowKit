#!/usr/bin/env bash
# cql-sanitize.sh — Deterministic CQL escaping + shell-metachar defense for user input.
# Usage: bash .agents/skills/confluence/scripts/cql-sanitize.sh '<term>'
# Returns sanitized term safe for CQL queries.
#
# The confluence-as library does NOT export _escape_cql_string (it lives as a
# private function in the search command module). This sanitizer is the only
# safety gate.

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: cql-sanitize.sh '<term>'" >&2
  exit 1
fi

input="$1"

# Layer 1 — reject malicious CQL patterns
case "$input" in
  *\;[A-Za-z]*|*\;\ [A-Za-z]*)
    echo "ERROR: CQL contains statement separator ';'" >&2
    exit 1 ;;
  *--*)
    echo "ERROR: CQL contains comment marker '--'" >&2
    exit 1 ;;
esac

# Layer 2 — reject shell metacharacters (defense in depth; not valid in CQL)
# shellcheck disable=SC2016  # single quotes are intentional — match literal $( and backtick
case "$input" in
  *'$('*|*'`'*)
    echo "ERROR: CQL contains command-substitution metachar (\$( or backtick)" >&2
    exit 1 ;;
  *'>'*|*'<'*|*'|'*|*'&'*)
    echo "ERROR: CQL contains shell redirection / pipe / background metachar" >&2
    exit 1 ;;
esac

# Layer 3 — escape backslash + double-quote per Confluence CQL grammar
# https://developer.atlassian.com/cloud/confluence/cql-fields/
sanitized="${input//\\/\\\\}"
sanitized="${sanitized//\"/\\\"}"

if [ -z "$sanitized" ]; then
  echo "ERROR: empty CQL after sanitization" >&2
  exit 1
fi

echo "$sanitized"
