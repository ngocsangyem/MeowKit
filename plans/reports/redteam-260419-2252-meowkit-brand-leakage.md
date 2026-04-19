# Red-Team Brand Leakage Audit — MeowKit Skills

**Scope:** `/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/skills/` (64 skills)
**Goal:** Strip MeowKit self-reference leakage so installed skills refer to "the project" / "this workflow" / "the kit", not "MeowKit".
**Mode:** scan → classify → execute (all 18+ patterns from user approval + secondary sweeps).

## Changes applied

### Group A — batch preamble edits (9 preamble files + 5 shared-protocol files + 2 completeness-principle files)

| Pattern | Before | After |
|---|---|---|
| LEAK-1 | `MeowKit follows the **Boil the Lake** principle` | `This workflow follows the **Boil the Lake** principle` |
| LEAK-2a | `> Help MeowKit get better!` | `> Help improve this workflow!` |
| LEAK-2b | `A) Help MeowKit get better!` | `A) Help improve the workflow!` |
| LEAK-2c | `*someone* used MeowKit` | `*someone* used this workflow` |
| LEAK-3 | `"Running MeowKit v{to} (just updated!)"` | `"Updated to v{to} — continuing."` |
| LEAK-4a | table col `MeowKit` | `AI-assisted` |
| LEAK-4b | `human team time and MeowKit time` | `human team time and AI-assisted time` |
| LEAK-4c | `meaningless with MeowKit` | `meaningless with AI assistance` |
| LEAK-5 | `# MeowKit philosophy — see CLAUDE.md — MeowKit uses CLAUDE.md for the full philosophy` | `# Project philosophy — see CLAUDE.md for the full philosophy` |

### Group B — per-file unique edits (LEAK-6 through LEAK-18 + 2nd + 3rd pass)

