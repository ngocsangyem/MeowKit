# How much of the Codex bundle mechanical rules reproduce

Measured 2026-11-17 at `4ca8bbb7` with `measure-source-vs-codex-bundle.py` (this folder). Scope: the Markdown bodies of the 119 skills both trees hold (803 files), frontmatter excluded, blank lines ignored.

## Result

| Rule set | Files identical to the bundle | Files that differ |
|---|---:|---:|
| 3 rules: `/mk:x` → `$mk-x`, `mk:x` → `mk-x`, `.claude/skills/<s>/` → `.agents/skills/mk-<s>/` | 355 (44%) | 448 |
| + 8 rules: `${CLAUDE_SKILL_DIR}` → own skill path, `$CLAUDE_PROJECT_DIR` → `$(git rev-parse --show-toplevel)`, `.claude/hooks/lib/` → `.codex/scripts/bin/`, `.claude/` → `.codex/`, `CLAUDE.md` → `AGENTS.md`, `Claude Code` → `Codex`, `subagent` → `sub-task` | 436 (54%) | 367 |

Not in either tree's pair: 40 source Markdown files with no bundle port, and 4 skills (`arch`, `breakdown`, `delegate`, `status`).

## What is left in the 367 files (about 1,590 changed lines, 670 source lines dropped, 130 bundle lines added)

| Cluster | Lines (approx.) | Kind |
|---|---:|---|
| `$mk-x` in the projection where the bundle says "the x skill": a reference, not an invocation | 140 | Rule: invocation form only inside a command; prose reference elsewhere |
| A bare skill name the bundle prefixes (`cook` → `mk-cook`) | 45 | Rule, from the skill list |
| `AskUserQuestion` reworded by hand ("ask the user", "by asking the user", "user question", …) | 200 | Not one rule: at least eight phrasings |
| `Agent` / `Task` / `subagent_type` → "delegate a sub-task" | 40 | Mostly rule, some hand phrasing |
| `ExitPlanMode` → "present the plan for approval" | 10 | Hand phrasing |
| Remaining `claude` → `codex` words (CLI name, lower case) | 150 | Rule with an allow-list |
| Script commands anchored to the skill path | 60 | Already a rule in `codex/rewrite.rs` (`root_anchor`) |
| A reference file path replaced by prose ("the risk checklist") because the file was not ported | 20 | Disappears once the file ships |
| `.claude/rules/<file>.md` → `AGENTS.md (<section>)` | 55 | Rule with a file-to-section table |
| Model tier words (`sonnet` → `STANDARD`) | 5 | Table |
| Sections dropped or added (step-file contract, advice checkpoints) | 800 | Hand edits; per-file decision |

Most-affected skills: autobuild, plan-creator, fix, ship, cook, agent-detector, plan-ceo-review.

## Reading

- Rules reach about half the files exactly and would reach most of the rest with five more rules.
- Two clusters are hand wording that no rule reproduces: the tool-name rephrasings (about 250 lines) and the dropped or added sections (about 800 lines, concentrated in a dozen workflow skills).
- Frontmatter is a separate question: every bundle description was rewritten by hand to fit the listing ceilings.

## After moving tool wording into the source (2026-11-17)

314 source lines in 126 files now carry the bundle's runtime-neutral wording ("ask the user" for `AskUserQuestion`, "delegate" for `Agent(subagent_type=…)`), each accepted only when projecting it forward gives exactly the bundle line. Files identical to the bundle: **484 of 803 (60%)**; 319 differ.

Left in source skill Markdown: 42 `AskUserQuestion` and 14 `subagent_type` mentions, in lines the bundle dropped, kept on purpose or did not pair one to one. Checks after the edit: `check-skills-portable`, `check-bundle-parity`, `check-skill-cross-refs`, `check-always-on-budget`, the skill contract suites and `npm test` (579 tests) pass. `check-instruction-criteria` reports the same 26 findings before and after the edit.

## After the remaining mechanical rules (2026-11-17)

Files identical to the bundle: **633 of 803 (79%)**; 170 differ. The script in this folder now holds every rule and prints the classes below.

Rules added, each kept only because it raised the count:

