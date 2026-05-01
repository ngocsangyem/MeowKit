---
title: Middleware Layer
description: The shell hooks that intercept between model and tools — build verify, loop detection, pre-completion gate, conversation summary cache.
---

> **See also:** [Hooks Reference](/reference/hooks) — the full hooks table with events and matchers.

# Middleware Layer

Middleware hooks are thin shell scripts between the model and its tools. They intercept Claude Code events (file writes, session start/stop, prompt submissions) and inject feedback or context — without any agent or skill involvement.

## Why middleware exists

> Agents write code, re-read their own code, declare it good, stop.

This is the failure mode the middleware layer was built to interrupt. Without external feedback, an agent edits a file, reads it back, decides it looks correct, and stops — without running tests or verification.

## The five hooks

| Hook | Event | Purpose |
|------|-------|---------|
| `post-write-build-verify.sh` | PostToolUse (Edit\|Write) | Compile/lint on source writes; hash-cached to skip unchanged files. Never blocks — feedback only. |
| `post-write-loop-detection.sh` | PostToolUse (Edit\|Write) | Warns at 4 edits to same file, escalates at 8. Cleared per session. |
| `pre-completion-check.sh` | Stop | Blocks session end without verification evidence. 3-attempt guard. LEAN: soft nudge only. MINIMAL: skipped. |
| `project-context-loader.sh` | SessionStart | Injects directory tree, tool availability, package scripts. Resets per-session state. |
| `conversation-summary-cache.sh` | Stop + UserPromptSubmit | Haiku-summarizes transcript on Stop (≤4KB). Injects cached summary on next prompt. Secret-scrubbed. |

## Key properties

- **Cheap** — each hook runs in milliseconds. Only the summary cache uses an LLM call (~$0.01).
- **Composable** — hooks are independent. Adding or removing one doesn't affect others.
- **Pruneable** — measured via dead-weight audit. If a hook stops paying its delta, it can be removed.
- **Zero awareness** — agents have no awareness of middleware. They see feedback in context but don't know its source.

## Conversation summary cache

Long sessions accumulate transcript fast. Without the cache, re-reading full transcript consumes ~48KB per turn. With the cache, a Haiku-summarized snapshot injects ~4KB.

**Token math** (50-turn session):
- Without cache: ~2.4 MB
- With cache: ~200 KB
- Summarization cost: ~$0.01-0.02

## Opt-out matrix

| Env var | Effect |
|---------|--------|
| `MEOWKIT_BUILD_VERIFY=off` | Skip build verify |
| `MEOWKIT_LOOP_DETECT=off` | Skip loop detection |
| `MEOWKIT_PRECOMPLETION=off` | Skip pre-completion check |
| `MEOWKIT_SUMMARY_CACHE=off` | Skip conversation summary |
| `MEOWKIT_HARNESS_MODE=LEAN` | PreCompletion: soft nudge; BuildVerify: still runs |
| `MEOWKIT_HARNESS_MODE=MINIMAL` | Skip BuildVerify + PreCompletion |

## Next steps

- [Hooks reference](/reference/hooks) — full event + handler table
- [How it works](/core-concepts/how-it-works) — architecture overview
- [Configuration](/reference/configuration) — all env vars
