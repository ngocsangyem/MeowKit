# Phase 6 — Grok, Pi and OMP emitters

**Priority:** medium · **Status:** done 2026-11-19 at project scope, with the differences listed per runtime below · **Effort:** 6d · **Depends on:** 4, 5

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

- [x] Grok (project scope; see "Grok, done")
- [x] Pi (see "Pi and OMP, done")
- [x] OMP
- [x] `--target all` covers six in a project; at global scope it covers Claude Code, Codex and Cursor

## Success criteria

- `mewkit init --target all` in a scratch project: `mewkit validate --target <runtime>` passes for six, and the resolver invariant holds on the installed tree.
- `grok inspect --json` (and the listing commands of Pi and OMP) show each skill name once.

## Risks

- Pi extension API or OMP hook module API moves between versions → the emitter records the version it was written against and doctor warns below it.
- OMP deep-merges foreign settings → doctor lists which foreign settings files are present.

## Grok, done (2026-11-19)

Sources: https://docs.x.ai/build/features/hooks.md, `/subagents.md` and `/skills-plugins-marketplaces` read 2026-11-19; rows X10 and X11 in `docs/maintainer/host-probe-log.md`. Grok is not installed here, so nothing was probed.

| Requirement | Built | Differs from the table above |
|---|---|---|
| Skills in `.grok/skills` | 127 skills projected with `/mk-<name>` invocations; packs as for Codex | — |
| Agents in `.grok/agents` | none | The vendor page names the folder and no file format or field. Writing a guessed format is not evidence-based, so the 41 projected prompts go to `.grok/meowkit/agents/` (a folder Grok does not load) with `name` and `description` only, where the 10 skill passages that name an agent file still resolve. Checklist C3 |
| `AGENTS.md`; `.grok/rules` only for other text | the shared block; nothing in `.grok/rules` | — |
| `.grok/hooks/<kit>.json`, camelCase payload, explicit timeouts | `.grok/hooks/meowkit.json`: privacy guard on every tool (10 s), ship check on `Bash` (300 s); scripts in `.grok/meowkit/hooks/` | Scripts are outside `.grok/hooks/` because Grok reads every `*.json` there as a hook file. The completion check is not registered: Grok ignores the output of every event but `PreToolUse` |
| MCP entry in `.grok/config.toml` | nothing written | The kit ships no MCP server outside Cursor's opt-in profiles |
| Trust note | `init` notice and a `grok trust` doctor row naming `/hooks-trust` and `--trust` | — |
| Capability column, model pins | none | The pages name permission filter names (`Bash`, `Edit`, `Read`, `Grep`, `WebFetch`, `WebSearch`) and no tool reference, and no model per tier. `kit-capabilities.json` is read by no emitter, so no column was invented |

- Project scope only: `--global --target grok` is refused, and `--target all` at global scope leaves Grok out.
- `mewkit validate --target grok` checks the hook file's documented form, the runtime config beside the scripts and each skill's `SKILL.md`.
- Always-on bytes for Grok: 7,687 (the shared block), the ceiling in `check-instruction-criteria.cjs`. A9, A10 and A13 are clean on the installed tree; the 13 A12 entries are the ones Codex and Cursor carry.
- Open, for the maintainer's Grok session: the field names inside `toolInput` (a shell command under a field name other than `command`, `cmd`, `script` or `commandLine` passes both guards unjudged), whether Grok runs a hook `command` through a shell that expands `$GROK_WORKSPACE_ROOT` (the page calls a hook "a shell command"; if it does not, both guards fail to start and Grok lets every call through), whether Grok also loads `.claude/skills` and `.cursor/skills` (checklist C3, C5). `init` prints one notice per foreign folder the surface table says Grok reads or may read.

## Pi and OMP, done (2026-11-19)

Decided by the maintainer on 2026-11-19: the files that shared skill text names by path live in one neutral folder, and Codex's installed files are written again when a second runtime that installs the tree arrives.

Sources: rows X12 to X14 in `docs/maintainer/host-probe-log.md`. Pi is not installed here; OMP 18.13.3 is, and its skill listing was read in a six-runtime project (X14).

