# Preamble (run first)

Run this block once at the start of the skill. It prints the facts later steps rely on and appends one line to the local skill-usage log that `mk:retro` reads.

```bash
_PROACTIVE=$(.claude/hooks/lib/workflow-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"
source <(.claude/hooks/lib/workflow-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
mkdir -p .meowkit/telemetry
echo '{"skill":"SKILL_NAME","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> .meowkit/telemetry/skill-usage.jsonl 2>/dev/null || true
```

Before running it, replace `SKILL_NAME` with the `name:` from the loading skill's frontmatter, without the `mk:` prefix.

How to use the output:

- `BRANCH` is the current branch. When you tell the user which branch you are on, use this value, not a branch named earlier in the conversation, because the conversation may be stale.
- `PROACTIVE: false` means the user opted out of skill suggestions: invoke other skills only when the user asks.
- `REPO_MODE` says who owns problems you notice outside the change: `solo` (offer to fix them), `collaborative` or `unknown` (mention them and let the user decide, since they may belong to someone else).

The usage log stays on this machine; nothing in this block sends data anywhere.
