# Phase 2 — Runtime surface table and placement resolver

**Priority:** high · **Status:** done 2026-11-18 · **Effort:** 3d · **Depends on:** 1

## Overview

Put "which runtime loads which path" in one data table, and compute from it, for any set of installed runtimes, where each kind of content is written so that every runtime sees it once.

## Key insights

- Placement is a function of the set, not of one runtime: with Claude Code present, Cursor and Grok already receive its hooks; without it, `.cursor/hooks.json` serves both.
- The current `EmitRequest.other_scope` already hints at cross-runtime awareness; the resolver replaces ad-hoc handling such as `ship-run-once`.

## Architecture

```
surface table (data, cited)          installed set + requested set
        └──────────────┬──────────────────────┘
                 placement resolver  (pure, no I/O)
                       │  Placement { kind → root, dialect, readers }
        ┌──────────────┼───────────────┐
   emitter A       emitter B       emitter C      → Plan → shared executor
```

- **Surface table:** per runtime and content kind (skills, agents, rules, context file, hooks, MCP): native roots, foreign roots read, precedence, dedupe rule, project-level switch, source URL or probe row, version, date.
- **Resolver output:** for each kind, the roots to write, the dialect (host or shared), which runtimes read each root, and switches to set (for example OMP `disabledProviders`).
- **Invariant checked in tests:** for every non-empty subset of the six runtimes and every kind, each runtime's readable roots contain each item exactly once, or the item is identical bytes where the table says identical copies collapse.

## Related files

- Create: `crates/mewkit-adapters/src/surface_table.rs`, `surface_table.json` (data), `placement_resolver.rs`, `placement_resolver_tests.rs`
- Modify: `crates/mewkit-adapters/src/contract.rs` (`Runtime` gains `Grok`, `Pi`, `Omp`; `EmitRequest` gains `placement`), `registry.rs`
- Create: `docs/maintainer/runtime-surface-table.md` (rendered from the data, with sources)

## Steps

1. Encode research §1 as data; every cell carries its source.
2. Write the resolver for skills first, then hooks, rules and context, MCP, agents.
3. Property test over all 63 subsets; table-driven cases for the pairs known to overlap (Claude Code + Cursor, Cursor + Grok, Codex + Pi + OMP).
4. Render the maintainer doc from the data and add a test that the doc is current.

## Todo

- [x] Data table with sources
- [x] Resolver per content kind
- [x] 63-subset invariant test
- [x] Rendered doc and its freshness test

## Success criteria

- `cargo test -p mewkit-adapters placement` passes with the invariant on all subsets.
- No emitter reads another runtime's presence directly; it reads the placement.

## Risks

- Unknown dedupe (Cursor, Grok) → the resolver treats "ND" as "no dedupe".

## Outcome (2026-11-18)

- Built as planned, with two differences from "Related files": the tests sit beside the resolver (`placement_resolver_tests.rs`) and the page is rendered by `surface_doc.rs`, checked by `tests/surface_table_doc.rs`. Rules and context files are one kind, `always-on`, because the item that must load once is the always-on block wherever it sits.
- The resolver is one rule for every kind: try each combination of writable roots, keep the one with the fewest certain double loads, then the fewest runtimes reading another runtime's wording, then the fewest possible double loads, then the fewest roots. No per-kind code.
- The invariant "exactly once" does not hold for every set. The test pins what is left: three certain double loads (Cursor skills with Claude Code and a `.agents/skills` reader; Grok always-on text with Claude Code and an `AGENTS.md` reader; Grok MCP with Claude Code and Cursor) and four reads the vendors leave open. None appears in a set of two. The acceptance criterion in plan.md is met in that form, not literally.
- D3 applied literally: Cursor beside Claude Code gets no skill copy of its own and reads `.claude/skills`, in Claude Code wording. Confirmed by the maintainer 2026-11-18, over the alternative of a second copy that lists every skill twice in Cursor. Its agents stay its own, because Cursor documents that `.cursor/agents` wins a name clash.
- `Runtime` has six values and three emitters; the CLI lists and accepts only runtimes with an emitter (`registry::emitted`).
- Vendor pages re-read for the table changed five cells of the research matrix; see research/runtime-discovery-matrix.md §6.

## Open for later phases

- Phase 4: emitters read `EmitRequest.placement`; today they ignore it.
- Phase 5: Grok beside Claude Code gets its hooks only through Grok's import of `.claude/settings.json`, which fails open with a 5 s default; the phase decides which decisions need a native Grok entry. The Claude Code `AGENTS.md` read depends on the project having a `CLAUDE.md`.
- Phase 7: a shared root has one owner (the first runtime in the set that may write it); removing that runtime hands the root over.