| Rule | Evidence |
|---|---|
| `mk:x` after a slash (`../mk:rubric/`) → `mk-x`; `../<skill>/` → `../mk-<skill>/` | Bundle folder names |
| `.claude/skills/<known skill>` → `.agents/skills/mk-<skill>`; any other `.claude/skills` → `.agents/skills` | Codex skill root (matrix §1) |
| `.claude/agents/<a>.md` → `.codex/agents/<a>.toml` | Codex agent format (matrix §1) |
| `.claude/rules/<file>.md` → `AGENTS.md (<section>)`, six-row table | Bundle `AGENTS.md` headings |
| `.claude/hooks/lib/skill-python.cjs` → `.codex/scripts/skill-python.cjs`; `.claude/hooks/lib/setup-workflow` → `mewkit setup` | Bundle text |
| `CLAUDE_PLUGIN_DATA` → `PLUGIN_DATA` | 32 of 32 mentions |
| `Claude` → `Codex`, `claude` → `codex` as a word; a `claude-<family>-<n>` model id → `<model-id>` | The bundle holds one `Claude` in 803 files |
| A `scripts/…` or `bin/…` path the skill has → `.agents/skills/mk-<skill>/…`, applied to both sides | `codex/rewrite.rs::root_anchor` does this at install for `<interpreter> <path>`; the bundle did the rest by hand |

Forms folded as equal, because the bundle uses both for the same source text: `$mk-x` and "the x skill" (236 and 188 uses); `sub-task`, `sub-tasks`, `subagents`.

What is left in the 170 files (678 paired lines, 668 source lines with no bundle line, 128 bundle lines with no source line):

| Class | Lines | Resolution |
|---|---:|---|
| Rewritten line | 284 | Per-file decision, with the unpaired lines |
| Small wording change | 144 | Per-file decision |
| Reference to one of the 40 files the bundle did not port | 104 | Gone once the file ships; the bundle replaced the path with prose |
| Model name in the source, tier word in the bundle | 52 | Source should name the tier (43 of them in `agent-detector/references/model-selection.md`) |
| Env file: `.meowkit/.env` in the source, `.codex/.env` in the bundle | 32 | Open: `load-dotenv.cjs` reads `.meowkit/.env` then `.claude/.env`; no loader for `.codex/.env` found in the bundle |
| Rule-file reference reworded by hand | 21 | Per-file decision |
| Tool name still in the source | 20 | Per-file decision |
| Path anchored by hand (`references/…`, `prompts/…`) | 17 | Rule only if Codex needs it for files it reads, not runs |
| Environment variable | 4 | See defects |

43 of the 160 files with paired differences have no hand wording at all: they differ only by unported-file references, tier words, env file or anchoring.

## Bundle defects found on the way (projection must not reproduce them)

- `mk-autobuild/SKILL.md:143` links `references/agent-teams-vs-sub-task.md`; the file is `agent-teams-vs-subagents.md`. Same file: "## sub-task (Default)", "sub-task are correct" (a blind `subagents` → `sub-task`, 64 lines across the bundle).
- `mk-agent-detector/SKILL.md:30-32` lists `AGENTS.md (Security)`, `(Data & injection boundary)`, `(Gates)` against `meowkit-core`, `security-rules`, `injection-rules`: shifted by one, and `AGENTS.md` has no "Gates" heading.
- `mk-agent-detector/references/team-mode.md:3`: "`the project environment=1` is enabled" (was `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`); the same phrase replaces `CLAUDE_MODEL` and `CLAUDE_PROJECT_DIR` in two more files.
- `mk-tech-graph/.../svg-layout-best-practices.md:76`: "Style-6: Codex Official Warm" (a style name, renamed by the word rule). The word rule needs an allow-list for proper names.
- `docs-finder` commands are left as `node scripts/x.js` while `multimodal` ones are anchored by hand; the installer anchors both.

## The rules as Rust (2026-11-17)

`crates/mewkit-adapters/src/projection/` implements the rules above for skill Markdown bodies; `tests/projection_matches_codex_bundle.rs` projects the 803 files and compares them with the bundle: **633 identical, 170 differing**, the same figures as the script. The test fails when more than 170 files differ, so a rule change cannot silently break a file that matched. It replaces the planned `scripts/compare-projection-to-bundle.cjs`.

