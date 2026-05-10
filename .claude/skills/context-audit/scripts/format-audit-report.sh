#!/usr/bin/env bash
# format-audit-report.sh — Reads enriched JSON from stdin, emits markdown report.
#
# Sections: Header → Summary table → Top consumers → Recommendations → Footer.
#
# Reqs: Bash 3.2+, python3 (for JSON walk + sort). No jq.

set -u

input="$(cat)"
if ! printf '%s' "$input" | python3 -m json.tool >/dev/null 2>&1; then
  echo "format-audit-report.sh: stdin is not valid JSON" >&2
  exit 2
fi

printf '%s' "$input" | python3 -c '
import json, sys

d = json.loads(sys.stdin.read())
t = d.get("totals", {})

scan_root  = d.get("scan_root", "?")
ts         = d.get("scan_timestamp", "?")
window     = t.get("window_size_tokens", 200000)
overhead_t = t.get("structural_overhead_tokens", 0)
overhead_p = t.get("structural_overhead_pct", 0)

# Banner thresholds — canonical source-of-truth, see references/token-cost-model.md.
if overhead_p < 10:
    banner = "Healthy"
elif overhead_p < 25:
    banner = "Watch"
else:
    banner = "Action recommended"

# Essential basenames — hard-coded from CLAUDE.md "Compaction Policy".
ESSENTIAL_BASENAMES = {
    "security-rules.md",
    "injection-rules.md",
    "gate-rules.md",
    "core-behaviors.md",
    "development-rules.md",
}

def basename(path_or_name):
    return path_or_name.rsplit("/", 1)[-1]

# Build flat list of (category, label, path_or_name, tokens) for ranking.
flat = []
for entry in d.get("claude_md_chain", []):
    flat.append(("claude_md", entry["path"], entry["path"], entry["estimated_tokens"]))
for entry in d.get("agents", []):
    flat.append(("agent", entry["name"], entry["name"], entry["estimated_tokens"]))
for entry in d.get("skills", []):
    flat.append(("skill", entry["name"], entry["name"], entry["estimated_tokens"]))
for entry in d.get("rules", []):
    flat.append(("rule", entry["path"], entry["path"], entry["estimated_tokens"]))
for entry in d.get("commands", []):
    flat.append(("command", entry["path"], entry["path"], entry["estimated_tokens"]))
for entry in d.get("mcp_servers", []):
    flat.append(("mcp", entry["name"], entry["name"], entry["estimated_tokens"]))

flat.sort(key=lambda r: r[3], reverse=True)

print(f"# Context Audit — `{scan_root}`")
print(f"*Scanned at {ts} · model window {window:,} tokens · banner: **{banner}**.*")
print()

# Summary table
print("## Summary")
print()
print("| Category | Components | Tokens | % of Window |")
print("| --- | ---: | ---: | ---: |")
def row(label, items, tokens):
    pct = (tokens / window) * 100 if window else 0
    print(f"| {label} | {len(items)} | {tokens:,} | {pct:.2f}% |")

row("CLAUDE.md chain", d.get("claude_md_chain", []), t.get("claude_md_tokens", 0))
row("Agents",          d.get("agents", []),          t.get("agents_tokens", 0))
row("Skills",          d.get("skills", []),          t.get("skills_tokens", 0))
row("Rules",           d.get("rules", []),           t.get("rules_tokens", 0))
row("Commands",        d.get("commands", []),        t.get("commands_tokens", 0))
row("MCP servers",     d.get("mcp_servers", []),     t.get("mcp_tokens", 0))
print(f"| **Total** | — | **{overhead_t:,}** | **{overhead_p:.2f}%** |")
print()

# Top consumers
print("## Top Consumers")
print()
top = flat[:10]
if not top:
    print("_(none)_")
else:
    for i, (cat, label, _path, toks) in enumerate(top, 1):
        print(f"{i}. `{label}` (~{toks:,} tokens, {cat})")
print()

# Recommendations — frame as "consider", never as imperatives.
# Skip essentials (basename match against ESSENTIAL_BASENAMES).
print("## Recommendations")
print()
recs = []
for cat, label, path_or_name, toks in flat:
    if basename(path_or_name) in ESSENTIAL_BASENAMES:
        continue
    if toks < 200:  # noise floor — anything under ~800 bytes is rounding error
        continue
    if cat == "skill":
        recs.append((toks, f"Skill `{label}` (~{toks:,} tokens) is loaded statically. "
                          f"If not in active rotation, consider lazy-loading via `mk:lazy-agent-loader`."))
    elif cat == "agent":
        recs.append((toks, f"Agent `{label}` (~{toks:,} tokens) — confirm it is still load-bearing; "
                          f"unused agents can be archived or moved behind `mk:lazy-agent-loader`."))
    elif cat == "rule":
        recs.append((toks, f"Rule file `{label}` (~{toks:,} tokens) — review whether it is still "
                          f"load-bearing or can be merged into a peer rule."))
    elif cat == "command":
        recs.append((toks, f"Command `{label}` (~{toks:,} tokens) — confirm it is still surfaced; "
                          f"deprecated commands can be removed."))
    elif cat == "mcp":
        recs.append((toks, f"MCP server `{label}` (~{toks:,} tokens of schema) — disable if not in use."))
    elif cat == "claude_md":
        recs.append((toks, f"`{label}` (~{toks:,} tokens) is loaded into every session. "
                          f"Trims here have the highest leverage."))

recs.sort(key=lambda r: r[0], reverse=True)

if not recs:
    print("_(no actionable recommendations — all components either essential or below noise floor)_")
else:
    # Cap to top 8; preserves brevity.
    for i, (_toks, line) in enumerate(recs[:8], 1):
        print(f"{i}. {line}")
print()

# Footer — boundary disambiguation.
print("## How to Act")
print()
print("- **Cost (USD):** see `/mk:budget`.")
print("- **Transcript size:** see `.claude/hooks/conversation-summary-cache.sh`.")
print("- **Runtime trim:** see `mk:lazy-agent-loader`.")
print()
print("All recommendations above are framed as *consider* — the audit reports state,")
print("it does not auto-edit. Decide based on active workflows, not file size alone.")
'
