# 01 — Executive research summary

Research on MeowKit at `main` @ `c7ff0a9e`, 2026-11-15. Nothing in the repository was changed
outside this directory. No recommendation here has been implemented, and none should be
without review.

## The short version

1. **MeowKit's enforced core is small and real.** On Claude Code, three hooks block for real:
   the plan gate on file edits, the privacy block on reads, and the pre-ship check on
   `git commit|push|merge`, which runs the project's tests and lint. They stop accidental,
   unplanned and scope-drifting work. They are not boundaries against a deliberate or misled
   agent with a shell (VERIFIED — R1).
2. **Most of the rest is instruction.** Model-tier routing, adaptive density, simplify, verify,
   the subagent status protocol, memory retrieval and most of the injection rules are
   prose the model may or may not follow (VERIFIED — 02 §3).
3. **Nothing measures whether any of it helps.** The repo contains no run of a model on a task
   with and without MeowKit (VERIFIED — R1 claim 13). H1 and H5 are therefore unknown, and
   every proposal to remove something "unproven" is as untested as the thing it removes.
4. **Several documented behaviours do not work as documented.** The three Gate 1 exceptions
   have no implementation, the budget "block" blocks nothing, `--prune` does not exist, and
   density selection gives newer models more scaffolding than older ones (VERIFIED — R1).
5. **The defensible direction is not "smaller" or "bigger" but "true, then measured".** Make
   the claims match the mechanisms, fix the mechanical defects, delegate the real security
   boundary and telemetry to the host, and build the smallest evaluation capability that lets
   the structural questions be decided by data.

## Hypothesis verdicts

| # | Hypothesis | Verdict | Basis |
| --- | --- | --- | --- |
| H1 | MeowKit improves coding-agent reliability | **UNKNOWN** | no outcome data anywhere in the repo |
| H2 | More scaffolding is not always better | **Holds for prescriptive always-on text; not shown for operational scaffolding** | one controlled study (2025 models), one vendor's guidance without ablation, one harness's own A/B; no study varies one scaffold across weak and strong models at fixed budget |
| H3 | Adaptive workflows beat rigid ones | **HYPOTHESIS** | no head-to-head found |
| H4 | Multi-agent improves complex engineering tasks | **HYPOTHESIS for current models** | one software source on a 20-task subset with 2025 models; one cost-confounded counter-study |
| H5 | Existing memory improves outcomes | **UNKNOWN, untestable today** | the team store has never held content here; reads are uninstrumented |
| H6 | CLI and adapters give portability without false parity | **Partly supported** | distribution is portable, behaviour is not; three specific overclaims and one underclaim, no blanket parity claim |
| H7 | Security controls give meaningful, enforced protection | **Partially supported, narrowly** | three real fail-closed blocks against accidents; no boundary against an agent with shell access; no sandbox or deny rules ship |
| H8 | MeowKit contains removable complexity | **Supported for specific mechanical items** | unwired scripts, an agent nothing spawns, a deprecated skill still referenced, dead path references; "128 skills is bloat" is not supported, and the nine legacy preamble copies turned out not to be byte-duplicates |

## What is solid (keep)

- Write guards fail closed on library faults and bad input (VERIFIED — R1 claim 1).
- The approval receipt detects a plan edited after approval and a wrong-revision ship.
- Pre-ship runs the real test, lint and type-check commands; a failing test blocked.
- The Rust installer verifies URL prefix and checksum, extracts defensively, merges existing
  settings correctly, and uninstalls by ownership (VERIFIED — 06).
- The always-on rule budget has a CI ceiling and currently passes with 180 bytes to spare.
- Parallel-write rules (no file overlap, worktree isolation, test after merge) match the one
  conflict study found.
- The repo is already candid in places: the receipt header, `gate-rules.md` and the README's
  Codex section state their own limits.

## Major risks (kit properties, ranked)

| # | Risk | Evidence | Where |
| --- | --- | --- | --- |
| 1 | Security wording exceeds mechanism: prose rules described as impossible to bypass; "4-layer+ security" | DOCUMENTED host position + VERIFIED source | 08 §7 |
| 2 | The plan gate is skipped by Bash writes and by writes under `.claude/`, which holds the gate itself; the approval stamp runs under a pre-approved permission; no deny rules | VERIFIED — R1 2, 3; L-12, L-13 | 08 §3 |
| 3 | Documented fast paths cannot work, so a blocked agent's easiest route is the unguarded tool. Two research agents did exactly that for scratch files | VERIFIED — R1 5; L-11 | 05, 08 |
| 4 | The ship gate is a literal string match and its 30-second hook can time out open | VERIFIED match; INFERRED timeout | 08 §3 |
| 5 | No outcome evidence, so nothing can be justified or pruned on data | VERIFIED | 07, 12 |
| 6 | Signals that mislead: "cost" that is not cost, a "block" that does not block and is probably never shown to the model | VERIFIED; visibility DOCUMENTED | 07 |
| 7 | Release state on main: no pinned release, no signatures, no branch protection on the stated root of trust | VERIFIED | 06 |
| 8 | Memory lint accepts paraphrase and look-alike classes, and skips silently without the CLI | VERIFIED — R1 9 | 09 |
| 9 | Agent `memory:` scopes grant write tools to 21 agents that do not declare them | VERIFIED count; DOCUMENTED host behaviour | 05, 08 |
| 10 | Per-host claims: lifecycle table overstates Claude, misstates Codex, understates Cursor; undocumented Cursor switch downgrades its gates | VERIFIED | 06 |

