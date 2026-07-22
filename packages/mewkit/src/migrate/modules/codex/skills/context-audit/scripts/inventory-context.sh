#!/usr/bin/env bash
# inventory-context.sh — Read-only walk of .codex/; emits JSON byte/line counts.
#
# Usage: inventory-context.sh [SCAN_ROOT]   # default: $PWD
# Output: JSON to stdout. No file writes.
# Reqs: Bash 3.2+, awk, find, wc, sed, date. No external deps (no jq).

set -u

# --- SCAN_ROOT canonicalization ---
# Reject leading-dash to prevent flag injection (BSD/macOS realpath has no `--`).
RAW="${1:-$PWD}"
case "$RAW" in
  -*) echo "SCAN_ROOT cannot start with '-': $RAW" >&2; exit 1 ;;
esac
SCAN_ROOT="$(realpath "$RAW" 2>/dev/null)" || { echo "invalid SCAN_ROOT: $RAW" >&2; exit 1; }
[ -d "$SCAN_ROOT" ] || { echo "SCAN_ROOT not a directory: $SCAN_ROOT" >&2; exit 1; }

# Escape a single string value for safe JSON interpolation.
# Order matters: backslashes first, then double-quotes. Strip control chars
# (including embedded newlines, which are rare in path names) defensively.
json_escape() {
  printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

file_bytes() {
  if [ -f "$1" ]; then wc -c < "$1" | awk '{print $1+0}'; else printf "0"; fi
}

file_lines() {
  if [ -f "$1" ]; then wc -l < "$1" | awk '{print $1+0}'; else printf "0"; fi
}

# Frontmatter byte count: bytes from start through second '---' line.
frontmatter_bytes() {
  [ -f "$1" ] || { printf "0"; return; }
  awk '
    BEGIN { count = 0; total = 0 }
    /^---$/ { count++; total += length($0) + 1; if (count == 2) { print total; exit } }
    count == 1 { total += length($0) + 1 }
    END { if (count < 2) print 0 }
  ' "$1"
}

# 1. AGENTS.md chain — root + descendants, exclude vendored/build dirs.
inventory_codex_md_chain() {
  local first=1
  printf '['
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    local rel="${f#${SCAN_ROOT}/}"
    [ "$first" = "1" ] || printf ','
    first=0
    printf '{"path":"%s","bytes":%s,"lines":%s}' \
      "$(json_escape "$rel")" "$(file_bytes "$f")" "$(file_lines "$f")"
  done < <(find "$SCAN_ROOT" \
    \( -name node_modules -o -name .git -o -name .worktrees -o -name dist -o -name build \) -prune \
    -o -type f -name 'AGENTS.md' -print 2>/dev/null)
  printf ']'
}

# 2. agents (.codex/agents/*.md)
inventory_agents() {
  local dir="$SCAN_ROOT/.codex/agents"
  local first=1
  printf '['
  [ -d "$dir" ] && while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ "$first" = "1" ] || printf ','
    first=0
    printf '{"name":"%s","bytes":%s}' \
      "$(json_escape "$(basename "$f" .md)")" "$(file_bytes "$f")"
  done < <(find "$dir" -maxdepth 1 -type f -name '*.md' 2>/dev/null)
  printf ']'
}

# 3. skills (.agents/skills/*/SKILL.md)
inventory_skills() {
  local dir="$SCAN_ROOT/.agents/skills"
  local first=1
  printf '['
  [ -d "$dir" ] && while IFS= read -r d; do
    [ -z "$d" ] && continue
    local name="$(basename "$d")"
    case "$name" in .*) continue ;; esac
    local sk="$d/SKILL.md"
    [ -f "$sk" ] || continue
    [ "$first" = "1" ] || printf ','
    first=0
    printf '{"name":"%s","bytes":%s,"frontmatter_bytes":%s}' \
      "$(json_escape "$name")" "$(file_bytes "$sk")" "$(frontmatter_bytes "$sk")"
  done < <(find "$dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
  printf ']'
}

# 4. rules (.agents/skills/rule-**/*.md)
inventory_rules() {
  local dir="$SCAN_ROOT/.codex/rules"
  local first=1
  printf '['
  [ -d "$dir" ] && while IFS= read -r f; do
    [ -z "$f" ] && continue
    local rel="${f#${SCAN_ROOT}/}"
    [ "$first" = "1" ] || printf ','
    first=0
    printf '{"path":"%s","bytes":%s}' \
      "$(json_escape "$rel")" "$(file_bytes "$f")"
  done < <(find "$dir" -type f -name '*.md' 2>/dev/null)
  printf ']'
}

# 5. commands (.codex/commands/**/*.md)
inventory_commands() {
  local dir="$SCAN_ROOT/.codex/commands"
  local first=1
  printf '['
  [ -d "$dir" ] && while IFS= read -r f; do
    [ -z "$f" ] && continue
    local rel="${f#${SCAN_ROOT}/}"
    [ "$first" = "1" ] || printf ','
    first=0
    printf '{"path":"%s","bytes":%s}' \
      "$(json_escape "$rel")" "$(file_bytes "$f")"
  done < <(find "$dir" -type f -name '*.md' 2>/dev/null)
  printf ']'
}

# 6. MCP servers — count top-level entries under "mcpServers" in .mcp.json.
# Heuristic: total file bytes split evenly across detected servers.
inventory_mcp() {
  local f="$SCAN_ROOT/.mcp.json"
  printf '['
  if [ -f "$f" ]; then
    local bytes; bytes=$(file_bytes "$f")
    local servers; servers=$(awk '
      BEGIN { in_section = 0; depth = 0 }
      /"mcpServers"[[:space:]]*:[[:space:]]*\{/ { in_section = 1; depth = 0; next }
      in_section {
        n = gsub(/\{/, "{"); depth += n
        if (depth == 1 && match($0, /"[^"]+"[[:space:]]*:[[:space:]]*\{/)) {
          s = substr($0, RSTART + 1)
          end = index(s, "\"")
          if (end > 0) print substr(s, 1, end - 1)
        }
        n = gsub(/\}/, "}"); depth -= n
        if (depth < 0) in_section = 0
      }
    ' "$f")
    if [ -n "$servers" ]; then
      local count; count=$(printf '%s\n' "$servers" | awk 'NF' | wc -l | awk '{print $1+0}')
      [ "$count" -eq 0 ] && count=1
      local per=$(( bytes / count ))
      local first=1
      while IFS= read -r srv; do
        [ -z "$srv" ] && continue
        [ "$first" = "1" ] || printf ','
        first=0
        printf '{"name":"%s","tool_count":0,"estimated_bytes":%s}' \
          "$(json_escape "$srv")" "$per"
      done <<< "$servers"
    fi
  fi
  printf ']'
}

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{'
printf '"scan_root":"%s",' "$(json_escape "$SCAN_ROOT")"
printf '"scan_timestamp":"%s",' "$ts"
printf '"codex_md_chain":'; inventory_codex_md_chain; printf ','
printf '"agents":';          inventory_agents;          printf ','
printf '"skills":';           inventory_skills;          printf ','
printf '"rules":';            inventory_rules;           printf ','
printf '"commands":';         inventory_commands;        printf ','
printf '"mcp_servers":';      inventory_mcp
printf '}\n'