**The shared tree** (`crates/mewkit-adapters/src/agents_tree.rs`, `kit/overlays/agents/`): Codex, Pi and OMP each install `.agents/skills` and `.agents/meowkit/` (helper scripts, rubrics, agent prompts as plain files, the guard script). Alone, a runtime writes its own wording: Codex as before, with its helpers in `.codex/`; Pi and OMP with `/skill:mk-<name>`. With two or more of the three in the project the tree is written in one wording for all (skills named in prose, "this runtime", paths under `.agents/meowkit/`), byte for byte the same from each emitter, so each install owns the files and a file leaves with the last of them. Cursor reading `.agents/skills` beside its own `.cursor/skills` does not change the wording.

| Requirement | Pi | OMP | Differs from the table above |
|---|---|---|---|
| Skills | `.agents/skills`; nothing in `.pi/skills` | `.agents/skills`; `.omp/config.yml` with `disabledProviders: [claude]` when Claude Code is installed here | The switch turns off everything OMP imports from `.claude/`, not skills alone; `init` says so. A `.omp/config.yml` the user already has is left alone and the notice asks for the line |
| Agents | none; `init` says a skill that hands work to an agent runs it in the main session | 41 files in `.omp/agents/` with `name`, `description`, built-in tool names | No `model`: OMP treats it as optional and no tier mapping is documented. `WebFetch`, `SendMessage` and the `Task*` list tools have no OMP built-in and are left out and named in the install summary |
| Rules / context | the shared `AGENTS.md` block | the same; nothing in `.omp/rules` | — |
| Hooks | `.pi/extensions/meowkit.ts` | `.omp/hooks/pre/meowkit.ts` | Both run `.agents/meowkit/hooks/guard.cjs` (the privacy decision on every call, the ship check on a shell command) through `pi.exec` and block on anything but an allow. The completion check is not ported |
| MCP | nothing written | nothing written | The kit ships no MCP server outside Cursor's opt-in profiles |
| Trust | `init` notice and a `pi trust` doctor row | stated in the install output: no trust step | — |

- Set changes that were due in the next phase and could not wait (`depends_on` in `crates/mewkit-cli/src/commands/mod.rs`): a runtime whose files depend on another being here is planned again when that other one joins, leaves or is upgraded. That covers the three that share the tree, and OMP's `.omp/config.yml` beside Claude Code. `init` plans the installed one first; `uninstall` plans the ones that stay for the set that remains and keeps a file a staying install also owns; `upgrade --target codex` upgrades Pi and OMP with it. `init codex` → `init omp` → `uninstall omp` leaves the tree of a fresh `init codex`, and `.omp/config.yml` comes and goes with Claude Code (`lifecycle.rs`). Without the kit a staying install was made from, its files stay as they are and a notice names `mewkit upgrade`.
- The guard modules pass the call to `guard.cjs` in a temp file (a large `write` is longer than one argument may be), find the script from their own location (a session started in a subdirectory still reaches it), and judge each part of a `path:selector` read (`.env:raw` on OMP) as a path. Both were run under Bun with a stand-in host API; neither has run inside Pi or OMP.
- `mewkit validate --target pi|omp`, doctor rows, lifecycle-matrix cells and `installed:pi`, `installed:omp` in the instruction criteria.

## Open after this phase

- Not probed: every Pi behaviour (not installed), and for OMP a real blocked call and a spawned agent (checklist C8, C9). The Grok items stay as listed above.
- `kit-capabilities.json` has no `grok`, `pi` or `omp` column: no emitter reads the file, and Grok's tool names are not documented. OMP's mapping lives in `crates/mewkit-adapters/src/omp/agents.rs`, from `builtin-names.ts`.
- The shared wording replaces "Claude Code" with "this runtime" and the bare word `claude` with `agent`. It reads correctly where the text means the host and awkwardly in a few rubric sentences; a pass over the installed shared tree by a person is still due.
- User-global installs for Grok, Pi and OMP are out of scope, as planned.
