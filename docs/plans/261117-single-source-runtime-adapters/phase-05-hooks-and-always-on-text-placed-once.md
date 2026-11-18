# Phase 5 — Hooks and always-on text placed once

**Priority:** high · **Status:** in progress · **Effort:** 4d · **Depends on:** 2, 4

## Overview

Hooks and always-on instructions are the two kinds where duplication changes behaviour: a guard that runs twice, a rule block read three times. Place each once per runtime set and make hook scripts accept every payload form.

## Requirements

- **Hook home by set (changed 2026-11-18, maintainer):** every runtime keeps its own hook file in every set, and the ship check's run-once marker stays. A runtime never takes its guards only from an import its user can switch off. The earlier wording ("Claude Code present → its hooks live only in `.claude/settings.json`") is withdrawn. Codex always its own `.codex/hooks.json`. Pi and OMP → one extension each (Phase 6).
- **Payload:** `hooks/lib/core` reads `tool_input` and `toolInput`, and the event-name forms of each runtime, behind one normaliser with replay cases per runtime.
- **Always-on text:** one authored block. Root `AGENTS.md` carries it for Codex, Cursor, Grok, Pi, OMP; `CLAUDE.md` imports it (`@AGENTS.md`) and adds Claude Code-only lines; `.cursor/rules`, `.grok/rules`, `.omp/rules` receive only text that is not in `AGENTS.md`. The placement decides whether `.claude/rules` is written when Grok is in the set.
- `AGENTS.md` stays under 32,768 B, measured in CI on the projected file.
- Hook files stay `.cjs` and outside any `pre/` or `post/` directory, which OMP executes.
- Every install prints the trust step each runtime needs.

## Related files

- Modify: `.claude/hooks/lib/` core (payload normaliser), `.claude/hooks/hook-coverage.json` (columns for all six), `docs/maintainer/hook-output-channels.md`, `docs/core/enforcement-matrix.md`
- Modify: emitters' hook and context planning; `scripts/check-always-on-budget.cjs` (AGENTS.md cap)
- Keep: `.claude/hooks/lib/ship-run-once.cjs` as a backstop; its test stays
- Create: replay cases under `tests/guards/` for camelCase payloads and for each overlapping pair

## Steps

1. Payload normaliser with replay cases; no decision logic changes.
2. Hook placement from the resolver in the Claude Code, Codex and Cursor emitters; guard replay for Claude Code + Cursor asserting one run without the marker.
3. Always-on block: author once, project to `AGENTS.md` and the `CLAUDE.md` import; move runtime-only text to overlays.
4. Trust notes in `init` output and `doctor` rows.

## Todo

- [x] Normaliser and replay cases
- [x] Hook home by set for three runtimes (own file always; resolver rule and test)
- [ ] One always-on block, AGENTS.md cap checked
- [ ] Trust notes

## Success criteria

- Guard replay: each overlapping pair runs each guard decision once.
- Always-on bytes per runtime are at or below today's.

## Risks

- `CLAUDE.md` in a user project is user-owned → MeowKit merges its marked block only, as it does for `AGENTS.md` today.
- Grok's Claude Code hook import is fail-open with a 5 s default → privacy and ship checks get a native Grok entry with an explicit timeout when Grok is in the set, and the Claude Code copy is switched off for Grok where a documented switch exists.

## Security

- `privacy-block` decisions are unchanged; only where the hook is registered changes. A runtime with no blocking channel for a guard is listed as not covered in the enforcement matrix.

## Progress (2026-11-18)

- `.claude/hooks/lib/core/hook-payload.cjs` folds the camelCase keys Grok documents (`toolInput`, `toolName`, `sessionId`, `hookEventName`, `workspaceRoot`) onto the snake_case ones every hook here reads; `parse-stdin.cjs` applies it for guards and observers. Before it, the privacy guard read a camelCase payload as an empty one and allowed the call. Two replay cases cover the privacy guard and the ship check with camelCase keys.
- Not covered, because nothing documents it: the keys inside Grok's `toolInput` (assumed `filePath` or `file_path`; checklist C5) and the tool names its matchers use.
- Only the Claude Code tree needed it: Codex and Cursor shells have their own readers and receive their own runtime's payload.

## Two decisions before the next steps (asked 2026-11-18)

### Hook home when Cursor shares a project with Claude Code

What Cursor runs there today: every hook in `.claude/settings.json` (import on by default, a user setting; an imported hook that crashes lets the call through) and every entry of `.cursor/hooks.json`.

| Cursor entry | Same decision from `.claude/settings.json`? | Proposed |
|---|---|---|
| `privacy-read-gate` (beforeReadFile), `shell-gate`, `tool-gate`, all fail-closed | Partly (`privacy-block` on Read and Bash), but imported hooks fail open | Keep native: a crashed gate must block (maintainer, 2026-11-11) |
| `mcp-gate` | No | Keep native |
| `pre-ship` (beforeShellExecution) | Yes: same core, already deduped by the run-once marker | **Open: see below** |
| `completion-check`, `stop-followup` (opt-in) | Documented mapping of `Stop`, not probed | Keep native; duplicate turn prompt possible when opted in |
| `session-context`, `telemetry-observers`, `subagent-lifecycle` | Different output | Keep native |

The requirement above says the ship check lives only in `.claude/settings.json` when Claude Code is present. That removes a duplicate the marker already neutralises, and adds a failure: with Cursor's import switched off, Cursor has no ship check at all, silently. Options: (a) as written, drop Cursor's `pre-ship` entry beside Claude Code; (b) keep both and the marker, and make the resolver never rely on an import a user can switch off for hooks, which turns the pair into a listed double load.

### The one always-on block

Claude Code loads `.claude/rules/*.md` (18,191 B). Codex and Cursor load a condensed text written by hand for the bundles (7,676 B and 6,289 B, now in the overlays). "One authored block" needs one of them to become the source: (a) keep `.claude/rules` for Claude Code and treat the condensed text as the block for every other runtime, authored once and shared by Codex, Cursor, Grok, Pi and OMP; (b) make the condensed text the block everywhere and have `CLAUDE.md` import it, which shrinks what Claude Code loads and moves the pinned blocked-pattern table and injection rules; (c) project `.claude/rules` in full to `AGENTS.md`, which more than doubles the other runtimes' always-on bytes and breaks "always-on bytes ≤ today's".

### Decided 2026-11-18

Hook home: option (b). The resolver refuses a hook source that a user-level switch can turn off (`placement_resolver.rs`, test `no_runtime_takes_its_guards_from_an_import_the_user_can_switch_off`), so Cursor beside Claude Code, Grok beside Claude Code and Grok beside Cursor each keep their own file and are listed as double loads on `docs/maintainer/runtime-surface-table.md`. The three emitters already write their own hook file in every set, so no emitter changed. The always-on choice is still open.
