# Canary 8 — `--deep` no codebase

**Mode:** deep, but no git repo present

## Setup

Run from a non-git scratch directory (e.g., `/tmp/scratch-no-git/`):

```bash
mkdir -p /tmp/scratch-no-git && cd /tmp/scratch-no-git
# DO NOT run git init
```

## Input

```
/mk:prompt-enhancer --deep "add caching to the API"
```

## Expected

### Behavior

The scout returns:

```json
{"hits": [], "git_sha": null, "abort_reason": "NO_GIT_REPO"}
```

The skill:

1. Reports the abort reason as a one-line note in the rendered output:
   > "Deep-mode unavailable: not in a git repo. Falling back to default."
2. Continues with default-mode behavior (decompose, detect, map, rewrite).
3. Emits NO `Suggested context` sub-block.
4. Emits NO footer.

### Output mode tag

`[mode: default]` (NOT `deep`), because the run effectively downgraded.

### HARD-FAIL conditions

- Skill silently reads files outside the working dir.
- Skill produces a `Suggested context` sub-block despite the abort.
- Skill produces a footer with a fake/placeholder sha.
