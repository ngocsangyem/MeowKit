# Projection divergences — Codex and Cursor

Where projecting `.claude/` by rule does not give the hand-ported bundles, and what happens to each difference. Taken 2026-11-17, extended 2026-11-18; reproduce with `cargo test -p mewkit-adapters --test projection_matches_bundles -- --nocapture` and, for Codex skill bodies line by line, `docs/plans/261117-single-source-runtime-adapters/research/measure-source-vs-codex-bundle.py`.

| Compared | Codex bundle | Cursor bundle |
|---|---|---|
| Skill Markdown bodies both trees hold (804) | 643 identical, 161 differ | 560 identical, 244 differ |
| Skill frontmatter keys (123 skills) | all match, one kept from the source | all match, one kept from the source |
| Skill descriptions | 13 identical, 110 reworded | 13 identical, 110 reworded |
| Agent keys (41 agents) | all match | all match |
| Agent descriptions | 16 identical, 25 reworded | 41 reworded |
| Agent prompts | 7 identical, 34 reworded | 41 rewritten |
| Skill text files that are not Markdown (188) | 109 identical, 79 differ | 108 identical, 80 differ |

The sections below were written for Codex skill bodies (646 identical and 158 differing when the first eight rows were decided). "After the rest of the engine" at the end covers frontmatter, agents, overlays, Cursor and the files that are not Markdown.

The bundle side is deliberate, not stale: of the 167 files, the bundle copy was committed after the source copy in 121, in the same commit in 39, before it in 7.

Status values: **settled** (a rule or a fold handles it), **defect** (the bundle is wrong; projection keeps the source), **open** (the maintainer decides).

## Settled

| Difference | Lines | How |
|---|---:|---|
| `$mk-x` in one tree, "the x skill" in the other | 424 uses | Folded as equal. Projection writes the invocation form for a single-runtime root and the prose form for a shared root |
| `sub-task`, `sub-tasks`, `subagents` for the same source word | ~80 | Folded as equal. Projection keeps "subagent", the wording `.claude/kit-capabilities.json` gives for Codex |
| `scripts/…`, `bin/…` anchored by hand in some bundle files, not in others | ~60 | Projection anchors every helper path the skill ships |
| Source note "Script paths in this skill's other files … prefix them" | 12 | Dropped by rule: anchoring already did it |
| A path to one of the 40 files the bundle did not port, replaced there by prose ("the harness rules") | 104 in 60 files | Projection ships those files, so the path stays |
| `mk-status` assets pointed at `mk-autobuild` | 4 | The bundle lacks `status`, `arch`, `breakdown`, `delegate`; projection ships them |

## Defects in the bundle

| Where | What |
|---|---|
| `mk-autobuild/SKILL.md:143` | Links `references/agent-teams-vs-sub-task.md`; the file is `agent-teams-vs-subagents.md` |
| 64 lines, mostly `mk-autobuild/references/agent-teams-vs-subagents.md` | `subagents` replaced by singular `sub-task`: "sub-task are correct", "## sub-task (Default)" |
| `mk-agent-detector/SKILL.md:30-32` | Rule list shifted by one against the source, and names `AGENTS.md (Gates)`, a heading `AGENTS.md` does not have |
| `team-mode.md:3`, `workflow-discovery.md`, `trace-schema.md` | An environment variable name replaced by "the project environment" inside code quotes |
| `mk-orchestrate` (9 lines) | Invoked as `/orchestrate`, which is neither the Codex form nor the skill's name |
| `mk-tech-graph`, `mk-stitch`, `mk-retro`, `mk-context-audit` | The host word replaced inside a proper name or an identifier: "Codex Official Warm", `codex_desktop_config`, `codex_code`, `codex_md_tokens` |
| `mk-skill-template-secure/.../security-anchor-template.md` | `mk-scout` became `mk-cso` in an example row |
| `mk-benchmark/SKILL.md` | `mkdir -p .meowkit/telemetry` became `.meowkit/memory` |

The projection rule for the host word needs two things the bundle shows: an allow-list of proper names, and heading anchors recomputed from the projected heading (`#claudepacks-…` must follow `.codex/packs`).

## Decided 2026-11-17 (maintainer: every row as proposed)