## Opportunities

- **Cheap hardening** that needs no new component: narrower pre-approved permissions,
  fail-closed hook configuration on supporting host versions, protection of the control plane.
- **Delegation to the host** for what it does better: sandbox and deny rules as the boundary,
  native telemetry as the source of cost and usage.
- **A deterministic enforcement suite** (E8) that would have caught every bypass listed above
  and costs almost nothing to run.
- **A first-week evaluation slice** (about $400 by the plan's own assumed figures) that
  produces the first real answer to H1.

## Not properties of the shipped kit

Found on this machine and excluded from the risk table: a local untracked override that
switches the contract gate off; a user-global toolkit whose rules contradict MeowKit's and
whose agents share eight names with it; a third-party plugin that injected mandatory-voiced
instructions into this session repeatedly; a skill listing in which most MeowKit
descriptions were dropped because the budget is shared with every installed toolkit; the CLI
absent from PATH. They are evidence that coexistence is a real operating condition and that
nothing in MeowKit detects it (06 §6).

## How this research corrected itself

- The README's component counts were right; the lead's early flag was retracted.
- "The plan gate fails closed" was narrowed: not when the entry script itself is broken.
- "Forged approval" was re-read as a documented design limit; the new part is the
  pre-approved command.
- "MeowKit's skill listing overflows" was found to be machine-dependent.
- "Multi-agent trails single-agent" was downgraded to hypothesis after the citation audit.
- The host's plugin-eval tool turned out to be unusable for flat-copy installs.
- The checkout moved from `fc278b31` to `c7ff0a9e` mid-research; findings were re-baselined
  and the two-CLI question became moot.

## Coverage — what was examined

| Area | Extent |
| --- | --- |
| MeowKit | hooks, rules, settings (traced and executed in scratch copies); 128 skills inventoried by script, core skills partly read; 42 agents; Rust CLI and three provider bundles; memory, telemetry and tests |
| Local harnesses | deepseek-harness `39163dd3`, qwen-code `9d390e23`, hermes-agent `4b86af50`, rig `8c1a2e19` — source read, nothing run, coverage partial and itemised in D06/D07 |
| Other hosts | Codex, Gemini CLI, OpenCode, Pi at source (shallow clones); Goose and Aider partly; Claude Code and Cursor from documentation only |
| Course and skills | learn-harness-engineering `a9342ff4`, a public skills repository `5863806d` |
| Literature | 47 arXiv papers, four CVEs and the vendor pages opened at the primary source by a separate auditor; none fabricated, several numbers corrected |
| Executed | hook replay with and without the local override, memory-note lint, density selection, an offline plugin-delivery install, config-toggle trial, hook unit tests, one full test run on the earlier commit |

## Not covered

- No controlled experiment was run. All of 12 is design.
- No live Codex or Cursor run; no Windows; no Rust `upgrade` trial.
- `validate --memory` was not run on main.
- Hook timeout, missing-`node` behaviour, and guard reach on other edit tools were not tested live.
- 103 skills were classified from metadata and counts only.
- Vendor system cards and one author's articles were not read.
- Copilot, Windsurf, Cline and Amp were not studied.

## Unresolved questions

1. Should the audit baseline stay on `main`, or be pinned to the branch the research started on?
2. Are the Gate 1 exceptions to be implemented or retracted?
3. Is the contract gate meant to apply outside full-density autobuild?
4. Should a budget ever stop work?
5. Is committed team memory still the intent, given the kit must ship with the store empty?
6. Does the maintainer want "cannot be bypassed" kept as emphasis for the model, or reworded?
7. What release-integrity level is intended beyond a same-release checksum?

## Reading order

`02` for what MeowKit is; `08` and `05` for what to fix; `12` for how to find out what works;
`13` for the order; `11` for the decisions that need the maintainer. Raw evidence is in
`findings/`, with `R1` and `R2` overriding the domain files where they differ.