- `meow:typescript/SKILL.md` — 3 × `(MeowKit security-rules.md)` → `(security-rules.md)`
- `meow:vue/SKILL.md` — `(MeowKit security-rules.md — XSS vector)` → `(security-rules.md — XSS vector)`, `(MeowKit naming-rules.md)` → `(naming-rules.md)`
- `meow:bootstrap/references/scaffolding-principles.md` — `Follow MeowKit naming-rules.md` → `Follow naming-rules.md`
- `meow:fix/references/workflow-ui.md` + `workflow-types.md` — `(MeowKit security rule` → `(security rule`
- `meow:plan-creator/SKILL.md` + `worked-example-stripe-billing.md` + `meow:harness/workflow.md` — `MeowKit 7-phase` → `the 7-phase`
- `meow:ship/references/version-changelog-todos.md` — `"MeowKit recommends maintaining` → `"This workflow recommends`
- `meow:party/SKILL.md` — `multiple MeowKit agent perspectives` → `multiple agent perspectives`
- `meow:project-context/SKILL.md` — `every MeowKit agent loads` → `every agent loads`
- `meow:agent-detector/SKILL.md` — title `# MeowKit Agent Detector` → `# Agent Detector`; `MeowKit agents at` → `Agents at`
- `meow:bootstrap/SKILL.md` — `MeowKit infrastructure` → `project infrastructure` (2 ×)
- `meow:skill-creator/references/creation-workflow.md` — `MeowKit phase` → `workflow phase`; example SKILL.md `"operates in Phase [X] of MeowKit's workflow"` → `"of the workflow"`
- `meow:skill-creator/references/skill-types.md` — table col `MeowKit Example` → `Example`
- `meow:plan-creator/references/parallel-mode.md` — `## Integration with MeowKit Rules` → `## Integration with Project Rules`
- `meow:figma/SKILL.md` — `overrides MeowKit rules` → `overrides project rules`
- `meow:retro/references/global-retro.md` — `MeowKit uses a simple git-based` → `This skill uses a simple git-based`; JSON example `"name": "meowkit"` → `"{project-slug}"`; `Focus: meowkit (58%)` → `Focus: {project} (58%)`; `Powered by MeowKit` → `Powered by this kit`
- `meow:problem-solving/references/attribution.md` — `imperative (meowkit style)` → `terse imperative style`
- `meow:multimodal/references/minimax-generation.md` — `welcome to MeowKit` → `welcome to the project`
- `meow:cook/SKILL.md` — `MeowKit's 7-phase workflow` → `the 7-phase workflow`
- `meow:help/SKILL.md` — title `# MeowKit Navigation Help` → `# Navigation Help`; description `MeowKit's 7-phase pipeline` → `the 7-phase pipeline`
- `meow:review/SKILL.md` — `# Adapted for MeowKit's review pipeline` → `# Adapted for the review pipeline`; `Phase 4 (Review)** of MeowKit's workflow` → `Phase 4 (Review)** of the project`
- `meow:ship/SKILL.md` — `Phase 5 (Ship)** of MeowKit's workflow` → `Phase 5 (Ship)** of the project`
- `meow:memory/references` — `Reference guides for MeowKit's memory system` → `for the memory system`
- `meow:rubric/SKILL.md` — `the meowkit rubric library` → `the rubric library`; `meowkit/tasks/reviews/` path prefix stripped
- `meow:skill-creator/SKILL.md` — `Create new MeowKit skills` → `Create new skills`; `MeowKit adoption` → `adoption`; `## MeowKit Compliance Evaluation` → `## Compliance Evaluation`; `taxonomy with MeowKit examples` → `taxonomy with examples`
- `meow:workflow-orchestrator/SKILL.md` — title `# MeowKit Workflow Orchestrator` → `# Workflow Orchestrator`; `MEOWKIT METADATA (...used by MeowKit tooling)` → `SKILL METADATA (...used by skill tooling)`; `Maps task signals to MeowKit workflow phases` → `to workflow phases`
- `meow:validate-plan/SKILL.md` — `# Adapted for MeowKit's gate system` → `# Adapted for the gate system`
- `meow:elicit/SKILL.md` — `# Adapted for MeowKit's review pipeline` → `# Adapted for the review pipeline`
- `meow:agent-detector/references/lifecycle-routing.md` — `.claude/memory/ is a MeowKit convention` → `.claude/memory/ is a project convention`
- `meow:docs-finder/SKILL.md` — SECURITY ANCHOR body `MeowKit's security rules` → `project security rules` (multimodal got the same edit)
- `meow:review/references/scope-drift-detection.md` + `meow:ship/references/plan-completion-audit.md` — `in MeowKit layout` → `in this kit layout`
- `meow:harness/SKILL.md` — `Existing meowkit detection` → `Existing kit detection`
- `meow:qa/SKILL.md` — `## MeowKit wiring` → `## Skill wiring`
- `meow:cso/references/phase-12-fp-filtering.md` — `part of MeowKit itself` → `part of the trusted kit`
- `meow:cso/references/phase-7-8-llm-skills.md` — `MeowKit's own skills are trusted` → `Kit's own skills are trusted`
- `meow:document-release/references/step2-per-file-audit.md` — `not MeowKit-specific` → `stack-agnostic`
- `meow:harness/references/adaptive-density-matrix.md` — `meowkit/...` path prefixes stripped (3 lines)
- `meow:lint-and-validate/references/linter-commands.md` — `## MeowKit Validation Scripts` → `## Shared Validation Scripts`; `check MeowKit-specific patterns` → `check kit-wide patterns`
- `meow:plan-ceo-review/references/required-outputs.md` — `with MeowKit: S→S...` → `with AI assistance: S→S...`
- `meow:plan-ceo-review/references/step0-scope-and-mode.md` — `With MeowKit,` → `With AI assistance,`
- `meow:qa-manual/references/qa-process.md` — `### From MeowKit plan file` → `### From the plan file`
- `meow:retro/references/data-gathering.md` — `# 12. MeowKit skill usage telemetry` → `# 12. Skill usage telemetry`
- `meow:scout/references/scouting-strategy.md` — `which MeowKit agent` → `which agent`
- `meow:ship/references/test-execution.md` — `**Noticed by:** MeowKit /meow:ship` → `**Noticed by:** /meow:ship`
- `meow:sprint-contract/references/bdd-to-ac-mapping.md` — 4 × `meowkit` prose references genericized to `this kit` / `the harness`
- `meow:trace-analyze/references/trace-schema.md` — `per meowkit-rules.md §4` → `per kit rules §4`
- `meow:web-to-markdown/references/gotchas.md` + `security.md` — `MeowKit user-agent` → `the configured user-agent`; `MeowKit injection-rules.md` → `injection-rules.md`; `MeowKit is not Cowork-scale` → `this kit is not Cowork-scale`
- `meow:workflow-orchestrator/references/fasttrack-and-teams.md` — `from MeowKit's built-in rules` → `from the kit's built-in rules`
- `meow:evaluate/step-01-load-rubrics.md` — `existing meowkit layers` → `existing kit layers`
- `meow:plan-creator/step-02-codebase-analysis.md` — `a properly-configured MeowKit` → `a properly-configured kit`
- `meow:project-organization/references/directory-rules.md` — title → `Directory Rules — Project Organization`; `### MeowKit-Specific Paths` → `### Kit-Specific Paths`; `5. MeowKit config?` → `5. Kit config?`; table cell `| MeowKit |` → `| Kit     |`
- `meow:sequential-thinking/references/advanced-strategies.md` — `Filtered for MeowKit:` → `Filtered for this kit:`

