#!/usr/bin/env bash
# estimate-tokens.sh — Reads inventory JSON from stdin, emits enriched JSON.
#
# Adds:
#   - per-entry "estimated_tokens" (chars/4, mirrors token-estimator.ts)
#   - "totals.{category}_tokens", "totals.structural_overhead_tokens"
#   - "totals.window_size_tokens" (hard-coded 200000)
#   - "totals.structural_overhead_pct"
#
# Heuristic source-of-truth: meowkit/packages/mewkit/src/orchviz/token-estimator.ts
# (CHARS_PER_TOKEN = 4). We inline the same heuristic to avoid a Node bridge that
# would require dist/ — not present on a fresh `mewkit init` install.
#
# Reqs: Bash 3.2+, python3 (used only for JSON parse/edit). No jq.

set -u

input="$(cat)"
if ! printf '%s' "$input" | python3 -m json.tool >/dev/null 2>&1; then
  echo "estimate-tokens.sh: stdin is not valid JSON" >&2
  exit 2
fi

WINDOW_SIZE_TOKENS="${MEOWKIT_CONTEXT_WINDOW:-200000}"

printf '%s' "$input" | python3 -c '
import json, sys, math

window = int(sys.argv[1])
data = json.loads(sys.stdin.read())

CHARS_PER_TOKEN = 4  # mirrors meowkit/packages/mewkit/src/orchviz/token-estimator.ts

def tokens_of(byte_count):
    if not byte_count:
        return 0
    return max(1, math.ceil(int(byte_count) / CHARS_PER_TOKEN))

def enrich(arr, byte_field="bytes"):
    total = 0
    for entry in arr:
        b = entry.get(byte_field) or entry.get("estimated_bytes") or 0
        t = tokens_of(b)
        entry["estimated_tokens"] = t
        total += t
    return total

claude_md_tokens = enrich(data.get("claude_md_chain", []))
agents_tokens    = enrich(data.get("agents", []))
skills_tokens    = enrich(data.get("skills", []))
rules_tokens     = enrich(data.get("rules", []))
commands_tokens  = enrich(data.get("commands", []))
mcp_tokens       = enrich(data.get("mcp_servers", []), byte_field="estimated_bytes")

structural = (
    claude_md_tokens + agents_tokens + skills_tokens
    + rules_tokens + commands_tokens + mcp_tokens
)
pct = (structural / window) * 100 if window > 0 else 0

data["totals"] = {
    "claude_md_tokens":           claude_md_tokens,
    "agents_tokens":              agents_tokens,
    "skills_tokens":              skills_tokens,
    "rules_tokens":               rules_tokens,
    "commands_tokens":            commands_tokens,
    "mcp_tokens":                 mcp_tokens,
    "structural_overhead_tokens": structural,
    "window_size_tokens":         window,
    "structural_overhead_pct":    round(pct, 2),
}

json.dump(data, sys.stdout, separators=(",", ":"))
sys.stdout.write("\n")
' "$WINDOW_SIZE_TOKENS"