| # | Difference | Decision | State |
|---|---|---|---|
| 1 | `--advice` supervision repeated in six skills | One protocol file, short per-skill files | Done in the source: `advise/references/advice-supervision-rules.md` holds "The call protocol"; `cook` has its own `references/advice-checkpoints.md`; the per-skill files keep a "Routing in this skill" section the bundle does not have, because it holds what each disposition means for that skill. Step-level triggers (`autobuild/step-02`, `step-05`, `cook/references/review-cycle.md`) stay in the source; the bundle dropped them |
| 2 | Model names against tier words | Source names tiers; pins per runtime | Done where it is wording: `agent-detector/references/model-selection.md` (tier tables with a pin column), `trace-analyze/references/error-taxonomy.md`, the cost comment in `autobuild/step-03-generate.md`. Not done, and not wording: autobuild's density detection reads the model id on Claude Code (`step-00-tier-detection.md`, `adaptive-density-matrix.md`, `workflow.md`, `SKILL.md`); the bundle removed it because Codex exposes none. That stays in the source and becomes a Codex overlay |
| 3 | Env file and cache location | One `.meowkit/.env` and `.meowkit/cache` for every runtime | Source already says so. The bundle scripts that read `.codex/.env` go with the bundle; projection ships the source scripts |
| 4 | `TaskCreate(…)` blocks | Source adopts the lists | Done: 27 hunks in `cook`, `fix`, `plan-creator`, `planning-engine`, `agent-detector` |
| 5 | Repository-only and hook wording | Neutral where true everywhere | Done for `careful`, `freeze`, `ship/SKILL.md`, one `plan-creator` example. Kept: lines about `workflow.yaml`, `validate.py`, `skill-python.cjs`, the co-author trailer and `budget-tracker.cjs`, which projection ships or which stay true |
| 6 | Rule-file references reworded by hand | Keep the rule's `AGENTS.md (<section>)` | No change |
| 7 | Small edits with no theme | Keep the source | No change |
| 8 | Step-file contract in `workflow.md` | Keep for every runtime | No change |

The passages the bundle's short `--advice` files had dropped (found by review against the committed text) are restored under each file's "Routing in this skill" section.

## After the rest of the engine (2026-11-18)

### Settled by rule or overlay

| Difference | How |
|---|---|
| Skill frontmatter: the bundles keep `name`, `description`, `requires_runtime` | Rule (`projection/frontmatter.rs`). `lint-and-validate` keeps `requires_runtime` from the source: the bundles dropped it with the Python scripts they did not port |
| Agent `model` | Rule: the tier table in `docs/maintainer/model-pins.md`, held in each target (41 of 41 match on both runtimes) |
| Codex `model_reasoning_effort`, `sandbox_mode`; Cursor `readonly`, `is_background`, `disable-model-invocation` | No authored counterpart: `kit/overlays/<runtime>/overlay.toml`, generated from the bundles |
| `orchestrator` agent, absent from both bundles | Overlay `omit`: the main session routes work on these runtimes |
| Model detection in `autobuild/step-00-tier-detection.md` (`CLAUDE_MODEL`, `ANTHROPIC_MODEL`) | Overlay `[[replace]]` on both runtimes: the report records `MEOWKIT_MODEL_HINT`. Nothing else is overlaid: `scripts/density-select.sh` already falls back to `STANDARD` with no model variable, so the matrix, `workflow.md` and `SKILL.md` stay true as authored (probe-log row P7) |
| `mk:[skill]`, `mk:<skill>`, `mk:{name}` placeholders | Rule: renamed like a skill name |
| A link to a heading that projection rewords (`#claudepacks-…`) | Rule (`projection/headings.rs`): the link takes the heading's new anchor; two more files match |
| 14 lines naming `AskUserQuestion`, `subagent_type` or "Task tool" in files the bundles did not port, and in three agents | Reworded in the source ("ask the user", "delegating"), as decided for the ported files |

After these, `node scripts/check-instruction-criteria.cjs <projected tree>` reports no A9, A10, A11 or A13 finding for either runtime; the 16 A12 findings are the 16 the source has in its baseline. Listing size: 9,493 chars for 127 skills on Codex (ceiling 12,000), 9,494 on Cursor (16,000).

### More defects in the bundles