One rule was not carried over: `subagent` → `sub-task`. `.claude/kit-capabilities.json` gives Codex's wording as "delegate to a subagent", and the bundle's `AGENTS.md` heading is "Delegation & subagents"; the comparison folds both nouns, and the script now matches the engine.

Not in the engine yet: frontmatter, tool wording from `kit-capabilities.json`, agents, overlays, the proper-name allow-list for the host word, Cursor.

## Review of the differing files (2026-11-17)

One more rule (drop the source note about prefixing script paths by hand) brings the figure to **636 identical, 167 differing**; the test ceiling is 167. The differences are grouped, with a status and a proposal each, in `docs/maintainer/projection-divergences.md`: six settled classes, eight bundle defects, eight open rows for the maintainer. `packages/docs/docs-reference-manifest.json` was regenerated: its source hashes follow the skill text changed earlier on this branch.

## After the maintainer's decisions (2026-11-18)

The eight open rows were decided as proposed and applied to the source: **646 identical, 158 differing** (804 files, `cook/references/advice-checkpoints.md` is new). Test ceiling 158. `scripts/bundle-parity-allow.json` lost ten keys that are now in step and gained one reason (seven keys) for the routing section the source keeps. Checks: `cargo test --workspace` (49 binaries), `npm test` (579), `check-instruction-criteria --baseline`, `check-bundle-parity`, `check-skills-portable`, `check-skill-cross-refs.sh`, `check-always-on-budget` pass.

## Frontmatter, agents, overlays and Cursor (2026-11-18)

The engine now projects whole trees (`projection::project_tree`): skill frontmatter, agents as Codex TOML or Cursor Markdown, and a per-runtime overlay (`kit/overlays/<runtime>/overlay.toml`: keys with no authored counterpart, passages to replace, paths to omit; `files/` for whole files). `tests/projection_matches_bundles.rs` replaces the Codex-only test and holds one limit per figure.

| Compared | Codex | Cursor |
|---|---|---|
| Skill bodies | 643 identical, 161 differ | 560 identical, 244 differ |
| Skill frontmatter keys | match | match |
| Skill descriptions reworded by hand | 110 of 123 | 110 of 123 |
| Agent keys | match | match |
| Agent descriptions, prompts reworded by hand | 27, 36 of 41 | 41, 41 of 41 |

Codex bodies went 646 → 647 (source rewording) → 643: six files now differ because projection keeps a proper name the bundle renamed, two more match because links follow reworded headings. The script in this folder holds the same rules and prints the same 643 and 161.

Criteria on the projected trees (written with `MEWKIT_PROJECT_TO=<dir>`, checked with `check-instruction-criteria.cjs <dir>/<runtime>`): A9, A10, A11 and A13 clean on both; A12 shows the source's 16 baselined findings. Before the last source rewording and the overlay, Codex had 17 A9 and 2 A10 findings.

Not Markdown: of 193 skill text files both trees hold, 105 are byte-identical and 60 differ in content; projection copies them unchanged. Open rows 9 to 15 are in `docs/maintainer/projection-divergences.md`.

## Rows 9 to 15 decided; scripts projected (2026-11-18)

The maintainer took every open row as proposed. Applied: a rule that names the main session where a runtime loads no `orchestrator` agent (Codex agents: 25 descriptions and 34 prompts still reworded by hand, from 27 and 36), an overlay line for the pull-request trailer, and path rules for skill files that are not Markdown (`projection/script.rs`).

| Text files that are not Markdown (188 both trees hold) | Codex | Cursor |
|---|---:|---:|
| Byte-identical to the bundle | 109 | 108 |
| Formatting only | 4 | 4 |
| Differ on lines with no path | 35 | 36 |
| Differ on a path line | 40 | 40 |

Before the rules, 105 files were identical on Codex. The figure moves little because most differences are the bundle's own rewrites (env file location, guards made self-contained, reformatted JavaScript), each listed in `docs/maintainer/projection-divergences.md` under "Scripts". All 142 scripts in each projected tree parse (`bash -n`, `node --check`, Python parse, JSON load). Skill bodies are unchanged at 643 and 161 (Codex), 560 and 244 (Cursor); criteria A9, A10, A11 and A13 stay clean on both trees.

Open: row 15 and the helper files the bundles do not ship, both waiting for the emitters.

