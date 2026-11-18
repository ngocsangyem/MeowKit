# Phase 5 — Hooks and always-on text placed once

**Priority:** high · **Status:** not started · **Effort:** 4d · **Depends on:** 2, 4

## Overview

Hooks and always-on instructions are the two kinds where duplication changes behaviour: a guard that runs twice, a rule block read three times. Place each once per runtime set and make hook scripts accept every payload form.

## Requirements

- **Hook home by set:** Claude Code present → its hooks live only in `.claude/settings.json`, and Cursor and Grok get entries only for decisions that file cannot give them. No Claude Code, Cursor present → `.cursor/hooks.json`. Grok alone → `.grok/hooks/`. Codex always its own `.codex/hooks.json`. Pi and OMP → one extension each (Phase 6).
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

- [ ] Normaliser and replay cases
- [ ] Hook home by set for three runtimes
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