| Where | What |
|---|---|
| `mk-ship/references/commit-push-pr.md:179` | The pull-request trailer links `https://codex.com/codex` |
| `mk-prompt-enhancer` (12 lines), `mk-brainstorming/references/edge-cases.md`, `mk-pack`, `mk-tech-graph` (4 files) | A source document, repository, website or diagram style renamed with the host word: `codex-prompting-best-practices`, `everything-codex`, `codex.ai`, "Codex Official". Projection keeps the names in `PROPER_NAMES` (`projection/host_words.rs`); six files differ from the bundle for this reason |
| `mk-skill-creator` (`SKILL.md`, `references/creation-workflow.md`, `scripts/init-skill.py`) | The template still writes `name: mk:{name}`, the Claude Code form |
| Cursor bundle, 68 skill files (170 mentions) | "Codex", most of them where the product is Cursor ("Codex's structured review") |
| Cursor bundle, about 100 lines | A kit helper called by bare name (`workflow-config set …`); the file is `.cursor/scripts/bin/workflow-config` and nothing puts that folder on `PATH` |
| Cursor bundle, rule references | Nine `AGENTS.md (<section>)` names, `Data & injection boundary` among them, that the Cursor `AGENTS.md` has no heading for; only `Ship check, security and compaction` exists |

### Decided 2026-11-18 (maintainer: every row as proposed)

| # | Difference | Decision | State |
|---|---|---|---|
| 9 | Skill `description`: 110 of 123 reworded by hand in each bundle, mostly to fold in the "when to use" hint that Claude Code reads from `when_to_use` | Keep the source description | No change. The listing is 9,493 chars on Codex (ceiling 12,000) |
| 10 | Codex agent prompts and descriptions: "orchestrator" → "main session", the status block reworded, script names dropped | Keep the source wording; a rule for the one word | Done: a target names what stands in for the `orchestrator` agent (`router` in `projection/target.rs`, "main session" on both runtimes), applied to agent descriptions and prompts as a whole word. `athena.md` now says "never routed by the orchestrator" so the word stands alone. Codex: 25 descriptions and 34 prompts still differ from the bundle, by the hand rewording that stays |
| 11 | Cursor agents: all 41 rewritten in the third person with an input contract | Project the authored prompt | No change; no whole-file overlays |
| 12 | Skill files that are not Markdown | Their own rules, paths only | Done, see "Scripts" below |
| 13 | Cursor wording for tools: `Grep` → "grep" or "search", `Glob` → "file-glob" (42 lines) | Keep the source | No change |
| 14 | The pull-request trailer `[Claude Code](https://claude.com/claude-code)` in `ship/references/commit-push-pr.md` | One overlay line per runtime | Done: `[[replace]]` in each overlay writes "Generated with Codex" and "Generated with Cursor", with no link (the bundles' `https://codex.com/codex` is not a real address) |
| 15 | Cursor rule references and helper paths | Wait for the always-on placement | Rule references done 2026-11-18: Cursor reads the shared `AGENTS.md` block, which has a heading for every `AGENTS.md (<section>)` a skill cites (test `every_rule_section_a_skill_can_cite_is_in_the_shared_block`). Helper paths settled 2026-11-20: the source names a helper by path (`.claude/hooks/lib/workflow-config …`), which projection points at each runtime's `scripts/bin/`; the ten command hints that named one bare were given the path |

### Scripts

Text files in a skill that are not Markdown (scripts, configuration, fixtures) get path rules only (`projection/script.rs`): the skills root and skill folders, `${CLAUDE_SKILL_DIR}`, agent files, the target's path map, any other `.claude/`, the folder as one quoted segment (`".claude"`), `CLAUDE_PLUGIN_DATA` (the name the skill's Markdown already uses), and a relative path that climbs out of the skills tree (`../../../hooks/lib/x.cjs`), which is resolved, mapped and written from where the file installs. Words, skill names and identifiers stay as authored. A file that is not UTF-8 is carried unchanged.

Measured against the bundles, byte for byte, over the 188 text files both trees hold:

| | Codex | Cursor |
|---|---:|---:|
| Identical | 109 | 108 |
| Differ by formatting only (quotes, indentation) | 4 | 4 |
| Differ on lines with no path | 35 | 36 |
| Differ on a path line | 40 | 40 |

Every script in both projected trees still parses: 142 `.sh`, `.cjs`, `.js`, `.py` and `.json` files checked with `bash -n`, `node --check`, a Python parse and a JSON load, the same count and result as the source.

What the path lines are:

| Difference | Paired lines (Codex) | Status |
|---|---:|---|
| Env file and cache: `.meowkit/.env`, `.meowkit/cache` in the source, `.codex/.env`, `.codex/cache` in the bundle | 22 | Settled by row 3: one location for every runtime |
| Rubrics: `mk-rubric/rubrics` in the projection, `.codex/rubrics` in the bundle | 5 | Projection keeps rubrics in the skill; the Markdown says the same |
| `${CLAUDE_PROJECT_DIR:-$(pwd)}` in the source, `git rev-parse` in the bundle | 11 of 13 source lines | Kept: every use falls back to the working directory |
| A skill name in a message a script prints (`/mk:jira-issue create`), reworded in the bundle | 22 of 138 source lines naming a skill | Kept as authored. A name rule here would also rewrite patterns (see the defect below); the messages show the Claude Code form on other runtimes until a rule limited to string output exists |
| Guards rewritten self-contained in the bundle (`careful`, `freeze`, `investigate`, `autobuild` scripts) | 4 files | Projection ships the source scripts, which load kit helpers; see the next table |

