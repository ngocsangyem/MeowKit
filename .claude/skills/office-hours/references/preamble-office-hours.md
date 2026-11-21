<!-- Per-skill additions to the shared preamble; SKILL.md loads both. -->

## SETUP (run this check BEFORE any browser command)

```bash
if command -v agent-browser >/dev/null 2>&1; then
  echo "READY: $(command -v agent-browser)"
elif command -v npx >/dev/null 2>&1 && npx --no-install agent-browser --version >/dev/null 2>&1; then
  echo "READY: npx agent-browser"
else
  echo "NEEDS_SETUP"
fi
```

If `NEEDS_SETUP`:
1. Tell the user: "The agent-browser CLI is not installed. OK to install it now?" Then STOP and wait.
2. Run: `npm i -g agent-browser` (or `brew install agent-browser`, or `cargo install agent-browser`).
3. After install, run `agent-browser install` once to download Chrome.
