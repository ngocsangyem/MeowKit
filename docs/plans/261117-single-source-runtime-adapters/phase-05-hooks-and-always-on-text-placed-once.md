# Phase 5 — Hooks and always-on text placed once

**Priority:** high · **Status:** in progress · **Effort:** 4d · **Depends on:** 2, 4

## Overview

Hooks and always-on instructions are the two kinds where duplication changes behaviour: a guard that runs twice, a rule block read three times. Place each once per runtime set and make hook scripts accept every payload form.

## Requirements

- **Hook home by set (changed 2026-11-18, maintainer):** every runtime keeps its own hook file in every set, and the ship check's run-once marker stays. A runtime never takes its guards only from an import its user can switch off. The earlier wording ("Claude Code present → its hooks live only in `.claude/settings.json`") is withdrawn. Codex always its own `.codex/hooks.json`. Pi and OMP → one extension each (Phase 6).
- **Payload:** `hooks/lib/core` reads `tool_input` and `toolInput`, and the event-name forms of each runtime, behind one normaliser with replay cases per runtime.
- **Always-on text (changed 2026-11-18, maintainer):** Claude Code keeps `.claude/rules`; one authored block, `kit/overlays/shared/AGENTS.md`, is the text for every other runtime. Root `AGENTS.md` carries it for Codex, Cursor, Grok, Pi, OMP; `.cursor/rules`, `.grok/rules`, `.omp/rules` receive only text that is not in `AGENTS.md`. The earlier wording (`CLAUDE.md` imports `@AGENTS.md`) is withdrawn. The placement decides whether `.claude/rules` is written when Grok is in the set.
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
- [x] One always-on block, AGENTS.md cap checked (Codex, Cursor; the other three with their emitters)
- [x] Trust notes (Claude Code, Codex, Cursor)

## Success criteria

- Guard replay: each overlapping pair runs each guard decision once.
- Always-on bytes per runtime are at or below today's. **Changed for Cursor installed alone:** 10,641 B against 6,316 B, accepted by the maintainer on 2026-11-19 (see "Always-on block, done" below).

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

## Always-on block, done 2026-11-18 (option a)

- Source: `kit/overlays/shared/AGENTS.md` (7,629 B), the former Codex text with the four passages that named Codex reworded. `ProjectedKit::open` adds it to every projected kit as `AGENTS.md` and refuses an overlay that ships its own.
- Codex and Cursor merge it as the `meowkit` block of the project's `AGENTS.md` (`agents_block.rs`). Both record the block; the second merge changes nothing. `uninstall` of one runtime leaves the block while another installed runtime records it (`keep_shared_blocks`), tested in `lifecycle.rs`.
- Cursor no longer installs `.cursor/rules/meowkit-core.mdc`; `runtime-invariants.mdc` (2,954 B) holds capability routing, discovery, the nesting contract, state ledgers and "rules are advisory". A test fails when an always-applied Cursor rule repeats a heading of the block.
- Every `AGENTS.md (<section>)` a projected skill can cite has a heading in the block (test in `projects_whole_kit.rs`). Before, nine such citations pointed at nothing on Cursor.
- `AGENTS.md` above 32,768 B is a finding of `check-instruction-criteria.cjs` on any installed tree, and the emitter refuses a block over that size.

| Always-on bytes | Before | After |
|---|---|---|
| Claude Code | 18,191 | 18,191 |
| Codex alone | 7,734 | 7,687 |
| Cursor alone | 6,316 | 10,641 |
| Cursor beside Codex (it reads both) | 14,050 | 10,641 |

This reverses the 2026-11-11 decision that Cursor writes nothing at `AGENTS.md`; the ADR carries a dated amendment.

Open:
- Cursor alone is 4,325 B above its old figure. Its old text left the blocked-pattern list, the core behaviors, the status protocol and the development rules out of always-on text; meeting 6,316 B would have needed the shared block cut to about 3.3 KB. Accepted by the maintainer on 2026-11-19; the ceiling is 10,641 B.
- A file that holds nothing but the block is recorded as created by whichever install merges into it, so the last runtime to leave removes it (`exec/decide.rs`, tested in `lifecycle.rs`).
- Beside Claude Code, Claude Code reads `AGENTS.md` only when the project has no `CLAUDE.md` (listed as unsettled on the surface page); nothing was changed for that.

## Trust notes, done 2026-11-18

| Runtime | `init` prints | `doctor` row | Source |
|---|---|---|---|
| Claude Code | asks to trust the folder on first interactive start | `claude-code trust`: states the step; the accepted state is not read | https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust |
| Codex | hooks and config are read only after the project is trusted (already there) | `codex trust`: reads `config.toml` (already there) | — |
| Cursor | project hooks run only in a trusted workspace | `cursor trust`: states the step; the state is not readable | https://cursor.com/docs/agent/hooks |

Per the Claude Code page, hooks in a settings file also run in `claude -p`, which shows no trust dialog.