The helpers a skill script or Markdown file names under `.claude/hooks/lib/`, and where the projected text now points. The emitter has to place each one there, or the row has to change with the placement (Phase 4 and 5):

| Helper | Named in | Projected to | In the bundles today |
|---|---:|---|---|
| `workflow-config`, `workflow-diff-scope`, `workflow-repo-mode`, `workflow-review-log`, `workflow-slug` | 3 to 16 files each | `<host>/scripts/bin/` | there |
| `skill-python.cjs` | 24 files | `<host>/scripts/` | there |
| `project-root.cjs`, `validate-content.cjs` | 3 and 1 files | `<host>/hooks/lib/` | there |
| `config-get.cjs`, `density-lookup.cjs`, `injection-audit.cjs`, `parse-stdin.cjs`, `secret-scrub.cjs` | 1 to 5 files each | `<host>/scripts/bin/` | not shipped |
| `.claude/eval/track-m-adapter-core.cjs` (two eval runners) | 2 files | `<host>/eval/` | not shipped |

One source line changed so the rules reach it: `web-to-markdown/scripts/persist_fetch.py` builds the path of `injection-audit.cjs` from one string instead of four segments. With the path left at `.claude`, a missing auditor made every fetch on another runtime count as critical.

More defects in the bundles, in scripts:

| Where | What |
|---|---|
| `mk-story-sizer/scripts/*.py` (3 files), `mk-markdown-reader/scripts/server.cjs` | An environment variable name replaced by "the project environment" inside code: `os.environ.get("the project environment", …)`, `process.env.the project environment` (the second does not parse) |
| `mk-prompt-enhancer/eval/run-canaries.cjs` | A pattern rewritten by the name rule: `/mk:prompt-enhancer` became `\the prompt-enhancer skill` |
| `mk-docs-finder/scripts/fetch-web-to-markdown.js` | Calls `.agents/skills/web-to-markdown/…`; the folder is `mk-web-to-markdown` |
| `mk-brainstorming`, `mk-prompt-enhancer` eval runners (Codex) | `require("../../../eval/…")` kept from the source; from `.agents/skills/mk-x/eval/` that is `.agents/eval/` |
| `mk-story-sizer/scripts/check-auto-create-gating.py`, `mk-web-to-markdown/scripts/persist_fetch.py` | Point at `.codex/scripts/injection-audit.cjs`, a file the bundle does not ship |
| `mk-context-audit` scripts | Field and function names renamed with the host word (`codex_md_chain`) |

### Closed on 2026-11-20

Nothing is open. The three rows that were:

| # | Difference | How it closed |
|---|---|---|
| 15 | Cursor helper paths: a kit helper called by bare name, with nothing putting `.cursor/scripts/bin` on `PATH` | The bundle wording is not followed. The source names every helper it runs by path under `.claude/hooks/lib/`, and the path rule rewrites that to the runtime's `scripts/bin/`. Ten command hints in skill references named `workflow-config` bare, on Claude Code too; they now carry the path. The three bare mentions left name the helper in prose and are followed by the command |
| — | The helpers and the eval core the bundles did not ship | Every helper path the projected text names exists after an install: 1,342 references under `.codex`, `.cursor`, `.grok`, `.omp`, `.pi` and `.agents` in a six-runtime install, none missing (2026-11-20). `parse-stdin.cjs` and the `core/hook-payload.cjs` it loads were the last ones absent; `scripts/sync-hook-core.cjs` now copies them to each `scripts/bin/`, and the `careful`, `freeze` and `investigate` guard scripts run from the projected trees. `.claude/eval/track-m-adapter-core.cjs` is not shipped and not needed: the two eval runners that load it are under `eval/`, which the ship set leaves out |
| — | Skill names in messages scripts print | Kept as authored, by the maintainer's decision of 2026-11-18 that scripts get path rules only. A name rule would also rewrite patterns (the defect below), so these 22 lines show the Claude Code form (`/mk:jira-issue create`) on other runtimes |

