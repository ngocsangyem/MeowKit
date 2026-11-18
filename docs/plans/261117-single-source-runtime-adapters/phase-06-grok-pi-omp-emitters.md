# Phase 6 — Grok, Pi and OMP emitters

**Priority:** medium · **Status:** not started · **Effort:** 6d · **Depends on:** 4, 5

## Overview

Add three emitters on the projection and placement built so far. Each ships with its validate profile, doctor rows, capability column, model pins and smoke-checklist rows. Order: Grok, Pi, OMP.

## Requirements per runtime

| | Grok | Pi | OMP |
|---|---|---|---|
| Skills | `.grok/skills` unless Phase 1 shows a shared root is read once | `.agents/skills` (shared dialect); none under `.pi/skills` | `.agents/skills`; Claude provider switched off for skills when `.claude/skills` is present |
| Agents | `.grok/agents`, fields per Phase 1 | none (no native subagents); delegate wording maps to `unsupported` | `.omp/agents` with `name`, `description`, lowercase built-in tool names, model alias |
| Rules / context | `AGENTS.md`; `.grok/rules` only for text not in it | `AGENTS.md` | `AGENTS.md`; `.omp/rules` only for text not in it |
| Hooks | `.grok/hooks/<kit>.json`, camelCase payload, explicit timeouts | one extension in `.pi/extensions` calling the shared core | one native hook module calling the shared core |
| MCP | `.grok/config.toml` entry only when no file Grok already reads defines the server | `.pi/mcp.json` | none written when another file it reads defines the same connection |
| Trust | `/hooks-trust` note | project trust note | none; state it in the install output |

- Tool wording: `kit-capabilities.json` gains `grok`, `pi`, `omp`, each value from that runtime's tool documentation or source (`builtin-names.ts` for OMP).
- An agent tool with no OMP equivalent is dropped from the list and reported in the install summary, never passed through.

## Related files

- Create: `crates/mewkit-adapters/src/grok/`, `pi/`, `omp/`; `crates/mewkit-core/src/validate/target_grok.rs`, `target_pi.rs`, `target_omp.rs`; `kit/overlays/{grok,pi,omp}/`
- Modify: `registry.rs`, `validate/targets.rs`, `.claude/kit-capabilities.json`, `scripts/lib/host-foreign-tokens.json` and `denied_tokens.rs`, `docs/maintainer/model-pins.md`, `docs/maintainer/runtime-smoke-checklist.md`, `crates/mewkit-cli/src/commands/init/choose.rs` (target list)

## Steps (per runtime)

1. Capability column and pins from the vendor pages, dated.
2. Emitter returning a `Plan`; `plan_strip` for uninstall.
3. Validate profile; goldens; lifecycle test in the all-runtimes matrix.
4. Hook entry (JSON, extension or module) with replay cases through the shared core.
5. Smoke-checklist rows for the maintainer.

## Todo

- [ ] Grok
- [ ] Pi
- [ ] OMP
- [ ] `--target all` covers six

## Success criteria

- `mewkit init --target all` in a scratch project: `mewkit validate --target <runtime>` passes for six, and the resolver invariant holds on the installed tree.
- `grok inspect --json` (and the listing commands of Pi and OMP) show each skill name once.

## Risks

- Pi extension API or OMP hook module API moves between versions → the emitter records the version it was written against and doctor warns below it.
- OMP deep-merges foreign settings → doctor lists which foreign settings files are present.
