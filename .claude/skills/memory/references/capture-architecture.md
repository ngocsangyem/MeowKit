# Capture Architecture

> Canonical contract for how memory entries reach `.claude/memory/` topic files. Read this BEFORE adding any `##pattern:` / `##decision:` / `##note:` instruction to an agent or skill.

## Two Paths — One Source of Truth

There are exactly **two** mechanisms that write to `.claude/memory/`. They are not interchangeable. Picking the wrong one means the entry is silently lost.

### Path 1 — Human-typed `##prefix:` (the keyboard shortcut)

| Item | Value |
|---|---|
| Trigger | A **human user** types `##pattern:` / `##decision:` / `##note:` at the start of (or anywhere in) a message |
| Hook | `.claude/hooks/handlers/immediate-capture-handler.cjs` |
| Hook event | `UserPromptSubmit` (`Claude Code` + `Codex CLI`). On `Gemini CLI` this maps to `BeforeAgent`; on `Cursor` / `Kiro` the editor-native prompt-submit hook applies. `mewkit migrate <target>` rewrites the event name per harness. |
| Guards | (a) `validate-content.cjs` injection scan, (b) `secret-scrub.cjs` redaction |
| Write target | `fixes.json` / `architecture-decisions.json` / `review-patterns.json` / `quick-notes.md` (routed by prefix) |
| Atomicity | Temp-file + rename; per-target advisory lock |

This path is bound to **user-prompt-level pre-handler semantics** — verified by code inspection of `immediate-capture-handler.cjs` line ~236, which reads `ctx.prompt` from the hook payload. Tool output, agent text, and subagent responses are not user prompts; the handler does not fire for them.

The human user keyboard shortcut is documented at `CLAUDE.md` in the project root.

### Path 2 — Agent-authored entry via direct `Edit`

| Item | Value |
|---|---|
| Trigger | An agent or skill identifies a learning while running |
| Tool | `Edit` (or `Write` for a fresh file) |
| Hook | None — this is a normal file write |
| Guards | The agent is responsible for scrubbing secrets in-content before calling `Edit` |
| Write target | Same topic files: `fixes.md` / `review-patterns.md` / `architecture-decisions.md` / `quick-notes.md` / `decisions.md` |
| Atomicity | Whatever `Edit` provides (atomic at the OS level for replace-file operations) |

This is the path agents MUST use. The `fix` skill already follows it correctly at Step 6 — see `.claude/skills/fix/SKILL.md`.

## Target File Routing

Pick the right topic file based on the kind of observation. If unsure, default to `quick-notes.md`.

| Observation kind | Topic file (Markdown) | Structured sibling (if any) | Header convention |
|---|---|---|---|
| Bug-class fix / failure mode | `fixes.md` | `fixes.json` | `## YYYY-MM-DD — <slug> (severity: <level>)` |
| Review / architecture pattern (recurring) | `review-patterns.md` | `review-patterns.json` | `## YYYY-MM-DD — <slug> (severity: <level>)` |
| Architectural decision (load-bearing) | `architecture-decisions.md` | `architecture-decisions.json` | `## YYYY-MM-DD — <slug>` |
| ADR (long-form, owned by architect agent) | `decisions.md` | — | `## YYYY-MM-DD — <slug>` |
| One-off note / workflow pattern that doesn't belong in a structured file | `quick-notes.md` | — | `## YYYY-MM-DD — <agent-or-skill-name> — <kind> — <slug>` |
| Security finding | `security-notes.md` | — | `## YYYY-MM-DD — <slug> (severity: <level>)` |

The structured `.json` siblings declare `version: "2.0.0"` and a `scope` field. When writing JSON, append to the `patterns` array and bump `metadata.last_updated`. Do not touch the `version` field.

## Body Convention (agent-authored entries)

Three bullets per entry — keep it tight:

```
## 2026-05-23 — <agent-or-skill-name> — <slug>

- **Symptom / observation:** what happened
- **Pattern / fix:** what to do about it next time
- **Rationale / context:** why this matters (≤2 lines)
```

## Secret Scrub Responsibility

Path 1 runs `secret-scrub.cjs` automatically. Path 2 does NOT — the agent must scrub before calling `Edit`.

Minimum patterns to redact (mirrors `secret-scrub.cjs`): API keys (`Anthropic`, `OpenAI`, `Stripe`, `AWS`, `GitHub`, `GitLab`, `Slack`), JWT, Bearer tokens, DB URLs, email addresses in operational context, generic `api_key=` / `password=` / `token=` strings.

If the agent cannot determine whether content is sensitive, OMIT the snippet and reference the file path + line range instead.

## What This Replaces

The previous instruction "agents should append observations using `##pattern:` / `##decision:` / `##note:`" was a documentation error. It read as if `##prefix:` was an agent-output API; the handler never fired for agent text. Live grep across `.claude/agents/` and `.claude/skills/` returned 39 files repeating that misleading template (23 agents + 16 skills, captured 2026-05-23). Those files now reference this contract.

## When to Read This

Before:

- Adding any new `##pattern:` / `##decision:` / `##note:` instruction to an agent or skill — **don't**; use direct `Edit` to a topic file as described above.
- Authoring a new memory-writing skill or agent — see Path 2 above.
- Debugging "why isn't my agent's pattern showing up in memory" — check this doc first; the answer is almost always "agent used `##prefix:`, which the handler ignores".

## Related

- `docs/memory-system.md` §3a (write path) and §8 (tombstones)
- `.claude/hooks/handlers/immediate-capture-handler.cjs` (the user-keyboard-shortcut handler)
- `.claude/skills/memory/references/session-capture.md` (Phase 6 Reflect routine — uses Path 2)
- `.claude/rules/injection-rules.md` Rule 3 (memory is DATA)