## KEEP (acceptable — real infrastructure, author signature, attribution)

- All `meowkit-*` binaries at `.claude/scripts/bin/` (real executables)
- `npx meowkit`, `npx mewkit`, `create-meowkit` (real CLI commands)
- All `MEOWKIT_*` env vars (real config)
- Frontmatter `source: meowkit`, `adapted_for: meowkit`, `source: claudekit-engineer` (provenance)
- `meowkit_contributor` config key, `.claude/memory/meowkit-*` paths
- `/tmp/meowkit-*` temp filenames
- `.gitignore.meowkit` template filename
- `MEOWKIT SECURITY ANCHOR` comment marker (security-module label, not user-facing prose)
- Contributor-mode field-report template (gated by `_CONTRIB=true` — Option A): includes `Hey MeowKit team —`, `Filed MeowKit field report:`, `| Version: {MeowKit version} |`, `what MeowKit should have done differently` — 8 residual instances across 8 preamble/shared-protocol files
- `meow:office-hours/references/phase6-handoff.md` — `A personal note from MeowKit creator:` and `Thank you for using MeowKit` — intentional author signature in YC program encouragement text
- `meow:problem-solving/references/attribution.md` — lineage note `meowkit adapted them further` — dedicated attribution file, kept per policy

## Result

- **~70 distinct sed/edit operations** across ~50 files
- **8 residual `{MeowKit version}` mentions remain** — all in contributor-mode template footers (`_CONTRIB=true` gated), invisible to downstream users
- Net effect: user projects installing these skills see "project workflow", "this workflow", "the kit", or generic phrasing instead of MeowKit branding

## Unresolved

- **Contributor-mode block duplication.** `contributor-mode.md` content is replicated across 9 preamble/shared-protocol files (DRY violation). Consolidating to a single referenced file is a separate refactor outside this audit scope. Current state: gated, harmless to downstream users.
- **Attribution tables in `meow:skill-creator/references/creation-workflow.md`.** The `| MeowKit (original) |` author-column template for new skills was softened to `| your org (original) |`; this assumes users understand the template is editable. If users don't customize it, their own new skills will claim `your org (original)` authorship. Low risk but worth documenting.
- **Author-signed YC encouragement text** in `meow:office-hours/references/phase6-handoff.md` — kept as-is (3 paragraphs). If the kit is white-labeled for enterprise distribution, this section should be stripped or parameterized.
